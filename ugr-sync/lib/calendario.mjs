// Calendario de Moodle (/calendar/view.php?view=upcoming&course=ID): es la lista
// que ve el alumno. Ahí están las clases sincrónicas y los vencimientos, con la
// fecha en hora de Argentina.
import { load } from 'cheerio';
import { coincidirNombreTarea } from './normalizar.mjs';
import { parsearTimestampMoodle } from './normalizar.mjs';

const ZONA_CAMPUS = 'America/Argentina/Buenos_Aires';

function limpiarTexto(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function partesHora(timestamp) {
  const numero = Number(timestamp);
  if (!Number.isFinite(numero)) return null;
  const ms = numero < 1e11 ? numero * 1000 : numero;
  const fecha = new Date(ms);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_CAMPUS,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(fecha);
  const tomar = (tipo) => partes.find((parte) => parte.type === tipo)?.value || '';
  const dias = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    dia: dias[tomar('weekday')] || null,
    hora: `${tomar('hour')}:${tomar('minute')}`
  };
}

export function extraerEventosCalendario(html) {
  if (!html) return [];
  const $ = load(html);
  const eventos = [];
  const vistos = new Set();

  $('[data-type="event"]').each((_, el) => {
    const nodo = $(el);
    const titulo = limpiarTexto(nodo.find('h3.name').first().text());
    const stamps = nodo.find('span.date[data-timestamp]').map((__, span) => $(span).attr('data-timestamp')).get().filter(Boolean);
    if (!titulo || stamps.length === 0) return;
    const clave = `${titulo}|${stamps[0]}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    const cuando = partesHora(stamps[0]);
    const cierre = stamps[1] ? partesHora(stamps[1]) : null;
    const enlace = nodo.find('a[href*="/mod/"], a[href*="zoom.us"], a[href*="zoom"]').not('[href*="calendar/view.php"]').first().attr('href') || '';
    eventos.push({
      titulo,
      fecha: parsearTimestampMoodle(stamps[0]),
      horaInicio: cuando?.hora || null,
      horaFin: cierre?.hora || null,
      dia: cuando?.dia || null,
      url: enlace
    });
  });

  $('a[data-action="view-event"]').each((_, el) => {
    const enlace = $(el);
    const titulo = limpiarTexto(enlace.attr('title') || enlace.find('.eventname').text());
    const dia = enlace.parents().filter((_, nodo) => $(nodo).attr('data-day-timestamp')).first();
    const stamp = dia.attr('data-day-timestamp');
    if (!titulo || !stamp) return;
    const clave = `${titulo}|${stamp}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    const cuando = partesHora(stamp);
    eventos.push({
      titulo,
      fecha: parsearTimestampMoodle(stamp),
      horaInicio: null,
      horaFin: null,
      dia: cuando?.dia || null,
      url: enlace.attr('href') || ''
    });
  });

  return eventos.filter((evento) => evento.fecha);
}

export function timestampsDeMesesDelPeriodo(anio, cuatrimestre) {
  const meses = Number(cuatrimestre) === 2 ? [7, 8, 9, 10, 11] : [2, 3, 4, 5, 6];
  return meses.map((mes) => Math.floor(Date.UTC(Number(anio) || new Date().getFullYear(), mes, 1) / 1000));
}

// «Vencimiento de X», «Se cierra X» y «X pendiente» son la fecha de una
// actividad, no una clase nueva. «Clase sincrónica…» sí es un evento propio.
export function esRecordatorioDeActividad(titulo) {
  const t = limpiarTexto(titulo);
  return /^(?:vencimiento de|se abre|se cierra)\b/i.test(t) || /\s(?:pendiente|cierra|abre)$/i.test(t);
}

export function nombreActividadDeEvento(titulo) {
  return limpiarTexto(titulo)
    .replace(/^(?:vencimiento de|se abre|se cierra)\s+/i, '')
    .replace(/^cuestionario:\s+/i, '')
    .replace(/\s+(?:pendiente|cierra|abre)$/i, '')
    .trim();
}

export function campoFechaDeEvento(titulo) {
  const t = limpiarTexto(titulo);
  if (/^(?:se abre)\b/i.test(t) || /\sabre$/i.test(t)) return 'inicio';
  return 'fin';
}

const DURACION_CLASE_MINUTOS = 90;
const DIAS_DE_CLASE = [
  ['lunes', 1],
  ['martes', 2],
  ['miercoles', 3],
  ['jueves', 4],
  ['viernes', 5]
];

function sinAcento(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function armarHora(hora, minutos) {
  const h = Number(hora);
  const m = Number(minutos || 0);
  if (!Number.isInteger(h) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function horaMasMinutos(hora, minutosSumar) {
  const [h, m] = String(hora || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = h * 60 + m + minutosSumar;
  return armarHora(Math.floor(total / 60) % 24, total % 60);
}

function minutosEntre(inicio, fin) {
  const [ha, ma] = String(inicio || '').split(':').map(Number);
  const [hb, mb] = String(fin || '').split(':').map(Number);
  if (![ha, ma, hb, mb].every(Number.isFinite)) return null;
  let delta = (hb * 60 + mb) - (ha * 60 + ma);
  if (delta < 0) delta += 24 * 60;
  return delta;
}

// El horario de verdad está escrito en el enlace («lunes de 17 hs a 18.30»,
// «miércoles a las 19 Hs»). La clase dura siempre una hora y media.
export function horarioDeclaradoEnTitulo(titulo) {
  const texto = String(titulo || '');
  const plano = sinAcento(texto);
  const dia = DIAS_DE_CLASE.find(([nombre]) => plano.includes(nombre))?.[1] || null;
  if (!dia) return null;
  const rango = texto.match(/(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*h(?:s|oras)?\.?\s*(?:a|hasta|-|–)\s*(\d{1,2})(?:\s*[:.]\s*(\d{2}))?/i);
  const suelto = texto.match(/a\s+las\s+(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*h/i);
  const juntoAlDia = texto.match(/(?:lunes|martes|mi[eé]rcoles|jueves|viernes).{0,50}?(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*h/i);
  const origen = rango || suelto || juntoAlDia;
  const inicio = origen ? armarHora(origen[1], origen[2]) : null;
  if (!inicio) return null;
  return { dia, horaInicio: inicio, horaFin: horaMasMinutos(inicio, DURACION_CLASE_MINUTOS) };
}

function horarioDeEvento(evento) {
  const declarado = horarioDeclaradoEnTitulo(evento.titulo);
  if (declarado) return declarado;
  if (!evento.horaInicio || !evento.dia || evento.dia > 5) return null;
  const duracion = minutosEntre(evento.horaInicio, evento.horaFin);
  if (evento.horaFin && duracion !== DURACION_CLASE_MINUTOS) return null;
  return {
    dia: evento.dia,
    horaInicio: evento.horaInicio,
    horaFin: horaMasMinutos(evento.horaInicio, DURACION_CLASE_MINUTOS)
  };
}

function pareceClase(titulo) {
  return /clase|encuentro|sincr|zoom|sala virtual|revisi[oó]n/i.test(titulo);
}

function tituloConHorario(evento) {
  if (!evento.horaInicio) return evento.titulo;
  if (/\d{1,2}\s*:\s*\d{2}|\d{1,2}\s*hs\b/i.test(evento.titulo)) return evento.titulo;
  const rango = evento.horaFin && evento.horaFin !== evento.horaInicio
    ? `${evento.horaInicio}–${evento.horaFin}`
    : evento.horaInicio;
  return `${evento.titulo} (${rango})`;
}

function tipoCronograma(titulo) {
  if (/consulta|revisi[oó]n/i.test(titulo)) return 'consulta';
  return 'clase';
}

// Separa el calendario del curso en: fechas para completar tareas o parciales
// ya conocidos, eventos de cursada para el cronograma, y horarios semanales
// cuando la misma clase se repite.
export function clasificarEventosCalendario({ eventos, actividades, materiaId }) {
  const fechas = [];
  const cronograma = [];
  const repeticiones = new Map();
  const horarios = [];
  const vistos = new Set();

  const sumarHorario = (horario) => {
    if (!horario?.horaInicio || !horario.dia || horario.dia > 5) return;
    const clave = `${materiaId}|${horario.dia}|${horario.horaInicio}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    horarios.push({
      materiaId,
      dia: String(horario.dia),
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
      aula: 'Virtual'
    });
  };

  for (const evento of eventos || []) {
    const nombre = nombreActividadDeEvento(evento.titulo);
    const conocida = (actividades || []).find((actividad) => coincidirNombreTarea(actividad.nombre, nombre));
    if (esRecordatorioDeActividad(evento.titulo) && conocida) {
      fechas.push({
        id: conocida.id,
        tabla: conocida.tabla,
        campo: campoFechaDeEvento(evento.titulo),
        fecha: evento.fecha
      });
      continue;
    }
    if (esRecordatorioDeActividad(evento.titulo) && !conocida) {
      cronograma.push(eventoCronograma(evento, materiaId));
      continue;
    }
    if (conocida && !pareceClase(evento.titulo)) continue;
    cronograma.push(eventoCronograma(evento, materiaId));
    sumarHorario(horarioDeclaradoEnTitulo(evento.titulo));
    const lista = repeticiones.get(evento.titulo) || [];
    lista.push(evento);
    repeticiones.set(evento.titulo, lista);
  }

  for (const lista of repeticiones.values()) {
    if (lista.length < 2) continue;
    if (horarioDeclaradoEnTitulo(lista[0].titulo)) continue;
    sumarHorario(horarioDeEvento(lista[0]));
  }

  return { fechas, cronograma: ajustarClasesAlHorario(cronograma, horarios), horarios };
}

export function diaDeFecha(fecha) {
  const partes = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return null;
  const dia = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), 15)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function ajustarClasesAlHorario(cronograma, horarios) {
  const porDia = new Map((horarios || []).map((horario) => [Number(horario.dia), horario]));
  return (cronograma || []).map((evento) => {
    if (evento.tipo === 'consulta' || /sin\s+clases/i.test(evento.titulo || '')) return evento;
    if (!pareceClase(evento.titulo)) return evento;
    const declarado = horarioDeclaradoEnTitulo(evento.titulo);
    const real = declarado || porDia.get(diaDeFecha(evento.fecha));
    if (!real?.horaInicio || !real.horaFin) return evento;
    const rango = `${real.horaInicio}–${real.horaFin}`;
    const titulo = String(evento.titulo || '').replace(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/g, (coincidencia, inicio, fin) => (
      inicio === real.horaInicio && fin === real.horaFin ? coincidencia : rango
    ));
    const detallesDeCampus = /horario del campus/i.test(evento.detalles || '');
    if (titulo === evento.titulo && !detallesDeCampus) return evento;
    return {
      ...evento,
      titulo,
      detalles: `Clase de ${real.horaInicio} a ${real.horaFin}.`
    };
  });
}

function eventoCronograma(evento, materiaId) {
  return {
    materiaId,
    fecha: evento.fecha,
    modalidad: 'sincrónico',
    tipo: tipoCronograma(evento.titulo),
    titulo: tituloConHorario(evento).slice(0, 200),
    detalles: evento.horaInicio
      ? `Horario del campus: ${evento.horaInicio}${evento.horaFin ? `–${evento.horaFin}` : ''}`
      : '',
    url: evento.url || ''
  };
}

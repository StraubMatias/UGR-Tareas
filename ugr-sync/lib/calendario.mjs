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
    const lista = repeticiones.get(evento.titulo) || [];
    lista.push(evento);
    repeticiones.set(evento.titulo, lista);
  }

  const horarios = [];
  const vistos = new Set();
  for (const lista of repeticiones.values()) {
    if (lista.length < 2) continue;
    const base = lista[0];
    if (!base.dia || base.dia > 5 || !base.horaInicio) continue;
    const clave = `${materiaId}|${base.dia}|${base.horaInicio}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    horarios.push({
      materiaId,
      dia: String(base.dia),
      horaInicio: base.horaInicio,
      horaFin: base.horaFin && base.horaFin !== base.horaInicio ? base.horaFin : base.horaInicio,
      aula: 'Virtual'
    });
  }

  return { fechas, cronograma, horarios };
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

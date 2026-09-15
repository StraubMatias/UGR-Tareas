// Detección de avisos en los foros informativos del campus (Avisos, Novedades,
// Consultas…) y análisis del texto de cada hilo para sugerir eventos espontáneos
// (clases de consulta, exámenes, entregas, exposiciones) al cronograma.
// El sync SOLO propone: cada aviso queda 'pendiente' y pasa a la campana y al
// cronograma únicamente cuando el admin lo aprueba en el modal de sincronización.
//
// Regla de negocio confirmada: se procesan avisos publicados desde hoy hacia
// adelante (DIAS_HACIA_ATRAS = 0); los hilos viejos y los eventos cuya fecha ya
// pasó se ignoran.
import { load } from 'cheerio';
import {
  limpiarTextoParaBusqueda,
  parsearFechaMoodle,
  parsearUnidadMoodle
} from './normalizar.mjs';

function limpiarTexto(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function completarUrl(href, baseUrl) {
  if (!href) return '';
  try {
    return new URL(href, baseUrl || undefined).toString();
  } catch {
    return href;
  }
}

// Foros «informativos»: son justamente los que interesa escudriñar en busca de
// avisos (es el complemento de esForoInformativo de tareas.mjs, que los descarta
// como consignas para el tablero de tareas).
const PATRONES_FORO_DE_AVISOS = [
  /^(avisos?|novedades?|noticias?|anuncios?|comunicados?)$/,
  /consulta(s)?/,
  /^foro\s+(general|principal)$/,
  // Avisos de organización: horarios de clases sincrónicas, encuentros, etc.
  /encuentr[oa]s?\s*(sincr|virtual)/,
  /horari[oa]\s+(de\s+)?encuentro/
];

export function esForoDeAvisos(nombre) {
  const n = limpiarTextoParaBusqueda(nombre);
  return PATRONES_FORO_DE_AVISOS.some((patron) => patron.test(n));
}

// Parser del índice de foros de un curso (/mod/forum/index.php?id=ID o la sección
// «Foros» del overview con expand[]=forum). Moodle renderiza una fila por foro
// con el enlace activityname a /mod/forum/view.php?id=N y la sección en `.small`.
// Devuelve todos los foros (con esAvisos) para que el caller decida cuáles leer.
export function extraerForosDelIndice(html, baseUrl = '') {
  const $ = load(html);
  const foros = [];
  const porId = new Map();

  $('tr[data-mdl-overview-cmid], tr').each((_, fila) => {
    const enlace = $(fila).find('a[href*="mod/forum/view.php"]').first();
    if (!enlace.length) return;
    const href = $(enlace).attr('href') || '';
    const matchId = href.match(/[?&]id=(\d+)/) || [null, $(fila).attr('data-mdl-overview-cmid')];
    if (!matchId[1] || porId.has(matchId[1])) return;
    porId.set(matchId[1], true);

    const celdaNombre = $(fila).find('td[data-mdl-overview-item="name"], td.cell.c0').first();
    const nombre = limpiarTexto($(enlace).text())
      || $(celdaNombre).attr('data-mdl-overview-value')
      || 'Foro sin nombre';

    let unidad = null;
    if (celdaNombre.length) {
      unidad = parsearUnidadMoodle(limpiarTexto($(celdaNombre).find('.small').first().text()));
    }

    foros.push({
      id: matchId[1],
      nombre,
      url: completarUrl(href, baseUrl) || completarUrl(`/mod/forum/view.php?id=${matchId[1]}`, baseUrl),
      unidad,
      esAvisos: esForoDeAvisos(nombre)
    });
  });

  return foros;
}

// Parser de la página de un foro (/mod/forum/view.php?id=N): lista las
// discusiones (hilos). Cubre la tabla clásica `discussionlist` y la lista de
// Moodle 4.x con filas `.discussion`, buscando enlaces a discuss.php.
export function extraerDiscusionesDeForo(html, baseUrl = '') {
  const $ = load(html);
  const discusiones = [];
  const vistos = new Set();

  $('a[href*="mod/forum/discuss.php"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const matchD = href.match(/[?&]d=(\d+)/);
    if (!matchD) return;
    const id = matchD[1];
    if (vistos.has(id)) return;
    vistos.add(id);

    const titulo = limpiarTexto($el.text()) || limpiarTexto($el.attr('title') || '');
    if (!titulo) return;

    const fila = $el.closest('tr, .discussion');
    const autor = limpiarTexto(
      fila.find('td.author a, .author a, [data-region="author-name"]').first().text()
    );
    const actualizado = limpiarTexto(fila.find('time[datetime]').first().attr('datetime') || '');

    discusiones.push({
      id,
      titulo,
      url: completarUrl(href, baseUrl),
      autor,
      actualizado: parsearFechaMoodle(actualizado) || null
    });
  });

  return discusiones;
}

// Parser de la página de una discusión (/mod/forum/discuss.php?d=N). El primer
// post del DOM es el que abre el hilo (el anuncio del profesor). Cada hilo = un
// aviso, así que se devuelve un solo post.
export function extraerPrimerPostDeHilo(html, baseUrl = '') {
  const $ = load(html);
  const post = $('article.forum-post-container, article.forumpost, .forum-post-container, [data-post-id], .forumpost').first();
  if (!post.length) return null;

  const id = post.attr('data-post-id') || '';
  const titulo = limpiarTexto(
    post.find('[data-region="post-subject"], h3[class*="subject"] a, .discussionname').first().text()
    || post.find('.subject a').first().text()
    || post.find('.subject').text()
    || post.find('h3').first().text()
  );
  const autor = limpiarTexto(
    post.find('[data-region="author-name"], .author a').first().text()
    || post.find('.author').text()
  );
  const fechaTexto = post.find('time[datetime]').first().attr('datetime')
    || limpiarTexto(post.find('time').first().text());
  const bloqueContenido = post.find('[data-region="post-content"], .posting, .content, .post-content').first();
  const contenido = limpiarTexto(bloqueContenido.text());
  const contenidoHtml = bloqueContenido.html() || '';
  const urlHilo = completarUrl(post.find('a[href*="discuss.php"]').first().attr('href'), baseUrl);

  if (!titulo && !contenido) return null;
  return {
    id,
    titulo,
    autor,
    fecha: parsearFechaMoodle(fechaTexto) || null,
    contenido,
    contenidoHtml,
    urlHilo
  };
}

// --- Análisis del texto de un aviso para sugerir un evento al cronograma ---

const MESES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12'
};

// Mapeo alineado con Date.getDay() de JavaScript (0=domingo).
const DIAS_SEMANA = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6
};

function hoyISO() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

function sumarDias(fechaISO, cantidad) {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + cantidad);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// Busca una fecha explícita (día de mes + mes [+ año]) dentro del texto y solo
// considera las que caen desde hoy en adelante.
function encontrarFechaExplicita(texto, hoy) {
  // Limpieza que conserva los separadores numéricos (/ y -): a diferencia de
  // limpiarTextoParaBusqueda (que los convierte en espacios), acá preservamos
  // el formato "30/11/2026" para poder matchearlo.
  const limpio = String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bde\s+el\b/g, 'del')
    .replace(/[^a-z0-9\-/\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const anioActual = hoy.slice(0, 4);

  // "21 de septiembre de 2026" / "21 de septiembre"
  const porNombre = limpio.match(/(?:el\s+)?(\d{1,2})\s+de\s+(?:del?\s+)?([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (porNombre) {
    const dia = porNombre[1].padStart(2, '0');
    const mes = MESES[porNombre[2]];
    if (mes) {
      const anio = porNombre[3] || anioActual;
      const fecha = `${anio}-${mes}-${dia}`;
      if (fecha >= hoy) return [{ fecha, confianza: porNombre[3] ? 'alta' : 'media' }];
    }
  }

  // "21/09", "21/09/2026", "21-09-2026"
  const porNumero = limpio.match(/(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?/);
  if (porNumero) {
    const dia = porNumero[1].padStart(2, '0');
    const mes = porNumero[2].padStart(2, '0');
    const anioRaw = porNumero[3];
    if (Number(dia) >= 1 && Number(dia) <= 31 && Number(mes) >= 1 && Number(mes) <= 12) {
      let anio = anioRaw;
      if (anioRaw && anioRaw.length === 2) anio = `20${anioRaw}`;
      const fecha = `${anio || anioActual}-${mes}-${dia}`;
      if (fecha >= hoy) return [{ fecha, confianza: anioRaw ? 'alta' : 'media' }];
    }
  }

  return [];
}

// Detecta una fecha de evento en el texto de un aviso. Prioridad: «mañana» →
// «hoy» → fecha explícita con año → numérica → sin año → «el lunes…».
// Devuelve { fecha, confianza } o null. Nunca devuelve fechas pasadas.
function detectarFechaEvento(texto, hoy) {
  const limpio = limpiarTextoParaBusqueda(texto);

  if (/\b(?:manana|maniana)\b/.test(limpio)) {
    return { fecha: sumarDias(hoy, 1), confianza: 'alta' };
  }
  if (/\bhoy\b/.test(limpio)) {
    return { fecha: hoy, confianza: 'alta' };
  }
  const explicitas = encontrarFechaExplicita(texto.replace(/\b(?:a|para|durante)\s+(?:el|la|los|las)\b/gi, ' '), hoy);
  if (explicitas.length > 0) return explicitas[0];

  const dia = limpio.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (dia) {
    const objetivo = DIAS_SEMANA[dia[1]];
    const hoyDia = new Date(`${hoy}T12:00:00`).getDay();
    let distancia = (objetivo - hoyDia + 7) % 7;
    if (distancia === 0) distancia = 7; // «el lunes» publicado un lunes = próximo lunes
    return { fecha: sumarDias(hoy, distancia), confianza: 'media' };
  }
  return null;
}

// Devuelve la fecha actual en formato ISO local (YYYY-MM-DD).
export function fechaHoyLocal() {
  return hoyISO();
}
const TIPOS_EVENTO = [
  // Orden de prioridad: lo específico antes que lo genérico.
  { tipo: 'examen', patrones: [/parcial/, /examen/, /parcialito/, /recuperatorio/, /final\b/, /coloquio/, /integrador/] },
  { tipo: 'entrega', patrones: [/entrega/, /entregar/, /vencimiento/, /present[ao]\s+(?:del?\s+)?(?:tp|trabajo)/] },
  { tipo: 'consulta', patrones: [/consulta/] },
  { tipo: 'exposición', patrones: [/exposici[oó]n/, /presentaci[oó]n/] },
  { tipo: 'sin_clases', patrones: [/sin\s+clases/, /no\s+hay\s+clases/, /no\s+habr[áa]\s+clases/] },
  { tipo: 'clase', patrones: [/clase/, /encuentro/, /zoom/, /meet/] }
];

function detectarTipoEvento(texto) {
  const limpio = limpiarTextoParaBusqueda(texto);
  for (const regla of TIPOS_EVENTO) {
    if (regla.patrones.some((patron) => patron.test(limpio))) return regla.tipo;
  }
  return null;
}

function formatoLegible(fechaISO) {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [, mes, dia] = fechaISO.split('-');
  return `${Number(dia)} de ${meses[Number(mes) - 1]}`;
}

// Analiza un aviso y, si el texto anuncia un evento con fecha desde hoy en
// adelante, devuelve la sugerencia para el cronograma. Si no hay fecha o el
// evento ya pasó, devuelve null (el aviso igual puede aprobarse como aviso).
export function analizarAvisoParaCronograma({ titulo, contenido, materiaNombre, hoy }) {
  const fechaBase = hoy || hoyISO();
  const texto = `${titulo || ''} ${contenido || ''}`;
  const fechaEvento = detectarFechaEvento(texto, fechaBase);
  const tipoEvento = detectarTipoEvento(texto);
  if (!fechaEvento || !tipoEvento) return null;
  if (fechaEvento.fecha < fechaBase) return null; // fecha ya pasó: se ignora.

  const limpio = limpiarTexto(texto.replace(/\b(?:el|la|los|las)\b/gi, ' '));
  const fragmento = limpio
    .replace(/\b(?:hoy|manana|maniana|mañana)\b/gi, ' ')
    .replace(/\b(?:a\s+las\s+\d{1,2}(?::\d{2})?\s*(?:hs\.?|horas?)?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  const tituloEvento = fragmento || limpiarTexto(titulo || 'Aviso del campus').slice(0, 80);
  const modalidad = /\basincr[oó]nic|\ba\s+distancia\b/.test(limpiarTextoParaBusqueda(texto))
    ? 'asincrónico'
    : 'sincrónico';

  const detalles = limpiarTexto(contenido || '').slice(0, 200);

  return {
    tipo: tipoEvento,
    fecha: fechaEvento.fecha,
    modalidad,
    titulo: tituloEvento,
    detalles: `Aviso del foro (${formatoLegible(fechaEvento.fecha)})${detalles ? ` — ${detalles}` : ''}`.slice(0, 250),
    confianza: fechaEvento.confianza,
    materiaNombre
  };
}
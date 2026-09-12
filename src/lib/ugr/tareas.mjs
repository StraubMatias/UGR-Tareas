// Parser de la página /mod/assign/index.php?id=ID (Tareas del curso).
// Soporta dos formatos que sirve Moodle:
//   1. Clásico: tabla con encabezados «Tarea», «Vencimiento», «Disponible desde»
//      y fechas en <time datetime="..."> o texto «viernes, 25 de septiembre…».
//   2. Overview (Moodle 4.5): celdas con data-mdl-overview-item="name|duedate",
//      id en data-mdl-overview-cmid y fechas como <span data-timestamp="...">.
import { load } from 'cheerio';
import { ROTULOS_VENCIMIENTO, ROTULOS_DISPONIBLE } from './constantes.mjs';
import { parsearFechaMoodle, parsearTimestampMoodle, parsearUnidadMoodle } from './normalizar.mjs';

function indiceColumna(encabezados, rotulos) {
  for (let i = 0; i < encabezados.length; i += 1) {
    const texto = String(encabezados[i]).toLowerCase();
    if (rotulos.some((r) => texto.includes(r)) && !texto.includes('calificación')) {
      return i;
    }
  }
  return -1;
}

function limpiarTexto(texto) {
  return String(texto).replace(/\s+/g, ' ').trim();
}

function completarUrl(href, baseUrl) {
  if (!href) return '';
  try {
    return new URL(href, baseUrl || undefined).toString();
  } catch {
    return href;
  }
}

// Rótulos que pueden aparecer en el bloque «Apertura»/«Cierre» de la página de una
// tarea (div[data-region="activity-dates"]).
const ROTULOS_APERTURA = ['apertura', 'disponible desde', 'empieza', 'inicio'];
const ROTULOS_CIERRE = ['cierre', 'vencimiento', 'fecha de entrega', 'hasta', 'entrega'];

// Fecha desde una celda: prioriza timestamp numérico (data-mdl-overview-value o
// data-timestamp), luego <time datetime="..."> y por último el texto visible.
function fechaDeCelda($, celda) {
  if (!celda || celda.length === 0) return null;

  const rawTs = $(celda).attr('data-mdl-overview-value')
    || $(celda).children('span[data-timestamp]').attr('data-timestamp')
    || '';
  if (rawTs && /^\d+$/.test(rawTs)) {
    const parseada = parsearTimestampMoodle(rawTs);
    if (parseada) return parseada;
  }

  const time = $(celda).find('time[datetime]').first();
  if (time.length) {
    const v = parsearFechaMoodle($(time).attr('datetime'));
    if (v) return v;
  }

  const texto = limpiarTexto($(celda).text());
  if (texto && texto !== 'Sin fecha') {
    const v = parsearFechaMoodle(texto);
    if (v) return v;
  }
  return null;
}

export function extraerTareas(html, baseUrl = '') {
  const $ = load(html);
  const tareas = [];

  $('table').each((_, tabla) => {
    const encabezados = $(tabla).find('thead th, tr.header th').map((_, th) => $(th).text()).get();

    // Columna a la que pertenece cada <th> según el atributo del overview.
    const columnas = $(tabla).find('thead th').map((_, th) => {
      return $(th).attr('data-mdl-overview-column') || '';
    }).get();

    const idxVencimiento = indiceColumna(encabezados, ROTULOS_VENCIMIENTO);
    const idxDisponible = indiceColumna(encabezados, ROTULOS_DISPONIBLE);
    const colVenc = columnas.findIndex((c) => c === 'duedate');
    const colDisp = columnas.findIndex((c) => c === 'allowsubmissionsfromdate');

    $(tabla).find('tbody tr').each((_, fila) => {
      const celdas = $(fila).find('td').map((_, td) => limpiarTexto($(td).text())).get();
      const enlace = $(fila).find('a[href*="mod/assign/view.php"]').first();
      const href = $(enlace).attr('href') || '';
      const matchId = href.match(/[?&]id=(\d+)/) || [null, $(fila).attr('data-mdl-overview-cmid')];
      if (!matchId[1]) return;

      // En formato overview la celda de fecha es `td[data-mdl-overview-item="duedate"]`.
      const filaTds = $(fila).find('td');
      const celdaVencOverview = $(fila).find('td[data-mdl-overview-item="duedate"]').first();
      const celdaDispOverview = $(fila).find('td[data-mdl-overview-item="allowsubmissionsfromdate"]').first();
      const celdaVenc = (colVenc !== -1 && filaTds.eq(colVenc).length) ? filaTds.eq(colVenc) : null;

      let fin = null;
      let inicio = null;
      if (celdaVencOverview.length) fin = fechaDeCelda($, celdaVencOverview);
      else if (celdaVenc && celdaVenc.length) fin = fechaDeCelda($, celdaVenc) || parsearFechaMoodle(celdas[colVenc] || undefined);

      if (celdaDispOverview.length) inicio = fechaDeCelda($, celdaDispOverview);
      else if (colDisp !== -1 && filaTds.eq(colDisp).length) {
        inicio = fechaDeCelda($, filaTds.eq(colDisp)) || parsearFechaMoodle(celdas[colDisp] || undefined);
      } else if (idxDisponible !== -1) {
        inicio = parsearFechaMoodle(celdas[idxDisponible] || undefined);
      }

      // Fallback clásico: fechas desde <time datetime> de la fila.
      if (!fin || !inicio) {
        const filaHtml = $(fila).html() || '';
        const tiempos = [...filaHtml.matchAll(/<time[^>]*datetime="([^"]+)"/gi)].map((m) => m[1]);
        if (!inicio) inicio = parsearFechaMoodle(tiempos[0] || undefined);
        if (!fin) fin = parsearFechaMoodle(tiempos[tiempos.length - 1] || undefined);
      }

      // En formato overview la celda de nombre trae la unidad en un sub-bloque
      // <div class="small">Unidad II</div>. También la buscamos en el nombre.
      const celdaNombre = $(fila).find('td[data-mdl-overview-item="name"]').first();
      const nombreTarea = limpiarTexto($(enlace).text()) || celdas[0] || 'Tarea sin nombre';
      let unidad = null;
      if (celdaNombre.length) {
        unidad = parsearUnidadMoodle(limpiarTexto($(celdaNombre).find('.small').first().text()))
          || parsearUnidadMoodle(limpiarTexto($(celdaNombre).text()));
      }
      if (!unidad) unidad = parsearUnidadMoodle(nombreTarea);

      tareas.push({
        id: matchId[1],
        nombre: nombreTarea,
        url: completarUrl(href, baseUrl) || completarUrl(`/mod/assign/view.php?id=${matchId[1]}`, baseUrl),
        inicio: inicio || 'Sin fecha',
        fin: fin || 'Sin fecha',
        unidad,
        conNota: true // Las tareas de Moodle llegan con nota en el sistema.
      });
    });
  });

  return tareas;
}

// Extrae «Apertura» (disponibilidad) y «Cierre» (vencimiento) de la página de una
// tarea (/mod/assign/view.php?id=N). El índice de asignaciones no muestra la
// apertura: este bloque llega solo en el detalle (Moodle 4.5).
// Devuelve { inicio, fin } con fechas en 'YYYY-MM-DD' o null.
export function extraerFechasActividad(html) {
  const resultado = { inicio: null, fin: null };
  if (!html) return resultado;

  const $ = load(html);
  const bloque = $('[data-region="activity-dates"], .activity-dates').first();
  if (!bloque.length) return resultado;

  bloque.children('div').each((_, el) => {
    const renglon = limpiarTexto($(el).text());
    const partes = renglon.match(/^([^:]+):\s*(.+)$/);
    if (!partes) return;
    const rotulo = partes[1].toLowerCase();
    const valor = parsearFechaMoodle(partes[2]);
    if (!valor) return;
    if (ROTULOS_APERTURA.some((r) => rotulo.includes(r))) resultado.inicio = valor;
    else if (ROTULOS_CIERRE.some((r) => rotulo.includes(r))) resultado.fin = valor;
  });

  return resultado;
}
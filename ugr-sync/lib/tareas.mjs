// Parser de la página /mod/assign/index.php?id=ID (Tareas del curso).
// La misma tabla de UGR Virtual lista también los foros del curso (enlaces a
// /mod/forum/view.php): se parsan igual y se marcan con tipo 'foro' para que la
// app los distinga de las tareas (assign).
// Soporta dos formatos que sirve Moodle:
//   1. Clásico: tabla con encabezados «Tarea», «Vencimiento», «Disponible desde»
//      y fechas en <time datetime="..."> o texto «viernes, 25 de septiembre…».
//   2. Overview (Moodle 4.5): celdas con data-mdl-overview-item="name|duedate",
//      id en data-mdl-overview-cmid y fechas como <span data-timestamp="...">.
import { load } from 'cheerio';
import { MODULOS_CONSIGNA, ROTULOS_VENCIMIENTO, ROTULOS_DISPONIBLE } from './constantes.mjs';
import { inferirTipoTarea, limpiarTextoParaBusqueda, parsearFechaMoodle, parsearTimestampMoodle, parsearUnidadMoodle, coincidirNombreTarea } from './normalizar.mjs';

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
const ROTULOS_APERTURA = ['apertura', 'abre', 'abrirá', 'abrira', 'disponible desde', 'empieza', 'inicio'];
const ROTULOS_CIERRE = ['cierre', 'cierra', 'cerrará', 'cerrara', 'vencimiento', 'fecha de entrega', 'fecha límite', 'fecha limite', 'hasta'];

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
      const enlace = $(fila).find('a[href*="mod/assign/view.php"], a[href*="mod/forum/view.php"]').first();
      const href = $(enlace).attr('href') || '';
      const matchModulo = href.match(/mod\/(assign|forum)\/view\.php/);
      const esForo = matchModulo?.[1] === 'forum';
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
        url: completarUrl(href, baseUrl) || completarUrl(`/mod/${esForo ? 'forum' : 'assign'}/view.php?id=${matchId[1]}`, baseUrl),
        inicio: inicio || 'Sin fecha',
        fin: fin || 'Sin fecha',
        unidad,
        tipo: esForo ? 'foro' : undefined,
        // Las tareas (assign) llegan calificadas en el sistema; un foro puede o
        // no evaluarse, así que se importa sin nota y el admin la tilda al
        // editarla si el foro se califica.
        conNota: !esForo
      });
    });
  });

  return tareas;
}

// Parser de la página /mod/forum/index.php?id=ID (Foros del curso).
// Moodle 4.x la sirve con la misma estructura del overview de asignaciones:
// filas tr[data-mdl-overview-cmid], celda de nombre con enlace activityname a
// /mod/forum/view.php?id=N y la sección del curso («General», «Unidad 1», …)
// en un sub-bloque `.small`. No trae fechas: los foros se importan como
// «Sin fecha» y el admin las completa si el foro tiene plazo de entrega.
// Los foros meramente informativos (Avisos, foros de consultas generales) no
// son consignas: se descartan para no ensuciar el tablero (ver
// esForoInformativo).
const PATRONES_FORO_INFORMATIVO = [
  /\b(?:avisos?|novedades|noticias|anuncios|comunicados)\b/,
  /consulta(s)?/,
  /^foro\s+(general|principal)$/,
  // Avisos de organización: horarios de clases sincrónicas, encuentros, etc.
  /encuentr[oa]s?\s*(sincr|virtual)/,
  /horari[oa]\s+(de\s+)?encuentro/
];

// Patrones de anuncios/organización que aplican también fuera de los foros
// (p. ej. una encuesta «choice» de «Horario adicional de encuentro…»).
const PATRONES_ANUNCIO_GENERAL = [
  /\b(?:avisos?|novedades|noticias|anuncios|comunicados)\b/,
  /encuentr[oa]s?\s*(sincr|virtual)/,
  /horari[oa]\s+(de\s+)?encuentro/
];

export function esForoInformativo(nombre) {
  const n = limpiarTextoParaBusqueda(nombre);
  return PATRONES_FORO_INFORMATIVO.some((patron) => patron.test(n));
}

// ¿El nombre corresponde a una actividad meramente informativa (no consigna)
// en cualquier tipo de módulo? Usa un subconjunto más conservador que
// esForoInformativo para no descartar de más en quizzes/tareas: solo avisos y
// avisos de organización (horarios de encuentro, clases sincrónicas, …).
export function esActividadInformativa(nombre) {
  const n = limpiarTextoParaBusqueda(nombre);
  return PATRONES_ANUNCIO_GENERAL.some((patron) => patron.test(n));
}

export function extraerForos(html, baseUrl = '') {
  const $ = load(html);
  const foros = [];

  $('tr[data-mdl-overview-cmid], tr').each((_, fila) => {
    const enlace = $(fila).find('a[href*="mod/forum/view.php"]').first();
    if (!enlace.length) return;
    const href = $(enlace).attr('href') || '';
    const matchId = href.match(/[?&]id=(\d+)/) || [null, $(fila).attr('data-mdl-overview-cmid')];
    if (!matchId[1]) return;

    const celdaNombre = $(fila).find('td[data-mdl-overview-item="name"], td.cell.c0').first();
    const nombreForo = limpiarTexto($(enlace).text())
      || $(celdaNombre).attr('data-mdl-overview-value')
      || 'Foro sin nombre';
    if (esForoInformativo(nombreForo)) return;

    let unidad = null;
    if (celdaNombre.length) {
      unidad = parsearUnidadMoodle(limpiarTexto($(celdaNombre).find('.small').first().text()));
    }
    if (!unidad) unidad = parsearUnidadMoodle(nombreForo);

    foros.push({
      id: matchId[1],
      nombre: nombreForo,
      url: completarUrl(href, baseUrl) || completarUrl(`/mod/forum/view.php?id=${matchId[1]}`, baseUrl),
      inicio: 'Sin fecha',
      fin: 'Sin fecha',
      unidad,
      tipo: 'foro',
      conNota: false
    });
  });

  return foros;
}

// Parser de la vista unificada /course/overview.php?id=ID (Moodle 4.5).
// Esa página agrupa los módulos del curso por tipo («Asignaciones», «Foros»,
// «Cuestionarios», «Retroalimentación», …) y renderiza las filas de cada tipo
// pedido con expand[]. Cada fila tiene data-mdl-overview-cmid (id del módulo),
// el nombre con enlace a /mod/<tipo>/view.php?id=N, la sección del curso en
// `.small` y, según el tipo, fechas (duedate) y calificación.
// Se importan como tareas SOLO los tipos «consigna» (MODULOS_CONSIGNA); los
// recursos de lectura (resource, url, page, folder, zoom…) se ignoran, y las
// actividades informativas (avisos, foros de consultas, «horarios de encuentro»,
// encuestas de organización…) se descartan con esForoInformativo (foros) y
// esActividadInformativa (resto de los tipos).
export function extraerActividadesOverview(html, baseUrl = '') {
  const actividades = [];
  if (!html) return actividades;

  const $ = load(html);
  const vistos = new Set();

  $('[id$="_overview"]').each((_, contenedor) => {
    const idContenedor = $(contenedor).attr('id') || '';
    const moduloSeccion = idContenedor.replace(/_overview$/, '');
    if (!MODULOS_CONSIGNA.includes(moduloSeccion)) return;

    $(contenedor).find('tr[data-mdl-overview-cmid]').each((_, fila) => {
      const cmid = $(fila).attr('data-mdl-overview-cmid');
      if (!cmid || vistos.has(cmid)) return;

      const celdaNombre = $(fila).find('td[data-mdl-overview-item="name"]').first();
      const enlace = $(fila).find('a.activityname, a[href*="/mod/"]').first();
      const href = $(enlace).attr('href') || '';
      const idModulo = (href.match(/[?&]id=(\d+)/) || [])[1];
      const nombre = limpiarTexto(
        $(celdaNombre).attr('data-mdl-overview-value')
          || $(enlace).text()
          || ''
      );
      if (!idModulo || !nombre) return;

      // El tipo del módulo se deduce del enlace real (más fiable que la sección).
      const modulo = (href.match(/\/mod\/([a-z0-9_]+)\/view\.php/) || [])[1] || moduloSeccion;
      if (!MODULOS_CONSIGNA.includes(modulo)) return;

      const esForo = modulo === 'forum';
      // Actividades meramente informativas no son consignas y se descartan en
      // cualquier tipo de módulo (foros «Avisos»/«Consultas» y también el
      // «choice» de «Horario adicional de encuentro sincrónico», encuestas de
      // organización, etc.).
      if (esForo ? esForoInformativo(nombre) : esActividadInformativa(nombre)) return;

      // Fechas del overview (no todos los tipos las traen; los foros no).
      const fechaItem = (item) => {
        const celda = $(fila).find(`td[data-mdl-overview-item="${item}"]`).first();
        if (!celda.length) return null;
        return fechaDeCelda($, celda);
      };
      const inicio = fechaItem('allowsubmissionsfromdate') || fechaItem('timeopen') || 'Sin fecha';
      const fin = fechaItem('duedate') || fechaItem('timeclose') || fechaItem('cutoffdate') || 'Sin fecha';
      const notaCampus = parsearNotaCampus($(fila).find('td[data-mdl-overview-item="Calificación"]').attr('data-mdl-overview-value')
        || $(fila).find('td[data-mdl-overview-item="Calificación"]').text());
      const entregada = entregadaEnCelda($(fila).find('td[data-mdl-overview-item="submitted"], td[data-mdl-overview-item="submissionstatus"]'));

      // Sección del curso («General», «Unidad 2», …) dentro de la celda de nombre.
      const unidad = parsearUnidadMoodle(limpiarTexto($(celdaNombre).find('.small').first().text()));

      actividades.push({
        id: idModulo,
        nombre,
        url: completarUrl(href, baseUrl),
        inicio,
        fin,
        unidad,
        tipo: esForo ? 'foro' : inferirTipoTarea(nombre),
        conNota: esForo || modulo === 'feedback' ? false : true,
        notaCampus,
        entregada: entregada || notaCampus != null
      });
      vistos.add(cmid);
    });
  });

  return actividades;
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

export function parsearNotaCampus(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpio || limpio === '-' || /^acciones/i.test(limpio)) return null;
  const numero = limpio.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!numero) return null;
  const valor = Number(numero[1]);
  if (!Number.isFinite(valor) || valor < 1 || valor > 10) return null;
  return Math.round(valor * 100) / 100;
}

// Acepta 0: un intento finalizado en 0 es una nota, no un campo vacío.
export function parsearNotaPublicada(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpio || limpio === '-' || /^acciones/i.test(limpio)) return null;
  const normalizado = limpio.replace(',', '.');
  const explicita = normalizado.match(/(\d+(?:\.\d+)?)\s*(?:de|\/)\s*\d+/i);
  const numero = explicita || normalizado.match(/(\d+(?:\.\d+)?)/);
  if (!numero) return null;
  const valor = Number(numero[1]);
  if (!Number.isFinite(valor) || valor < 0 || valor > 10) return null;
  return Math.round(valor * 100) / 100;
}

function notaDeCuerpoDeIntento(cuerpo) {
  const enCurso = /en curso|sin finalizar|in progress/i.test(cuerpo);
  const cerrado = /finalizado|completado|completed/i.test(cuerpo);
  if (enCurso && !cerrado) return null;
  const todas = String(cuerpo).matchAll(/Calificaci[oó]n(?:\s+m[aá]s alta|\s+para aprobar)?\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:de|\/)\s*\d+(?:[.,]\d+)?)/gi);
  for (const encontrada of todas) {
    if (/m[aá]s alta|para aprobar/i.test(encontrada[0])) continue;
    const nota = parsearNotaPublicada(encontrada[1]);
    if (nota != null) return nota;
  }
  return null;
}

function intentoEnCurso(estado) {
  return /en curso|sin finalizar|in progress/i.test(estado) && !/finalizado|finished|completado|completed/i.test(estado);
}

function esRotuloDeNota(rotulo) {
  const texto = limpiarTexto(rotulo).toLowerCase();
  if (!texto || /m[aá]s alta|para aprobar|to pass|highest/.test(texto)) return false;
  return /^(calificaci[oó]n|grade|nota)\b/.test(texto);
}

function notaDeRotuloCalificacion(texto) {
  const limpio = limpiarTexto(texto);
  if (!limpio || /m[aá]s alta|para aprobar|to pass|highest/i.test(limpio)) return null;
  return parsearNotaPublicada(limpio);
}

function numeroDeIntento(titulo) {
  return Number(limpiarTexto(titulo).match(/^intento\b(?:\s+n[ºo°.]*)?\s*(\d+)/i)?.[1]);
}

// Moodle 4.5 lista el intento más nuevo primero. Cada uno es una tabla
// quizreviewsummary con la fila Calificación.
function notaDeResumenesDeIntento($) {
  const notas = [];
  $('table.quizreviewsummary').each((_, tabla) => {
    let estado = '';
    let nota = null;
    $(tabla).find('tr').each((__, tr) => {
      const rotulo = limpiarTexto($(tr).find('th').first().text());
      const valor = limpiarTexto($(tr).find('td').first().text());
      if (/estado|status/i.test(rotulo)) estado = valor;
      if (esRotuloDeNota(rotulo)) nota = notaDeRotuloCalificacion(valor);
    });
    if (intentoEnCurso(estado)) return;
    if (nota == null) return;
    notas.push(nota);
  });
  return notas.length > 0 ? notas[0] : null;
}

// Tarjetas de Moodle 4.5: h4 «Intento N» y tabla quizreviewsummary con fila Calificación.
function notaDeTarjetasDeIntento($) {
  const intentos = [];
  $('h4').each((_, h4) => {
    const numero = numeroDeIntento($(h4).text());
    if (!numero) return;
    const tarjeta = $(h4).closest('.card, li, section');
    const alcance = tarjeta.length && tarjeta.find('h4').length === 1 ? tarjeta : $(h4).parent();
    const estado = limpiarTexto(alcance.find('tr').filter((__, tr) => /estado|status/i.test($(tr).find('th').first().text())).first().find('td').text());
    if (intentoEnCurso(estado || limpiarTexto(alcance.text()))) return;
    const fila = alcance.find('tr').filter((__, tr) => esRotuloDeNota($(tr).find('th').first().text())).first();
    const nota = notaDeRotuloCalificacion(fila.find('td').first().text());
    if (nota == null) return;
    intentos.push({ n: numero, nota });
  });
  if (intentos.length === 0) return null;
  intentos.sort((a, b) => b.n - a.n);
  return intentos[0].nota;
}

// La nota que vale es la del último intento terminado. «Calificación más alta»
// se usa solo si la página no lista intentos.
export function extraerNotaUltimoIntento(html) {
  if (!html) return null;
  const $ = load(html);
  const deResumen = notaDeResumenesDeIntento($);
  if (deResumen != null) return deResumen;
  const deTarjetas = notaDeTarjetasDeIntento($);
  if (deTarjetas != null) return deTarjetas;
  const intentos = [];
  const texto = $('body').text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  const bloques = texto.matchAll(/Intento\s+(\d+)(?!\d)([\s\S]*?)(?=Intento\s+\d+(?!\d)|$)/gi);
  for (const bloque of bloques) {
    const nota = notaDeCuerpoDeIntento(bloque[2]);
    if (nota == null) continue;
    intentos.push({ n: Number(bloque[1]), nota });
  }
  $('table').each((_, tabla) => {
    const encabezados = $(tabla).find('th').toArray().map((th) => limpiarTexto($(th).text()).toLowerCase());
    const textoEncabezado = encabezados.join(' ');
    if (!/intento/.test(textoEncabezado) || !/calific/.test(textoEncabezado)) return;
    const columnaNota = encabezados.findIndex((encabezado) => /calific/.test(encabezado) && !/aprobar|m[aá]s alta/.test(encabezado));
    $(tabla).find('tbody tr').each((__, fila) => {
      const celdas = $(fila).find('th, td').toArray().map((celda) => limpiarTexto($(celda).text()));
      const numero = Number(String(celdas[0] || '').match(/\d+/)?.[0]);
      if (!Number.isFinite(numero)) return;
      const cruda = columnaNota >= 0 ? celdas[columnaNota] : celdas.find((celda) => parsearNotaPublicada(celda) != null);
      const nota = parsearNotaPublicada(cruda);
      if (nota == null) return;
      if (intentoEnCurso(celdas.join(' '))) return;
      intentos.push({ n: numero, nota });
    });
  });
  if (intentos.length > 0) {
    intentos.sort((a, b) => b.n - a.n || 0);
    return intentos[0].nota;
  }
  const sueltas = [];
  $('tr').each((_, tr) => {
    const rotulo = limpiarTexto($(tr).find('th').first().text());
    if (!esRotuloDeNota(rotulo)) return;
    const nota = notaDeRotuloCalificacion($(tr).find('td').first().text());
    if (nota != null) sueltas.push(nota);
  });
  if (sueltas.length === 1) return sueltas[0];
  const final = texto.match(/calificaci[oó]n final(?:\s+en\s+este\s+cuestionario)?(?:\s+es)?\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:de|\/)\s*\d+(?:[.,]\d+)?)/i);
  if (final) return parsearNotaPublicada(final[1]);
  const suelta = texto.match(/(?:su calificaci[oó]n(?:\s+es)?|calificaci[oó]n m[aá]s alta)\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:de|\/)\s*\d+(?:[.,]\d+)?)/i);
  return suelta ? parsearNotaPublicada(suelta[1]) : null;
}

// Si el cuestionario no publica el número en el resumen, el último intento
// terminado enlaza a review.php, que sí lo muestra.
export function urlDeUltimaRevision(html, baseUrl = '') {
  if (!html) return null;
  const $ = load(html);
  const candidatos = [];
  $('h4').each((_, h4) => {
    const numero = numeroDeIntento($(h4).text());
    if (!numero) return;
    const tarjeta = $(h4).closest('.card, li, section');
    const alcance = tarjeta.length && tarjeta.find('h4').length === 1 ? tarjeta : $(h4).parent();
    const estado = limpiarTexto(alcance.text());
    if (intentoEnCurso(estado)) return;
    const href = alcance.find('a[href*="review.php"]').attr('href');
    if (href) candidatos.push({ n: numero, href });
  });
  if (candidatos.length === 0) {
    const href = $('a[href*="/mod/quiz/review.php"]').first().attr('href');
    return href ? completarUrl(href, baseUrl) : null;
  }
  candidatos.sort((a, b) => b.n - a.n);
  return completarUrl(candidatos[0].href, baseUrl);
}

export function priorizarNotaDeUltimoIntento(progreso = [], intentos = []) {
  const salida = progreso.map((item) => ({ ...item }));
  for (const intento of intentos) {
    if (intento?.nota == null || !intento.materiaId || !intento.nombre) continue;
    const indice = salida.findIndex((item) => item.materiaId === intento.materiaId && (
      (intento.id && item.id === intento.id)
      || coincidirNombreTarea(item.nombre, intento.nombre)
    ));
    const previa = indice >= 0 ? salida[indice] : null;
    const fila = {
      materiaId: intento.materiaId,
      nombre: intento.nombre,
      tabla: intento.tabla || previa?.tabla || (intento.id ? 'tareas' : 'nueva'),
      id: intento.id || previa?.id || null,
      fecha: intento.fecha || previa?.fecha,
      nota: intento.nota,
      entregada: true,
      forzar: true
    };
    if (indice >= 0) salida[indice] = { ...salida[indice], ...fila };
    else salida.push(fila);
  }
  return salida;
}

function entregadaEnCelda(celda) {
  if (!celda || celda.length === 0) return false;
  const valor = String(celda.attr('data-mdl-overview-value') || '').trim();
  if (valor === '1' || valor === 'true') return true;
  return /enviad|entregad|submitted|graded/i.test(celda.text());
}

export function extraerNotasDeLibreta(html) {
  if (!html) return [];
  const $ = load(html);
  const notas = [];
  const vistos = new Set();
  $('tr').each((_, tr) => {
    const enlace = $(tr).find('a.gradeitemheader[href*="/mod/"], a[href*="/mod/"][href*="view.php"]').first();
    const href = enlace.attr('href') || '';
    const id = (href.match(/[?&]id=(\d+)/) || [])[1];
    const nombre = limpiarTexto(enlace.text());
    const nota = parsearNotaCampus($(tr).find('td.column-grade, td[class*="column-grade"], td.grade').first().text());
    if (!id || !nombre || nota == null || vistos.has(id)) return;
    vistos.add(id);
    notas.push({ id, nombre, nota, url: completarUrl(href, '') });
  });
  return notas;
}
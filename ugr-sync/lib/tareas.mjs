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
import { MODULOS_CONSIGNA, ROTULOS_VENCIMIENTO, ROTULOS_DISPONIBLE, UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';
import { extraerSesskey } from './materias.mjs';
import { esNombreConsignaValido, inferirTipoTarea, limpiarTextoParaBusqueda, parsearFechaMoodle, parsearTimestampMoodle, parsearUnidadMoodle, coincidirNombreTarea } from './normalizar.mjs';

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
      const nombreTarea = limpiarTexto(
        $(celdaNombre).attr('data-mdl-overview-value')
          || $(celdaNombre).find('a.activityname').first().text()
          || $(enlace).filter('.activityname').text()
          || $(enlace).text()
          || $(fila).find('a.activityname').first().text()
      );
      if (!esNombreConsignaValido(nombreTarea)) return;
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
      if (!idModulo || !nombre || !esNombreConsignaValido(nombre)) return;

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
      const notaCampus = parsearNotaCampus($(fila).find('td[data-mdl-overview-item="Calificación"], td[data-mdl-overview-item="Grade"], td[data-mdl-overview-item="grade"]').attr('data-mdl-overview-value')
        || $(fila).find('td[data-mdl-overview-item="Calificación"], td[data-mdl-overview-item="Grade"], td[data-mdl-overview-item="grade"]').text());
      const entregada = entregadaEnCelda($(fila).find('td[data-mdl-overview-item="submitted"], td[data-mdl-overview-item="submissionstatus"], td[data-mdl-overview-item="status"]'));

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

function puntuacionNombreConsigna(nombre) {
  if (!esNombreConsignaValido(nombre)) return 0;
  return 1000 + String(nombre).length;
}

function combinarCamposActividad(base, extra) {
  const salida = { ...base };
  for (const [clave, valor] of Object.entries(extra)) {
    if (valor == null || valor === '') continue;
    if (clave === 'nombre') continue;
    if (clave === 'inicio' || clave === 'fin') {
      if (!salida[clave] || salida[clave] === 'Sin fecha') salida[clave] = valor;
      continue;
    }
    if (salida[clave] == null || salida[clave] === '') salida[clave] = valor;
  }
  const nombreBase = salida.nombre;
  const nombreExtra = extra.nombre;
  if (puntuacionNombreConsigna(nombreExtra) > puntuacionNombreConsigna(nombreBase)) {
    salida.nombre = nombreExtra;
  }
  return salida;
}

// Une listas de actividades detectadas en distintas páginas/parsers (overview,
// índice de assign, foros…) deduplicando por id de módulo Moodle.
export function fusionarActividadesConsigna(listas) {
  const mapa = new Map();
  for (const lista of listas) {
    for (const actividad of Array.isArray(lista) ? lista : []) {
      if (!actividad?.id || !esNombreConsignaValido(actividad.nombre)) continue;
      const esForo = actividad.tipo === 'foro' || /\/mod\/forum\//.test(actividad.url || '');
      const normalizada = {
        ...actividad,
        tipo: actividad.tipo || (esForo ? 'foro' : inferirTipoTarea(actividad.nombre)),
        conNota: actividad.conNota ?? !esForo
      };
      if (mapa.has(actividad.id)) {
        mapa.set(actividad.id, combinarCamposActividad(mapa.get(actividad.id), normalizada));
      } else {
        mapa.set(actividad.id, normalizada);
      }
    }
  }
  return [...mapa.values()];
}

// Aplica todos los parsers de consignas sobre un mismo HTML. El overview unificado
// usa contenedores `*_overview`, pero /mod/assign/index.php a veces devuelve solo
// la tabla de asignaciones (sin ese contenedor): ahí `extraerTareas` es el que
// encuentra los trabajos prácticos.
export function extraerConsignasDeHtml(html, baseUrl = '') {
  if (!html) return [];
  const desdeOverview = extraerActividadesOverview(html, baseUrl);
  const desdeTareas = extraerTareas(html, baseUrl)
    .filter((t) => !esForoInformativo(t.nombre))
    .map((t) => ({
      ...t,
      tipo: t.tipo || inferirTipoTarea(t.nombre),
      conNota: t.conNota ?? true
    }));
  const desdeForos = extraerForos(html, baseUrl);
  return fusionarActividadesConsigna([desdeOverview, desdeTareas, desdeForos]);
}

async function pedirHtmlCurso(cliente, ruta) {
  try {
    const pagina = await cliente.pedir(ruta);
    if (pagina?.html && !pagina.es_requiere_login) return pagina.html;
  } catch {
    // Sin sesión o error de red: el llamador puede usar otro índice como respaldo.
  }
  return '';
}

function nombreDeEnlaceActividad($, enlace) {
  const nodo = $(enlace);
  const instancia = nodo.find('.instancename').first().clone();
  instancia.find('.accesshide').remove();
  return limpiarTexto(
    instancia.text()
      || nodo.find('.activityname').first().text()
      || nodo.attr('title')
      || nodo.text()
  );
}

function actividadDesdeEnlaceModulo({ href, nombre, baseUrl, unidadSeccion = null }) {
  const modulo = (href.match(/\/mod\/([a-z0-9_]+)\/view\.php/i) || [])[1];
  if (!modulo || !MODULOS_CONSIGNA.includes(modulo)) return null;
  const id = (href.match(/[?&]id=(\d+)/) || [])[1];
  if (!id || !esNombreConsignaValido(nombre)) return null;
  const esForo = modulo === 'forum';
  if (esForo ? esForoInformativo(nombre) : esActividadInformativa(nombre)) return null;
  return {
    id,
    nombre,
    url: completarUrl(href, baseUrl),
    inicio: 'Sin fecha',
    fin: 'Sin fecha',
    unidad: unidadSeccion || parsearUnidadMoodle(nombre),
    tipo: esForo ? 'foro' : inferirTipoTarea(nombre),
    conNota: esForo || modulo === 'feedback' ? false : true
  };
}

// Índice oficial del curso (mismo contenido que el menú lateral de Moodle).
export function consignasDesdeCourseContents(secciones, baseUrl = '') {
  const actividades = [];
  for (const seccion of Array.isArray(secciones) ? secciones : []) {
    const unidadSeccion = parsearUnidadMoodle(seccion?.name);
    for (const mod of seccion?.modules || []) {
      const modname = mod?.modname;
      if (!modname || !MODULOS_CONSIGNA.includes(modname)) continue;
      const nombre = limpiarTexto(mod?.name);
      const instance = String(mod?.instance || '');
      const href = mod?.url || (instance ? `/mod/${modname}/view.php?id=${instance}` : '');
      if (!href) continue;
      const actividad = actividadDesdeEnlaceModulo({
        href,
        nombre,
        baseUrl,
        unidadSeccion
      });
      if (actividad) actividades.push(actividad);
    }
  }
  return actividades;
}

async function extraerConsignasDeWebservice(cliente, cursoId, sesskey, baseUrl) {
  if (!sesskey || !cliente?.pedir) return [];
  try {
    const cuerpo = JSON.stringify([{
      index: 0,
      methodname: 'core_course_get_contents',
      args: { courseid: Number(cursoId) }
    }]);
    const pagina = await cliente.pedir(UGR_RUTAS.ajax(sesskey), {
      method: 'POST',
      cuerpo,
      tipoCuerpo: 'application/json'
    });
    const respuesta = JSON.parse(pagina.html || '[]');
    const bloque = Array.isArray(respuesta) ? respuesta[0] : respuesta;
    if (bloque?.error || !Array.isArray(bloque?.data)) return [];
    return consignasDesdeCourseContents(bloque.data, baseUrl);
  } catch {
    return [];
  }
}

export function idsSeccionesDeCurso(html) {
  if (!html) return [];
  const $ = load(html);
  const ids = new Set();
  $('[data-section]').each((_, el) => {
    const valor = $(el).attr('data-section');
    if (valor && /^\d+$/.test(valor)) ids.add(valor);
  });
  $('a[href*="section="]').each((_, enlace) => {
    const match = ($(enlace).attr('href') || '').match(/[?&]section=(\d+)/);
    if (match?.[1]) ids.add(match[1]);
  });
  return [...ids].filter((id) => id !== '0');
}

// Enlaces a consignas en la página del curso (course/view.php) y sus secciones.
// En Moodle 4 el título suele ir en span.instancename dentro de a.aalink.
export function extraerConsignasDePaginaCurso(html, baseUrl = '') {
  if (!html) return [];
  const $ = load(html);
  const actividades = [];
  const vistos = new Set();
  const agregar = (href, nombre, unidadSeccion = null) => {
    const actividad = actividadDesdeEnlaceModulo({ href, nombre, baseUrl, unidadSeccion });
    if (!actividad || vistos.has(actividad.id)) return;
    vistos.add(actividad.id);
    actividades.push(actividad);
  };

  const unidadDeSeccion = parsearUnidadMoodle(
    limpiarTexto($('.course-content .sectionname, [data-region="section-title"]').first().text())
  );

  $('a.activityname[href*="/mod/"][href*="/view.php"], a.aalink[href*="/mod/"][href*="/view.php"]').each((_, enlace) => {
    if ($(enlace).closest('nav, .footer, [role="navigation"]').length) return;
    agregar($(enlace).attr('href') || '', nombreDeEnlaceActividad($, enlace), unidadDeSeccion);
  });

  return actividades;
}

function fusionarHtmlsUnicos(...htmls) {
  const unicos = [];
  const vistos = new Set();
  for (const html of htmls) {
    if (!html || vistos.has(html)) continue;
    vistos.add(html);
    unicos.push(html);
  }
  return unicos;
}

// Descubre todas las consignas de un curso: overview, índices de tareas/foros
// y la página del curso. Siempre se piden en paralelo y se fusionan: el overview
// a veces lista quizzes pero se queda corto en asignaciones nuevas.
export async function extraerConsignasDeCurso(cliente, cursoId, { baseUrl = UGR_BASE_URL, rutas = UGR_RUTAS } = {}) {
  const [htmlOverview, htmlAssign, htmlForos, htmlCurso] = await Promise.all([
    pedirHtmlCurso(cliente, rutas.overviewCurso(cursoId, MODULOS_CONSIGNA)),
    pedirHtmlCurso(cliente, rutas.tareasDeCurso(cursoId)),
    pedirHtmlCurso(cliente, rutas.forosDeCurso(cursoId)),
    pedirHtmlCurso(cliente, rutas.curso(cursoId))
  ]);

  let actividades = [];
  for (const html of fusionarHtmlsUnicos(htmlOverview, htmlAssign, htmlForos)) {
    actividades = fusionarActividadesConsigna([actividades, extraerConsignasDeHtml(html, baseUrl)]);
  }
  const sesskey = extraerSesskey(htmlCurso) || extraerSesskey(htmlOverview);
  if (sesskey) {
    const desdeWebservice = await extraerConsignasDeWebservice(cliente, cursoId, sesskey, baseUrl);
    actividades = fusionarActividadesConsigna([actividades, desdeWebservice]);
  }

  if (htmlCurso) {
    actividades = fusionarActividadesConsigna([actividades, extraerConsignasDePaginaCurso(htmlCurso, baseUrl)]);
    const secciones = idsSeccionesDeCurso(htmlCurso).slice(0, 12);
    if (secciones.length > 0) {
      const htmlsSeccion = await Promise.all(
        secciones.map((seccion) => pedirHtmlCurso(cliente, `${rutas.curso(cursoId)}&section=${seccion}`))
      );
      for (const html of htmlsSeccion) {
        actividades = fusionarActividadesConsigna([actividades, extraerConsignasDePaginaCurso(html, baseUrl)]);
      }
    }
  }
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
  const limpio = String(texto || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpio || limpio === '-' || /^acciones/i.test(limpio) || /sin calificar|not yet graded|no grade/i.test(limpio)) return null;
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
  if (!texto || /m[aá]s alta|para aprobar|to pass|highest|gradepass/.test(texto)) return false;
  return /calificaci[oó]n|\bgrade\b|\bnota\b|\bmarks?\b/.test(texto);
}

function notaDeRotuloCalificacion(texto) {
  const limpio = limpiarTexto(texto);
  if (!limpio || /m[aá]s alta|para aprobar|to pass|highest/i.test(limpio)) return null;
  return parsearNotaPublicada(limpio);
}

function numeroDeIntento(titulo) {
  return Number(limpiarTexto(titulo).match(/\b(?:intento|attempt)\b(?:\s+n[ºo°.]*)?\s*(\d+)/i)?.[1]);
}

function notaDeFilasDeTabla($, tabla) {
  let estado = '';
  let nota = null;
  if (!tabla || !tabla.length) return { estado, nota };
  $(tabla).find('tr').each((_, tr) => {
    const rotulo = limpiarTexto($(tr).find('th').first().text());
    const celda = $(tr).find('td').first();
    const cruda = celda.length ? (celda.html() || celda.text()) : $(tr).text();
    if (/estado|status/i.test(rotulo)) estado = limpiarTexto(celda.text());
    if (esRotuloDeNota(rotulo)) nota = notaDeRotuloCalificacion(cruda);
  });
  return { estado, nota };
}

function extraerIntentosTerminados($, texto) {
  const intentos = [];
  $('h4, h3').each((_, titulo) => {
    const numero = numeroDeIntento($(titulo).text());
    if (!numero) return;
    const tarjeta = $(titulo).closest('.card, li, section');
    const alcance = tarjeta.length ? tarjeta : $(titulo).parent();
    const { estado, nota } = notaDeFilasDeTabla($, alcance.find('table').first());
    const cuerpo = limpiarTexto(alcance.text());
    if (intentoEnCurso(estado || cuerpo)) return;
    const valor = nota != null ? nota : notaDeCuerpoDeIntento(cuerpo);
    if (valor == null) return;
    intentos.push({ n: numero, nota: valor });
  });
  $('table.quizreviewsummary, table.quizattemptsummary').each((_, tabla) => {
    const nodo = $(tabla);
    const tarjeta = nodo.closest('.card, li, section');
    const numero = numeroDeIntento(tarjeta.find('h4, h3').first().text())
      || numeroDeIntento(nodo.prevAll('h4, h3').first().text());
    const { estado, nota } = notaDeFilasDeTabla($, nodo);
    if (intentoEnCurso(estado)) return;
    if (nota == null) return;
    intentos.push({ n: numero || 0, nota });
  });
  const bloques = String(texto).matchAll(/\b(?:intento|attempt)\s+(\d+)(?!\d)([\s\S]*?)(?=\b(?:intento|attempt)\s+\d+(?!\d)|$)/gi);
  for (const bloque of bloques) {
    const nota = notaDeCuerpoDeIntento(bloque[2]);
    if (nota == null) continue;
    intentos.push({ n: Number(bloque[1]), nota });
  }
  return intentos;
}

function elegirUltimoIntento(intentos) {
  if (!intentos.length) return null;
  const conNumero = intentos.filter((item) => item.n > 0);
  const lista = conNumero.length > 0 ? conNumero : intentos;
  lista.sort((a, b) => b.n - a.n);
  return lista[0].nota;
}

// La nota que vale es la del último intento terminado. «Calificación más alta»
// se usa solo si la página no lista intentos.
export function extraerNotaUltimoIntento(html) {
  if (!html) return null;
  const $ = load(html);
  const texto = ($('body').length ? $('body').text() : String(html)).replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  const intentos = extraerIntentosTerminados($, texto);
  const deIntentos = elegirUltimoIntento(intentos);
  if (deIntentos != null) return deIntentos;
  $('table').each((_, tabla) => {
    const encabezados = $(tabla).find('th').toArray().map((th) => limpiarTexto($(th).text()).toLowerCase());
    const textoEncabezado = encabezados.join(' ');
    if (!/intento|attempt/.test(textoEncabezado) || !/calific|grade|nota|mark/.test(textoEncabezado)) return;
    const columnaNota = encabezados.findIndex((encabezado) => esRotuloDeNota(encabezado));
    $(tabla).find('tbody tr, tr').each((__, fila) => {
      const celdas = $(fila).find('th, td').toArray().map((celda) => limpiarTexto($(celda).text()));
      const numero = Number(String(celdas[0] || '').match(/\d+/)?.[0]);
      if (!Number.isFinite(numero)) return;
      const cruda = columnaNota >= 0 ? celdas[columnaNota] : celdas.find((celda) => parsearNotaPublicada(celda) != null);
      const nota = parsearNotaPublicada(cruda);
      if (nota == null || intentoEnCurso(celdas.join(' '))) return;
      intentos.push({ n: numero, nota });
    });
  });
  const deTabla = elegirUltimoIntento(intentos);
  if (deTabla != null) return deTabla;
  const sueltas = [];
  $('tr').each((_, tr) => {
    const rotulo = limpiarTexto($(tr).find('th').first().text());
    if (!esRotuloDeNota(rotulo)) return;
    const celda = $(tr).find('td').first();
    const nota = notaDeRotuloCalificacion(celda.html() || celda.text());
    if (nota != null) sueltas.push(nota);
  });
  if (sueltas.length === 1) return sueltas[0];
  const final = texto.match(/calificaci[oó]n final(?:\s+en\s+este\s+cuestionario)?(?:\s+es)?\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:de|\/)\s*\d+(?:[.,]\d+)?)/i);
  if (final) return parsearNotaPublicada(final[1]);
  const suelta = texto.match(/(?:su calificaci[oó]n(?:\s+es)?|calificaci[oó]n m[aá]s alta)\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:de|\/)\s*\d+(?:[.,]\d+)?)/i);
  return suelta ? parsearNotaPublicada(suelta[1]) : null;
}

export function extraerProgresoDeActividad(html) {
  if (!html) return { nota: null, entregada: false };
  const nota = extraerNotaUltimoIntento(html);
  const $ = load(html);
  const plano = $('body').text();
  const hayRevision = $('a[href*="review.php"]').length > 0;
  const hayIntento = /\b(?:intento|attempt)\s+\d+/i.test(plano) && /finalizado|finished|completado|completed/i.test(plano);
  const envio = $('[data-region="activity-header"], .submissionstatustable, .submissionstatus, .submissionsummarytable').text();
  const enviada = /enviad|entregad|submitted|graded|para calificar/i.test(envio)
    && !/no entregad|no enviad|not submitted/i.test(envio);
  return { nota, entregada: nota != null || hayRevision || hayIntento || enviada };
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
    if (!intento?.materiaId || !intento.nombre) continue;
    if (intento.nota == null && !intento.entregada) continue;
    const indice = salida.findIndex((item) => item.materiaId === intento.materiaId && (
      (intento.id && item.id === intento.id)
      || coincidirNombreTarea(item.nombre, intento.nombre)
    ));
    const previa = indice >= 0 ? salida[indice] : null;
    const nota = intento.nota != null ? intento.nota : previa?.nota ?? null;
    const fila = {
      materiaId: intento.materiaId,
      materiaNombre: intento.materiaNombre || previa?.materiaNombre,
      nombre: intento.nombre,
      tabla: intento.tabla || previa?.tabla || (intento.id ? 'tareas' : 'nueva'),
      id: intento.id || previa?.id || null,
      fecha: intento.fecha || previa?.fecha,
      nota,
      entregada: Boolean(intento.entregada || nota != null || previa?.entregada),
      forzar: intento.nota != null
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
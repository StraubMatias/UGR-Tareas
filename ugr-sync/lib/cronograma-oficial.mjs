// Descubre el recurso «Cronograma» en cada curso, descarga PDF/DOCX y convierte
// el plan en filas de `cronograma_eventos` (origen `oficial`).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'cheerio';
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';
import { cabeceraCookies } from './autenticar.mjs';
import { textoDesdeDocx } from './docx-texto.mjs';
import { esTituloClaseGenericaDelCampus, extraerEventosCalendario } from './calendario.mjs';
import {
  elegirEnlaceZoomParaFilaHorario,
  elegirEnlaceZoomParaHorarios,
  inferirHorarioDesdeHtmlZoom,
  inferirHorarioDesdeTituloZoom
} from './zoom-cursada.mjs';
import { enlacesZoomConocidosParaMateria } from './zoom-enlaces-comision.mjs';

function limpiarTexto(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function sinAcento(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function slugId(texto) {
  return String(texto || '')
    .slice(0, 48)
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'evento';
}

function inferirAnioReferencia(texto) {
  const actual = new Date().getFullYear();
  const candidatos = [...String(texto || '').matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  const enRango = candidatos.filter((a) => a >= actual - 1 && a <= actual + 2);
  if (enRango.length > 0) return enRango.sort((a, b) => enRango.filter((x) => x === b).length - enRango.filter((x) => x === a).length)[0];
  return actual;
}

const RE_FECHA_COMPLETA = /\b(\d{1,2})\/(0[1-9]|1[0-2])\/(\d{4})\b/g;
const RE_FECHA_CORTA = /\b(\d{1,2})\/(0[1-9]|1[0-2])\b(?!\s*\/\s*\d)/g;

function diaMesValido(d, m) {
  const dia = Number(d);
  const mes = Number(m);
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || mes < 1 || mes > 12) return false;
  if (dia < 1 || dia > 31) return false;
  return true;
}

/** Texto de PDF con varias columnas pegadas en una celda (varias unidades / semanas). */
export function textoPareceColumnasFusionadas(texto) {
  const t = String(texto || '').trim();
  if (!t) return false;
  const unidades = [...t.matchAll(/\b(unidad|m[oó]dulo|modulo)\s*([ivx\d]+)\b/gi)];
  if (unidades.length >= 2) return true;
  if (t.length > 240) return true;
  if (/\b\d{1,2}\s+(UNIDAD|MÓDULO|MODULO)\b.*\b\d{1,2}\s+(UNIDAD|MÓDULO|MODULO)\b/i.test(t)) return true;
  return false;
}

function listarFechasCronogramaEnTexto(normalizado, anioRef) {
  const fechasCompletas = [...normalizado.matchAll(RE_FECHA_COMPLETA)].filter((m) => diaMesValido(m[1], m[2]));
  if (fechasCompletas.length > 0) return fechasCompletas;
  return [...normalizado.matchAll(RE_FECHA_CORTA)]
    .filter((m) => diaMesValido(m[1], m[2]))
    .map((m) => {
      const d = String(m[1]).padStart(2, '0');
      const mes = m[2];
      const y = String(anioRef);
      const textoFecha = m[0];
      return Object.assign([textoFecha, d, mes, y], { index: m.index });
    });
}

/** @param {string} texto */
export function parsearTextoCronogramaOficial(texto) {
  const normalizado = String(texto || '')
    .replace(/\r/g, '')
    .replace(/\f/g, '\n');
  const anioRef = inferirAnioReferencia(normalizado);
  const fechas = listarFechasCronogramaEnTexto(normalizado, anioRef);
  const filas = [];

  for (let i = 0; i < fechas.length; i += 1) {
    const [, d, m, y] = fechas[i];
    const iso = `${y}-${m}-${d}`;
    const fin = fechas[i + 1]?.index ?? normalizado.length;
    const post = normalizado.slice(fechas[i].index, fin);
    const fragmento = fragmentoInmediatoTrasFecha(post);
    const norm = sinAcento(fragmento);
    const previoCorto = normalizado.slice(Math.max(0, fechas[i].index - 200), fechas[i].index);
    const lineaPrevia = previoCorto
      .split('\n')
      .map((linea) => limpiarTexto(linea))
      .filter(Boolean)
      .pop() || '';

    let tipo = 'clase';
    let modalidad = 'sincrónico';
    if (/sin\s*clases|no\s+hay\s+clases/i.test(norm) && /turno|septiembre|mesas|examen/i.test(norm)) {
      tipo = 'sin_clases';
      modalidad = 'sin_clases';
    } else if (/2\s*do\s+llamado|1\s*er\s+llamado|llamado\s+turno/i.test(norm)) {
      tipo = 'examen_final';
    } else if (
      /\bparcial\b/.test(norm)
      && !/opcional/.test(norm)
      && !/unidades?\s+\d/.test(norm)
      && !/prueba(s)?\s+de\s+software/i.test(norm)
      && !textoPareceColumnasFusionadas(fragmento)
      && !/\bunidad\s+[ivx\d]/i.test(norm)
      && /\b(1|2|primer|segund|er|do)\b.*\b(parcial|examen)\b|\bexamen\s+parcial\b/i.test(fragmento)
    ) {
      tipo = 'examen';
    } else if (/\bconsulta\b/.test(norm)) {
      tipo = 'consulta';
    } else if (/\bentrega\b/.test(norm)) {
      tipo = 'entrega';
    } else if (/asincr|a\s+distancia/.test(norm)) {
      modalidad = 'asincrónico';
    }

    const prevNorm = sinAcento(lineaPrevia);
    if (/sin\s*clases/i.test(prevNorm) && /turno|septiembre|mesas|examen/i.test(prevNorm)) {
      tipo = 'sin_clases';
      modalidad = 'sin_clases';
    }

    let tituloSemilla = '';
    if (
      tipo === 'sin_clases'
      && /sin\s*clases/i.test(norm)
      && lineaPrevia
      && !/sin\s*clases|turno\s+de\s+examen/i.test(sinAcento(lineaPrevia))
    ) {
      tipo = 'clase';
      modalidad = 'sincrónico';
      tituloSemilla = lineaPrevia.replace(/^\d+\s+\w+\s+/i, '').trim() || lineaPrevia;
    }

    const titulo = tituloSemilla || extraerTituloBloque(fragmento, tipo);
    const detalles = extraerDetallesBloque(fragmento, titulo);
    filas.push({ fecha: iso, modalidad, tipo, titulo, detalles });
  }

  const vistos = new Set();
  return filas.filter((fila) => {
    const blob = `${fila.titulo} ${fila.detalles}`;
    if (textoPareceColumnasFusionadas(blob) && fila.tipo !== 'clase') return false;
    if (textoPareceColumnasFusionadas(blob) && fila.tipo === 'clase' && !/\b(unidad|m[oó]dulo|modulo)\s*[ivx\d]/i.test(fila.titulo)) {
      return false;
    }
    if (fila.tipo === 'examen' && /^parcial$/i.test(String(fila.titulo || '').trim())) return false;
    const clave = `${fila.fecha}|${fila.titulo}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function recortarCeldaHorizontal(celda) {
  let t = String(celda || '').trim();
  if (!t) return '';
  const otraFecha = t.search(/\b\d{1,2}\/(0[1-9]|1[0-2])(?:\/\d{4})?\b/);
  if (otraFecha > 8) t = t.slice(0, otraFecha).trim();
  const trozosUnidad = t.split(/\s+\d{1,2}\s+(?=(?:UNIDAD|MÓDULO|MODULO)\s)/i);
  if (trozosUnidad.length > 1) {
    const ultimo = trozosUnidad[trozosUnidad.length - 1].trim();
    if (ultimo.length > 8) {
      t = /^(UNIDAD|MÓDULO|MODULO)\b/i.test(ultimo) ? ultimo : `UNIDAD ${ultimo}`;
    }
  }
  if (/\bexamen\b/i.test(t)) {
    t = t.replace(/\s+\d{1,2}\s+(?:1|2)?\s*(?:er|do|ro)?\.?\s*examen\s*$/i, '').trim();
  }
  if (textoPareceColumnasFusionadas(t)) {
    const primeraUnidad = t.match(/^(.{0,200}?\b(?:UNIDAD|MÓDULO|MODULO)\s*[IVX\d]+[^0-9]{0,120})/i);
    if (primeraUnidad) t = limpiarTexto(primeraUnidad[1]);
  }
  return t.length > 220 ? `${t.slice(0, 217)}…` : t;
}

/** Solo el contenido de la celda de esa fecha (evita arrastrar columnas del PDF). */
function fragmentoInmediatoTrasFecha(post) {
  const texto = String(post || '');
  const match = texto.match(/\b(\d{1,2})\/(0[1-9]|1[0-2])(?:\/(\d{4}))?\b/);
  if (!match || match.index === undefined) return '';
  const despues = texto.slice(match.index + match[0].length).replace(/^\s+/, '');
  const primeraLinea = despues.split('\n')[0] || '';
  let celda = recortarCeldaHorizontal(primeraLinea);
  if (celda.length >= 12) return celda;

  const lineas = despues.split('\n');
  const acumulado = [];
  for (const linea of lineas) {
    const t = linea.trim();
    if (!t) {
      if (acumulado.length > 0) break;
      continue;
    }
    if (/\b\d{1,2}\/(0[1-9]|1[0-2])(?:\/\d{4})?\b/.test(t)) break;
    acumulado.push(t);
    const unido = acumulado.join(' ');
    if (unido.length > 200 || acumulado.length >= 3) break;
  }
  celda = recortarCeldaHorizontal(acumulado.join(' '));
  return celda;
}

function lineasUtilesTrasFecha(bloque) {
  const sinFecha = bloque
    .replace(/^\s*\d{1,2}\/\d{2}(?:\/\d{4})?\s*/, '')
    .split('\n')
    .map((parte) => limpiarTexto(parte))
    .filter((parte) => parte && !/^\d+$/.test(parte));
  return sinFecha.filter((parte) => !/^(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|domingo)$/i.test(parte));
}

function extraerTituloBloque(bloque, tipo) {
  if (tipo === 'sin_clases') return 'Sin clases';
  if (tipo === 'consulta') return 'Clase de consulta';
  if (tipo === 'examen_final') {
    const m = bloque.match(/(\d\s*[°º]?\s*(?:er|do|ro)?\s*llamado[^\n.]{0,80}|llamado\s+turno[^\n.]{0,60})/i);
    if (m) return limpiarTexto(m[0]);
  }
  if (tipo === 'examen' && /\bparcial\b/i.test(bloque)) {
    const m = bloque.match(/parcial[^.\n]{0,100}/i);
    if (m) return limpiarTexto(m[0].replace(/^[^Pp]*/, ''));
  }

  const unidades = [...bloque.matchAll(/\b(Unidad|Módulo|Modulo)\s*([IVX\d]+)\s*[:.\-–]?\s*([^\n.]{4,90})/gi)];
  const unidad = unidades[unidades.length - 1];
  if (unidad) {
    const tituloUnidad = limpiarTexto(`${unidad[1]} ${unidad[2]}: ${unidad[3]}`);
    if (tituloUnidad.length <= 120) return tituloUnidad;
  }

  const lineas = lineasUtilesTrasFecha(bloque);
  if (lineas.length > 0) {
    const primera = lineas[0];
    if (primera.length >= 3 && primera.length <= 120) return primera;
    if (primera.length > 120) {
      const corta = primera.split(/(?<=[.!?])\s+/)[0] || primera;
      return corta.length > 200 ? `${corta.slice(0, 197)}…` : corta;
    }
  }

  let cuerpo = bloque
    .replace(/\d{2}\/\d{2}\/\d{4}/g, ' ')
    .replace(/\b\d{1,2}\/\d{2}\b(?!\d)/g, ' ')
    .replace(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
    .replace(/clase\s*\/\s*sem|contenido\s*\/\s*actividades|fecha\b/gi, ' ')
    .replace(/^\s*\d+\s*/m, '')
    .replace(/"/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const corto = cuerpo.split(/(?<=[.!?])\s+/).find((parte) => parte.length > 12) || cuerpo;
  const titulo = limpiarTexto(corto);
  if (!titulo) return tipo === 'examen' ? 'Parcial' : 'Clase';
  return titulo.length > 200 ? `${titulo.slice(0, 197)}…` : titulo;
}

function extraerDetallesBloque(bloque, titulo) {
  if (textoPareceColumnasFusionadas(bloque) || textoPareceColumnasFusionadas(titulo)) return '';
  const resto = limpiarTexto(
    bloque
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
      .replace(titulo, '')
      .replace(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes)\b/gi, '')
  );
  if (!resto || resto.length < 20 || textoPareceColumnasFusionadas(resto)) return '';
  return resto.length > 180 ? `${resto.slice(0, 177)}…` : resto;
}

/** @param {string} html */
export function extraerRecursoCronogramaDeHtml(html, baseUrl = UGR_BASE_URL) {
  const $ = load(html || '');
  const candidatos = [];
  $('a[href*="mod/resource/view.php"]').each((_, a) => {
    const titulo = limpiarTexto($(a).text());
    if (!titulo || !/cronogram/i.test(titulo)) return;
    if (/archivo adjunto$/i.test(titulo)) return;
    const href = $(a).attr('href');
    if (!href) return;
    const url = new URL(href, baseUrl).toString();
    const id = url.match(/[?&]id=(\d+)/)?.[1] || '';
    let puntaje = 10;
    if (/cronograma de cursado|cronograma de cursada/i.test(titulo)) puntaje += 30;
    if (/cuatrimestre|2026/i.test(titulo)) puntaje += 10;
    if (/\.pdf|\.docx/i.test(titulo)) puntaje += 5;
    candidatos.push({ titulo, url, resourceId: id, puntaje });
  });
  candidatos.sort((a, b) => b.puntaje - a.puntaje);
  return candidatos[0] || null;
}

export async function descargarBufferRecursoCampus(cliente, resourceViewUrl) {
  const pagina = await cliente.pedir(resourceViewUrl);
  const $ = load(pagina.html);
  let href =
    $('a[href*="pluginfile.php"]').first().attr('href')
    || $('a[href*=".pdf"], a[href*=".docx"], a[href*=".doc"]').first().attr('href');
  if (!href) return null;
  const url = new URL(href, UGR_BASE_URL).toString();
  const respuesta = await fetch(url, {
    headers: {
      Cookie: cabeceraCookies(cliente.jar),
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)'
    }
  });
  if (!respuesta.ok) return null;
  const buffer = Buffer.from(await respuesta.arrayBuffer());
  const nombre = decodeURIComponent(url.split('/').pop()?.split('?')[0] || '');
  return { buffer, nombre, url };
}

export function textoDesdeBufferPlan(buffer, nombreArchivo = '') {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.subarray(0, 5).toString('utf8') === '%PDF-') {
    const dir = mkdtempSync(join(tmpdir(), 'ugr-cronograma-'));
    const pdf = join(dir, 'plan.pdf');
    const txt = join(dir, 'plan.txt');
    try {
      writeFileSync(pdf, buf);
      const resultado = spawnSync('pdftotext', ['-layout', pdf, txt], { encoding: 'utf8' });
      if (resultado.status !== 0) return '';
      return readFileSync(txt, 'utf8');
    } finally {
      try {
        unlinkSync(pdf);
      } catch { /* ignore */ }
      try {
        unlinkSync(txt);
      } catch { /* ignore */ }
    }
  }
  const nombre = String(nombreArchivo || '').toLowerCase();
  if (nombre.endsWith('.docx') || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    return textoDesdeDocx(buf);
  }
  return buf.toString('utf8');
}

const DIAS_TITULO = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5
};

function inferirDiaDesdeTituloZoom(titulo) {
  const norm = sinAcento(titulo);
  for (const [nombre, dia] of Object.entries(DIAS_TITULO)) {
    if (norm.includes(nombre)) return dia;
  }
  return null;
}

export function extraerUrlZoomJoinDesdeHtml(html) {
  const matches = [...String(html || '').matchAll(/https:\/\/[^"'<>\s]*zoom\.us\/j\/[^"'<>\s]+/g)];
  const preferida = matches.map((m) => m[0]).find((u) => /pwd=/.test(u)) || matches[0]?.[0];
  return preferida || '';
}

function idModuloCampus(url) {
  return String(url || '').match(/[?&]id=(\d+)/)?.[1] || '';
}

/** Resuelve join de Zoom o URL externa desde mod/zoom o mod/url del campus. */
export async function resolverUrlClaseDesdeCampus(cliente, urlCampus) {
  const url = String(urlCampus || '').trim();
  if (!url) return '';
  try {
    const pagina = await cliente.pedir(url);
    const join = extraerUrlZoomJoinDesdeHtml(pagina.html);
    if (join) return join;
    const $ = load(pagina.html);
    const externa = $('a[href*="zoom.us/j/"], a[href*="zoom.us/s/"]').first().attr('href')
      || $('a[href*="zoom.us"]').not('[href*="virtual.ugr"]').first().attr('href');
    if (externa) return new URL(externa, UGR_BASE_URL).toString();
    if (/mod\/url\/view\.php/i.test(url)) {
      const redir = pagina.html.match(/https:\/\/[^"'<>\s]*zoom\.us\/[^"'<>\s]+/i)?.[0];
      if (redir) return redir;
    }
  } catch {
    // Sin sesión o página caída: al menos el enlace al campus.
  }
  return url;
}

async function completarJoinEnEnlaces(cliente, enlaces) {
  for (const enlace of enlaces) {
    if (enlace.urlJoin && /zoom\.us\/j\//i.test(enlace.urlJoin)) continue;
    enlace.urlJoin = await resolverUrlClaseDesdeCampus(cliente, enlace.urlCampus);
    if (!enlace.dia || !enlace.horaInicio) {
      const horarioPagina = inferirHorarioDesdeHtmlZoom('', enlace.titulo);
      enlace.dia = enlace.dia ?? horarioPagina.dia;
      enlace.horaInicio = enlace.horaInicio ?? horarioPagina.horaInicio;
    }
  }
  return enlaces;
}

function fusionarEnlacesZoom(remotos, semilla) {
  const mapa = new Map();
  for (const enlace of [...semilla, ...remotos]) {
    const clave = idModuloCampus(enlace.urlCampus) || enlace.urlCampus;
    if (!clave) continue;
    const previo = mapa.get(clave);
    mapa.set(clave, previo ? { ...previo, ...enlace, urlJoin: enlace.urlJoin || previo.urlJoin } : enlace);
  }
  return [...mapa.values()];
}

function agregarEnlaceZoomCandidato(mapa, { titulo, urlCampus, dia = null, horaInicio = null, horaFin = null }) {
  if (!urlCampus) return;
  const clave = urlCampus.split('?')[0];
  const previo = mapa.get(clave);
  const horarioTitulo = inferirHorarioDesdeTituloZoom(titulo || '');
  const fila = {
    titulo: titulo || previo?.titulo || 'Zoom',
    urlCampus,
    urlJoin: previo?.urlJoin || '',
    dia: dia ?? previo?.dia ?? horarioTitulo.dia,
    horaInicio: horaInicio ?? previo?.horaInicio ?? horarioTitulo.horaInicio,
    horaFin: horaFin ?? previo?.horaFin ?? horarioTitulo.horaFin,
    inicio: previo?.inicio ?? horarioTitulo.inicio,
    fin: previo?.fin ?? horarioTitulo.fin
  };
  mapa.set(clave, fila);
}

function recolectarEnlacesZoomDeHtml(html, mapa) {
  const $ = load(html || '');
  $('a[href*="/mod/zoom/view.php"], a[href*="/mod/url/view.php"]').each((_, a) => {
    const titulo = limpiarTexto($(a).text() || $(a).attr('title') || '');
    const href = $(a).attr('href');
    if (!href || /reuniones de zoom/i.test(titulo)) return;
    if (/\/mod\/url\//i.test(href) && !/clase|sincr|zoom|encuentro|sala/i.test(titulo)) return;
    const urlCampus = new URL(href, UGR_BASE_URL).toString();
    agregarEnlaceZoomCandidato(mapa, { titulo, urlCampus, dia: inferirDiaDesdeTituloZoom(titulo) });
  });
}

async function enriquecerEnlacesZoomDesdeCalendario(cliente, cursoId, mapa) {
  try {
    const cal = await cliente.pedir(UGR_RUTAS.calendarioCurso(cursoId));
    for (const evento of extraerEventosCalendario(cal.html)) {
      const href = String(evento.url || '');
      if (!/\/mod\/zoom\/view\.php/i.test(href)) continue;
      const urlCampus = new URL(href, UGR_BASE_URL).toString();
      agregarEnlaceZoomCandidato(mapa, {
        titulo: evento.titulo,
        urlCampus,
        dia: evento.dia,
        horaInicio: evento.horaInicio,
        horaFin: evento.horaFin
      });
    }
  } catch {
    // Calendario ilegible: seguimos con la lista del curso.
  }
}

/** @returns {Promise<Array<{ titulo: string, urlCampus: string, urlJoin: string, dia: number|null, horaInicio?: string|null, horaFin?: string|null }>>} */
export async function extraerEnlacesZoomDelCurso(cliente, cursoId) {
  const mapa = new Map();
  const pagina = await cliente.pedir(UGR_RUTAS.curso(cursoId));
  recolectarEnlacesZoomDeHtml(pagina.html, mapa);

  try {
    const indice = await cliente.pedir(`/mod/zoom/index.php?id=${cursoId}`);
    recolectarEnlacesZoomDeHtml(indice.html, mapa);
  } catch {
    // Algunos cursos no exponen el índice de Zoom.
  }

  await enriquecerEnlacesZoomDesdeCalendario(cliente, cursoId, mapa);
  const enlaces = [...mapa.values()];

  await completarJoinEnEnlaces(cliente, enlaces);
  for (const enlace of enlaces) {
    try {
      const zoom = await cliente.pedir(enlace.urlCampus);
      const horarioPagina = inferirHorarioDesdeHtmlZoom(zoom.html, enlace.titulo);
      if (horarioPagina.dia) enlace.dia = enlace.dia ?? horarioPagina.dia;
      if (horarioPagina.horaInicio) enlace.horaInicio = enlace.horaInicio ?? horarioPagina.horaInicio;
      if (horarioPagina.horaFin) enlace.horaFin = enlace.horaFin ?? horarioPagina.horaFin;
      enlace.inicio = horarioPagina.inicio ?? enlace.inicio;
      enlace.fin = horarioPagina.fin ?? enlace.fin;
    } catch {
      // join ya resuelto en completarJoinEnEnlaces
    }
  }
  return enlaces;
}

/** Enlaces del curso + catálogo comisión 2026 para esta materia. */
export async function extraerEnlacesZoomParaMateria(cliente, cursoId, nombreMateria) {
  const semilla = enlacesZoomConocidosParaMateria(nombreMateria);
  let remotos = [];
  try {
    remotos = await extraerEnlacesZoomDelCurso(cliente, cursoId);
  } catch {
    remotos = [];
  }
  const fusionados = fusionarEnlacesZoom(remotos, semilla);
  await completarJoinEnEnlaces(cliente, fusionados);
  return fusionados;
}

export async function actualizarEnlacesZoomEnHorarios(db, materiaId, enlacesZoom) {
  if (!enlacesZoom?.length) return 0;
  const horarios = await db.execute({
    sql: 'SELECT id, dia, hora_inicio, hora_fin FROM horarios WHERE materia_id = ? AND alumno_id IS NULL',
    args: [materiaId]
  });
  if (horarios.rows.length === 0) return 0;

  const fallback = elegirEnlaceZoomParaHorarios(enlacesZoom, horarios.rows);

  let actualizados = 0;
  for (const fila of horarios.rows) {
    const urlElegida = elegirEnlaceZoomParaFilaHorario(enlacesZoom, fila) || fallback;
    if (!urlElegida) continue;
    await db.execute({
      sql: 'UPDATE horarios SET url_clase = ? WHERE id = ?',
      args: [urlElegida, fila.id]
    });
    actualizados += 1;
  }
  return actualizados;
}

/**
 * @param {import('@libsql/client').Client} db
 * @param {string} materiaId
 * @param {Array<{ fecha: string, modalidad: string, tipo: string, titulo: string, detalles: string }>} filas
 */
export async function aplicarCronogramaOficialEnDb(db, materiaId, filas, { reemplazarManual = false } = {}) {
  if (!filas?.length) return { insertados: 0, eliminadosUgr: 0, eliminadosManual: 0 };

  const manualPrevio = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM cronograma_eventos WHERE materia_id = ? AND origen = 'manual' AND fecha LIKE '2026-%'",
    args: [materiaId]
  });
  if (Number(manualPrevio.rows[0]?.n ?? 0) >= 8) {
    return { insertados: 0, eliminadosUgr: 0, eliminadosManual: 0, omitido: true };
  }

  let eliminadosUgr = 0;
  let eliminadosManual = 0;

  if (filas.length >= 5) {
    const ugr = await db.execute({
      sql: "DELETE FROM cronograma_eventos WHERE materia_id = ? AND origen = 'ugr'",
      args: [materiaId]
    });
    eliminadosUgr = Number(ugr.rowsAffected ?? 0);
    if (reemplazarManual) {
      const manual = await db.execute({
        sql: "DELETE FROM cronograma_eventos WHERE materia_id = ? AND origen = 'manual'",
        args: [materiaId]
      });
      eliminadosManual = Number(manual.rowsAffected ?? 0);
    }
  }

  const cambios = [];
  for (const fila of filas) {
    const titulo = String(fila.titulo).slice(0, 200);
    const id = `oficial_${materiaId}_${fila.fecha}_${slugId(titulo)}`;
    cambios.push({
      sql: `INSERT INTO cronograma_eventos (id, materia_id, fecha, modalidad, tipo, titulo, detalles, url, origen)
            VALUES (?, ?, ?, ?, ?, ?, ?, '', 'oficial')
            ON CONFLICT(materia_id, fecha, titulo) DO UPDATE SET
              modalidad = excluded.modalidad,
              tipo = excluded.tipo,
              detalles = excluded.detalles,
              origen = 'oficial'`,
      args: [id, materiaId, fila.fecha, fila.modalidad, fila.tipo, titulo, fila.detalles || '']
    });
  }
  if (cambios.length > 0) await db.batch(cambios, 'write');
  return { insertados: cambios.length, eliminadosUgr, eliminadosManual };
}

/**
 * @param {{ db: import('@libsql/client').Client, cliente: object, mapeos: Array<object> }} opts
 */
/** Completa `horarios.url_clase` con el join de Zoom del curso (mismo enlace todos los días). */
export async function sincronizarEnlacesZoomHorarios({ db, cliente, mapeos }) {
  let horariosActualizados = 0;
  for (const mapeo of mapeos || []) {
    const curso = mapeo?.curso;
    const materiaId = mapeo?.coincidencia?.materia?.id;
    if (!curso?.id || !materiaId) continue;
    const nombreMateria = mapeo?.coincidencia?.materia?.nombre || '';
    try {
      const enlacesZoom = await extraerEnlacesZoomParaMateria(cliente, curso.id, nombreMateria);
      horariosActualizados += await actualizarEnlacesZoomEnHorarios(db, materiaId, enlacesZoom);
    } catch {
      const soloSemilla = enlacesZoomConocidosParaMateria(nombreMateria);
      if (soloSemilla.length > 0) {
        for (const enlace of soloSemilla) {
          enlace.urlJoin = enlace.urlCampus;
        }
        horariosActualizados += await actualizarEnlacesZoomEnHorarios(db, materiaId, soloSemilla);
      }
    }
  }
  return horariosActualizados;
}

export async function sincronizarCronogramasOficialesDesdeCampus({ db, cliente, mapeos }) {
  const resumen = [];
  for (const mapeo of mapeos || []) {
    const curso = mapeo?.curso;
    const materiaId = mapeo?.coincidencia?.materia?.id;
    const nombre = mapeo?.coincidencia?.materia?.nombre || curso?.nombre || materiaId;
    if (!curso?.id || !materiaId) continue;

    const pagina = await cliente.pedir(UGR_RUTAS.curso(curso.id));
    const recurso = extraerRecursoCronogramaDeHtml(pagina.html);
    let filas = [];
    let fuente = '';

    if (recurso?.url) {
      const descarga = await descargarBufferRecursoCampus(cliente, recurso.url);
      if (descarga?.buffer?.length) {
        const texto = textoDesdeBufferPlan(descarga.buffer, descarga.nombre);
        filas = parsearTextoCronogramaOficial(texto);
        fuente = recurso.titulo;
      }
    }

    let aplicado = { insertados: 0, eliminadosUgr: 0, eliminadosManual: 0 };
    if (filas.length >= 3) {
      aplicado = await aplicarCronogramaOficialEnDb(db, materiaId, filas);
    }

    const enlacesZoom = await extraerEnlacesZoomDelCurso(cliente, curso.id);
    const horariosZoom = await actualizarEnlacesZoomEnHorarios(db, materiaId, enlacesZoom);

    resumen.push({
      materiaId,
      nombre,
      cursoId: curso.id,
      recurso: fuente || '(sin recurso Cronograma)',
      eventosPdf: filas.length,
      ...aplicado,
      horariosZoom
    });
  }
  return resumen;
}

export { esTituloClaseGenericaDelCampus };

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
import { esTituloClaseGenericaDelCampus } from './calendario.mjs';

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

/** @param {string} texto */
export function parsearTextoCronogramaOficial(texto) {
  const normalizado = String(texto || '')
    .replace(/\r/g, '')
    .replace(/\f/g, '\n');
  const anioRef = inferirAnioReferencia(normalizado);
  const fechasCompletas = [...normalizado.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)];
  const fechasCortas = [...normalizado.matchAll(/\b(\d{1,2})\/(\d{2})(?!\/\d)/g)];
  const fechas = fechasCompletas.length > 0
    ? fechasCompletas
    : fechasCortas.map((m) => {
      const d = String(m[1]).padStart(2, '0');
      const mes = m[2];
      const y = String(anioRef);
      const textoFecha = m[0];
      return Object.assign([textoFecha, d, mes, y], { index: m.index });
    });
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
    } else if (/\bparcial\b/.test(norm) && !/opcional/.test(norm) && !/unidades?\s+\d/.test(norm) && !/prueba(s)?\s+de\s+software/i.test(norm)) {
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
    const clave = `${fila.fecha}|${fila.titulo}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/** Solo las primeras líneas tras la fecha (evita arrastrar semanas posteriores del PDF). */
function fragmentoInmediatoTrasFecha(post) {
  const lineas = String(post || '').split('\n');
  const acumulado = [];
  let pasoFecha = false;
  for (const linea of lineas) {
    const t = linea.trim();
    if (!pasoFecha) {
      if (/\b\d{1,2}\/\d{2}(?:\/\d{4})?\b/.test(t)) pasoFecha = true;
      continue;
    }
    if (!t) {
      if (acumulado.length > 0) break;
      continue;
    }
    if (/\b\d{1,2}\/\d{2}(?:\/\d{4})?\b/.test(t)) break;
    acumulado.push(t);
    if (acumulado.join(' ').length > 360 || acumulado.length >= 5) break;
  }
  return acumulado.join('\n');
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
  const resto = limpiarTexto(
    bloque
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
      .replace(titulo, '')
      .replace(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes)\b/gi, '')
  );
  if (!resto || resto.length < 20) return '';
  return resto.length > 500 ? `${resto.slice(0, 497)}…` : resto;
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

/** @returns {Promise<Array<{ titulo: string, urlCampus: string, urlJoin: string, dia: number|null }>>} */
export async function extraerEnlacesZoomDelCurso(cliente, cursoId) {
  const pagina = await cliente.pedir(UGR_RUTAS.curso(cursoId));
  const $ = load(pagina.html);
  const vistos = new Set();
  const enlaces = [];
  $('a[href*="/mod/zoom/view.php"]').each((_, a) => {
    const titulo = limpiarTexto($(a).text());
    const href = $(a).attr('href');
    if (!href || !titulo || /reuniones de zoom/i.test(titulo)) return;
    const urlCampus = new URL(href, UGR_BASE_URL).toString();
    if (vistos.has(urlCampus)) return;
    vistos.add(urlCampus);
    enlaces.push({
      titulo,
      urlCampus,
      urlJoin: '',
      dia: inferirDiaDesdeTituloZoom(titulo)
    });
  });

  for (const enlace of enlaces) {
    try {
      const zoom = await cliente.pedir(enlace.urlCampus);
      enlace.urlJoin = extraerUrlZoomJoinDesdeHtml(zoom.html) || enlace.urlCampus;
    } catch {
      enlace.urlJoin = enlace.urlCampus;
    }
  }
  return enlaces;
}

export async function actualizarEnlacesZoomEnHorarios(db, materiaId, enlacesZoom) {
  if (!enlacesZoom?.length) return 0;
  const horarios = await db.execute({
    sql: 'SELECT id, dia FROM horarios WHERE materia_id = ? AND alumno_id IS NULL',
    args: [materiaId]
  });
  let actualizados = 0;
  for (const fila of horarios.rows) {
    const dia = Number(fila.dia);
    let url =
      enlacesZoom.find((e) => e.dia === dia && e.urlJoin)?.urlJoin
      || (enlacesZoom.length === 1 ? enlacesZoom[0].urlJoin : '');
    if (!url) {
      const generico = enlacesZoom.find((e) => !e.dia && e.urlJoin);
      url = generico?.urlJoin || '';
    }
    if (!url) continue;
    await db.execute({
      sql: 'UPDATE horarios SET url_clase = ? WHERE id = ?',
      args: [url, fila.id]
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

import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import { cabeceraCookies } from './autenticar.mjs';
import { textoDesdeDocx } from './docx-texto.mjs';
import { parsearNotaPublicada } from './tareas.mjs';

function limpiarTexto(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

export function esUrlAssign(url) {
  return /assign\/view\.php|\/mod\/assign\//i.test(String(url || ''));
}

/**
 * Solo buzones con varias entregas explícitas en el nombre (SGSI).
 * No usar "trabajo práctico" suelto: matchea tareas normales de otras materias (p. ej. EGR).
 */
export function esTareaBuzonEntregasMultiples(nombre) {
  return /entregas?\s+del\s+trabajo/i.test(String(nombre || ''));
}

function completarUrl(href, baseUrl) {
  if (!href) return '';
  try {
    return new URL(href, baseUrl || undefined).toString();
  } catch {
    return href;
  }
}

/** Busca una nota 1–10 en texto de devolución (Word o comentario del profe). */
export function extraerNotaDeTextoDevolucion(texto) {
  const plano = limpiarTexto(texto);
  if (!plano) return null;
  const patrones = [
    /devoluci[oó]n[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*(?:\/|\s*de\s*)\s*10\b/i,
    /entrega\s*\d+[\s\S]{0,80}?(\d+(?:[.,]\d+)?)\s*(?:\/|\s*de\s*)\s*10\b/i,
    /nota\s*(?:final|obtenida|del\s+trabajo)?\s*(?:es|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:\/|\s*de\s*)\s*10\b/i,
    /calificaci[oó]n\s*(?:final)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:\/|\s*de\s*)\s*10\b/i,
    /puntuaci[oó]n\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:\/|\s*de\s*)\s*10\b/i,
    /(\d+(?:[.,]\d+)?)\s*\/\s*10\b/,
    /obtuvo\s+(?:un\s+)?(\d+(?:[.,]\d+)?)\s*(?:\/|\s*de\s*)\s*10\b/i,
    /nota\s*:?\s*(\d+(?:[.,]\d+)?)\b/i
  ];
  for (const patron of patrones) {
    const m = plano.match(patron);
    if (!m) continue;
    const nota = parsearNotaPublicada(m[1]);
    if (nota != null) return nota;
  }
  return null;
}

function filaDeTabla($, tabla, rotulos) {
  const salida = {};
  $(tabla).find('tr').each((_, tr) => {
    const rotulo = limpiarTexto($(tr).find('th').first().text()).toLowerCase();
    if (!rotulos.some((r) => rotulo.includes(r))) return;
    const celda = $(tr).find('td').first();
    const clave = rotulos.find((r) => rotulo.includes(r));
    salida[clave] = {
      html: celda.html() || '',
      texto: limpiarTexto(celda.text())
    };
  });
  return salida;
}

function enlacesDevolucion($, alcance, baseUrl) {
  const archivos = [];
  alcance.find('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const nombre = limpiarTexto($(a).text()) || 'Devolución';
    if (!/pluginfile\.php|\.docx|\.doc|\.pdf/i.test(href) && !/devoluci[oó]n|retroalimentaci[oó]n|feedback|entrega\s*\d/i.test(nombre)) return;
    archivos.push({
      url: completarUrl(href, baseUrl),
      nombre
    });
  });
  return archivos;
}

export function acortarEstadoCampus(texto) {
  const t = limpiarTexto(texto);
  if (!t) return '';
  const fila = t.match(/estado de la entrega\s+(.+?)(?:\s+estado de la calificación|\s+n[uú]mero del intento|$)/i);
  if (fila) return limpiarTexto(fila[1]).slice(0, 80);
  const corto = t.match(
    /^(reabierto|entregado|enviado para calificar|calificado|sin entregar|no entregado|graded|submitted)/i
  );
  if (corto) return corto[1];
  if (t.length <= 80) return t;
  return `${t.slice(0, 77)}…`;
}

function parsearBloqueIntento($, alcance, numero, baseUrl) {
  const tablas = alcance.find('table');
  let estadoEntrega = '';
  let notaHtml = null;
  let comentario = '';
  let archivos = [];
  tablas.each((_, tabla) => {
    const filas = filaDeTabla($, tabla, [
      'estado de la entrega',
      'estado de la calificación',
      'calificación',
      'comentarios de retroalimentación',
      'archivos de retroalimentación'
    ]);
    if (filas['estado de la entrega']) estadoEntrega = filas['estado de la entrega'].texto;
    const cal = filas.calificación || filas['estado de la calificación'];
    if (cal) notaHtml = parsearNotaPublicada(cal.html) ?? parsearNotaPublicada(cal.texto);
    if (filas['comentarios de retroalimentación']) {
      comentario = filas['comentarios de retroalimentación'].texto;
    }
    if (filas['archivos de retroalimentación']) {
      archivos = enlacesDevolucion($, $(tabla).find('td').last(), baseUrl);
    }
  });
  if (archivos.length === 0) archivos = enlacesDevolucion($, alcance, baseUrl);
  if (!estadoEntrega) {
    const textoBloque = limpiarTexto(alcance.text());
    const m = textoBloque.match(/estado de la entrega\s+([^\n]+)/i);
    if (m) estadoEntrega = limpiarTexto(m[1]);
  }
  estadoEntrega = acortarEstadoCampus(estadoEntrega);
  const tieneDevolucion = archivos.length > 0 || comentario.length > 20;
  return {
    numero,
    estado: estadoEntrega,
    notaCampus: notaHtml,
    comentarioProf: comentario,
    archivos,
    tieneDevolucion
  };
}

function bloqueIntentoDesdeTitulo($, titulo, baseUrl) {
  const texto = limpiarTexto($(titulo).text());
  const m = texto.match(/^Intento\s+(\d+)\s*:?/i) || texto.match(/^Attempt\s+(\d+)\s*:?/i);
  if (!m) return null;
  const numero = Number(m[1]);
  const $titulo = $(titulo);
  const bloque = $('<div class="ugr-attempt-block"/>');
  bloque.append($titulo.clone());
  bloque.append($titulo.nextUntil('h3, h4, .submissionstatustable, [data-region="submission-status"]').clone());
  return { numero, datos: parsearBloqueIntento($, bloque, numero, baseUrl) };
}

function parsearIntentosEnRegion($, region, baseUrl) {
  const porNumero = new Map();
  region.find('h3, h4').each((_, titulo) => {
    const parsed = bloqueIntentoDesdeTitulo($, titulo, baseUrl);
    if (parsed) porNumero.set(parsed.numero, parsed.datos);
  });
  return porNumero;
}

/**
 * Parsea la página /mod/assign/view.php con intentos de entrega y devoluciones.
 */
export function extraerEntregasAssign(html, baseUrl = '') {
  if (!html || (!/\/mod\/assign\//i.test(html) && !/path-mod-assign|submissionstatustable/i.test(html))) {
    return { entregas: [], intentoActual: null, requiereNuevaEntrega: false };
  }
  const $ = load(html);
  const regionEnvio = $(
    '[data-region="submission-status"], .submissionstatus, .submissionsummarytable'
  ).first();
  const tablasEnvio = $('.submissionstatustable, [data-region="submission-status"]').filter(
    (_, el) => !$(el).closest('#region-previous-attempts, [data-region="previous-attempts"]').length
  );
  const textoEnvio = limpiarTexto(
    (regionEnvio.length ? regionEnvio : tablasEnvio.first()).text() || ''
  );
  const planoEnvio = limpiarTexto(tablasEnvio.text() || textoEnvio);
  const intentoActual = Number(
    planoEnvio.match(/este\s+es\s+el\s+intento\s+(\d+)/i)?.[1]
    || textoEnvio.match(/este\s+es\s+el\s+intento\s+(\d+)/i)?.[1]
    || textoEnvio.match(/attempt\s+(\d+)/i)?.[1]
  ) || null;

  const estadoActual = acortarEstadoCampus(
    textoEnvio.match(/estado de la entrega\s+([^\n]+)/i)?.[1]
    || textoEnvio.match(/estado de la calificación\s+([^\n]+)/i)?.[1]
    || ''
  );
  const requiereNuevaEntrega = /reabiert|reopened/i.test(estadoActual)
    || /reabiert|reopened/i.test(textoEnvio);

  const porNumero = new Map();
  const regionAnteriores = $('#region-previous-attempts, [data-region="previous-attempts"]').first();
  if (regionAnteriores.length) {
    for (const [num, datos] of parsearIntentosEnRegion($, regionAnteriores, baseUrl)) {
      porNumero.set(num, datos);
    }
  }

  $('[data-region="attempt-summary"]').each((_, region) => {
    for (const [num, datos] of parsearIntentosEnRegion($, $(region), baseUrl)) {
      if (!porNumero.has(num)) porNumero.set(num, datos);
    }
  });

  if (porNumero.size === 0) {
    const archivosPagina = enlacesDevolucion($, $('body'), baseUrl);
    if (archivosPagina.length > 0 || /retroalimentaci[oó]n|pluginfile\.php.*assignfeedback/i.test(html)) {
      const comentario = limpiarTexto(
        $('td.cell').filter((_, td) => /retroalimentaci[oó]n/i.test($(td).prev('th').text())).first().text()
      );
      const n = intentoActual || 1;
      porNumero.set(n, {
        numero: n,
        estado: estadoActual,
        notaCampus: parsearNotaPublicada(textoEnvio),
        comentarioProf: comentario,
        archivos: archivosPagina,
        tieneDevolucion: archivosPagina.length > 0 || comentario.length > 15
      });
    }
  }

  if (intentoActual && !porNumero.has(intentoActual)) {
    porNumero.set(intentoActual, {
      numero: intentoActual,
      estado: estadoActual,
      notaCampus: parsearNotaPublicada(textoEnvio),
      comentarioProf: '',
      archivos: [],
      tieneDevolucion: false
    });
  }

  const numeros = [...porNumero.keys()].sort((a, b) => a - b);
  const devolucionReal = (fila) => (
    (fila.archivos?.length > 0) || (fila.comentarioProf?.length > 15) || fila.notaCampus != null
  );
  const cerradasConDev = numeros.filter((numero) => {
    const esActiva = intentoActual != null && numero === intentoActual;
    return !esActiva && devolucionReal(porNumero.get(numero));
  });
  let indiceEntrega = 0;
  const metaPorNumero = new Map();
  for (const numero of cerradasConDev) {
    indiceEntrega += 1;
    metaPorNumero.set(numero, {
      indiceEntrega: indiceEntrega,
      pendiente: false,
      esActiva: false
    });
  }
  if (intentoActual != null && !metaPorNumero.has(intentoActual)) {
    const filaAct = porNumero.get(intentoActual) || {};
    const pendiente = requiereNuevaEntrega
      || /reabiert|reopened/i.test(filaAct.estado || '')
      || /no entregad|sin entregar|not submitted/i.test(filaAct.estado || '')
      || !devolucionReal(filaAct);
    indiceEntrega += 1;
    metaPorNumero.set(intentoActual, {
      indiceEntrega: indiceEntrega,
      pendiente,
      esActiva: true
    });
  }
  const entregas = numeros
    .filter((numero) => metaPorNumero.has(numero))
    .map((numero) => {
      const fila = porNumero.get(numero);
      const meta = metaPorNumero.get(numero);
      return {
        ...fila,
        numero,
        esActiva: meta.esActiva,
        indiceEntrega: meta.indiceEntrega,
        pendiente: meta.pendiente
      };
    });

  return { entregas, intentoActual, requiereNuevaEntrega, estadoActual };
}

export async function descargarArchivoConSesion(cliente, url) {
  if (!cliente?.jar || !url) return null;
  try {
    let actual = String(url);
    for (let salto = 0; salto < 6; salto += 1) {
      const control = new AbortController();
      const timer = setTimeout(() => control.abort(), 45000);
      let respuesta;
      try {
        respuesta = await fetch(actual, {
          headers: {
            Cookie: cabeceraCookies(cliente.jar),
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)',
            Accept: '*/*'
          },
          redirect: 'manual',
          signal: control.signal
        });
      } finally {
        clearTimeout(timer);
      }
      if (!respuesta) return null;
      if (respuesta.status >= 300 && respuesta.status < 400) {
        const destino = respuesta.headers.get('location');
        if (!destino) return null;
        actual = new URL(destino, actual).toString();
        continue;
      }
      if (!respuesta.ok) return null;
      const buf = Buffer.from(await respuesta.arrayBuffer());
      if (buf.length < 4) return null;
      const cabeza = buf.subarray(0, Math.min(120, buf.length)).toString('utf8').toLowerCase();
      if (cabeza.includes('<!doctype') || cabeza.includes('<html')) return null;
      if (buf[0] === 0x50 && buf[1] === 0x4b) return buf;
      return buf;
    }
    return null;
  } catch {
    return null;
  }
}

export async function enriquecerNotasDesdeDevoluciones(cliente, entregas) {
  const salida = [];
  for (const entrega of entregas) {
    let nota = entrega.notaCampus;
    let notaOrigen = nota != null ? 'campus' : null;
    let devolucionTexto = '';
    let feedbackUrl = entrega.archivos?.[0]?.url || '';
    let feedbackNombre = entrega.archivos?.[0]?.nombre || '';

    if (entrega.comentarioProf) {
      devolucionTexto = entrega.comentarioProf.slice(0, 4000);
      const deComentario = extraerNotaDeTextoDevolucion(entrega.comentarioProf);
      if (nota == null && deComentario != null) {
        nota = deComentario;
        notaOrigen = 'devolucion_texto';
      }
    }

    for (const archivo of entrega.archivos || []) {
      if (!/\.docx?$/i.test(archivo.url) && !/\.docx?/i.test(archivo.nombre)) continue;
      let buffer = null;
      try {
        buffer = await descargarArchivoConSesion(cliente, archivo.url);
      } catch {
        buffer = null;
      }
      if (!buffer) continue;
      const texto = textoDesdeDocx(buffer);
      if (texto && texto.length > devolucionTexto.length) devolucionTexto = texto.slice(0, 8000);
      const deDocx = extraerNotaDeTextoDevolucion(texto);
      if (deDocx != null) {
        nota = deDocx;
        notaOrigen = 'devolucion_docx';
        feedbackUrl = archivo.url;
        feedbackNombre = archivo.nombre;
        break;
      }
    }

    if (nota == null && feedbackNombre) {
      const deNombre = feedbackNombre.match(/entrega\s*(\d+)/i);
      if (deNombre && entrega.comentarioProf) {
        const deCom = extraerNotaDeTextoDevolucion(entrega.comentarioProf);
        if (deCom != null) {
          nota = deCom;
          notaOrigen = 'devolucion_texto';
        }
      }
    }

    salida.push({
      ...entrega,
      nota,
      notaOrigen,
      devolucionTexto,
      feedbackUrl,
      feedbackNombre
    });
  }
  return salida;
}

export function resumirEntregasParaTablero(entregas) {
  const activa = entregas.find((e) => e.esActiva);
  const conNota = [...entregas]
    .filter((e) => e.nota != null && !e.esActiva)
    .sort((a, b) => (b.indiceEntrega ?? b.numero) - (a.indiceEntrega ?? a.numero));
  const ultimaNota = conNota[0] ?? null;
  const hayOtraEntregaAbierta = Boolean(
    activa && (activa.pendiente || /reabiert|reopened/i.test(activa.estado || ''))
  );
  const entregada = !hayOtraEntregaAbierta;
  return {
    notaParaTablero: ultimaNota?.nota ?? null,
    notaOrigen: ultimaNota?.notaOrigen ?? null,
    entregada,
    entregaActivaIndice: activa?.indiceEntrega ?? null
  };
}

export async function aplicarEntregasAssignEnDb({
  db,
  tareaId,
  alumnoId,
  alumnoNombre,
  entregas
}) {
  if (!tareaId || !alumnoId || !Array.isArray(entregas)) return resumirEntregasParaTablero([]);

  await db.execute({
    sql: 'DELETE FROM tareas_entregas WHERE tarea_id = ? AND alumno_id = ?',
    args: [tareaId, alumnoId]
  });

  const escrituras = [];
  const ahora = new Date().toISOString();
  for (const entrega of entregas) {
    const id = `te_${tareaId}_${alumnoId}_${entrega.numero}`;
    escrituras.push({
      sql: `INSERT INTO tareas_entregas (
              id, tarea_id, alumno_id, numero, indice_entrega, es_activa, estado, nota, nota_origen,
              comentario_prof, feedback_url, feedback_nombre, devolucion_texto, sincronizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tarea_id, alumno_id, numero) DO UPDATE SET
              indice_entrega = excluded.indice_entrega,
              es_activa = excluded.es_activa,
              estado = excluded.estado,
              nota = excluded.nota,
              nota_origen = excluded.nota_origen,
              comentario_prof = excluded.comentario_prof,
              feedback_url = excluded.feedback_url,
              feedback_nombre = excluded.feedback_nombre,
              devolucion_texto = excluded.devolucion_texto,
              sincronizado_en = excluded.sincronizado_en`,
      args: [
        id,
        tareaId,
        alumnoId,
        entrega.numero,
        entrega.indiceEntrega,
        entrega.esActiva ? 1 : 0,
        entrega.estado || '',
        entrega.nota != null ? String(entrega.nota) : null,
        entrega.notaOrigen || null,
        entrega.comentarioProf ? String(entrega.comentarioProf).slice(0, 4000) : null,
        entrega.feedbackUrl || null,
        entrega.feedbackNombre || null,
        entrega.devolucionTexto ? entrega.devolucionTexto.slice(0, 8000) : null,
        ahora
      ]
    });
  }
  if (escrituras.length) await db.batch(escrituras, 'write');

  const resumen = resumirEntregasParaTablero(entregas);
  const entregasCalificadas = entregas.filter((e) => !e.esActiva && e.nota != null).length;
  const otraFasePendiente = entregas.some(
    (e) => e.esActiva && (e.pendiente || /reabiert|reopened/i.test(e.estado || ''))
  );
  if (!resumen.entregada && entregasCalificadas > 0 && otraFasePendiente) {
    await db.execute({
      sql: `DELETE FROM completadas WHERE tarea_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))`,
      args: [tareaId, alumnoId, alumnoNombre || '']
    });
  } else if (resumen.entregada) {
    await db.execute({
      sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)
            ON CONFLICT(tarea_id, alumno) DO UPDATE SET
              alumno_id = excluded.alumno_id,
              completada_en = CASE
                WHEN completadas.completada_en IS NOT NULL AND TRIM(completadas.completada_en) != ''
                THEN completadas.completada_en
                ELSE excluded.completada_en
              END`,
      args: [tareaId, alumnoId, alumnoNombre || '', ahora]
    });
  }

  return resumen;
}

export async function sincronizarEntregasAssignDesdeHtml({
  cliente,
  db,
  tareaId,
  alumnoId,
  alumnoNombre,
  html,
  baseUrl = 'https://virtual.ugr.edu.ar/'
}) {
  const { entregas: crudas } = extraerEntregasAssign(html, baseUrl);
  if (!crudas.length) return { entregas: [], resumen: resumirEntregasParaTablero([]) };
  const enriquecidas = await enriquecerNotasDesdeDevoluciones(cliente, crudas);
  const resumen = await aplicarEntregasAssignEnDb({
    db,
    tareaId,
    alumnoId,
    alumnoNombre,
    entregas: enriquecidas
  });
  return { entregas: enriquecidas, resumen };
}

/** Prioridad al inicio del sync: buzones assign con varias entregas y devoluciones Word. */
/** Quita hitos viejos en tareas que no son buzón «Entregas del trabajo» (p. ej. EGR primera entrega). */
export async function quitarHitosAssignDeTareasSimples(db, materiaIds) {
  if (!materiaIds?.length) return;
  const marcas = materiaIds.map(() => '?').join(', ');
  await db.execute({
    sql: `DELETE FROM tareas_entregas WHERE tarea_id IN (
            SELECT t.id FROM tareas t
            WHERE t.materia_id IN (${marcas})
              AND LOWER(t.nombre) NOT LIKE '%entregas del trabajo%'
          )`,
    args: [...materiaIds]
  });
}

export async function listarTareasAssignConUrl(db, materiaIds) {
  if (!materiaIds?.length) return [];
  const marcas = materiaIds.map(() => '?').join(', ');
  const res = await db.execute({
    sql: `SELECT t.id, t.materia_id, t.nombre, t.url, m.nombre AS materia
          FROM tareas t JOIN materias m ON m.id = t.materia_id
          WHERE t.materia_id IN (${marcas}) AND TRIM(COALESCE(t.url, '')) != ''
            AND (LOWER(t.url) LIKE '%assign%')`,
    args: [...materiaIds]
  });
  return res.rows
    .filter((fila) => fila?.url && esTareaBuzonEntregasMultiples(fila.nombre))
    .map((fila) => ({
      id: String(fila.id),
      materia_id: String(fila.materia_id),
      nombre: String(fila.nombre),
      url: String(fila.url),
      materia: String(fila.materia || '')
    }));
}

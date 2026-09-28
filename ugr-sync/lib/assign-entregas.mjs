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
    if (!/pluginfile\.php|\.docx|\.doc|\.pdf/i.test(href) && !/devoluci[oó]n|retroalimentaci[oó]n|feedback/i.test(nombre)) return;
    archivos.push({
      url: completarUrl(href, baseUrl),
      nombre
    });
  });
  return archivos;
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
  const textoBloque = limpiarTexto(alcance.text());
  if (!estadoEntrega) {
    const m = textoBloque.match(/estado de la entrega\s+([^\n]+)/i);
    if (m) estadoEntrega = limpiarTexto(m[1]);
  }
  const tieneDevolucion = archivos.length > 0 || comentario.length > 20;
  return {
    numero,
    estado: estadoEntrega || textoBloque.slice(0, 120),
    notaCampus: notaHtml,
    comentarioProf: comentario,
    archivos,
    tieneDevolucion
  };
}

/**
 * Parsea la página /mod/assign/view.php con intentos de entrega y devoluciones.
 */
export function extraerEntregasAssign(html, baseUrl = '') {
  if (!html || (!/\/mod\/assign\//i.test(html) && !/path-mod-assign|submissionstatustable/i.test(html))) {
    return { entregas: [], intentoActual: null, requiereNuevaEntrega: false };
  }
  const $ = load(html);
  const plano = $('body').text().replace(/\u00a0/g, ' ');
  const intentoActual = Number(
    plano.match(/este es el intento\s+(\d+)/i)?.[1]
    || plano.match(/n[uú]mero del intento[\s\S]*?(\d+)/i)?.[1]
    || plano.match(/attempt\s+(\d+)/i)?.[1]
  ) || null;

  const envio = limpiarTexto(
    $('[data-region="submission-status"], .submissionstatustable, .submissionstatus, .submissionsummarytable').text()
    || plano.slice(0, 2500)
  );
  const estadoActual = envio.match(/estado de la entrega\s+([^\n]+)/i)?.[1]
    || envio.match(/estado de la calificación\s+([^\n]+)/i)?.[1]
    || '';
  const requiereNuevaEntrega = /reabiert|reopened/i.test(estadoActual)
    || /reabiert|reopened/i.test(envio);

  const porNumero = new Map();

  $('#region-previous-attempts h3, #region-previous-attempts h4, h3, h4, h5, .card-title, .collapsible-actions').each((_, titulo) => {
    const texto = limpiarTexto($(titulo).text());
    const m = texto.match(/^Intento\s+(\d+)\s*:?/i) || texto.match(/^Attempt\s+(\d+)\s*:?/i);
    if (!m) return;
    const numero = Number(m[1]);
    const tarjeta = $(titulo).closest('.card, .box, section, li, [data-region="attempt-summary"], .generalbox');
    const alcance = tarjeta.length ? tarjeta : $(titulo).parent().parent();
    porNumero.set(numero, parsearBloqueIntento($, alcance, numero, baseUrl));
  });

  const bloquesTexto = plano.split(/\bIntento\s+(\d+)\s*:/i);
  for (let i = 1; i < bloquesTexto.length; i += 2) {
    const numero = Number(bloquesTexto[i]);
    if (!Number.isFinite(numero) || porNumero.has(numero)) continue;
    const fragmento = bloquesTexto[i + 1] || '';
    const $frag = load(`<div id="frag">${fragmento.slice(0, 12000)}</div>`);
    porNumero.set(numero, parsearBloqueIntento($frag, $frag('#frag'), numero, baseUrl));
  }

  if (porNumero.size === 0) {
    const archivosPagina = enlacesDevolucion($, $('body'), baseUrl);
    if (archivosPagina.length > 0 || /retroalimentaci[oó]n|pluginfile\.php.*assignfeedback/i.test(html)) {
      const comentario = limpiarTexto(
        $('td.cell').filter((_, td) => /retroalimentaci[oó]n/i.test($(td).prev('th').text())).first().text()
      );
      const n = intentoActual || 1;
      porNumero.set(n, {
        numero: n,
        estado: estadoActual || envio.slice(0, 80),
        notaCampus: parsearNotaPublicada(envio),
        comentarioProf: comentario,
        archivos: archivosPagina,
        tieneDevolucion: archivosPagina.length > 0 || comentario.length > 15
      });
    }
  }

  if (intentoActual && !porNumero.has(intentoActual)) {
    porNumero.set(intentoActual, {
      numero: intentoActual,
      estado: estadoActual || envio.slice(0, 80),
      notaCampus: parsearNotaPublicada(envio),
      comentarioProf: '',
      archivos: [],
      tieneDevolucion: false
    });
  }

  const numeros = [...porNumero.keys()].sort((a, b) => a - b);
  let indiceEntrega = 0;
  const entregas = numeros.map((numero) => {
    const fila = porNumero.get(numero);
    const esActiva = intentoActual != null && numero === intentoActual;
    const cerradaConDevolucion = !esActiva && (fila.tieneDevolucion || fila.notaCampus != null);
    let indice = null;
    let pendiente = false;
    if (cerradaConDevolucion) {
      indiceEntrega += 1;
      indice = indiceEntrega;
    } else if (esActiva && requiereNuevaEntrega) {
      indice = indiceEntrega + 1;
      pendiente = true;
    } else if (esActiva) {
      indice = indiceEntrega + 1;
      pendiente = /no entregad|sin entregar|not submitted/i.test(fila.estado);
    }
    return {
      ...fila,
      esActiva,
      indiceEntrega: indice,
      pendiente
    };
  });

  return { entregas, intentoActual, requiereNuevaEntrega, estadoActual };
}

export async function descargarArchivoConSesion(cliente, url) {
  if (!cliente?.jar || !url) return null;
  try {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), 22000);
    let respuesta;
    try {
      respuesta = await fetch(url, {
        headers: {
          Cookie: cabeceraCookies(cliente.jar),
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)'
        },
        signal: control.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!respuesta?.ok) return null;
    return Buffer.from(await respuesta.arrayBuffer());
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
      const buffer = await descargarArchivoConSesion(cliente, archivo.url);
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
  const conNota = [...entregas]
    .filter((e) => e.nota != null)
    .sort((a, b) => (b.indiceEntrega ?? b.numero) - (a.indiceEntrega ?? a.numero));
  const ultimaNota = conNota[0] ?? null;
  const activa = entregas.find((e) => e.esActiva);
  const entregada = !(activa?.pendiente || (activa && /reabiert|reopened/i.test(activa.estado || '')));
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
  if (!resumen.entregada) {
    await db.execute({
      sql: 'DELETE FROM completadas WHERE tarea_id = ? AND alumno_id = ?',
      args: [tareaId, alumnoId]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)
            ON CONFLICT(tarea_id, alumno) DO NOTHING`,
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
export async function listarTareasAssignConUrl(db, materiaIds, alumnoId) {
  if (!materiaIds?.length) return [];
  const marcas = materiaIds.map(() => '?').join(', ');
  const res = await db.execute({
    sql: `SELECT t.id, t.materia_id, t.nombre, t.url, m.nombre AS materia
          FROM tareas t JOIN materias m ON m.id = t.materia_id
          WHERE t.materia_id IN (${marcas}) AND TRIM(COALESCE(t.url, '')) != ''
            AND (LOWER(t.url) LIKE '%assign%')`,
    args: [...materiaIds]
  });
  return res.rows.filter((fila) => fila?.url);
}

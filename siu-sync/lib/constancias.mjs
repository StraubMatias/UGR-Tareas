// SIU Guaraní — solicitudes de constancias y certificados (Autogestión → Solicitudes).
// Flujo real:
//   solicitudes                      → listado de solicitudes del alumno
//   solicitudes/nueva_solicitud      → formulario (constancia, copias, presentar, observaciones)
//   solicitudes/get_cantidad_copias  → cuántas copias permite cada tipo de constancia
//   solicitudes/get_formulario_filtro→ filtro extra (solo examen final / promedio)
//   solicitudes/turno_examen, get_actividad_anio, get_llamado_examen → mesas de examen
//   POST solicitudes/nueva_solicitud → alta de la solicitud
import { load } from 'cheerio';

export const TIPOS_CONSTANCIA = {
  alumno_regular: { valor: '1', formulario: '34000240', etiqueta: 'Constancia de alumno regular' },
  examen_final: { valor: '7', formulario: '34000236', etiqueta: 'Constancia de examen final' },
  promedio_academico: { valor: '2', formulario: '', etiqueta: 'Constancia de promedio académico' },
  promedio_sin_aplazos: { valor: '3', formulario: '', etiqueta: 'Constancia de promedio académico sin aplazos' }
};

const ORDEN_TIPOS = ['alumno_regular', 'examen_final', 'promedio_academico', 'promedio_sin_aplazos'];

/** Extrae el `cont` de la envoltura JSON de SIU (o devuelve el HTML tal cual). */
export function extraerContSiu(html) {
  const texto = String(html || '');
  if (!texto.trim().startsWith('{')) return texto;
  try {
    const json = JSON.parse(texto);
    return json.cont ?? texto;
  } catch {
    return texto;
  }
}

function jsonSiu(html) {
  const texto = String(html || '').trim();
  if (!texto.startsWith('{')) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** Tipos de constancia con la cantidad de copias que permite cada uno. */
export async function listarTiposConstancia(cliente) {
  const tipos = [];
  for (const clave of ORDEN_TIPOS) {
    const tipo = TIPOS_CONSTANCIA[clave];
    const res = await cliente.pedir('solicitudes/get_cantidad_copias', {
      method: 'POST',
      cuerpo: new URLSearchParams({ constancia: tipo.valor }).toString()
    });
    const json = jsonSiu(res.html);
    const copias = Number(json?.copias ?? 0);
    tipos.push({
      clave,
      valor: tipo.valor,
      formulario: tipo.formulario,
      etiqueta: tipo.etiqueta,
      copias: Number.isFinite(copias) && copias > 0 ? copias : 1
    });
  }
  return tipos;
}

/** Turnos de examen de un año académico: [{ valor, etiqueta }]. */
export async function listarTurnosExamen(cliente, anioAcademico) {
  const res = await cliente.pedir('solicitudes/turno_examen', {
    method: 'POST',
    cuerpo: new URLSearchParams({ anio: String(anioAcademico) }).toString()
  });
  const json = jsonSiu(res.html);
  const turnos = json?.turno || {};
  return Object.entries(turnos).map(([valor, etiqueta]) => ({ valor: String(valor), etiqueta: String(etiqueta) }));
}

/** Actividades (materias) que se pueden cursar en un año/turno: [{ valor, etiqueta }]. */
export async function listarActividadesExamen(cliente, anioAcademico, turnoExamen) {
  const res = await cliente.pedir('solicitudes/get_actividad_anio', {
    method: 'POST',
    cuerpo: new URLSearchParams({
      anio: String(anioAcademico),
      turno_examen: String(turnoExamen ?? '')
    }).toString()
  });
  const json = jsonSiu(res.html);
  const actividades = json?.actividades || [];
  return actividades.map((item) => ({
    valor: String(item.elemento),
    etiqueta: String(item.actividad_descr || '')
  }));
}

/** Mesas de examen de una actividad: [{ valor, etiqueta }]. */
export async function listarMesasExamen(cliente, { anioAcademico, turnoExamen, actividad }) {
  const res = await cliente.pedir('solicitudes/get_llamado_examen', {
    method: 'POST',
    cuerpo: new URLSearchParams({
      anio: String(anioAcademico),
      turno_examen: String(turnoExamen ?? ''),
      actividad: String(actividad ?? ''),
      fecha_desde: '',
      fecha_hasta: ''
    }).toString()
  });
  const json = jsonSiu(res.html);
  if (json && json.cod === '-1') return [];
  // El servidor usa `llamado_examen`; el JS del campus lee `actividad`.
  const datos = json?.llamado_examen || json?.actividad || [];
  return datos.map((item) => ({
    valor: String(item.valor ?? item.elemento ?? ''),
    etiqueta: String(item.descr ?? item.llamado_examen_descr ?? '')
  }));
}

/** Años académicos disponibles (el filtro de SIU los manda como opciones). */
export async function listarAniosAcademicos(cliente) {
  const res = await cliente.pedir('solicitudes/get_formulario_filtro', {
    method: 'POST',
    cuerpo: new URLSearchParams({ form: TIPOS_CONSTANCIA.examen_final.formulario }).toString()
  });
  const json = jsonSiu(res.html);
  const cont = extraerContSiu(json?.cont ?? res.html);
  const $ = load(cont);
  const anios = [];
  $('#formulario_filtro-anio_academico option').each((_, opcion) => {
    const valor = String($(opcion).attr('value') || '').trim();
    if (valor) anios.push({ valor, etiqueta: $(opcion).text().trim() });
  });
  return anios;
}

/** Sillas de examen (llamados) disponibles para una actividad/turno. */
export async function listarSillasExamen(cliente, { anioAcademico, turnoExamen, actividad }) {
  const res = await cliente.pedir('solicitudes/get_llamado_examen', {
    method: 'POST',
    cuerpo: new URLSearchParams({
      anio: String(anioAcademico),
      turno_examen: String(turnoExamen ?? ''),
      actividad: String(actividad ?? ''),
      fecha_desde: '',
      fecha_hasta: ''
    }).toString()
  });
  const json = jsonSiu(res.html);
  if (json && json.cod === '-1') return [];
  const datos = json?.llamado_examen || json?.actividad || [];
  return datos.map((item) => ({
    valor: String(item.valor ?? item.elemento ?? ''),
    etiqueta: String(item.descr ?? item.llamado_examen_descr ?? '')
  }));
}

/**
 * Alta de la solicitud de constancia.
 * `filtro` solo se usa para "examen final" (mesa de examen) y "promedio académico".
 */
export async function solicitarConstanciaSiu(cliente, {
  tipoClave,
  copias = 1,
  presentar,
  observaciones = '',
  filtro = null
}) {
  const tipo = TIPOS_CONSTANCIA[tipoClave];
  if (!tipo) throw new Error('Tipo de constancia desconocido.');
  const destino = String(presentar || '').trim();
  if (!destino) throw new Error('Indicá a quién se presenta la constancia.');

  const cuerpo = new URLSearchParams({
    constancia: tipo.valor,
    copias: String(copias),
    presentar: destino,
    observaciones: String(observaciones || '').trim(),
    formulario: tipo.formulario,
    formulario_campo: filtro?.campo || '',
    formulario_valor: filtro?.valor || ''
  });

  const res = await cliente.pedir('solicitudes/nueva_solicitud', {
    method: 'POST',
    cuerpo: cuerpo.toString()
  });

  const json = jsonSiu(res.html);
  if (json) {
    // El campus devuelve `{ ok: false, cont: html }` cuando rechaza el alta.
    if (json.ok === false) {
      const cont = typeof json.cont === 'string' ? extraerContSiu(json.cont) : '';
      const mensaje = cont.match(/<div[^>]*class=["'][^"']*error[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      throw new Error(mensaje ? mensaje[1].replace(/<[^>]+>/g, ' ').trim() : 'SIU Guaraní rechazó la solicitud.');
    }
    // `cod: "-2"` es la redirección de éxito: vuelve al listado de solicitudes.
    if (json.cod === '-2') {
      const aviso = String(json.cont?.tiene_mensaje || '').trim();
      if (aviso) throw new Error(aviso);
      return { ok: true, url: res.url };
    }
    if (json.cod === '-1') {
      throw new Error(String(json.cont || 'SIU Guaraní no pudo registrar la solicitud.'));
    }
  }
  return { ok: true, url: res.url };
}

/** Listado de solicitudes del alumno: [{ constancia, fecha, presentar, estado, vencimiento, comprobante }]. */
export async function listarSolicitudesSiu(cliente) {
  const res = await cliente.pedir('solicitudes', {});
  const cont = extraerContSiu(res.html);
  const $ = load(cont);
  const solicitudes = [];
  $('table tbody tr').each((_, fila) => {
    const celdas = $(fila).find('td').toArray().map((celda) => $(celda).text().replace(/\s+/g, ' ').trim());
    if (celdas.length < 6) return;
    const enlace = $(fila).find('a.descargar_cert').attr('href') || '';
    solicitudes.push({
      constancia: celdas[0] || '',
      fecha: celdas[1] || '',
      presentar: celdas[2] || '',
      solicitadoEn: celdas[3] || '',
      copias: celdas[4] || '',
      estado: celdas[5] || '',
      vencimiento: celdas[6] || '',
      comprobante: enlace
    });
  });
  return solicitudes;
}

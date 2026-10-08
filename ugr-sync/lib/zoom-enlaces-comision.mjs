/**
 * Enlaces oficiales de clase (UGR Virtual) — comisión 2026.
 * Catálogo: `database/enlaces-clase-comision.json` (misma fuente que el calendario en Next).
 */
import catalogo from '../../database/enlaces-clase-comision.json' with { type: 'json' };

/** @type {typeof catalogo} */
export const ENLACES_ZOOM_COMISION = catalogo;

function normalizarNombreMateria(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
}

/** Escribe url_clase en horarios (join = campus si no hay sesión Moodle). */
export async function aplicarEnlacesZoomComisionEnDb(db, materias) {
  const { buscarMateriaPorFragmento } = await import('../../database/planes-cronograma-comision.mjs');
  const { actualizarEnlacesZoomEnHorarios } = await import('./cronograma-oficial.mjs');
  const procesadas = new Set();
  let total = 0;
  for (const entrada of ENLACES_ZOOM_COMISION) {
    if (procesadas.has(entrada.materia)) continue;
    const materia = buscarMateriaPorFragmento(materias, entrada.materia);
    if (!materia) continue;
    procesadas.add(entrada.materia);
    const enlaces = enlacesZoomConocidosParaMateria(materia.nombre).map((e) => ({
      ...e,
      urlJoin: e.urlCampus
    }));
    total += await actualizarEnlacesZoomEnHorarios(db, materia.id, enlaces);
  }
  return total;
}

export function enlacesZoomConocidosParaMateria(nombreMateria) {
  const n = normalizarNombreMateria(nombreMateria);
  if (!n) return [];
  return ENLACES_ZOOM_COMISION.filter((entrada) => {
    const frag = normalizarNombreMateria(entrada.materia);
    return n.includes(frag) || frag.split(/\s+/).filter((p) => p.length > 3).every((p) => n.includes(p));
  }).map((entrada) => ({
    titulo: entrada.titulo,
    urlCampus: entrada.urlCampus,
    urlJoin: '',
    dia: entrada.dia ?? null,
    horaInicio: entrada.horaInicio ?? null,
    horaFin: entrada.horaFin ?? null,
    profesorClave: entrada.profesorClave ?? null
  }));
}

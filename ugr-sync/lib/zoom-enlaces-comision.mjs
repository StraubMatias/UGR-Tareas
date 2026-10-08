/**
 * Enlaces oficiales de clase (UGR Virtual) por materia de comisión 2026.
 * El sync los usa como semilla y resuelve el join zoom.us con sesión Moodle.
 */

/** @type {Array<{ materia: string, titulo: string, urlCampus: string, dia?: number, horaInicio?: string }>} */
export const ENLACES_ZOOM_COMISION = [
  {
    materia: 'SISTEMAS DE GESTIÓN DE SEGURIDAD',
    titulo: 'Enlace a la clase sincrónica de los Miércoles a las 19 Hs',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=280032',
    dia: 3,
    horaInicio: '19:00'
  },
  {
    materia: 'SISTEMAS DE GESTIÓN DE SEGURIDAD',
    titulo: 'Encuentro sincrónico de los jueves a las 20:30 Hs',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=342068',
    dia: 4,
    horaInicio: '20:30'
  },
  {
    materia: 'AUDITORÍAS DE SEGURIDAD',
    titulo: 'Encuentros Auditorías de S.I., martes 18hs.',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/url/view.php?id=337190',
    dia: 2,
    horaInicio: '18:00'
  },
  {
    materia: 'EVALUACIÓN Y GESTIÓN DE RIESGOS',
    titulo: 'Clase Sincrónica Semanal - Viernes 18:00 hs',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=240182',
    dia: 5,
    horaInicio: '18:00'
  },
  {
    materia: 'GESTIÓN DE ACTIVOS',
    titulo: 'Link de Clase Sincrónica',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=306536'
  },
  {
    materia: 'CONCEPTOS DE DESARROLLO',
    titulo: 'Sala Virtual',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=336084'
  },
  {
    materia: 'INTRODUCCIÓN A LA CRIPTOGRAFÍA',
    titulo: 'Enlace zoom - clases sincronicas',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=215547'
  }
];

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
    horaFin: entrada.horaFin ?? null
  }));
}

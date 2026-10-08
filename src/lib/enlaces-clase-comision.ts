/** Enlaces oficiales UGR Virtual (comisión 2026). Respaldo si `horarios.url_clase` está vacío. */
export type EntradaEnlaceClase = {
  fragmentoMateria: string;
  urlCampus: string;
  dia?: number;
  horaInicio?: string;
};

const ENLACES: EntradaEnlaceClase[] = [
  {
    fragmentoMateria: 'SISTEMAS DE GESTIÓN DE SEGURIDAD',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=280032',
    dia: 3,
    horaInicio: '19:00'
  },
  {
    fragmentoMateria: 'SISTEMAS DE GESTIÓN DE SEGURIDAD',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=342068',
    dia: 4,
    horaInicio: '20:30'
  },
  {
    fragmentoMateria: 'AUDITORÍAS DE SEGURIDAD',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/url/view.php?id=337190',
    dia: 2,
    horaInicio: '18:00'
  },
  {
    fragmentoMateria: 'EVALUACIÓN Y GESTIÓN DE RIESGOS',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=240182',
    dia: 5,
    horaInicio: '18:00'
  },
  {
    fragmentoMateria: 'GESTIÓN DE ACTIVOS',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=306536'
  },
  {
    fragmentoMateria: 'CONCEPTOS DE DESARROLLO',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=336084'
  },
  {
    fragmentoMateria: 'INTRODUCCIÓN A LA CRIPTOGRAFÍA',
    urlCampus: 'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=215547'
  }
];

function normalizarNombre(nombre: string) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();
}

function minutosDesdeHora(hora: string | null | undefined) {
  const m = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function enlacesParaMateria(nombreMateria: string) {
  const n = normalizarNombre(nombreMateria);
  if (!n) return [];
  return ENLACES.filter((entrada) => {
    const frag = normalizarNombre(entrada.fragmentoMateria);
    return n.includes(frag) || frag.split(/\s+/).filter((p) => p.length > 3).every((p) => n.includes(p));
  });
}

/** Mejor URL de campus para un horario semanal de la materia. */
export function enlaceClaseComisionParaHorario(
  nombreMateria: string,
  dia: number | string,
  horaInicio: string
): string {
  const candidatos = enlacesParaMateria(nombreMateria);
  if (candidatos.length === 0) return '';
  if (candidatos.length === 1) return candidatos[0].urlCampus;

  const diaNum = Number(dia);
  const inicio = minutosDesdeHora(horaInicio);
  let mejor = candidatos[0];
  let puntaje = -1;
  for (const entrada of candidatos) {
    let p = 0;
    if (entrada.dia && entrada.dia === diaNum) p += 100;
    const hi = minutosDesdeHora(entrada.horaInicio);
    if (hi !== null && inicio !== null && Math.abs(hi - inicio) <= 20) p += 80;
    if (p > puntaje) {
      puntaje = p;
      mejor = entrada;
    }
  }
  return mejor.urlCampus;
}

export function enlaceClaseComisionParaMateria(nombreMateria: string): string {
  const lista = enlacesParaMateria(nombreMateria);
  return lista.length === 1 ? lista[0].urlCampus : '';
}

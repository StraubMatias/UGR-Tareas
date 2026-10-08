import type { Materia, Nota, Parcial } from '../core/cursada.ts';
const NOTA_MINIMA_APROBACION = 6;

function claveHoyCalendario() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

function obtenerClaveDiaCalendario(fecha: string | null | undefined) {
  if (!fecha || fecha === 'Sin fecha') return null;
  const partes = String(fecha).slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some((p) => !Number.isFinite(p))) return null;
  return `${partes[0]}-${String(partes[1]).padStart(2, '0')}-${String(partes[2]).padStart(2, '0')}`;
}

export function esParcialRecuperatorio(parcial: Pick<Parcial, 'nombre'>) {
  return /\brecuperatorio\b/i.test(String(parcial.nombre || ''));
}

function notaNumerica(nota: string | number | null | undefined) {
  const valor = Number.parseFloat(String(nota ?? '').replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
}

function notaDeParcial(parcialId: string, alumno: string, notas: Nota[]) {
  const fila = notas.find((n) => n.parcial_id === parcialId && n.alumno === alumno);
  return fila ? notaNumerica(fila.nota) : null;
}

/** Parciales de cuatrimestre de la materia (sin recuperatorio), ordenados por fecha. */
export function parcialesCuatrimestreDeMateria(parciales: Parcial[], materiaId: string) {
  return parciales
    .filter((p) => p.materia_id === materiaId && !esParcialRecuperatorio(p))
    .sort((a, b) => {
      const fa = obtenerClaveDiaCalendario(a.fecha) || '9999-99-99';
      const fb = obtenerClaveDiaCalendario(b.fecha) || '9999-99-99';
      return fa.localeCompare(fb) || a.nombre.localeCompare(b.nombre, 'es');
    });
}

function parcialYaCerro(parcial: Parcial, claveHoy: string) {
  const clave = obtenerClaveDiaCalendario(parcial.fecha);
  if (!clave) return false;
  return clave <= claveHoy;
}

/** Índices 0-based de parciales que el alumno debe recuperar (nota menor a 6 tras rendir el parcial). */
export function indicesParcialesARecuperar(
  alumno: string,
  materiaId: string,
  parciales: Parcial[],
  notas: Nota[],
  claveHoy = claveHoyCalendario()
): number[] {
  const cuatrimestre = parcialesCuatrimestreDeMateria(parciales, materiaId);
  const indices: number[] = [];
  cuatrimestre.forEach((parcial, indice) => {
    if (!parcialYaCerro(parcial, claveHoy)) return;
    const nota = notaDeParcial(parcial.id, alumno, notas);
    if (nota === null) return;
    if (nota < NOTA_MINIMA_APROBACION) indices.push(indice);
  });
  return indices;
}

export function etiquetaParcialesRecuperatorio(indices: number[]) {
  if (indices.length === 0) return '';
  const ordinales = ['1.er', '2.do', '3.er'];
  const partes = indices.map((i) => `${ordinales[i] || `${i + 1}.º`} parcial`);
  if (partes.length === 1) return `Recuperatorio del ${partes[0]}`;
  if (partes.length === 2) return `Recuperatorio del ${partes[0]} y ${partes[1]}`;
  return `Recuperatorio: ${partes.join(', ')}`;
}

/**
 * En el día del recuperatorio, reemplaza la fila genérica por un aviso según las notas del alumno.
 * Si no debe recuperar nada, no muestra el evento.
 */
export function personalizarParcialesDelDia(
  parcialesDelDia: Parcial[],
  parcialesCursada: Parcial[],
  alumno: string | null | undefined,
  notas: Nota[],
  _materias: Materia[],
  claveDia: string
): Parcial[] {
  if (!alumno) return parcialesDelDia;

  const recuperatorios = parcialesDelDia.filter(esParcialRecuperatorio);
  if (recuperatorios.length === 0) return parcialesDelDia;

  const otros = parcialesDelDia.filter((p) => !esParcialRecuperatorio(p));
  const claveHoy = claveHoyCalendario();
  const agregados: Parcial[] = [];

  for (const recup of recuperatorios) {
    const indices = indicesParcialesARecuperar(alumno, recup.materia_id, parcialesCursada, notas, claveHoy);
    if (indices.length === 0) continue;
    const etiqueta = etiquetaParcialesRecuperatorio(indices);
    agregados.push({
      ...recup,
      id: `recup_${recup.id}_${alumno}`,
      nombre: etiqueta,
      detalles: recup.detalles
        ? `${etiqueta}. ${recup.detalles}`
        : `Rendís el recuperatorio de la materia (${etiqueta.replace(/^Recuperatorio del? /, '')}).`
    });
  }

  return [...otros, ...agregados];
}

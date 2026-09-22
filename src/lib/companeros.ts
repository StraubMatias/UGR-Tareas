export interface InscripcionAlumno {
  alumno: string;
  materiaId: string;
}

function claveCursada(materias: Set<string>): string {
  return [...materias].sort().join('\0');
}

// Alumnos con exactamente las mismas materias que `alumno` dentro de las visibles.
// Quien cursa esas materias y dos más no entra: su cronograma y su puntaje son otros.
export function alumnosConLaMismaCursada(
  inscripciones: InscripcionAlumno[],
  alumno: string,
  materiasVisibles: string[]
): string[] {
  const visibles = new Set(materiasVisibles);
  const porAlumno = new Map<string, Set<string>>();
  for (const fila of inscripciones) {
    if (!visibles.has(fila.materiaId)) continue;
    const cursada = porAlumno.get(fila.alumno) || new Set<string>();
    cursada.add(fila.materiaId);
    porAlumno.set(fila.alumno, cursada);
  }

  const propia = porAlumno.get(alumno);
  if (!propia || propia.size === 0) return [];
  const esperada = claveCursada(propia);
  return [...porAlumno.entries()]
    .filter(([, cursada]) => claveCursada(cursada) === esperada)
    .map(([nombre]) => nombre)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

// Quien cursa esa materia entra al ranking de la materia, aunque curse otras más.
export function alumnosDeLaMateria(inscripciones: InscripcionAlumno[], materiaId: string): string[] {
  const nombres = new Set(
    inscripciones.filter((fila) => fila.materiaId === materiaId).map((fila) => fila.alumno)
  );
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

// Quien comparte al menos una materia entra al estado por alumno.
// Al abrir su ficha se ven solo esas materias en común, no el resto de su cursada.
export function alumnosConAlgunaMateriaEnComun(
  inscripciones: InscripcionAlumno[],
  alumno: string
): string[] {
  const propias = materiasQueCursa(inscripciones, alumno);
  if (propias.size === 0) return [];
  const nombres = new Set<string>();
  for (const fila of inscripciones) {
    if (propias.has(fila.materiaId)) nombres.add(fila.alumno);
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

export function materiasEnComun(
  inscripciones: InscripcionAlumno[],
  alumno: string,
  otro: string
): Set<string> {
  const propias = materiasQueCursa(inscripciones, alumno);
  const suyas = materiasQueCursa(inscripciones, otro);
  return new Set([...propias].filter((materiaId) => suyas.has(materiaId)));
}

export function materiasQueCursa(inscripciones: InscripcionAlumno[], alumno: string): Set<string> {
  return new Set(
    inscripciones.filter((fila) => fila.alumno === alumno).map((fila) => fila.materiaId)
  );
}

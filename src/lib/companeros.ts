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

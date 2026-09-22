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

// Estado por alumno: el admin ve a todos los registrados.
// El resto ve a quien comparte una materia y a quien todavía no sincronizó.
// Quien cursa otra cosa y nada en común no entra: su ficha no mostraría tareas propias.
export function alumnosEnEstado(
  inscripciones: InscripcionAlumno[],
  alumno: string,
  registrados: string[],
  esAdmin = false
): string[] {
  if (esAdmin) return [...registrados].sort((a, b) => a.localeCompare(b, 'es'));
  const propias = materiasQueCursa(inscripciones, alumno);
  if (propias.size === 0) return [...registrados].sort((a, b) => a.localeCompare(b, 'es'));
  const inscriptos = new Set(inscripciones.map((fila) => fila.alumno));
  const esperando = registrados.filter((nombre) => !inscriptos.has(nombre));
  return [...new Set([...alumnosConAlgunaMateriaEnComun(inscripciones, alumno), ...esperando])]
    .sort((a, b) => a.localeCompare(b, 'es'));
}

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

/** Calendario Académico UGR 2026 — Estudiantes regulares. */
export const CALENDARIO_ACADEMICO_2026 = [
  ['2026-01-19', '2026-01-19', 'inicio', 'Inicio actividad académica'],
  ['2026-02-09', '2026-02-27', 'becas', 'Postulación a becas de ayuda económica e investigación'],
  ['2026-02-02', '2026-02-05', 'inscripcion', 'Inscripción al 1.er llamado · Turno 1'],
  ['2026-02-09', '2026-02-14', 'examen', '1.er llamado · Turno 1'],
  ['2026-02-16', '2026-02-19', 'inscripcion', 'Inscripción al 2.º llamado · Turno 1'],
  ['2026-02-23', '2026-02-27', 'examen', '2.º llamado · Turno 1'],
  ['2026-03-02', '2026-03-06', 'inscripcion', 'Inscripción de auxiliares de 2.ª y adscriptos'],
  ['2026-03-09', '2026-03-12', 'inscripcion', 'Inscripción a cursada de asignaturas'],
  ['2026-03-16', '2026-03-16', 'inicio', 'Inicio del 1.er cuatrimestre'],
  ['2026-03-30', '2026-03-30', 'arancel', 'Último día para solicitar reducción arancelaria'],
  ['2026-05-11', '2026-05-14', 'inscripcion', 'Inscripción al llamado · Turno 2'],
  ['2026-05-18', '2026-05-23', 'examen', 'Llamado · Turno 2'],
  ['2026-06-20', '2026-06-20', 'finalizacion', 'Finalización del 1.er cuatrimestre'],
  ['2026-07-06', '2026-07-09', 'inscripcion', 'Inscripción al 1.er llamado · Turno 3'],
  ['2026-07-13', '2026-07-18', 'examen', '1.er llamado · Turno 3'],
  ['2026-07-20', '2026-07-23', 'inscripcion', 'Inscripción al 2.º llamado · Turno 3'],
  ['2026-07-27', '2026-08-01', 'examen', '2.º llamado · Turno 3'],
  ['2026-08-03', '2026-08-07', 'inscripcion', 'Inscripción de auxiliares de 2.ª y adscriptos'],
  ['2026-08-10', '2026-08-13', 'inscripcion', 'Inscripción a cursada de asignaturas'],
  ['2026-08-18', '2026-08-18', 'inicio', 'Inicio del 2.º cuatrimestre'],
  ['2026-09-07', '2026-09-10', 'inscripcion', 'Inscripción al llamado · Turno 4'],
  ['2026-09-14', '2026-09-19', 'examen', 'Llamado · Turno 4'],
  ['2026-11-14', '2026-11-14', 'finalizacion', 'Finalización del 2.º cuatrimestre'],
  ['2026-11-23', '2026-11-26', 'inscripcion', 'Inscripción al 1.er llamado · Turno 5'],
  ['2026-11-30', '2026-12-05', 'examen', '1.er llamado · Turno 5'],
  ['2026-12-07', '2026-12-10', 'inscripcion', 'Inscripción al 2.º llamado · Turno 5'],
  ['2026-12-14', '2026-12-19', 'examen', '2.º llamado · Turno 5']
].map(([fecha_desde, fecha_hasta, tipo, titulo], indice) => ({
  id: `ugr-2026-${String(indice + 1).padStart(2, '0')}`,
  anio: 2026,
  fecha_desde,
  fecha_hasta,
  tipo,
  titulo,
  detalles: tipo === 'arancel'
    ? 'Hasta esta fecha, quienes se inscribieron en 1, 2 o 3 asignaturas pueden solicitar la reducción arancelaria en cuotas.'
    : 'Calendario Académico UGR 2026 · Estudiantes regulares.'
}));

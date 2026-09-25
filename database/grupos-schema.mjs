// Compartido por la migración y las pruebas con libSQL local.
export async function crearEsquemaGrupos(db) {
  const columnas = await db.execute('PRAGMA table_info(tareas)');
  if (!columnas.rows.some((c) => c.name === 'grupal')) {
    await db.execute('ALTER TABLE tareas ADD COLUMN grupal INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnas.rows.some((c) => c.name === 'cupo_maximo')) {
    await db.execute('ALTER TABLE tareas ADD COLUMN cupo_maximo INTEGER DEFAULT 0');
  }
  if (!columnas.rows.some((c) => c.name === 'permite_individual')) {
    await db.execute('ALTER TABLE tareas ADD COLUMN permite_individual INTEGER NOT NULL DEFAULT 1');
  }
  await db.batch([
    `CREATE TABLE IF NOT EXISTS grupos_tareas (
      id TEXT PRIMARY KEY,
      tarea_id TEXT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL COLLATE NOCASE,
      UNIQUE(tarea_id, nombre), UNIQUE(id, tarea_id)
    )`,
    `CREATE TABLE IF NOT EXISTS integrantes_tareas (
      tarea_id TEXT NOT NULL,
      alumno_id TEXT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      grupo_id TEXT NOT NULL,
      PRIMARY KEY(tarea_id, alumno_id),
      FOREIGN KEY(grupo_id, tarea_id) REFERENCES grupos_tareas(id, tarea_id) ON DELETE CASCADE
    )`,
    'CREATE INDEX IF NOT EXISTS idx_integrantes_grupo ON integrantes_tareas(grupo_id)',
    `CREATE TABLE IF NOT EXISTS preferencias_tarea_alumno (
      tarea_id TEXT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
      alumno_id TEXT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      entrega_individual INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (tarea_id, alumno_id)
    )`,
    `CREATE TABLE IF NOT EXISTS invitaciones_grupo (
      id TEXT PRIMARY KEY,
      grupo_id TEXT NOT NULL,
      tarea_id TEXT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
      de_alumno_id TEXT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      para_alumno_id TEXT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      creada_en TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      FOREIGN KEY (grupo_id, tarea_id) REFERENCES grupos_tareas(id, tarea_id) ON DELETE CASCADE
    )`,
    'CREATE INDEX IF NOT EXISTS idx_invitaciones_para ON invitaciones_grupo(para_alumno_id, estado)'
  ], 'write');
}

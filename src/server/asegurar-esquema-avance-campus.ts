import type { Client } from '@libsql/client';

let listo = false;

export async function asegurarEsquemaAvanceCampusEnServidor(db: Client): Promise<void> {
  if (listo) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS avance_campus_recursos (
      id TEXT PRIMARY KEY,
      alumno_id TEXT NOT NULL,
      materia_id TEXT NOT NULL,
      cmid TEXT NOT NULL,
      modulo TEXT,
      titulo TEXT NOT NULL,
      url TEXT,
      unidad TEXT,
      orden INTEGER NOT NULL DEFAULT 0,
      completada INTEGER NOT NULL DEFAULT 0,
      sincronizado_en TEXT,
      UNIQUE(alumno_id, materia_id, cmid)
    )
  `);
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_avance_campus_materia ON avance_campus_recursos(alumno_id, materia_id, orden)'
  );
  listo = true;
}

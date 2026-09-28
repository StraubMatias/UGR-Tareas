import type { Client } from '@libsql/client';

let esquemaEntregasListo = false;

/** Tabla de hitos por tarea assign (migración 31). Idempotente en Vercel sin migrate manual. */
export async function asegurarEsquemaEntregasEnServidor(db: Client): Promise<void> {
  if (esquemaEntregasListo) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tareas_entregas (
      id TEXT PRIMARY KEY,
      tarea_id TEXT NOT NULL,
      alumno_id TEXT NOT NULL,
      numero INTEGER NOT NULL,
      indice_entrega INTEGER,
      es_activa INTEGER NOT NULL DEFAULT 0,
      estado TEXT,
      nota TEXT,
      nota_origen TEXT,
      comentario_prof TEXT,
      feedback_url TEXT,
      feedback_nombre TEXT,
      devolucion_texto TEXT,
      sincronizado_en TEXT,
      UNIQUE(tarea_id, alumno_id, numero)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_tareas_entregas_tarea ON tareas_entregas(tarea_id, alumno_id)');
  esquemaEntregasListo = true;
}

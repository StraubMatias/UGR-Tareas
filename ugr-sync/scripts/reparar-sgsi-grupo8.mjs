/**
 * Repara hitos SGSI «Entregas del trabajo práctico» para Grupo 8 (Matute + Iñaki).
 * Uso: node ugr-sync/scripts/reparar-sgsi-grupo8.mjs
 * Requiere TURSO_* en .env.local
 */
process.loadEnvFile?.('.env.local');
import { createClient } from '@libsql/client';

const TAREA_ID = 't_1788022325001';
const ALUMNOS = ['admin_matute', 'a_1787597608468'];
const NOTA_ENTREGA_1 = '8';
const COMENTARIO = 'Esta todo correcto, por favor contiuén en su misma línea a disposición para lo que necesiten';
const DOC_NOMBRE = 'Devolucion Grupo 8 Entrega 1 SGSI.docx';
const AHORA = new Date().toISOString();

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) {
    console.error('Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN en .env.local');
    process.exit(1);
  }
  const db = createClient({ url, authToken: token });
  const nombres = await db.execute({
    sql: `SELECT id, nombre FROM alumnos WHERE id IN (${ALUMNOS.map(() => '?').join(',')})`,
    args: ALUMNOS
  });
  const porId = new Map(nombres.rows.map((r) => [String(r.id), String(r.nombre)]));

  for (const alumnoId of ALUMNOS) {
    const alumnoNombre = porId.get(alumnoId) || alumnoId;
    await db.execute({
      sql: 'DELETE FROM tareas_entregas WHERE tarea_id = ? AND alumno_id = ?',
      args: [TAREA_ID, alumnoId]
    });
    await db.batch([
      {
        sql: `INSERT INTO tareas_entregas (
          id, tarea_id, alumno_id, numero, indice_entrega, es_activa, estado, nota, nota_origen,
          comentario_prof, feedback_url, feedback_nombre, devolucion_texto, sincronizado_en
        ) VALUES (?, ?, ?, 2, 1, 0, ?, ?, 'reparacion_manual', ?, NULL, ?, ?, ?)`,
        args: [
          `te_${TAREA_ID}_${alumnoId}_2`,
          TAREA_ID,
          alumnoId,
          'Reabierto',
          NOTA_ENTREGA_1,
          COMENTARIO,
          DOC_NOMBRE,
          COMENTARIO,
          AHORA
        ]
      },
      {
        sql: `INSERT INTO tareas_entregas (
          id, tarea_id, alumno_id, numero, indice_entrega, es_activa, estado, nota, nota_origen,
          comentario_prof, feedback_url, feedback_nombre, devolucion_texto, sincronizado_en
        ) VALUES (?, ?, ?, 4, 2, 1, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
        args: [
          `te_${TAREA_ID}_${alumnoId}_4`,
          TAREA_ID,
          alumnoId,
          'Reabierto',
          AHORA
        ]
      },
      {
        sql: `INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en, cerrada)
              VALUES (?, ?, ?, ?, ?, ?, 1)
              ON CONFLICT(tarea_id, alumno) DO UPDATE SET
                alumno_id = excluded.alumno_id,
                nota = excluded.nota,
                cargada_en = excluded.cargada_en,
                cerrada = 1`,
        args: [
          `nota_tarea_${TAREA_ID}_${alumnoId}`,
          TAREA_ID,
          alumnoId,
          alumnoNombre,
          NOTA_ENTREGA_1,
          AHORA
        ]
      },
      {
        sql: `DELETE FROM completadas WHERE tarea_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))`,
        args: [TAREA_ID, alumnoId, alumnoNombre]
      }
    ], 'write');
    console.log(`✓ ${alumnoNombre}: entrega 1 nota ${NOTA_ENTREGA_1}, entrega 2 pendiente`);
  }

  await db.execute({
    sql: 'DELETE FROM tareas_entregas WHERE tarea_id = ? AND indice_entrega IS NULL',
    args: [TAREA_ID]
  });
  console.log('✓ Filas huérfanas sin índice de entrega eliminadas');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

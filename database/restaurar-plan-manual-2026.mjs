/**
 * Reafirma el plan de comisión 2026 (origen `manual`) y quita filas `oficial`
 * que lo pisaron por PDFs mal parseados del campus.
 */
import { PLANES_CRONOGRAMA_COMISION, buscarMateriaPorFragmento } from './planes-cronograma-comision.mjs';

export async function reassertPlanManualComision2026(db, materias) {
  const lista = Array.isArray(materias) ? materias : [];
  let oficialEliminados = 0;
  let manualActualizados = 0;

  for (const plan of PLANES_CRONOGRAMA_COMISION) {
    const materia = buscarMateriaPorFragmento(lista, plan.materia);
    if (!materia) continue;

    const borrados = await db.execute({
      sql: "DELETE FROM cronograma_eventos WHERE materia_id = ? AND origen = 'oficial'",
      args: [materia.id]
    });
    oficialEliminados += Number(borrados.rowsAffected ?? 0);

    for (const [fecha, modalidad, tipo, titulo, detalles] of plan.filas) {
      if (!String(fecha).startsWith('2026-')) continue;
      const id = `cronograma_${materia.id}_${fecha}_${titulo}`;
      await db.execute({
        sql: `INSERT INTO cronograma_eventos (id, materia_id, fecha, modalidad, tipo, titulo, detalles, url, origen)
              VALUES (?, ?, ?, ?, ?, ?, ?, '', 'manual')
              ON CONFLICT(materia_id, fecha, titulo) DO UPDATE SET
                modalidad = excluded.modalidad,
                tipo = excluded.tipo,
                detalles = excluded.detalles,
                origen = 'manual'`,
        args: [id, materia.id, fecha, modalidad, tipo, titulo, detalles || '']
      });
      manualActualizados += 1;
    }
  }

  return { oficialEliminados, manualActualizados };
}

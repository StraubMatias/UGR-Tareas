/** Replica hitos assign del integrante con más datos al resto del grupo (entregas múltiples UGR). */
export async function ejecutarReplicarHitosGrupales(db) {
  const { replicarHitosEntregaGrupo } = await import('../src/lib/grupos-tareas.ts');
  const grupos = await db.execute(`
    SELECT DISTINCT i.tarea_id, i.grupo_id
    FROM integrantes_tareas i
    JOIN tareas t ON t.id = i.tarea_id
    WHERE COALESCE(t.grupal, 0) = 1
      AND LOWER(t.nombre) LIKE '%entregas del trabajo%'
  `);
  let total = 0;
  for (const fila of grupos.rows) {
    const copiados = await replicarHitosEntregaGrupo(db, String(fila.tarea_id), String(fila.grupo_id));
    total += copiados.length;
  }
  return total;
}

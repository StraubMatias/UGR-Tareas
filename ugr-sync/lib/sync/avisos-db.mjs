// Persistencia de avisos Moodle (campana + estado).
// Registra las sugerencias de avisos (estado 'pendiente'). No se publican
// solas: solo el admin las aprueba. Si un hilo ya existía (aceptado o
// rechazado) no se re-sugiere ni se le cambia el estado.
export async function insertarAvisosDetectados({ db, avisos }) {
  if (!Array.isArray(avisos) || avisos.length === 0) return 0;
  const insertar = avisos.map((a) => ({
    sql: `INSERT INTO avisos_moodle
          (id, curso_id, curso_nombre, materia_id, materia_nombre, foro_id, foro_nombre, hilo_id, titulo, autor, fecha, contenido, url, estado, creado_en)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', datetime('now'))
          ON CONFLICT(curso_id, hilo_id) DO UPDATE SET
            titulo = excluded.titulo,
            autor = excluded.autor,
            contenido = excluded.contenido,
            fecha = excluded.fecha,
            url = excluded.url`,
    args: [
      a.id,
      a.cursoId,
      a.cursoNombre,
      a.materiaId || null,
      a.materiaNombre || '',
      a.foroId,
      a.foroNombre,
      a.hiloId,
      a.titulo,
      a.autor || '',
      a.fecha,
      a.contenido || '',
      a.url || ''
    ]
  }));
  await db.batch(insertar, 'write');
  return insertar.length;
}

// Aprueba avisos (estado 'pendiente' → 'aceptado'). Solo después de esto el
// aviso se muestra en la campana de notificaciones.
export async function aprobarAvisos({ db, ids }) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const updates = ids
    .filter(Boolean)
    .map((id) => ({
      sql: "UPDATE avisos_moodle SET estado = 'aceptado' WHERE id = ?",
      args: [id]
    }));
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}

// Rechaza avisos sugeridos (no se publican y no se vuelven a proponer).
export async function rechazarAvisos({ db, ids }) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const updates = ids
    .filter(Boolean)
    .map((id) => ({
      sql: "UPDATE avisos_moodle SET estado = 'rechazado' WHERE id = ?",
      args: [id]
    }));
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}
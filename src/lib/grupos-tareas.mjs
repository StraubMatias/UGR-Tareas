import { randomUUID } from 'node:crypto';
import { tareaHabilitada, validarNota } from '../app/validators.js';

export class ErrorGrupo extends Error {}

async function transaccion(db, ejecutar) {
  const tx = await db.transaction('write');
  try {
    const resultado = await ejecutar(tx);
    await tx.commit();
    return resultado;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

async function obtenerTarea(tx, tareaId) {
  const res = await tx.execute({ sql: 'SELECT * FROM tareas WHERE id = ?', args: [tareaId] });
  if (!res.rows[0]) throw new ErrorGrupo('La tarea no existe.');
  return res.rows[0];
}

async function tieneProgreso(tx, tareaId, alumnos) {
  for (const id of alumnos) {
    const res = await tx.execute({
      sql: `SELECT 1 FROM completadas WHERE tarea_id = ? AND alumno_id = ?
            UNION ALL SELECT 1 FROM notas_tareas WHERE tarea_id = ? AND alumno_id = ? LIMIT 1`,
      args: [tareaId, id, tareaId, id]
    });
    if (res.rows.length) return true;
  }
  return false;
}

// El servidor debe pasar el alumno obtenido de la sesión, nunca del formulario.
export async function asignarGrupo(db, tareaId, alumnoId, { nombre, grupoId, salir = false }) {
  return transaccion(db, async (tx) => {
    const tarea = await obtenerTarea(tx, tareaId);
    if (!Number(tarea.grupal)) throw new ErrorGrupo('Esta tarea es individual.');
    const actual = (await tx.execute({
      sql: 'SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?',
      args: [tareaId, alumnoId]
    })).rows[0]?.grupo_id;
    if (actual && !salir) throw new ErrorGrupo('Primero salí de tu grupo actual.');
    if (salir && !actual) throw new ErrorGrupo('No pertenecés a un grupo de esta tarea.');
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    let destino = actual;
    if (!salir) {
    if (grupoId) {
      const grupo = await tx.execute({
        sql: 'SELECT id FROM grupos_tareas WHERE id = ? AND tarea_id = ?', args: [grupoId, tareaId]
      });
      if (!grupo.rows.length) throw new ErrorGrupo('El grupo no pertenece a esta tarea.');
      
      const integrantesCount = await tx.execute({
        sql: 'SELECT COUNT(*) as total FROM integrantes_tareas WHERE grupo_id = ?', args: [grupoId]
      });
      if (integrantesCount.rows[0].total >= tarea.cupo_maximo && tarea.cupo_maximo > 0) {
        throw new ErrorGrupo('El grupo ya alcanzó el cupo máximo permitido.');
      }
      destino = grupoId;
    } else {
        if (!nombreLimpio || nombreLimpio.length > 100) throw new ErrorGrupo('El nombre del grupo debe tener entre 1 y 100 caracteres.');
        const repetido = await tx.execute({
          sql: 'SELECT id FROM grupos_tareas WHERE tarea_id = ? AND nombre = ?', args: [tareaId, nombreLimpio]
        });
        if (repetido.rows.length) throw new ErrorGrupo('Ya existe un grupo con ese nombre. Podés unirte a él.');
        destino = `grupo_${randomUUID()}`;
        await tx.execute({
          sql: 'INSERT INTO grupos_tareas (id, tarea_id, nombre) VALUES (?, ?, ?)',
          args: [destino, tareaId, nombreLimpio]
        });
      }
    }
    const integrantes = await tx.execute({
      sql: 'SELECT alumno_id FROM integrantes_tareas WHERE grupo_id = ?', args: [destino]
    });
    if (await tieneProgreso(tx, tareaId, [...new Set([alumnoId, ...integrantes.rows.map((i) => i.alumno_id)])])) {
      throw new ErrorGrupo('No se pueden cambiar integrantes mientras el alumno o el grupo tenga entrega o nota.');
    }
    if (salir) {
      await tx.execute({ sql: 'DELETE FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?', args: [tareaId, alumnoId] });
      await tx.execute({ sql: 'DELETE FROM grupos_tareas WHERE id = ? AND NOT EXISTS (SELECT 1 FROM integrantes_tareas WHERE grupo_id = ?)', args: [actual, actual] });
    } else {
      await tx.execute({ sql: 'INSERT INTO integrantes_tareas (tarea_id, alumno_id, grupo_id) VALUES (?, ?, ?)', args: [tareaId, alumnoId, destino] });
    }
    return { grupoId: salir ? null : destino };
  });
}


async function destinatarios(tx, tarea, alumno) {
  if (!Number(tarea.grupal)) return [alumno];
  const res = await tx.execute({
    sql: `SELECT a.id, a.nombre FROM integrantes_tareas i JOIN alumnos a ON a.id = i.alumno_id
          WHERE i.tarea_id = ? AND i.grupo_id = (
            SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?
          )`,
    args: [tarea.id, tarea.id, alumno.id]
  });
  if (!res.rows.length) throw new ErrorGrupo('Primero creá o unite a un grupo desde Materias.');
  return res.rows;
}

export async function actualizarProgresoTarea(db, tareaId, alumno, { nota, alternarEntrega = false }) {
  return transaccion(db, async (tx) => {
    const tarea = await obtenerTarea(tx, tareaId);
    if (!tareaHabilitada(tarea.inicio)) throw new ErrorGrupo('La tarea todavía no está habilitada.');
    const integrantes = await destinatarios(tx, tarea, alumno);
    const fecha = new Date().toISOString();
    if (alternarEntrega) {
      const marcada = await tieneProgreso(tx, tareaId, [alumno.id]);
      if (marcada) {
        const notas = await tx.execute({ sql: 'SELECT 1 FROM notas_tareas WHERE tarea_id = ? AND alumno_id = ?', args: [tareaId, alumno.id] });
        if (Number(tarea.con_nota) && notas.rows.length) throw new ErrorGrupo('Primero borrá la nota para desmarcar la entrega.');
      }
      for (const integrante of integrantes) {
        await tx.execute({ sql: 'DELETE FROM completadas WHERE tarea_id = ? AND alumno_id = ?', args: [tareaId, integrante.id] });
        if (!marcada) await tx.execute({
          sql: 'INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)',
          args: [tareaId, integrante.id, integrante.nombre, fecha]
        });
      }
    } else {
      if (!Number(tarea.con_nota)) throw new ErrorGrupo('La tarea no está configurada para llevar nota.');
      const validacion = validarNota(nota);
      if (!validacion.vacia && !validacion.valida) throw new ErrorGrupo('La nota debe ser un número entre 1 y 10.');
      for (const integrante of integrantes) {
        if (validacion.vacia) {
          await tx.execute({ sql: 'DELETE FROM notas_tareas WHERE tarea_id = ? AND alumno_id = ?', args: [tareaId, integrante.id] });
        } else {
          await tx.execute({
            sql: `INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en) VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, nota = excluded.nota, cargada_en = excluded.cargada_en`,
            args: [`nota_tarea_${randomUUID()}`, tareaId, integrante.id, integrante.nombre, validacion.valor, fecha]
          });
        }
      }
    }
    return { alumnos: integrantes.map((i) => i.nombre) };
  });
}

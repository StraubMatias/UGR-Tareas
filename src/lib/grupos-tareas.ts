import { randomUUID } from 'node:crypto';
import type { Client, InValue, Transaction } from '@libsql/client';
import { tareaHabilitada, validarNota } from '../app/validators.ts';

export class ErrorGrupo extends Error {}

interface TareaFila {
  id: string;
  grupal?: number | bigint | string | null;
  inicio?: string | null;
  con_nota?: number | bigint | string | null;
  cupo_maximo?: number | bigint | string | null;
}

interface Persona {
  id: string;
  nombre: string;
}

interface OpcionesGrupo {
  nombre?: string;
  grupoId?: string | null;
  salir?: boolean;
  eliminarGrupoId?: string | null;
  permitirMover?: boolean;
}

interface OpcionesProgreso {
  nota?: string | number;
  alternarEntrega?: boolean;
}

async function transaccion<T>(db: Client, ejecutar: (tx: Transaction) => Promise<T>): Promise<T> {
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

async function consultar<T>(tx: Transaction, sql: string, args: InValue[] = []): Promise<T[]> {
  const res = await tx.execute({ sql, args });
  return res.rows as unknown as T[];
}

async function obtenerTarea(tx: Transaction, tareaId: string): Promise<TareaFila> {
  const filas = await consultar<TareaFila>(tx, 'SELECT * FROM tareas WHERE id = ?', [tareaId]);
  if (!filas[0]) throw new ErrorGrupo('La tarea no existe.');
  return filas[0];
}

async function tieneProgreso(tx: Transaction, tareaId: string, alumnos: string[]): Promise<boolean> {
  for (const id of alumnos) {
    const filas = await consultar<Record<string, unknown>>(tx, `SELECT 1 FROM completadas WHERE tarea_id = ? AND alumno_id = ?
            UNION ALL SELECT 1 FROM notas_tareas WHERE tarea_id = ? AND alumno_id = ? LIMIT 1`, [tareaId, id, tareaId, id]);
    if (filas.length) return true;
  }
  return false;
}

// Sincroniza entregas y notas existentes entre todos los integrantes actuales del grupo.
async function sincronizarProgresoGrupo(tx: Transaction, tarea: TareaFila, grupoId: string): Promise<void> {
  const miembros = await consultar<Persona>(tx,
    'SELECT a.id, a.nombre FROM integrantes_tareas i JOIN alumnos a ON a.id = i.alumno_id WHERE i.grupo_id = ?',
    [grupoId]
  );
  if (!miembros.length) return;

  const placeholders = miembros.map(() => '?').join(',');
  const ids = miembros.map((m) => m.id);

  // 1. Sincronizar entregas si al menos un integrante ya la tenía marcada
  const completadas = await consultar<{ completada_en: string | null }>(tx,
    `SELECT * FROM completadas WHERE tarea_id = ? AND alumno_id IN (${placeholders}) ORDER BY completada_en ASC`,
    [tarea.id, ...ids]
  );

  if (completadas.length > 0) {
    const fechaCompletada = completadas[0].completada_en || new Date().toISOString();
    for (const m of miembros) {
      await tx.execute({
        sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)
              ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, completada_en = excluded.completada_en`,
        args: [tarea.id, m.id, m.nombre, fechaCompletada]
      });
    }
  }

  // 2. Sincronizar nota si la tarea lleva nota y al menos un integrante ya tenía nota cargada
  if (Number(tarea.con_nota)) {
    const notas = await consultar<{ nota: string | number | null; cargada_en: string | null }>(tx,
      `SELECT * FROM notas_tareas WHERE tarea_id = ? AND alumno_id IN (${placeholders}) ORDER BY cargada_en DESC`,
      [tarea.id, ...ids]
    );

    if (notas.length > 0) {
      const notaSincronizar = notas[0].nota;
      const fechaNota = notas[0].cargada_en || new Date().toISOString();
      for (const m of miembros) {
        await tx.execute({
          sql: `INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, nota = excluded.nota, cargada_en = excluded.cargada_en`,
          args: [`nota_tarea_${randomUUID()}`, tarea.id, m.id, m.nombre, notaSincronizar, fechaNota]
        });
        await tx.execute({
          sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)
                ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, completada_en = excluded.completada_en`,
          args: [tarea.id, m.id, m.nombre, fechaNota]
        });
      }
    }
  }
}

// El servidor debe pasar el alumno obtenido de la sesión, nunca del formulario.
export async function asignarGrupo(
  db: Client,
  tareaId: string,
  alumnoId: string | null,
  {
    nombre,
    grupoId = null,
    salir = false,
    eliminarGrupoId = null,
    permitirMover = false
  }: OpcionesGrupo = {}
): Promise<{ grupoId: string | null; eliminado?: boolean }> {
  return transaccion(db, async (tx) => {
    const tarea = await obtenerTarea(tx, tareaId);
    if (!Number(tarea.grupal)) throw new ErrorGrupo('Esta tarea es individual.');

    if (eliminarGrupoId) {
      const grupo = await consultar<{ id: string }>(tx,
        'SELECT id FROM grupos_tareas WHERE id = ? AND tarea_id = ?',
        [eliminarGrupoId, tareaId]
      );
      if (!grupo.length) throw new ErrorGrupo('El grupo no pertenece a esta tarea.');
      await tx.execute({ sql: 'DELETE FROM integrantes_tareas WHERE grupo_id = ? AND tarea_id = ?', args: [eliminarGrupoId, tareaId] });
      await tx.execute({ sql: 'DELETE FROM grupos_tareas WHERE id = ? AND tarea_id = ?', args: [eliminarGrupoId, tareaId] });
      return { grupoId: null, eliminado: true };
    }

    const actual = alumnoId
      ? (await consultar<{ grupo_id: string | null }>(tx,
        'SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?',
        [tareaId, alumnoId]
      ))[0]?.grupo_id ?? null
      : null;

    if (actual && !salir && !permitirMover) throw new ErrorGrupo('Primero salí de tu grupo actual.');
    if (salir && !actual) throw new ErrorGrupo('No pertenecés a un grupo de esta tarea.');
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    let destino: string | null = actual;
    if (!salir) {
      if (grupoId) {
        const grupo = await consultar<{ id: string }>(tx,
          'SELECT id FROM grupos_tareas WHERE id = ? AND tarea_id = ?', [grupoId, tareaId]
        );
        if (!grupo.length) throw new ErrorGrupo('El grupo no pertenece a esta tarea.');

        const integrantesCount = await consultar<{ total: number | bigint | string }>(tx,
          'SELECT COUNT(*) as total FROM integrantes_tareas WHERE grupo_id = ?', [grupoId]
        );
        if (Number(tarea.cupo_maximo) > 0 && Number(integrantesCount[0].total) >= Number(tarea.cupo_maximo)) {
          throw new ErrorGrupo('El grupo ya alcanzó el cupo máximo permitido.');
        }
        destino = grupoId;
      } else {
        if (!nombreLimpio || nombreLimpio.length > 100) throw new ErrorGrupo('El nombre del grupo debe tener entre 1 y 100 caracteres.');
        const repetido = await consultar<{ id: string }>(tx,
          'SELECT id FROM grupos_tareas WHERE tarea_id = ? AND nombre = ?', [tareaId, nombreLimpio]
        );
        if (repetido.length) throw new ErrorGrupo('Ya existe un grupo con ese nombre. Podés unirte a él.');
        destino = `grupo_${randomUUID()}`;
        await tx.execute({
          sql: 'INSERT INTO grupos_tareas (id, tarea_id, nombre) VALUES (?, ?, ?)',
          args: [destino, tareaId, nombreLimpio]
        });
      }
    }

    if (salir) {
      await tx.execute({ sql: 'DELETE FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?', args: [tareaId, alumnoId] });
      await tx.execute({ sql: 'DELETE FROM grupos_tareas WHERE id = ? AND NOT EXISTS (SELECT 1 FROM integrantes_tareas WHERE grupo_id = ?)', args: [actual, actual] });
    } else {
      if (!destino) throw new ErrorGrupo('No se pudo resolver el grupo.');
      if (actual && actual !== destino && permitirMover) {
        await tx.execute({ sql: 'DELETE FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?', args: [tareaId, alumnoId] });
        await tx.execute({ sql: 'DELETE FROM grupos_tareas WHERE id = ? AND NOT EXISTS (SELECT 1 FROM integrantes_tareas WHERE grupo_id = ?)', args: [actual, actual] });
      }
      await tx.execute({ sql: 'INSERT INTO integrantes_tareas (tarea_id, alumno_id, grupo_id) VALUES (?, ?, ?)', args: [tareaId, alumnoId, destino] });
      // Sincronizar automáticamente entregas y notas previas entre los integrantes
      await sincronizarProgresoGrupo(tx, tarea, destino);
    }
    return { grupoId: salir ? null : destino };
  });
}

async function destinatarios(tx: Transaction, tarea: TareaFila, alumno: Persona): Promise<Persona[]> {
  if (!Number(tarea.grupal)) return [alumno];
  const filas = await consultar<Persona>(tx, `SELECT a.id, a.nombre FROM integrantes_tareas i JOIN alumnos a ON a.id = i.alumno_id
          WHERE i.tarea_id = ? AND i.grupo_id = (
            SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?
          )`, [tarea.id, tarea.id, alumno.id]);
  // Sin grupo asignado: la tarea sigue siendo grupal, pero la entrega/nota es solo de esta persona.
  if (!filas.length) return [alumno];
  return filas;
}

export async function actualizarProgresoTarea(
  db: Client,
  tareaId: string,
  alumno: Persona,
  { nota, alternarEntrega = false }: OpcionesProgreso = {}
): Promise<{ alumnos: string[] }> {
  return transaccion(db, async (tx) => {
    const tarea = await obtenerTarea(tx, tareaId);
    if (!tareaHabilitada(tarea.inicio)) throw new ErrorGrupo('La tarea todavía no está habilitada.');
    const integrantes = await destinatarios(tx, tarea, alumno);
    const fecha = new Date().toISOString();
    if (alternarEntrega) {
      const marcada = await tieneProgreso(tx, tareaId, [alumno.id]);
      if (marcada) {
        const notas = await consultar<Record<string, unknown>>(tx,
          'SELECT 1 FROM notas_tareas WHERE tarea_id = ? AND alumno_id = ?', [tareaId, alumno.id]
        );
        if (Number(tarea.con_nota) && notas.length) throw new ErrorGrupo('Primero borrá la nota para desmarcar la entrega.');
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
            args: [`nota_tarea_${randomUUID()}`, tarea.id, integrante.id, integrante.nombre, validacion.valor, fecha]
          });
          await tx.execute({
            sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)
                  ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, completada_en = excluded.completada_en`,
            args: [tareaId, integrante.id, integrante.nombre, fecha]
          });
        }
      }
    }
    return { alumnos: integrantes.map((i) => i.nombre) };
  });
}

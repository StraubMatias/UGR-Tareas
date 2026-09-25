import { randomUUID } from 'node:crypto';
import type { Client, InValue, Transaction } from '@libsql/client';
import { tareaHabilitada, validarNota } from '../app/validators.ts';

export class ErrorGrupo extends Error {}

interface TareaFila {
  id: string;
  grupal?: number | bigint | string | null;
  permite_individual?: number | bigint | string | null;
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

function permiteEntregaIndividual(tarea: TareaFila): boolean {
  return !Number(tarea.grupal) || Number(tarea.permite_individual ?? 1) === 1;
}

async function marcarEntregaIndividualTx(
  tx: Transaction,
  tareaId: string,
  alumnoId: string,
  activo: boolean
): Promise<void> {
  const tarea = await obtenerTarea(tx, tareaId);
  if (!Number(tarea.grupal)) throw new ErrorGrupo('Esta tarea es individual.');
  if (!permiteEntregaIndividual(tarea)) {
    throw new ErrorGrupo('Esta tarea solo se entrega en grupo. Unite o creá uno.');
  }
  const enGrupo = await consultar<{ grupo_id: string }>(tx,
    'SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?',
    [tareaId, alumnoId]
  );
  if (enGrupo.length) throw new ErrorGrupo('Salí del grupo antes de marcar entrega individual.');
  if (activo) {
    await tx.execute({
      sql: `INSERT INTO preferencias_tarea_alumno (tarea_id, alumno_id, entrega_individual)
            VALUES (?, ?, 1)
            ON CONFLICT(tarea_id, alumno_id) DO UPDATE SET entrega_individual = 1`,
      args: [tareaId, alumnoId]
    });
  } else {
    await tx.execute({
      sql: 'DELETE FROM preferencias_tarea_alumno WHERE tarea_id = ? AND alumno_id = ?',
      args: [tareaId, alumnoId]
    });
  }
}

export async function marcarEntregaIndividual(
  db: Client,
  tareaId: string,
  alumnoId: string,
  activo: boolean
): Promise<void> {
  if (!alumnoId) throw new ErrorGrupo('No se pudo identificar al alumno.');
  return transaccion(db, async (tx) => marcarEntregaIndividualTx(tx, tareaId, alumnoId, activo));
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
async function sincronizarProgresoGrupo(
  tx: Transaction,
  tarea: TareaFila,
  grupoId: string
): Promise<{ integrantes: string[]; nota: string | null }> {
  const miembros = await consultar<Persona>(tx,
    'SELECT a.id, a.nombre FROM integrantes_tareas i JOIN alumnos a ON a.id = i.alumno_id WHERE i.grupo_id = ?',
    [grupoId]
  );
  if (!miembros.length) return { integrantes: [], nota: null };

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
    const notas = await consultar<{ nota: string | number | null; cargada_en: string | null; alumno_id: string }>(tx,
      `SELECT nota, cargada_en, alumno_id FROM notas_tareas WHERE tarea_id = ? AND alumno_id IN (${placeholders}) ORDER BY cargada_en ASC`,
      [tarea.id, ...ids]
    );

    if (notas.length > 0) {
      const fuente = notas[0];
      const notaSincronizar = fuente.nota;
      const ahoraIso = new Date().toISOString();
      const fechaFuente = fuente.cargada_en || ahoraIso;
      const notasPrevias = await consultar<{ alumno_id: string; cargada_en: string | null }>(tx,
        `SELECT alumno_id, cargada_en FROM notas_tareas WHERE tarea_id = ? AND alumno_id IN (${placeholders})`,
        [tarea.id, ...ids]
      );
      const conNotaAntes = new Set(notasPrevias.map((fila) => fila.alumno_id));
      const cargadaEnPorAlumno = new Map(notasPrevias.map((fila) => [fila.alumno_id, fila.cargada_en]));
      const actualizados: string[] = [];
      for (const m of miembros) {
        const esFuente = m.id === fuente.alumno_id;
        const yaTenia = conNotaAntes.has(m.id);
        let fechaNota = esFuente
          ? fechaFuente
          : (yaTenia ? (cargadaEnPorAlumno.get(m.id) || ahoraIso) : ahoraIso);
        const fechaCopiadaDelFuente = Boolean(
          yaTenia && !esFuente && fechaNota === fechaFuente
        );
        if (fechaCopiadaDelFuente) fechaNota = ahoraIso;

        if (yaTenia && !esFuente) {
          if (fechaCopiadaDelFuente) {
            await tx.execute({
              sql: `UPDATE notas_tareas SET nota = ?, alumno_id = ?, cargada_en = ? WHERE tarea_id = ? AND alumno_id = ?`,
              args: [notaSincronizar, m.id, fechaNota, tarea.id, m.id]
            });
          } else {
            await tx.execute({
              sql: `UPDATE notas_tareas SET nota = ?, alumno_id = ? WHERE tarea_id = ? AND alumno_id = ?`,
              args: [notaSincronizar, m.id, tarea.id, m.id]
            });
          }
        } else {
          await tx.execute({
            sql: `INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en) VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, nota = excluded.nota, cargada_en = excluded.cargada_en`,
            args: [`nota_tarea_${randomUUID()}`, tarea.id, m.id, m.nombre, notaSincronizar, fechaNota]
          });
        }
        await tx.execute({
          sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)
                ON CONFLICT(tarea_id, alumno) DO UPDATE SET
                  alumno_id = excluded.alumno_id,
                  completada_en = CASE
                    WHEN completadas.completada_en IS NOT NULL AND completadas.completada_en != ''
                         AND completadas.completada_en != ?
                    THEN completadas.completada_en
                    ELSE excluded.completada_en
                  END`,
          args: [tarea.id, m.id, m.nombre, fechaNota, fechaFuente]
        });
        if (!yaTenia) actualizados.push(m.nombre);
      }
      return { integrantes: actualizados, nota: String(notaSincronizar ?? '') };
    }
  }
  return { integrantes: [], nota: null };
}

/** Tras cargar una nota personal (p. ej. campus): replica al resto del grupo de esa tarea. */
export async function propagarNotaGrupalTrasCargaCampus(
  db: Client,
  tareaId: string,
  alumnoId: string
): Promise<{
  tareaNombre: string;
  nota: string;
  integrantesActualizados: string[];
  integrantesGrupo: string[];
} | null> {
  const fila = await db.execute({
    sql: `SELECT i.grupo_id, t.nombre AS tarea_nombre
          FROM integrantes_tareas i
          JOIN tareas t ON t.id = i.tarea_id
          WHERE i.tarea_id = ? AND i.alumno_id = ? AND COALESCE(t.grupal, 0) = 1`,
    args: [tareaId, alumnoId]
  });
  const grupoId = fila.rows[0]?.grupo_id;
  if (!grupoId) return null;
  const tareaNombre = String(fila.rows[0]?.tarea_nombre || 'Tarea grupal');
  const propagado = await transaccion(db, async (tx) => {
    const tarea = await obtenerTarea(tx, tareaId);
    return sincronizarProgresoGrupo(tx, tarea, String(grupoId));
  });
  if (!propagado.nota) return null;
  const miembros = await db.execute({
    sql: `SELECT a.nombre FROM integrantes_tareas i JOIN alumnos a ON a.id = i.alumno_id WHERE i.grupo_id = ? ORDER BY a.nombre`,
    args: [String(grupoId)]
  });
  const integrantesGrupo = miembros.rows.map((r) => String(r.nombre));
  return {
    tareaNombre,
    nota: propagado.nota,
    integrantesActualizados: propagado.integrantes,
    integrantesGrupo
  };
}

/** Tras sync o carga manual: replica nota/entrega del grupo a todos los integrantes. */
export async function propagarNotasGrupalesEnMaterias(
  db: Client,
  alumnoId: string,
  materiaIds: string[]
): Promise<Array<{ tareaId: string; tareaNombre: string; nota: string; integrantes: string[] }>> {
  if (!materiaIds.length) return [];
  const marcas = materiaIds.map(() => '?').join(',');
  const resGrupos = await db.execute({
    sql: `SELECT DISTINCT t.id AS tarea_id, i.grupo_id, t.nombre AS tarea_nombre
          FROM tareas t
          JOIN integrantes_tareas i ON i.tarea_id = t.id
          WHERE t.materia_id IN (${marcas}) AND COALESCE(t.grupal, 0) = 1 AND i.alumno_id = ?`,
    args: [...materiaIds, alumnoId]
  });
  const filas = resGrupos.rows.map((fila) => ({
    tarea_id: String(fila.tarea_id),
    grupo_id: String(fila.grupo_id),
    tarea_nombre: String(fila.tarea_nombre)
  }));
  const resultado: Array<{ tareaId: string; tareaNombre: string; nota: string; integrantes: string[] }> = [];
  for (const fila of filas) {
    const propagado = await transaccion(db, async (tx) => {
      const tarea = await obtenerTarea(tx, fila.tarea_id);
      return sincronizarProgresoGrupo(tx, tarea, fila.grupo_id);
    });
    if (propagado.integrantes.length && propagado.nota) {
      resultado.push({
        tareaId: fila.tarea_id,
        tareaNombre: fila.tarea_nombre,
        nota: propagado.nota,
        integrantes: propagado.integrantes
      });
    }
  }
  return resultado;
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
      await tx.execute({
        sql: 'DELETE FROM preferencias_tarea_alumno WHERE tarea_id = ? AND alumno_id = ?',
        args: [tareaId, alumnoId]
      });
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
    if (Number(tarea.grupal) && !permiteEntregaIndividual(tarea)) {
      const enGrupo = await consultar<{ grupo_id: string }>(tx,
        'SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?',
        [tareaId, alumno.id]
      );
      if (!enGrupo.length) {
        throw new ErrorGrupo('Esta tarea se entrega en grupo. Creá uno o unite a uno existente.');
      }
    }
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

export async function enviarInvitacionGrupo(
  db: Client,
  tareaId: string,
  deAlumnoId: string,
  paraAlumnoId: string,
  grupoId: string
): Promise<{ id: string }> {
  if (deAlumnoId === paraAlumnoId) throw new ErrorGrupo('No podés invitarte a vos mismo.');
  return transaccion(db, async (tx) => {
    const tarea = await obtenerTarea(tx, tareaId);
    if (!Number(tarea.grupal)) throw new ErrorGrupo('Esta tarea no es grupal.');

    const pertenece = await consultar<{ grupo_id: string }>(tx,
      'SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ? AND grupo_id = ?',
      [tareaId, deAlumnoId, grupoId]
    );
    if (!pertenece.length) throw new ErrorGrupo('Solo podés invitar desde un grupo en el que estés.');

    const destinoEnGrupo = await consultar<{ grupo_id: string }>(tx,
      'SELECT grupo_id FROM integrantes_tareas WHERE tarea_id = ? AND alumno_id = ?',
      [tareaId, paraAlumnoId]
    );
    if (destinoEnGrupo.length) throw new ErrorGrupo('Esa persona ya tiene grupo en esta tarea.');

    const pendiente = await consultar<{ id: string }>(tx,
      `SELECT id FROM invitaciones_grupo
       WHERE tarea_id = ? AND para_alumno_id = ? AND grupo_id = ? AND estado = 'pendiente'`,
      [tareaId, paraAlumnoId, grupoId]
    );
    if (pendiente.length) throw new ErrorGrupo('Ya hay una invitación pendiente para esa persona.');

    const cupo = Number(tarea.cupo_maximo) || 0;
    if (cupo > 0) {
      const integrantesCount = await consultar<{ total: number | bigint | string }>(tx,
        'SELECT COUNT(*) as total FROM integrantes_tareas WHERE grupo_id = ?', [grupoId]
      );
      if (Number(integrantesCount[0].total) >= cupo) {
        throw new ErrorGrupo('El grupo ya está completo.');
      }
    }

    const id = `inv_grupo_${randomUUID()}`;
    await tx.execute({
      sql: `INSERT INTO invitaciones_grupo (id, grupo_id, tarea_id, de_alumno_id, para_alumno_id, creada_en, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      args: [id, grupoId, tareaId, deAlumnoId, paraAlumnoId, new Date().toISOString()]
    });
    return { id };
  });
}

export async function responderInvitacionGrupo(
  db: Client,
  invitacionId: string,
  paraAlumnoId: string,
  aceptar: boolean
): Promise<void> {
  const res = await db.execute({
    sql: 'SELECT id, grupo_id, tarea_id, para_alumno_id, estado FROM invitaciones_grupo WHERE id = ?',
    args: [invitacionId]
  });
  const fila = res.rows[0];
  const invitacion = fila
    ? {
      id: String(fila.id),
      grupo_id: String(fila.grupo_id),
      tarea_id: String(fila.tarea_id),
      para_alumno_id: String(fila.para_alumno_id),
      estado: String(fila.estado)
    }
    : undefined;
  if (!invitacion) throw new ErrorGrupo('La invitación no existe.');
  if (String(invitacion.para_alumno_id) !== paraAlumnoId) throw new ErrorGrupo('Esta invitación no es para vos.');
  if (String(invitacion.estado) !== 'pendiente') throw new ErrorGrupo('Esta invitación ya fue respondida.');

  if (!aceptar) {
    await db.execute({
      sql: "UPDATE invitaciones_grupo SET estado = 'rechazada' WHERE id = ?",
      args: [invitacionId]
    });
    return;
  }

  await asignarGrupo(db, String(invitacion.tarea_id), paraAlumnoId, { grupoId: String(invitacion.grupo_id) });
  await db.batch([
    {
      sql: "UPDATE invitaciones_grupo SET estado = 'aceptada' WHERE id = ?",
      args: [invitacionId]
    },
    {
      sql: `UPDATE invitaciones_grupo SET estado = 'cancelada'
            WHERE tarea_id = ? AND para_alumno_id = ? AND estado = 'pendiente' AND id != ?`,
      args: [invitacion.tarea_id, paraAlumnoId, invitacionId]
    }
  ], 'write');
}

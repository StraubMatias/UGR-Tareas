'use server';

import { db } from '../turso';
import { convertirValidacion } from '../../lib/utils';
import type { RespuestaAction } from './types';
import {
  crearId,
  obtenerIPReal,
  verificarRateLimitEscritura,
  registrarAuditoria,
  obtenerUsuarioSesion,
  verificarAdmin,
  existeMateria,
  validarLongitud,
  MAX_AULA_LENGTH
} from '../../server/action-internals';

export async function crearHorarioAction({ materiaId, dia, horaInicio, horaFin, aula }: { materiaId: string; dia: string | number; horaInicio: string; horaFin: string; aula: string; usuario?: string }): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede crear horarios.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };

    const diaNumerico = Number(dia);
    if (!Number.isInteger(diaNumerico) || diaNumerico < 1 || diaNumerico > 5) {
      return { exito: false, mensaje: 'Los horarios solo pueden cargarse de lunes a viernes.' };
    }
    const validacionAula = validarLongitud(aula, MAX_AULA_LENGTH, 'aula');
    if (!validacionAula.valida) return convertirValidacion(validacionAula);

    const id = crearId('horario_');
    await db.execute({
      sql: 'INSERT INTO horarios (id, materia_id, dia, hora_inicio, hora_fin, aula) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, diaNumerico, horaInicio, horaFin, validacionAula.valor]
    });
    await registrarAuditoria({ accion: 'crear_horario', usuario: usuarioSesion, detalle: `Creó horario para la materia ${materiaId}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error al crear horario:', error);
    return { exito: false, mensaje: 'No se pudo crear el horario.' };
  }
}

export async function eliminarHorarioAction(id: string, usuario: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede borrar horarios.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    await db.execute({ sql: 'DELETE FROM horarios WHERE id = ?', args: [id] });
    await registrarAuditoria({ accion: 'eliminar_horario', usuario: usuarioSesion, detalle: `Eliminó el horario ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    return { exito: false, mensaje: 'No se pudo borrar el horario.' };
  }
}

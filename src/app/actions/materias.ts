'use server';

import { db } from '../turso';
import { convertirValidacion } from '../../lib/utils';
import { normalizarUnidad } from '../validators';
import type { RespuestaAction, TareaActionParams } from './types';
import {
  crearId,
  obtenerIPReal,
  verificarRateLimitEscritura,
  registrarAuditoria,
  obtenerUsuarioSesion,
  verificarAdmin,
  existeMateria,
  validarFecha,
  validarLongitud,
  MAX_NOMBRE_LENGTH,
  MAX_DETALLES_LENGTH,
  MAX_CONDICIONES_LENGTH
} from '../../server/action-internals';


export async function crearMateriaAction({ nombre, anio, cuatrimestre }: {
  nombre: string;
  anio: string | number;
  cuatrimestre: string | number;
}): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede crear materias.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre de la materia');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
    const nombreFormateado = validacionNombre.valor;
    const anioNumerico = Number(anio);
    const cuatrimestreNumerico = Number(cuatrimestre);

    if (!nombreFormateado) {
      return { exito: false, mensaje: 'El nombre de la materia es obligatorio.' };
    }
    if (!Number.isInteger(anioNumerico) || anioNumerico < 2000) {
      return { exito: false, mensaje: 'Ingresá un año válido.' };
    }
    if (![1, 2].includes(cuatrimestreNumerico)) {
      return { exito: false, mensaje: 'El cuatrimestre debe ser 1 o 2.' };
    }

    const periodoId = `periodo_${anioNumerico}_${cuatrimestreNumerico}`;
    const id = crearId('m_');
    await db.execute({
      sql: 'INSERT OR IGNORE INTO periodos (id, anio, cuatrimestre, nombre, activo) VALUES (?, ?, ?, ?, 1)',
      args: [periodoId, anioNumerico, cuatrimestreNumerico, `${anioNumerico} - ${cuatrimestreNumerico}° cuatrimestre`]
    });
    await db.batch([
      { sql: 'INSERT INTO materias (id, nombre, periodo_id) VALUES (?, ?, ?)', args: [id, nombreFormateado.toUpperCase(), periodoId] },
      {
        sql: `INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id)
              SELECT id, ? FROM alumnos WHERE COALESCE(origen, 'comision') = 'comision'`,
        args: [id]
      }
    ], 'write');
    await registrarAuditoria({ accion: 'crear_materia', usuario: usuarioSesion, detalle: `Creó la materia ${nombreFormateado}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la materia.' };
  }
}

export async function renombrarMateriaAction(id: string, nuevoNombre: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede renombrar materias.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nuevoNombre, MAX_NOMBRE_LENGTH, 'nombre de la materia');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre es obligatorio.' };
    await db.execute({
      sql: 'UPDATE materias SET nombre = ? WHERE id = ?',
      args: [validacionNombre.valor.toUpperCase(), id]
    });
    await registrarAuditoria({ accion: 'renombrar_materia', usuario: usuarioSesion, detalle: `Renombró la materia ${id} a ${validacionNombre.valor}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en renombrarMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo renombrar la materia.' };
  }
}

export async function editarCondicionesMateriaAction({ id, condiciones, notaMinimaRegularizar, notaMinimaPromocionar, reglaPromocion }: {
  id: string;
  condiciones: string;
  notaMinimaRegularizar: string | number;
  notaMinimaPromocionar: string | number;
  reglaPromocion: string;
  usuario?: string | null;
}): Promise<RespuestaAction> {
  try {
    const regularizar = Number(notaMinimaRegularizar);
    const promocionar = Number(notaMinimaPromocionar);
    const reglasValidas = ['tp_nota', 'tp_porcentaje_nota', 'auditorias_tps', 'ciberdelitos_parciales', 'riesgos_tps', 'activos_porcentaje', 'metodologia'];
    const maximo = ['activos_porcentaje', 'tp_porcentaje_nota'].includes(reglaPromocion) ? 100 : 10;
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede editar condiciones.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionCondiciones = validarLongitud(condiciones, MAX_CONDICIONES_LENGTH, 'condiciones');
    if (!validacionCondiciones.valida) return convertirValidacion(validacionCondiciones);
    if (![regularizar, promocionar].every((nota) => Number.isFinite(nota) && nota >= 1 && nota <= maximo)) {
      return { exito: false, mensaje: `Los valores mínimos deben estar entre 1 y ${maximo}.` };
    }
    if (!reglasValidas.includes(reglaPromocion)) {
      return { exito: false, mensaje: 'La regla de promoción no es válida.' };
    }
    if (promocionar < regularizar) {
      return { exito: false, mensaje: 'La nota para promocionar no puede ser menor que la de regularización.' };
    }
    await db.execute({
      sql: 'UPDATE materias SET condiciones = ?, nota_minima_regularizar = ?, nota_minima_promocionar = ?, regla_promocion = ? WHERE id = ?',
      args: [validacionCondiciones.valor, regularizar, promocionar, reglaPromocion, id]
    });
    await registrarAuditoria({ accion: 'editar_condiciones_materia', usuario: usuarioSesion, detalle: `Editó condiciones de la materia ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error al editar condiciones de materia:', error);
    return { exito: false, mensaje: 'No se pudieron guardar las condiciones.' };
  }
}

export async function eliminarMateriaAction(id: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar materias.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM notas_tareas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM integrantes_tareas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM grupos_tareas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM tareas WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM notas_parciales WHERE parcial_id IN (SELECT id FROM parciales WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM parciales WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM horarios WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM inscripciones WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM materias WHERE id = ?', args: [id] }
    ], 'write');
    await registrarAuditoria({ accion: 'eliminar_materia', usuario: usuarioSesion, detalle: `Eliminó la materia ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar la materia y sus datos relacionados.' };
  }
}

export async function crearTareaAction(params: TareaActionParams): Promise<RespuestaAction> {
  const { materiaId, nombre, inicio, fin, detalles, unidad, conNota, tipo, grupal = false, permiteIndividual = true, cupoMaximo = 0 } = params;
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede crear tareas.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre de la tarea');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre de la tarea es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return convertirValidacion(validacionDetalles);
    const validacionInicio = validarFecha(inicio);
    if (!validacionInicio.valida) return { exito: false, mensaje: 'La fecha de inicio no es válida.' };
    const validacionFin = validarFecha(fin);
    if (!validacionFin.valida) return { exito: false, mensaje: 'La fecha de fin no es válida.' };
    const unidadNormalizada = normalizarUnidad(unidad);
    if (!unidadNormalizada.valida) {
      return { exito: false, mensaje: 'La unidad debe ser un número entero mayor o igual a 1.' };
    }
    const conNotaNumerico = conNota ? 1 : 0;
    const tipoNormalizado = ['actividad', 'foro', 'trabajo_practico'].includes(tipo) ? tipo : 'actividad';
    const cupo = Number(cupoMaximo);
    if (!Number.isInteger(cupo) || cupo < 0 || cupo > 30) {
      return { exito: false, mensaje: 'El cupo del grupo tiene que ser un entero entre 0 y 30.' };
    }

    const grupalNumerico = grupal === true ? 1 : 0;
    const permiteIndividualNumerico = grupalNumerico && permiteIndividual === false ? 0 : 1;
    const id = crearId('t_');
    await db.execute({
      sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo, grupal, permite_individual, cupo_maximo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, validacionNombre.valor, validacionInicio.valor, validacionFin.valor, validacionDetalles.valor || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado, grupalNumerico, permiteIndividualNumerico, cupo]
    });
    await registrarAuditoria({ accion: 'crear_tarea', usuario: usuarioSesion, detalle: `Creó la tarea ${validacionNombre.valor}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la tarea.' };
  }
}

export async function editarTareaAction(params: TareaActionParams): Promise<RespuestaAction> {
  const { id, nombre, inicio, fin, detalles, unidad, conNota, tipo, grupal = false, permiteIndividual = true, cupoMaximo = 0 } = params;
  try {
    if (!id) return { exito: false, mensaje: 'ID de tarea requerido.' };
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede editar tareas.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre de la tarea');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre de la tarea es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return convertirValidacion(validacionDetalles);
    const validacionInicio = validarFecha(inicio);
    if (!validacionInicio.valida) return { exito: false, mensaje: 'La fecha de inicio no es válida.' };
    const validacionFin = validarFecha(fin);
    if (!validacionFin.valida) return { exito: false, mensaje: 'La fecha de fin no es válida.' };
    const unidadNormalizada = normalizarUnidad(unidad);
    if (!unidadNormalizada.valida) {
      return { exito: false, mensaje: 'La unidad debe ser un número entero mayor o igual a 1.' };
    }
    const conNotaNumerico = conNota ? 1 : 0;
    const tipoNormalizado = ['actividad', 'foro', 'trabajo_practico'].includes(tipo) ? tipo : 'actividad';

    const grupalNumerico = grupal === true ? 1 : 0;
    const permiteIndividualNumerico = grupalNumerico && permiteIndividual === false ? 0 : 1;
    const cupo = Number(cupoMaximo);
    if (!Number.isInteger(cupo) || cupo < 0 || cupo > 30) {
      return { exito: false, mensaje: 'El cupo del grupo tiene que ser un entero entre 0 y 30.' };
    }
    const actualizacion = await db.execute({
      sql: 'UPDATE tareas SET nombre = ?, inicio = ?, fin = ?, detalles = ?, unidad = ?, con_nota = ?, tipo = ?, grupal = ?, permite_individual = ?, cupo_maximo = ? WHERE id = ?',
      args: [validacionNombre.valor, validacionInicio.valor, validacionFin.valor, validacionDetalles.valor || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado, grupalNumerico, permiteIndividualNumerico, cupo, id]
    });
    if (!actualizacion.rowsAffected) return { exito: false, mensaje: 'La tarea seleccionada no existe o no se pudo editar.' };
    await registrarAuditoria({ accion: 'editar_tarea', usuario: usuarioSesion, detalle: `Editó la tarea ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en editarTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo editar la tarea.' };
  }
}

export async function eliminarTareaAction(id: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar tareas.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM notas_tareas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM integrantes_tareas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM grupos_tareas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM tareas WHERE id = ?', args: [id] }
    ], 'write');
    await registrarAuditoria({ accion: 'eliminar_tarea', usuario: usuarioSesion, detalle: `Eliminó la tarea ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar la tarea.' };
  }
}
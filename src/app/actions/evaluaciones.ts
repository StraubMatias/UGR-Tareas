'use server';

import { db } from '../turso';
import { asignarGrupo, actualizarProgresoTarea, ErrorGrupo } from '../../lib/grupos-tareas';
import { convertirValidacion } from '../../lib/utils';
import { parcialHabilitado, validarNota } from '../validators';
import type { RespuestaAction } from './types';
import {
  texto,
  textoONull,
  crearId,
  obtenerIPReal,
  verificarRateLimitEscritura,
  registrarAuditoria,
  obtenerUsuarioSesion,
  verificarAdmin,
  obtenerAlumno,
  existeMateria,
  validarFecha,
  validarLongitud,
  MAX_NOMBRE_LENGTH,
  MAX_DETALLES_LENGTH
} from '../../server/action-internals';


// --- PARCIALES Y NOTAS ---


export async function crearParcialAction({ materiaId, nombre, fecha, detalles, usuario }: { materiaId: string; nombre: string; fecha: string; detalles: string; usuario: string }): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede crear parciales.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre del parcial');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre del parcial es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return convertirValidacion(validacionDetalles);
    const validacionFecha = validarFecha(fecha);
    if (!validacionFecha.valida) return { exito: false, mensaje: 'La fecha no es válida.' };

    const id = crearId('parcial_');
    await db.execute({
      sql: 'INSERT INTO parciales (id, materia_id, nombre, fecha, detalles) VALUES (?, ?, ?, ?, ?)',
      args: [id, materiaId, validacionNombre.valor, validacionFecha.valor, validacionDetalles.valor || 'Sin observaciones']
    });
    await registrarAuditoria({ accion: 'crear_parcial', usuario: usuarioSesion, detalle: `Creó el parcial ${validacionNombre.valor}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo crear el parcial.' };
  }
}

export async function editarParcialAction({ id, materiaId, nombre, fecha, detalles, usuario }: { id: string; materiaId: string; nombre: string; fecha: string; detalles: string; usuario: string }): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede editar parciales.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre del parcial');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre del parcial es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return convertirValidacion(validacionDetalles);
    const validacionFecha = validarFecha(fecha);
    if (!validacionFecha.valida) return { exito: false, mensaje: 'La fecha no es válida.' };

    await db.execute({
      sql: 'UPDATE parciales SET materia_id = ?, nombre = ?, fecha = ?, detalles = ? WHERE id = ?',
      args: [materiaId, validacionNombre.valor, validacionFecha.valor, validacionDetalles.valor || 'Sin observaciones', id]
    });
    await registrarAuditoria({ accion: 'editar_parcial', usuario: usuarioSesion, detalle: `Editó el parcial ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en editarParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo editar el parcial.' };
  }
}

export async function eliminarParcialAction(id: string, usuario: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede borrar parciales.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    await db.batch([
      { sql: 'DELETE FROM notas_parciales WHERE parcial_id = ?', args: [id] },
      { sql: 'DELETE FROM parciales WHERE id = ?', args: [id] }
    ], 'write');
    await registrarAuditoria({ accion: 'eliminar_parcial', usuario: usuarioSesion, detalle: `Eliminó el parcial ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo borrar el parcial.' };
  }
}

export async function guardarNotaParcialAction(parcialId: string, alumno: string, nota: string | number, usuario: string): Promise<RespuestaAction> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) {
      return { exito: false, mensaje: 'Debés iniciar sesión para cargar notas.' };
    }
    const alumnoSolicitado = String(alumno || '').trim();
    const esAdmin = await verificarAdmin();
    if (!esAdmin) {
      return { exito: false, mensaje: 'La nota del parcial se copia de UGR Virtual al sincronizar.' };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const parcial = await db.execute({
      sql: 'SELECT fecha FROM parciales WHERE id = ?',
      args: [parcialId]
    });

    if (parcial.rows.length === 0) {
      return { exito: false, mensaje: 'El parcial no existe.' };
    }

    if (!parcialHabilitado(textoONull(parcial.rows[0].fecha))) {
      return { exito: false, mensaje: 'La nota se puede cargar a partir de la fecha del parcial.' };
    }
    const alumnoDB = await obtenerAlumno(alumnoSolicitado);
    if (!alumnoDB) return { exito: false, mensaje: 'El alumno no existe.' };

    const notaLimpia = typeof nota === 'string' ? nota.trim() : '';
    const validacion = validarNota(nota);
    if (!validacion.vacia && !validacion.valida) {
      return { exito: false, mensaje: 'La nota debe ser un número entre 1 y 10.' };
    }
    
    // Verificamos si ya existe nota cargada para este alumno en este parcial
    const existe = await db.execute({
      sql: 'SELECT id FROM notas_parciales WHERE parcial_id = ? AND alumno_id = ?',
      args: [parcialId, alumnoDB.id]
    });

    if (existe.rows.length > 0) {
      if (notaLimpia === '') {
        // Si borra el input, eliminamos la nota registrada
        await db.execute({
          sql: 'DELETE FROM notas_parciales WHERE parcial_id = ? AND alumno_id = ?',
          args: [parcialId, alumnoDB.id]
        });
        await registrarAuditoria({ accion: 'eliminar_nota_parcial', usuario: usuarioSesion, detalle: `Eliminó la nota de ${alumnoDB.nombre} en el parcial ${parcialId}`, ip: await obtenerIPReal() });
      } else {
        // Actualizamos la nota
        await db.execute({
          sql: 'UPDATE notas_parciales SET nota = ? WHERE parcial_id = ? AND alumno_id = ?',
          args: [validacion.valor, parcialId, alumnoDB.id]
        });
        await registrarAuditoria({ accion: 'guardar_nota_parcial', usuario: usuarioSesion, detalle: `Actualizó nota ${validacion.valor} de ${alumnoDB.nombre} en el parcial ${parcialId}`, ip: await obtenerIPReal() });
      }
    } else if (!validacion.vacia) {
      // Insertamos nueva nota
      const id = crearId('nota_');
      await db.execute({
        sql: 'INSERT INTO notas_parciales (id, parcial_id, alumno_id, alumno, nota) VALUES (?, ?, ?, ?, ?)',
        args: [id, parcialId, alumnoDB.id, alumnoDB.nombre, validacion.valor]
      });
      await registrarAuditoria({ accion: 'guardar_nota_parcial', usuario: usuarioSesion, detalle: `Cargó nota ${validacion.valor} a ${alumnoDB.nombre} en el parcial ${parcialId}`, ip: await obtenerIPReal() });
    }
    return { exito: true };
  } catch (error) {
    console.error('Error en guardarNotaParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo guardar la nota.' };
  }
}

export async function guardarNotaTareaAction(
  tareaId: string,
  alumno: string,
  nota: string | number,
  usuario: string
): Promise<RespuestaAction> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) {
      return { exito: false, mensaje: 'Debés iniciar sesión para cargar notas.' };
    }
    const alumnoSolicitado = String(alumno || '').trim();
    const esAdmin = await verificarAdmin();
    if (!esAdmin) {
      return { exito: false, mensaje: 'La nota de la tarea se copia de UGR Virtual al sincronizar.' };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const alumnoDB = await obtenerAlumno(alumnoSolicitado);
    if (!alumnoDB) return { exito: false, mensaje: 'El alumno no existe.' };

    const resultado = await actualizarProgresoTarea(db, tareaId, alumnoDB, { nota });
    await registrarAuditoria({
      accion: 'guardar_nota_tarea',
      usuario: usuarioSesion,
      detalle: `Cargó nota en la tarea ${tareaId} para: ${resultado.alumnos.join(', ')}`,
      ip: await obtenerIPReal()
    });

    return { exito: true };
  } catch (error) {
    console.error('Error en guardarNotaTareaAction:', error);
    return { 
      exito: false, 
      mensaje: error instanceof ErrorGrupo ? error.message : 'No se pudo guardar la nota de la tarea.' 
    };
  }
}

export interface GestionarGrupoParams {
  tareaId: string;
  nombre?: string;
  grupoId?: string;
  salir?: boolean;
  alumnoNombre?: string;
  eliminarGrupoId?: string;
}

export async function gestionarGrupoTareaAction(params: GestionarGrupoParams): Promise<RespuestaAction> {
  const { tareaId, nombre, grupoId, salir = false, alumnoNombre, eliminarGrupoId } = params;
  try {
    const usuario = await obtenerUsuarioSesion();
    if (!usuario) return { exito: false, mensaje: 'Debés iniciar sesión.' };
    const limite = await verificarRateLimitEscritura(usuario);
    if (!limite.exito) return limite;

    const esAdmin = await verificarAdmin();

    if (eliminarGrupoId) {
      if (!esAdmin) return { exito: false, mensaje: 'Solo el administrador puede eliminar grupos.' };
      await asignarGrupo(db, tareaId, null, { eliminarGrupoId });
      await registrarAuditoria({
        accion: 'grupo_tarea_eliminar',
        usuario,
        detalle: `Eliminó el grupo ${eliminarGrupoId} de la tarea ${tareaId}`,
        ip: await obtenerIPReal()
      });
      return { exito: true };
    }

    const nombreAlumnoObjetivo = (esAdmin && alumnoNombre) ? alumnoNombre.trim() : usuario;
    if (!esAdmin && alumnoNombre && alumnoNombre.trim().toLowerCase() !== usuario.toLowerCase()) {
      return { exito: false, mensaje: 'Solo el administrador puede gestionar los grupos de otros compañeros.' };
    }

    const alumno = await obtenerAlumno(nombreAlumnoObjetivo);
    if (!alumno) return { exito: false, mensaje: 'El alumno no existe.' };

    if (!salir && !eliminarGrupoId) {
      const tareaFila = await db.execute({
        sql: 'SELECT materia_id FROM tareas WHERE id = ?',
        args: [tareaId]
      });
      const materiaId = texto(tareaFila.rows[0]?.materia_id);
      if (!materiaId) return { exito: false, mensaje: 'La tarea no existe.' };
      const cursa = await db.execute({
        sql: 'SELECT 1 FROM inscripciones WHERE materia_id = ? AND alumno_id = ?',
        args: [materiaId, alumno.id]
      });
      if (cursa.rows.length === 0) {
        return { exito: false, mensaje: 'Ese alumno no está cursando esta materia.' };
      }
    }

    await asignarGrupo(db, tareaId, alumno.id, {
      nombre,
      grupoId,
      salir,
      permitirMover: esAdmin
    });

    await registrarAuditoria({
      accion: 'grupo_tarea',
      usuario,
      detalle: `${salir ? 'Salió de' : 'Asignó a'} un grupo de la tarea ${tareaId} (${nombreAlumnoObjetivo})`,
      ip: await obtenerIPReal()
    });
    return { exito: true };
  } catch (error) {
    console.error('Error al gestionar grupo:', error);
    return {
      exito: false,
      mensaje: error instanceof ErrorGrupo ? error.message : 'No se pudo actualizar el grupo.'
    };
  }
}

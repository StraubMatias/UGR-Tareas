'use server';

import { db } from '../turso';
import { actualizarProgresoTarea, ErrorGrupo } from '../../lib/grupos-tareas';
import { alumnosConLaMismaCursada } from '../../lib/companeros';
import type { RespuestaAction } from './types';
import {
  texto,
  textoONull,
  obtenerIPReal,
  verificarRateLimitEscritura,
  registrarAuditoria,
  obtenerUsuarioSesion,
  verificarAdmin,
  obtenerAlumno,
  leerCuenta,
  borrarCuentasSinSincronizar,
  CODIGOS_PLAN
} from '../../server/action-internals';
import { armarMaterias, consultaPeriodo } from '../../server/estado-helpers';
import { validarNota } from '../validators';

// Una ida a Turso con todas las lecturas del tablero. Antes cada refresco
// repetía la sesión y abría un pedido por tabla (~15 roundtrips).
export async function obtenerEstadoCompleto(periodoIdSolicitado: string | null | undefined = null) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return null;

    await borrarCuentasSinSincronizar();
    const cuenta = await leerCuenta(usuarioSesion);
    const yaInscripto = texto(cuenta?.id)
      ? await db.execute({ sql: 'SELECT 1 FROM inscripciones WHERE alumno_id = ? LIMIT 1', args: [texto(cuenta?.id)] })
      : { rows: [] };
    if (texto(cuenta?.origen) === 'propio' && yaInscripto.rows.length === 0) {
      const [nombres, inscriptos] = await Promise.all([
        db.execute('SELECT nombre FROM alumnos ORDER BY nombre ASC'),
        db.execute(`SELECT a.nombre AS alumno, i.materia_id
                    FROM inscripciones i JOIN alumnos a ON a.id = i.alumno_id`)
      ]);
      return {
        usuario: usuarioSesion,
        rol: 'alumno',
        origen: 'propio',
        ugrUsuario: textoONull(cuenta?.ugr_usuario),
        periodos: [],
        periodoActivo: null,
        materias: [],
        alumnos: [usuarioSesion],
        registrados: nombres.rows.map((fila) => texto(fila.nombre)),
        parciales: [],
        notas: [],
        horarios: [],
        cronograma: [],
        progresoPlan: [],
        avisos: [],
        inscripciones: inscriptos.rows.map((fila) => ({
          alumno: texto(fila.alumno),
          materiaId: texto(fila.materia_id)
        }))
      };
    }

    let periodoParaCargar = periodoIdSolicitado || null;
    if (!periodoParaCargar) {
      const previa = await db.execute('SELECT id, activo FROM periodos ORDER BY anio DESC, cuatrimestre DESC');
      periodoParaCargar = texto(
        previa.rows.find((periodo) => Number(periodo.activo) === 1)?.id || previa.rows[0]?.id
      ) || null;
    }

    const [
      resPeriodos,
      resMaterias,
      resTareas,
      resCompletadas,
      resNotasTareas,
      resGrupos,
      resPreferenciasGrupo,
      resAlumnos,
      resParciales,
      resNotasParciales,
      resHorarios,
      resCronograma,
      resProgreso,
      resAvisos,
      resRol,
      resInscripciones,
      resInvitacionesGrupo
    ] = await db.batch([
      { sql: 'SELECT id, anio, cuatrimestre, nombre, activo FROM periodos ORDER BY anio DESC, cuatrimestre DESC', args: [] },
      consultaPeriodo(
        periodoParaCargar,
        `SELECT id, nombre, condiciones, nota_minima_regularizar, nota_minima_promocionar, regla_promocion
         FROM materias WHERE periodo_id = ? ORDER BY nombre ASC`,
        `SELECT id, nombre, condiciones, nota_minima_regularizar, nota_minima_promocionar, regla_promocion
         FROM materias ORDER BY nombre ASC`
      ),
      consultaPeriodo(
        periodoParaCargar,
        `SELECT t.id, t.materia_id, t.nombre, t.inicio, t.fin, t.detalles, t.unidad, t.con_nota, t.tipo, t.url, t.grupal, t.permite_individual, t.cupo_maximo
         FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE m.periodo_id = ?`,
        `SELECT id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo, url, grupal, permite_individual, cupo_maximo FROM tareas`
      ),
      consultaPeriodo(
        periodoParaCargar,
        `SELECT c.tarea_id, COALESCE(a.nombre, c.alumno) AS alumno, c.completada_en
         FROM completadas c
         JOIN tareas t ON t.id = c.tarea_id
         JOIN materias m ON m.id = t.materia_id
         LEFT JOIN alumnos a ON a.id = c.alumno_id
         WHERE m.periodo_id = ?`,
        `SELECT c.tarea_id, COALESCE(a.nombre, c.alumno) AS alumno, c.completada_en
         FROM completadas c LEFT JOIN alumnos a ON a.id = c.alumno_id`
      ),
      consultaPeriodo(
        periodoParaCargar,
        `SELECT n.tarea_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota, n.cargada_en
         FROM notas_tareas n
         JOIN tareas t ON t.id = n.tarea_id
         JOIN materias m ON m.id = t.materia_id
         LEFT JOIN alumnos a ON a.id = n.alumno_id
         WHERE m.periodo_id = ?`,
        `SELECT n.tarea_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota, n.cargada_en
         FROM notas_tareas n LEFT JOIN alumnos a ON a.id = n.alumno_id`
      ),
      {
        sql: `SELECT g.id, g.tarea_id, g.nombre, a.nombre AS alumno
          FROM grupos_tareas g LEFT JOIN integrantes_tareas i ON i.grupo_id = g.id
          LEFT JOIN alumnos a ON a.id = i.alumno_id ORDER BY g.nombre, a.nombre`,
        args: []
      },
      {
        sql: `SELECT p.tarea_id, a.nombre AS alumno
              FROM preferencias_tarea_alumno p
              JOIN alumnos a ON a.id = p.alumno_id
              WHERE p.entrega_individual = 1`,
        args: []
      },
      { sql: 'SELECT nombre FROM alumnos ORDER BY nombre ASC', args: [] },
      consultaPeriodo(
        periodoParaCargar,
        `SELECT p.id, p.materia_id, p.nombre, p.fecha, p.detalles, p.url
         FROM parciales p JOIN materias m ON m.id = p.materia_id
         WHERE m.periodo_id = ? ORDER BY p.fecha ASC`,
        `SELECT id, materia_id, nombre, fecha, detalles, url FROM parciales ORDER BY fecha ASC`
      ),
      consultaPeriodo(
        periodoParaCargar,
        `SELECT n.id, n.parcial_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota
         FROM notas_parciales n
         JOIN parciales p ON p.id = n.parcial_id
         JOIN materias m ON m.id = p.materia_id
         LEFT JOIN alumnos a ON a.id = n.alumno_id
         WHERE m.periodo_id = ?`,
        `SELECT n.id, n.parcial_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota
         FROM notas_parciales n LEFT JOIN alumnos a ON a.id = n.alumno_id`
      ),
      consultaPeriodo(
        periodoParaCargar,
        `SELECT h.id, h.materia_id, h.dia, h.hora_inicio, h.hora_fin, h.aula, h.alumno_id
         FROM horarios h JOIN materias m ON m.id = h.materia_id
         WHERE CAST(h.dia AS INTEGER) BETWEEN 1 AND 5 AND m.periodo_id = ?
         ORDER BY h.dia ASC, h.hora_inicio ASC`,
        `SELECT h.id, h.materia_id, h.dia, h.hora_inicio, h.hora_fin, h.aula, h.alumno_id
         FROM horarios h
         WHERE CAST(h.dia AS INTEGER) BETWEEN 1 AND 5
         ORDER BY h.dia ASC, h.hora_inicio ASC`
      ),
      consultaPeriodo(
        periodoParaCargar,
        `SELECT c.id, c.materia_id, c.fecha, c.modalidad, c.tipo, c.titulo, c.detalles, c.url, c.origen
         FROM cronograma_eventos c JOIN materias m ON m.id = c.materia_id
         WHERE m.periodo_id = ? ORDER BY c.fecha ASC, c.titulo ASC`,
        `SELECT id, materia_id, fecha, modalidad, tipo, titulo, detalles, url, origen
         FROM cronograma_eventos ORDER BY fecha ASC, titulo ASC`
      ),
      {
        sql: 'SELECT COALESCE(a.nombre, p.alumno) AS alumno, p.materia_codigo, p.estado, p.nota, p.actualizado_en FROM progreso_materias p LEFT JOIN alumnos a ON a.id = p.alumno_id ORDER BY alumno ASC, p.materia_codigo ASC',
        args: []
      },
      {
        sql: `SELECT id, curso_id, curso_nombre, materia_id, materia_nombre, foro_nombre, titulo, autor, fecha, contenido, url, estado
              FROM avisos_moodle WHERE estado = 'aceptado' ORDER BY fecha DESC`,
        args: []
      },
      { sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)', args: [usuarioSesion] },
      {
        sql: `SELECT a.nombre AS alumno, i.materia_id
              FROM inscripciones i
              JOIN alumnos a ON a.id = i.alumno_id`,
        args: []
      },
      {
        sql: `SELECT i.id, i.grupo_id, i.tarea_id, g.nombre AS grupo_nombre,
                     t.nombre AS tarea_nombre, m.nombre AS materia_nombre, a.nombre AS de_alumno
              FROM invitaciones_grupo i
              JOIN grupos_tareas g ON g.id = i.grupo_id AND g.tarea_id = i.tarea_id
              JOIN tareas t ON t.id = i.tarea_id
              JOIN materias m ON m.id = t.materia_id
              JOIN alumnos a ON a.id = i.de_alumno_id
              WHERE i.para_alumno_id = ? AND i.estado = 'pendiente'
              ORDER BY i.creada_en DESC`,
        args: [texto(cuenta?.id)]
      }
    ], 'read');

    const materiasArmadas = armarMaterias(
      resMaterias.rows,
      resTareas.rows,
      resCompletadas.rows,
      resNotasTareas.rows,
      resGrupos.rows,
      resPreferenciasGrupo.rows
    );
    const inscripciones = resInscripciones.rows.map((fila) => ({
      alumno: texto(fila.alumno),
      materiaId: texto(fila.materia_id)
    }));
    const companeros = alumnosConLaMismaCursada(
      inscripciones,
      usuarioSesion,
      materiasArmadas.map((materia) => materia.id)
    );
    const materiasPropias = new Set(
      inscripciones
        .filter((fila) => fila.alumno.toLowerCase() === usuarioSesion.toLowerCase())
        .map((fila) => fila.materiaId)
    );
    const rol = texto(resRol.rows[0]?.rol) || 'alumno';
    const verTodaLaCursada = rol === 'admin';
    const materiaVisible = (materiaId: string) => verTodaLaCursada || materiasPropias.has(materiaId);
    const materiaDeLaCursada = (materiaId: string) => materiasPropias.has(materiaId);
    const materiasVisibles = materiasArmadas.filter((materia) => materiaVisible(materia.id));
    const todosLosAlumnos = resAlumnos.rows.map((fila) => texto(fila.nombre));
    const alumnosVisibles = verTodaLaCursada
      ? todosLosAlumnos
      : companeros;

    return {
      usuario: usuarioSesion,
      rol,
      origen: texto(cuenta?.origen) || 'comision',
      ugrUsuario: textoONull(cuenta?.ugr_usuario),
      periodos: resPeriodos.rows.map((fila) => ({
        id: texto(fila.id),
        anio: Number(fila.anio),
        cuatrimestre: Number(fila.cuatrimestre),
        nombre: texto(fila.nombre),
        activo: Number(fila.activo)
      })),
      periodoActivo: periodoParaCargar,
      materias: materiasVisibles,
      alumnos: alumnosVisibles,
      registrados: todosLosAlumnos,
      parciales: resParciales.rows.filter((fila) => materiaVisible(texto(fila.materia_id))).map((fila) => ({
        id: texto(fila.id),
        materia_id: texto(fila.materia_id),
        nombre: texto(fila.nombre),
        fecha: texto(fila.fecha),
        detalles: texto(fila.detalles),
        url: texto(fila.url)
      })),
      notas: resNotasParciales.rows.map((fila) => ({
        id: texto(fila.id),
        parcial_id: texto(fila.parcial_id),
        alumno: texto(fila.alumno),
        nota: fila.nota == null || fila.nota === '' ? null : Number(fila.nota)
      })),
      horarios: resHorarios.rows.filter((fila) => {
        if (!materiaDeLaCursada(texto(fila.materia_id))) return false;
        const duenio = textoONull(fila.alumno_id);
        return !duenio || duenio === texto(cuenta?.id);
      }).map((fila) => ({
        id: texto(fila.id),
        materia_id: texto(fila.materia_id),
        dia: texto(fila.dia),
        hora_inicio: texto(fila.hora_inicio),
        hora_fin: texto(fila.hora_fin),
        aula: texto(fila.aula)
      })),
      cronograma: resCronograma.rows.filter((fila) => materiaDeLaCursada(texto(fila.materia_id))).map((fila) => ({
        id: texto(fila.id),
        materia_id: texto(fila.materia_id),
        fecha: texto(fila.fecha),
        modalidad: texto(fila.modalidad),
        tipo: texto(fila.tipo),
        titulo: texto(fila.titulo),
        detalles: texto(fila.detalles),
        url: texto(fila.url),
        origen: texto(fila.origen)
      })),
      progresoPlan: resProgreso.rows.map((fila) => ({
        alumno: textoONull(fila.alumno),
        materia_codigo: texto(fila.materia_codigo),
        estado: texto(fila.estado),
        nota: fila.nota == null || fila.nota === '' ? null : Number(fila.nota),
        actualizado_en: texto(fila.actualizado_en)
      })),
      avisos: resAvisos.rows
        .filter((fila) => materiaDeLaCursada(texto(fila.materia_id)))
        .map((fila) => ({
          id: texto(fila.id),
          curso_id: texto(fila.curso_id),
          curso_nombre: texto(fila.curso_nombre),
          materia_nombre: texto(fila.materia_nombre),
          foro_nombre: texto(fila.foro_nombre),
          titulo: texto(fila.titulo),
          autor: texto(fila.autor),
          fecha: texto(fila.fecha),
          contenido: texto(fila.contenido),
          url: texto(fila.url),
          estado: texto(fila.estado)
        })),
      inscripciones,
      invitacionesGrupo: resInvitacionesGrupo.rows.map((fila) => ({
        id: texto(fila.id),
        grupoId: texto(fila.grupo_id),
        tareaId: texto(fila.tarea_id),
        grupoNombre: texto(fila.grupo_nombre),
        tareaNombre: texto(fila.tarea_nombre),
        materiaNombre: texto(fila.materia_nombre),
        deAlumno: texto(fila.de_alumno)
      }))
    };
  } catch (error) {
    console.error('Error en obtenerEstadoCompleto:', error);
    return null;
  }
}

export async function guardarProgresoPlanAction({ alumno, materiaCodigo, estado, nota }: {
  alumno: string;
  materiaCodigo: string;
  estado: string;
  nota?: string | number | null;
}): Promise<RespuestaAction> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const admin = await verificarAdmin();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const estadosValidos = ['pendiente', 'cursando', 'aprobada', 'promocionada'];
    if (!alumno || !CODIGOS_PLAN.has(materiaCodigo) || !estadosValidos.includes(estado)) {
      return { exito: false, mensaje: 'Los datos del progreso no son válidos.' };
    }
    const alumnoDB = await obtenerAlumno(alumno);
    if (!alumnoDB) return { exito: false, mensaje: 'El alumno no existe.' };
    if (!admin && usuarioSesion.toLowerCase() !== alumno.toLowerCase()) {
      return { exito: false, mensaje: 'Solo podés actualizar tu propio estado académico.' };
    }
    if (!admin && !['aprobada', 'promocionada'].includes(estado)) {
      return { exito: false, mensaje: 'Tu estado solo puede ser aprobada o promocionada.' };
    }
    const notaValidada = validarNota(nota);
    if (['aprobada', 'promocionada'].includes(estado) && notaValidada.vacia) {
      return { exito: false, mensaje: 'Cargá la nota final para guardar una materia aprobada.' };
    }
    if (!notaValidada.vacia && !notaValidada.valida) {
      return { exito: false, mensaje: 'La nota debe ser un número entre 1 y 10.' };
    }

    await db.execute({
      sql: `
        INSERT INTO progreso_materias (id, alumno_id, alumno, materia_codigo, estado, nota, actualizado_en)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(alumno, materia_codigo) DO UPDATE SET
          alumno_id = excluded.alumno_id,
          estado = excluded.estado,
          nota = excluded.nota,
          actualizado_en = excluded.actualizado_en
      `,
      args: [`progreso_${alumnoDB.id}_${materiaCodigo}`, alumnoDB.id, alumnoDB.nombre, materiaCodigo, estado, ['aprobada', 'promocionada'].includes(estado) ? notaValidada.valor : null]
    });
    await registrarAuditoria({ accion: 'guardar_progreso_plan', usuario: usuarioSesion, detalle: `Actualizó ${materiaCodigo} de ${alumnoDB.nombre} a ${estado}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error al guardar progreso del plan:', error);
    return { exito: false, mensaje: 'No se pudo guardar el progreso.' };
  }
}

export async function toggleTareaAction(tareaId: string, alumno?: string): Promise<RespuestaAction> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    // Admin puede marcar la entrega de cualquier alumno; el alumno solo de sí mismo
    const alumnoObjetivo = (await verificarAdmin() && alumno) ? alumno : usuarioSesion;
    const alumnoDB = await obtenerAlumno(alumnoObjetivo);
    if (!alumnoDB) return { exito: false, mensaje: 'El alumno no existe.' };
    const resultado = await actualizarProgresoTarea(db, tareaId, alumnoDB, { alternarEntrega: true });
    await registrarAuditoria({ accion: 'alternar_entrega_tarea', usuario: usuarioSesion, detalle: `Cambió entrega de ${tareaId} para: ${resultado.alumnos.join(', ')}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en toggleTareaAction:', error);
    return { exito: false, mensaje: error instanceof ErrorGrupo ? error.message : 'No se pudo actualizar la tarea.' };
  }
}

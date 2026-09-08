'use server';

import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import { db } from './turso';
import { PLAN_DE_ESTUDIO } from './plan-utils';

const COOKIE_SESION = 'ugr_sesion';
const DURACION_SESION_SEGUNDOS = 10 * 60;
const scryptAsync = promisify(scrypt);

const MENSAJE_LOGIN_INVALIDO = 'Usuario o contraseña incorrectos.';
const MENSAJE_LOGIN_BLOQUEADO = 'Demasiados intentos. Probá de nuevo en unos minutos.';
const LIMITE_LOGIN_USUARIO = 5;
const LIMITE_LOGIN_IP = 20;
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const BLOQUEO_LOGIN_MS = 15 * 60 * 1000;
const CODIGOS_PLAN = new Set(PLAN_DE_ESTUDIO.map((materia) => materia.codigo));

function obtenerSecretoSesion() {
  const secreto = process.env.SESSION_SECRET?.trim();
  if (!secreto) throw new Error('Falta SESSION_SECRET en el entorno.');
  return secreto;
}

function crearId(prefijo) {
  return `${prefijo}${randomUUID()}`;
}

async function obtenerClavesLogin(usuario) {
  const encabezados = await headers();
  const ip = encabezados.get('x-forwarded-for')?.split(',')[0]?.trim()
    || encabezados.get('x-real-ip')?.trim()
    || 'unknown';
  const claves = [{ clave: `ip:${ip}`, limite: LIMITE_LOGIN_IP }];
  if (usuario) claves.push({ clave: `user:${usuario.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO });
  return claves;
}

async function loginEstaBloqueado(claves) {
  const ahora = Date.now();
  for (const { clave } of claves) {
    const res = await db.execute({
      sql: 'SELECT bloqueado_hasta FROM login_intentos WHERE clave = ?',
      args: [clave]
    });
    if (Number(res.rows[0]?.bloqueado_hasta || 0) > ahora) return true;
  }
  return false;
}

async function registrarFalloLogin(claves) {
  const ahora = Date.now();
  for (const { clave, limite } of claves) {
    const res = await db.execute({
      sql: 'SELECT fallos, ventana_inicio FROM login_intentos WHERE clave = ?',
      args: [clave]
    });
    const fila = res.rows[0];
    const mismaVentana = fila && ahora - Number(fila.ventana_inicio) < VENTANA_LOGIN_MS;
    const fallos = mismaVentana ? Number(fila.fallos) + 1 : 1;
    const ventanaInicio = mismaVentana ? Number(fila.ventana_inicio) : ahora;
    const bloqueadoHasta = fallos >= limite ? ahora + BLOQUEO_LOGIN_MS : null;

    await db.execute({
      sql: `
        INSERT INTO login_intentos (clave, fallos, ventana_inicio, bloqueado_hasta)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(clave) DO UPDATE SET
          fallos = excluded.fallos,
          ventana_inicio = excluded.ventana_inicio,
          bloqueado_hasta = excluded.bloqueado_hasta
      `,
      args: [clave, fallos, ventanaInicio, bloqueadoHasta]
    });
  }
}

async function limpiarIntentosLogin(claves) {
  for (const { clave } of claves) {
    await db.execute({
      sql: 'DELETE FROM login_intentos WHERE clave = ?',
      args: [clave]
    });
  }
}

function firmarSesion(payload) {
  return createHmac('sha256', obtenerSecretoSesion()).update(payload).digest('base64url');
}

function crearValorSesion(usuario, versionSesion) {
  const payload = Buffer.from(JSON.stringify({
    usuario,
    versionSesion,
    expira: Date.now() + DURACION_SESION_SEGUNDOS * 1000
  })).toString('base64url');
  return `${payload}.${firmarSesion(payload)}`;
}

function leerValorSesion(valor) {
  try {
    const [payload, firma] = String(valor || '').split('.');
    if (!payload || !firma) return null;

    const firmaEsperada = firmarSesion(payload);
    const firmaBytes = Buffer.from(firma);
    const firmaEsperadaBytes = Buffer.from(firmaEsperada);
    if (firmaBytes.length !== firmaEsperadaBytes.length || !timingSafeEqual(firmaBytes, firmaEsperadaBytes)) {
      return null;
    }

    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return datos.expira > Date.now() && typeof datos.usuario === 'string'
      ? { usuario: datos.usuario, versionSesion: Number(datos.versionSesion) || 1 }
      : null;
  } catch (error) {
    return null;
  }
}

async function establecerSesion(usuario, versionSesion) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESION, crearValorSesion(usuario, versionSesion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DURACION_SESION_SEGUNDOS,
    path: '/'
  });
}

async function obtenerUsuarioSesion() {
  const cookieStore = await cookies();
  const sesion = leerValorSesion(cookieStore.get(COOKIE_SESION)?.value);
  if (!sesion) return null;

  const resultado = await db.execute({
    sql: 'SELECT sesion_version FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [sesion.usuario]
  });
  const versionActual = Number(resultado.rows[0]?.sesion_version || 0);
  return versionActual > 0 && versionActual === sesion.versionSesion ? sesion.usuario : null;
}

async function verificarAdmin() {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) return false;
  const resultado = await db.execute({
    sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [usuario]
  });
  return resultado.rows[0]?.rol === 'admin';
}

async function obtenerRolUsuario(usuario) {
  if (!usuario) return null;
  const resultado = await db.execute({
    sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [usuario]
  });
  return resultado.rows[0]?.rol || 'alumno';
}

async function existeMateria(id) {
  const resultado = await db.execute({
    sql: 'SELECT 1 FROM materias WHERE id = ?',
    args: [id]
  });
  return resultado.rows.length > 0;
}

async function obtenerAlumno(nombre) {
  const resultado = await db.execute({
    sql: 'SELECT id, nombre FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [nombre]
  });
  return resultado.rows[0] || null;
}

async function hashearPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivada = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derivada).toString('hex')}`;
}

async function verificarPassword(password, almacenada) {
  if (!almacenada?.startsWith('scrypt$')) return false;

  const [, salt, hashHex] = almacenada.split('$');
  if (!salt || !hashHex) return false;

  try {
    const derivada = await scryptAsync(password, salt, hashHex.length / 2);
    const hashBytes = Buffer.from(hashHex, 'hex');
    const derivadaBytes = Buffer.from(derivada);
    return hashBytes.length === derivadaBytes.length && timingSafeEqual(hashBytes, derivadaBytes);
  } catch (error) {
    return false;
  }
}

function parcialHabilitado(fecha) {
  if (!fecha || fecha === 'Sin fecha') return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaParcial = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaParcial.getTime()) && fechaParcial <= hoy;
}

function tareaHabilitada(fecha) {
  if (!fecha || fecha === 'Sin fecha') return true;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaInicio.getTime()) && fechaInicio <= hoy;
}

function tareaDentroDelPlazo(fecha) {
  if (!fecha || fecha === 'Sin fecha') return true;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaCierre = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaCierre.getTime()) && hoy < fechaCierre;
}

function validarNota(nota) {
  const notaLimpia = typeof nota === 'string' ? nota.trim().replace(',', '.') : String(nota ?? '').trim();
  if (!notaLimpia) return { valida: false, vacia: true, valor: '' };

  const valor = Number(notaLimpia);
  return {
    valida: Number.isFinite(valor) && valor >= 1 && valor <= 10,
    vacia: false,
    valor: notaLimpia
  };
}

function normalizarUnidad(unidad) {
  const unidadLimpia = unidad === null || unidad === undefined ? '' : String(unidad).trim();
  if (!unidadLimpia) return { valida: true, valor: null };
  if (!/^\d+$/.test(unidadLimpia) || Number(unidadLimpia) < 1) {
    return { valida: false, valor: null };
  }
  return { valida: true, valor: Number(unidadLimpia) };
}

// --- AUTENTICACIÓN Y ALUMNOS ---

// Valida credenciales consultando directamente a la tabla alumnos en Turso
export async function validarLoginAction(usuarioInput, passwordInput) {
  try {
    const userClean = String(usuarioInput || '').trim();
    const passClean = String(passwordInput || '').trim();

    if (!userClean || !passClean) {
      return { exito: false, mensaje: MENSAJE_LOGIN_INVALIDO };
    }

    const clavesLogin = await obtenerClavesLogin(userClean);
    if (await loginEstaBloqueado(clavesLogin)) {
      return { exito: false, mensaje: MENSAJE_LOGIN_BLOQUEADO };
    }

    const res = await db.execute({
      sql: 'SELECT nombre, password, rol, sesion_version FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [userClean]
    });

    if (res.rows.length === 0) {
      await registrarFalloLogin(clavesLogin);
      return { exito: false, mensaje: MENSAJE_LOGIN_INVALIDO };
    }

    const usuarioDB = res.rows[0];
    const credencialesValidas = await verificarPassword(passClean, usuarioDB.password);

    if (!credencialesValidas) {
      await registrarFalloLogin(clavesLogin);
      return { exito: false, mensaje: MENSAJE_LOGIN_INVALIDO };
    }

    await limpiarIntentosLogin(clavesLogin);
    await establecerSesion(usuarioDB.nombre, Number(usuarioDB.sesion_version) || 1);
    return { exito: true, usuario: usuarioDB.nombre, rol: usuarioDB.rol || 'alumno' };
  } catch (error) {
    console.error('Error en validarLoginAction:', error);
    const detalle = String(error?.message || '').toLowerCase();
    if (detalle.includes('no such table') && detalle.includes('login_intentos')) {
      return { exito: false, mensaje: 'La base necesita actualizarse. Ejecutá npm run migrate antes de iniciar la app.' };
    }
    if (detalle.includes('no such column') && detalle.includes('rol')) {
      return { exito: false, mensaje: 'La base necesita actualizarse. Ejecutá npm run migrate antes de iniciar la app.' };
    }
    return { exito: false, mensaje: 'Error de conexión con la base de datos' };
  }
}

export async function cerrarSesionAction() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESION);
  return { exito: true };
}

export async function obtenerSesionAction() {
  const usuario = await obtenerUsuarioSesion();
  return { usuario, rol: await obtenerRolUsuario(usuario) };
}

// Cambiar contraseña en la tabla alumnos en Turso
export async function cambiarPasswordAction(usuarioInput, passActualInput, passNuevaInput) {
  try {
    const userClean = usuarioInput ? usuarioInput.trim() : '';
    const passActualClean = passActualInput ? passActualInput.trim() : '';
    const passNuevaClean = passNuevaInput ? passNuevaInput.trim() : '';

    if (!userClean || !passActualClean || !passNuevaClean) {
      return { exito: false, mensaje: 'Completá todos los campos.' };
    }

    if (passNuevaClean.length < 6) {
      return { exito: false, mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    // 1. Validamos credenciales actuales
    const loginValido = await validarLoginAction(userClean, passActualClean);
    if (!loginValido.exito) {
      return { exito: false, mensaje: 'La contraseña actual es incorrecta.' };
    }

    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion || usuarioSesion.toLowerCase() !== userClean.toLowerCase()) {
      return { exito: false, mensaje: 'La sesión no es válida. Volvé a iniciar sesión.' };
    }

    // 2. Actualizamos el campo password en la base de datos Turso
    const version = await db.execute({
      sql: 'SELECT sesion_version FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [userClean]
    });
    const nuevaVersion = Number(version.rows[0]?.sesion_version || 1) + 1;
    await db.execute({
      sql: 'UPDATE alumnos SET password = ?, sesion_version = ? WHERE LOWER(nombre) = LOWER(?)',
      args: [await hashearPassword(passNuevaClean), nuevaVersion, userClean]
    });
    await establecerSesion(userClean, nuevaVersion);

    return { exito: true, mensaje: '¡Contraseña actualizada con éxito!' };
  } catch (error) {
    console.error('Error en cambiarPasswordAction:', error);
    return { exito: false, mensaje: 'Error al cambiar la contraseña en la base de datos.' };
  }
}

// Obtener todos los alumnos registrados
export async function obtenerAlumnosAction() {
  try {
    if (!await obtenerUsuarioSesion()) return [];
    const res = await db.execute('SELECT nombre FROM alumnos ORDER BY nombre ASC');
    return res.rows.map((r) => r.nombre);
  } catch (error) {
    console.error('Error al obtener alumnos:', error);
    return [];
  }
}

export async function obtenerPeriodosAction() {
  try {
    if (!await obtenerUsuarioSesion()) return [];
    const res = await db.execute('SELECT id, anio, cuatrimestre, nombre, activo FROM periodos ORDER BY anio DESC, cuatrimestre DESC');
    return res.rows;
  } catch (error) {
    console.error('Error al obtener períodos:', error);
    return [];
  }
}

// Crear nuevo alumno en la BD
export async function crearAlumnoAction(nombre) {
  try {
    if (!await verificarAdmin()) return;
    const nombreFormateado = nombre.trim();
    if (!nombreFormateado) return;
    const id = crearId('a_');
    await db.execute({
      sql: 'INSERT INTO alumnos (id, nombre, password) VALUES (?, ?, ?)',
      args: [id, nombreFormateado, await hashearPassword(nombreFormateado)]
    });
  } catch (error) {
    console.error('Error en crearAlumnoAction:', error);
  }
}

// Renombrar alumno
export async function editarAlumnoAction(nombreAntiguo, nuevoNombre) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede editar alumnos.' };
    const nuevoFormateado = nuevoNombre.trim();
    if (!nuevoFormateado) return { exito: false, mensaje: 'El nombre es obligatorio.' };
    const alumnoActual = await obtenerAlumno(nombreAntiguo);
    if (!alumnoActual) return { exito: false, mensaje: 'El alumno no existe.' };
    if (nuevoFormateado.toLowerCase() !== nombreAntiguo.toLowerCase()) {
      const existente = await db.execute({
        sql: 'SELECT 1 FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
        args: [nuevoFormateado]
      });
      if (existente.rows.length > 0) return { exito: false, mensaje: 'Ya existe un alumno con ese nombre.' };
    }

    await db.batch([
      { sql: 'UPDATE alumnos SET nombre = ? WHERE id = ?', args: [nuevoFormateado, alumnoActual.id] },
      { sql: 'UPDATE completadas SET alumno = ? WHERE alumno_id = ?', args: [nuevoFormateado, alumnoActual.id] },
      { sql: 'UPDATE notas_parciales SET alumno = ? WHERE alumno_id = ?', args: [nuevoFormateado, alumnoActual.id] },
      { sql: 'UPDATE notas_tareas SET alumno = ? WHERE alumno_id = ?', args: [nuevoFormateado, alumnoActual.id] },
      { sql: 'UPDATE progreso_materias SET alumno = ? WHERE alumno_id = ?', args: [nuevoFormateado, alumnoActual.id] }
    ], 'write');
    return { exito: true };
  } catch (error) {
    console.error('Error en editarAlumnoAction:', error);
    return { exito: false, mensaje: 'No se pudo editar el alumno.' };
  }
}

// Eliminar alumno de la BD
export async function eliminarAlumnoAction(nombre) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar alumnos.' };
    const alumnoActual = await obtenerAlumno(nombre);
    if (!alumnoActual) return { exito: false, mensaje: 'El alumno no existe.' };
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM notas_parciales WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM notas_tareas WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM progreso_materias WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM alumnos WHERE id = ?', args: [alumnoActual.id] }
    ], 'write');
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarAlumnoAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar el alumno.' };
  }
}

// --- MATERIAS Y TAREAS ---

function consultaPeriodo(periodoId, sqlConPeriodo, sqlSinPeriodo) {
  return periodoId
    ? { sql: sqlConPeriodo, args: [periodoId] }
    : { sql: sqlSinPeriodo, args: [] };
}

export async function obtenerDatos(periodoId = null) {
  try {
    if (!await obtenerUsuarioSesion()) return [];
    const [resMaterias, resTareas, resCompletadas, resNotasTareas] = await Promise.all([
      db.execute(consultaPeriodo(
        periodoId,
        `SELECT id, nombre, condiciones, nota_minima_regularizar, nota_minima_promocionar, regla_promocion
         FROM materias WHERE periodo_id = ? ORDER BY nombre ASC`,
        `SELECT id, nombre, condiciones, nota_minima_regularizar, nota_minima_promocionar, regla_promocion
         FROM materias ORDER BY nombre ASC`
      )),
      db.execute(consultaPeriodo(
        periodoId,
        `SELECT t.id, t.materia_id, t.nombre, t.inicio, t.fin, t.detalles, t.unidad, t.con_nota, t.tipo
         FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE m.periodo_id = ?`,
        `SELECT id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo FROM tareas`
      )),
      db.execute(consultaPeriodo(
        periodoId,
        `SELECT c.tarea_id, COALESCE(a.nombre, c.alumno) AS alumno, c.completada_en
         FROM completadas c
         JOIN tareas t ON t.id = c.tarea_id
         JOIN materias m ON m.id = t.materia_id
         LEFT JOIN alumnos a ON a.id = c.alumno_id
         WHERE m.periodo_id = ?`,
        `SELECT c.tarea_id, COALESCE(a.nombre, c.alumno) AS alumno, c.completada_en
         FROM completadas c LEFT JOIN alumnos a ON a.id = c.alumno_id`
      )),
      db.execute(consultaPeriodo(
        periodoId,
        `SELECT n.tarea_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota, n.cargada_en
         FROM notas_tareas n
         JOIN tareas t ON t.id = n.tarea_id
         JOIN materias m ON m.id = t.materia_id
         LEFT JOIN alumnos a ON a.id = n.alumno_id
         WHERE m.periodo_id = ?`,
        `SELECT n.tarea_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota, n.cargada_en
         FROM notas_tareas n LEFT JOIN alumnos a ON a.id = n.alumno_id`
      ))
    ]);

    const tareasPorMateria = new Map();
    resTareas.rows.forEach((tarea) => {
      const tareasMateria = tareasPorMateria.get(tarea.materia_id) || [];
      tareasMateria.push(tarea);
      tareasPorMateria.set(tarea.materia_id, tareasMateria);
    });

    const completadasPorTarea = new Map();
    resCompletadas.rows.forEach((completada) => {
      const completadasTarea = completadasPorTarea.get(completada.tarea_id) || [];
      completadasTarea.push(completada);
      completadasPorTarea.set(completada.tarea_id, completadasTarea);
    });

    const notasPorTarea = new Map();
    const fechasNotasPorTarea = new Map();
    resNotasTareas.rows.forEach((nota) => {
      const notasTarea = notasPorTarea.get(nota.tarea_id) || {};
      notasTarea[nota.alumno] = nota.nota;
      notasPorTarea.set(nota.tarea_id, notasTarea);

      const fechasNotasTarea = fechasNotasPorTarea.get(nota.tarea_id) || {};
      fechasNotasTarea[nota.alumno] = nota.cargada_en;
      fechasNotasPorTarea.set(nota.tarea_id, fechasNotasTarea);
    });

    const materias = resMaterias.rows.map((m) => {
      const tareasMateria = tareasPorMateria.get(m.id) || [];

      const tareasConCompletados = tareasMateria.map((t) => {
        const completadas = completadasPorTarea.get(t.id) || [];
        const notas = notasPorTarea.get(t.id) || {};
        const notaCargadaEn = fechasNotasPorTarea.get(t.id) || {};
        const completadoPor = completadas.map((c) => c.alumno);
        const completadoEn = Object.fromEntries(
          completadas.map((c) => [c.alumno, c.completada_en])
        );

        return {
          id: t.id,
          nombre: t.nombre,
          inicio: t.inicio,
          fin: t.fin,
          detalles: t.detalles,
          unidad: t.unidad || '',
          conNota: Number(t.con_nota) === 1,
          tipo: t.tipo || 'actividad',
          completadoPor,
          completadoEn,
          notas,
          notaCargadaEn
        };
      });

      return {
        id: m.id,
        nombre: m.nombre,
        condiciones: m.condiciones || '',
        notaMinimaRegularizar: Number(m.nota_minima_regularizar) || 4,
        notaMinimaPromocionar: Number(m.nota_minima_promocionar) || 8,
        reglaPromocion: m.regla_promocion || 'tp_nota',
        tareas: tareasConCompletados
      };
    });

    return materias;
  } catch (error) {
    console.error('Error al obtener datos de Turso:', error);
    return [];
  }
}

export async function obtenerProgresoPlanAction() {
  try {
    if (!await obtenerUsuarioSesion()) return [];
    const res = await db.execute('SELECT COALESCE(a.nombre, p.alumno) AS alumno, p.materia_codigo, p.estado, p.nota, p.actualizado_en FROM progreso_materias p LEFT JOIN alumnos a ON a.id = p.alumno_id ORDER BY alumno ASC, p.materia_codigo ASC');
    return res.rows;
  } catch (error) {
    console.error('Error al obtener progreso del plan:', error);
    return [];
  }
}

export async function guardarProgresoPlanAction({ alumno, materiaCodigo, estado, nota }) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const admin = await verificarAdmin();

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
    return { exito: true };
  } catch (error) {
    console.error('Error al guardar progreso del plan:', error);
    return { exito: false, mensaje: 'No se pudo guardar el progreso.' };
  }
}

export async function toggleTareaAction(tareaId, alumno) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const alumnoObjetivo = await verificarAdmin() ? alumno : usuarioSesion;
    const alumnoDB = await obtenerAlumno(alumnoObjetivo);
    if (!alumnoDB) return { exito: false, mensaje: 'El alumno no existe.' };
    const tarea = await db.execute({
      sql: 'SELECT inicio, fin FROM tareas WHERE id = ?',
      args: [tareaId]
    });
    if (tarea.rows.length === 0) return { exito: false, mensaje: 'La tarea no existe.' };
    if (!tareaHabilitada(tarea.rows[0].inicio)) {
      return { exito: false, mensaje: 'La tarea todavía no está habilitada.' };
    }
    const existe = await db.execute({
      sql: 'SELECT * FROM completadas WHERE tarea_id = ? AND alumno_id = ?',
      args: [tareaId, alumnoDB.id]
    });

    if (existe.rows.length > 0) {
      await db.execute({
        sql: 'DELETE FROM completadas WHERE tarea_id = ? AND alumno_id = ?',
        args: [tareaId, alumnoDB.id]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, datetime('now'))",
        args: [tareaId, alumnoDB.id, alumnoDB.nombre]
      });
    }
    return { exito: true };
  } catch (error) {
    console.error('Error en toggleTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo actualizar la tarea.' };
  }
}

export async function crearMateriaAction({ nombre, anio, cuatrimestre }) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede crear materias.' };
    const nombreFormateado = nombre?.trim();
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
    await db.execute({
      sql: 'INSERT INTO materias (id, nombre, periodo_id) VALUES (?, ?, ?)',
      args: [id, nombreFormateado.toUpperCase(), periodoId]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la materia.' };
  }
}

export async function renombrarMateriaAction(id, nuevoNombre) {
  try {
    if (!await verificarAdmin()) return;
    await db.execute({
      sql: 'UPDATE materias SET nombre = ? WHERE id = ?',
      args: [nuevoNombre.toUpperCase().trim(), id]
    });
  } catch (error) {
    console.error('Error en renombrarMateriaAction:', error);
  }
}

export async function editarCondicionesMateriaAction({ id, condiciones, notaMinimaRegularizar, notaMinimaPromocionar, reglaPromocion, usuario }) {
  try {
    const regularizar = Number(notaMinimaRegularizar);
    const promocionar = Number(notaMinimaPromocionar);
    const reglasValidas = ['tp_nota', 'tp_porcentaje_nota', 'auditorias_tps', 'ciberdelitos_parciales', 'riesgos_tps', 'activos_porcentaje'];
    const maximo = ['activos_porcentaje', 'tp_porcentaje_nota'].includes(reglaPromocion) ? 100 : 10;
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede editar condiciones.' };
    }
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
      args: [condiciones?.trim() || '', regularizar, promocionar, reglaPromocion, id]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error al editar condiciones de materia:', error);
    return { exito: false, mensaje: 'No se pudieron guardar las condiciones.' };
  }
}

export async function eliminarMateriaAction(id) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar materias.' };
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM notas_tareas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM tareas WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM notas_parciales WHERE parcial_id IN (SELECT id FROM parciales WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM parciales WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM horarios WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM materias WHERE id = ?', args: [id] }
    ], 'write');
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar la materia y sus datos relacionados.' };
  }
}

export async function crearTareaAction({ materiaId, nombre, inicio, fin, detalles, unidad, conNota, tipo }) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede crear tareas.' };
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };
    const unidadNormalizada = normalizarUnidad(unidad);
    if (!unidadNormalizada.valida) {
      return { exito: false, mensaje: 'La unidad debe ser un número entero mayor o igual a 1.' };
    }
    const conNotaNumerico = conNota ? 1 : 0;
    const tipoNormalizado = ['actividad', 'foro', 'trabajo_practico'].includes(tipo) ? tipo : 'actividad';

    const id = crearId('t_');
    await db.execute({
      sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, nombre, inicio || 'Sin fecha', fin || 'Sin fecha', detalles || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la tarea.' };
  }
}

export async function editarTareaAction({ id, nombre, inicio, fin, detalles, unidad, conNota, tipo }) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede editar tareas.' };
    const unidadNormalizada = normalizarUnidad(unidad);
    if (!unidadNormalizada.valida) {
      return { exito: false, mensaje: 'La unidad debe ser un número entero mayor o igual a 1.' };
    }
    const conNotaNumerico = conNota ? 1 : 0;
    const tipoNormalizado = ['actividad', 'foro', 'trabajo_practico'].includes(tipo) ? tipo : 'actividad';

    await db.execute({
      sql: 'UPDATE tareas SET nombre = ?, inicio = ?, fin = ?, detalles = ?, unidad = ?, con_nota = ?, tipo = ? WHERE id = ?',
      args: [nombre, inicio, fin, detalles, unidadNormalizada.valor, conNotaNumerico, tipoNormalizado, id]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en editarTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo editar la tarea.' };
  }
}

export async function eliminarTareaAction(id) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar tareas.' };
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM notas_tareas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM tareas WHERE id = ?', args: [id] }
    ], 'write');
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar la tarea.' };
  }
}

// --- HORARIOS DE CURSADA ---

export async function obtenerHorariosAction(periodoId = null) {
  try {
    if (!await obtenerUsuarioSesion()) return [];
    const res = await db.execute(consultaPeriodo(
      periodoId,
      `SELECT h.id, h.materia_id, h.dia, h.hora_inicio, h.hora_fin, h.aula
       FROM horarios h JOIN materias m ON m.id = h.materia_id
       WHERE CAST(h.dia AS INTEGER) BETWEEN 1 AND 5 AND m.periodo_id = ?
       ORDER BY h.dia ASC, h.hora_inicio ASC`,
      `SELECT h.id, h.materia_id, h.dia, h.hora_inicio, h.hora_fin, h.aula
       FROM horarios h
       WHERE CAST(h.dia AS INTEGER) BETWEEN 1 AND 5
       ORDER BY h.dia ASC, h.hora_inicio ASC`
    ));
    return res.rows;
  } catch (error) {
    console.error('Error al obtener horarios:', error);
    return [];
  }
}

export async function crearHorarioAction({ materiaId, dia, horaInicio, horaFin, aula, usuario }) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede crear horarios.' };
    }
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };

    const diaNumerico = Number(dia);
    if (!Number.isInteger(diaNumerico) || diaNumerico < 1 || diaNumerico > 5) {
      return { exito: false, mensaje: 'Los horarios solo pueden cargarse de lunes a viernes.' };
    }

    const id = crearId('horario_');
    await db.execute({
      sql: 'INSERT INTO horarios (id, materia_id, dia, hora_inicio, hora_fin, aula) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, diaNumerico, horaInicio, horaFin, aula?.trim() || '']
    });
    return { exito: true };
  } catch (error) {
    console.error('Error al crear horario:', error);
    return { exito: false, mensaje: 'No se pudo crear el horario.' };
  }
}

export async function eliminarHorarioAction(id, usuario) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede borrar horarios.' };
    }

    await db.execute({ sql: 'DELETE FROM horarios WHERE id = ?', args: [id] });
    return { exito: true };
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    return { exito: false, mensaje: 'No se pudo borrar el horario.' };
  }
}

// --- PARCIALES Y NOTAS ---

export async function obtenerParcialesAction(periodoId = null) {
  try {
    if (!await obtenerUsuarioSesion()) return { parciales: [], notas: [] };
    const [resParciales, resNotas] = await Promise.all([
      db.execute(consultaPeriodo(
        periodoId,
        `SELECT p.id, p.materia_id, p.nombre, p.fecha, p.detalles
         FROM parciales p JOIN materias m ON m.id = p.materia_id
         WHERE m.periodo_id = ? ORDER BY p.fecha ASC`,
        `SELECT id, materia_id, nombre, fecha, detalles FROM parciales ORDER BY fecha ASC`
      )),
      db.execute(consultaPeriodo(
        periodoId,
        `SELECT n.id, n.parcial_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota
         FROM notas_parciales n
         JOIN parciales p ON p.id = n.parcial_id
         JOIN materias m ON m.id = p.materia_id
         LEFT JOIN alumnos a ON a.id = n.alumno_id
         WHERE m.periodo_id = ?`,
        `SELECT n.id, n.parcial_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota
         FROM notas_parciales n LEFT JOIN alumnos a ON a.id = n.alumno_id`
      ))
    ]);

    return {
      parciales: resParciales.rows,
      notas: resNotas.rows
    };
  } catch (error) {
    console.error('Error al obtener parciales:', error);
    return { parciales: [], notas: [] };
  }
}

export async function crearParcialAction({ materiaId, nombre, fecha, detalles, usuario }) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede crear parciales.' };
    }
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };

    const id = crearId('parcial_');
    await db.execute({
      sql: 'INSERT INTO parciales (id, materia_id, nombre, fecha, detalles) VALUES (?, ?, ?, ?, ?)',
      args: [id, materiaId, nombre, fecha || 'Sin fecha', detalles || 'Sin observaciones']
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo crear el parcial.' };
  }
}

export async function editarParcialAction({ id, materiaId, nombre, fecha, detalles, usuario }) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede editar parciales.' };
    }
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };

    await db.execute({
      sql: 'UPDATE parciales SET materia_id = ?, nombre = ?, fecha = ?, detalles = ? WHERE id = ?',
      args: [materiaId, nombre, fecha || 'Sin fecha', detalles || 'Sin observaciones', id]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en editarParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo editar el parcial.' };
  }
}

export async function eliminarParcialAction(id, usuario) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede borrar parciales.' };
    }

    await db.batch([
      { sql: 'DELETE FROM notas_parciales WHERE parcial_id = ?', args: [id] },
      { sql: 'DELETE FROM parciales WHERE id = ?', args: [id] }
    ], 'write');
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo borrar el parcial.' };
  }
}

export async function guardarNotaParcialAction(parcialId, alumno, nota, usuario) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede cargar o editar notas.' };
    }

    const parcial = await db.execute({
      sql: 'SELECT fecha FROM parciales WHERE id = ?',
      args: [parcialId]
    });

    if (parcial.rows.length === 0) {
      return { exito: false, mensaje: 'El parcial no existe.' };
    }

    if (!parcialHabilitado(parcial.rows[0].fecha)) {
      return { exito: false, mensaje: 'La nota se puede cargar a partir de la fecha del parcial.' };
    }
    const alumnoDB = await obtenerAlumno(alumno);
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
      } else {
        // Actualizamos la nota
        await db.execute({
          sql: 'UPDATE notas_parciales SET nota = ? WHERE parcial_id = ? AND alumno_id = ?',
          args: [validacion.valor, parcialId, alumnoDB.id]
        });
      }
    } else if (notaLimpia !== '') {
      // Insertamos nueva nota
      const id = crearId('nota_');
      await db.execute({
        sql: 'INSERT INTO notas_parciales (id, parcial_id, alumno_id, alumno, nota) VALUES (?, ?, ?, ?, ?)',
        args: [id, parcialId, alumnoDB.id, alumnoDB.nombre, notaLimpia]
      });
    }
    return { exito: true };
  } catch (error) {
    console.error('Error en guardarNotaParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo guardar la nota.' };
  }
}

export async function guardarNotaTareaAction(tareaId, alumno, nota, usuario) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    const admin = await verificarAdmin();
    if (!alumno || !usuarioSesion || (alumno !== usuarioSesion && !admin)) {
      return { exito: false, mensaje: 'Solo podés cargar tu propia nota.' };
    }
    const alumnoDB = await obtenerAlumno(alumno);
    if (!alumnoDB) return { exito: false, mensaje: 'El alumno no existe.' };

    const tarea = await db.execute({
      sql: 'SELECT con_nota, inicio, fin FROM tareas WHERE id = ?',
      args: [tareaId]
    });
    if (tarea.rows.length === 0 || Number(tarea.rows[0].con_nota) !== 1) {
      return { exito: false, mensaje: 'La tarea no está configurada para llevar nota.' };
    }
    if (!tareaHabilitada(tarea.rows[0].inicio)) {
      return { exito: false, mensaje: 'La tarea todavía no está habilitada para cargar notas.' };
    }
    const validacion = validarNota(nota);
    if (!validacion.vacia && !validacion.valida) {
      return { exito: false, mensaje: 'La nota debe ser un número entre 1 y 10.' };
    }

    if (validacion.vacia) {
      await db.execute({
        sql: 'DELETE FROM notas_tareas WHERE tarea_id = ? AND alumno_id = ?',
        args: [tareaId, alumnoDB.id]
      });
    } else {
      const cargadaEn = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, nota = excluded.nota, cargada_en = excluded.cargada_en',
        args: [crearId('nota_tarea_'), tareaId, alumnoDB.id, alumnoDB.nombre, validacion.valor, cargadaEn]
      });
    }

    return { exito: true };
  } catch (error) {
    console.error('Error en guardarNotaTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo guardar la nota de la tarea.' };
  }
}
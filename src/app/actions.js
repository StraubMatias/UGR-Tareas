'use server';

import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import { db } from './turso';
import { PLAN_DE_ESTUDIO } from './plan-utils';
import { normalizarUnidad, parcialHabilitado, tareaHabilitada, validarNota } from './validators';
import { actualizarUrlsParciales, actualizarUrlsTareas, conectarUGR, detectarTareasNuevas, insertarTareasDetectadas } from '../../ugr-sync/lib/sync-core.mjs';

const COOKIE_SESION = 'ugr_sesion';
const DURACION_SESION_SEGUNDOS = 30 * 60;
const scryptAsync = promisify(scrypt);

const MENSAJE_LOGIN_INVALIDO = 'Usuario o contraseña incorrectos.';
const MENSAJE_LOGIN_BLOQUEADO = 'Demasiados intentos. Probá de nuevo en unos minutos.';
const LIMITE_LOGIN_USUARIO = 5;
const LIMITE_LOGIN_IP = 20;
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const BLOQUEO_LOGIN_MS = 15 * 60 * 1000;
const CODIGOS_PLAN = new Set(PLAN_DE_ESTUDIO.map((materia) => materia.codigo));
const LIMITE_ACCIONES_ESCRITURA = 30;
const VENTANA_ACCIONES_MS = 60 * 1000;
const BLOQUEO_ACCIONES_MS = 5 * 60 * 1000;
const MAX_NOMBRE_LENGTH = 100;
const MAX_DETALLES_LENGTH = 500;
const MAX_CONDICIONES_LENGTH = 1000;
const MAX_AULA_LENGTH = 50;
const MAX_TITULO_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 128;
const MAX_USUARIO_LENGTH = 100;

function obtenerSecretoSesion() {
  const secreto = process.env.SESSION_SECRET?.trim();
  if (!secreto) throw new Error('Falta SESSION_SECRET en el entorno.');
  return secreto;
}

function crearId(prefijo) {
  return `${prefijo}${randomUUID()}`;
}

function esIPPrivada(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('169.254.')) return true;
  return false;
}

async function obtenerIPReal() {
  const encabezados = await headers();
  const xff = encabezados.get('x-forwarded-for')?.split(',')?.map((ip) => ip.trim()) || [];
  const xRealIp = encabezados.get('x-real-ip')?.trim();
  const cfConnectingIp = encabezados.get('cf-connecting-ip')?.trim();

  // Cloudflare: confiar en cf-connecting-ip si está presente
  if (cfConnectingIp && !esIPPrivada(cfConnectingIp)) return cfConnectingIp;

  // x-forwarded-for: tomar la primera IP que no sea privada (la del cliente real)
  for (const ip of xff) {
    if (ip && !esIPPrivada(ip)) return ip;
  }

  // x-real-ip: solo confiar si no es privada
  if (xRealIp && !esIPPrivada(xRealIp)) return xRealIp;

  // Fallback: primera IP de x-forwarded-for o unknown
  return xff[0] || xRealIp || 'unknown';
}

async function obtenerClavesLogin(usuario) {
  const ip = await obtenerIPReal();
  const claves = [{ clave: `ip:${ip}`, limite: LIMITE_LOGIN_IP }];
  if (usuario) claves.push({ clave: `user:${usuario.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO });
  return claves;
}

async function accionEscrituraEstaBloqueada(usuario) {
  const ip = await obtenerIPReal();
  const ahora = Date.now();
  const claves = [`accion:ip:${ip}`, `accion:user:${usuario.toLowerCase()}`];
  for (const clave of claves) {
    const res = await db.execute({
      sql: 'SELECT bloqueado_hasta FROM login_intentos WHERE clave = ?',
      args: [clave]
    });
    if (Number(res.rows[0]?.bloqueado_hasta || 0) > ahora) return true;
  }
  return false;
}

async function registrarAccionEscritura(usuario) {
  const ip = await obtenerIPReal();
  const ahora = Date.now();
  const claves = [
    { clave: `accion:ip:${ip}`, limite: LIMITE_ACCIONES_ESCRITURA },
    { clave: `accion:user:${usuario.toLowerCase()}`, limite: LIMITE_ACCIONES_ESCRITURA }
  ];
  for (const { clave, limite } of claves) {
    const res = await db.execute({
      sql: 'SELECT fallos, ventana_inicio FROM login_intentos WHERE clave = ?',
      args: [clave]
    });
    const fila = res.rows[0];
    const mismaVentana = fila && ahora - Number(fila.ventana_inicio) < VENTANA_ACCIONES_MS;
    const fallos = mismaVentana ? Number(fila.fallos) + 1 : 1;
    const ventanaInicio = mismaVentana ? Number(fila.ventana_inicio) : ahora;
    const bloqueadoHasta = fallos >= limite ? ahora + BLOQUEO_ACCIONES_MS : null;

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

async function verificarRateLimitEscritura(usuario) {
  if (await accionEscrituraEstaBloqueada(usuario)) {
    return { exito: false, mensaje: 'Demasiadas acciones. Probá de nuevo en unos minutos.' };
  }
  await registrarAccionEscritura(usuario);
  return { exito: true };
}

function validarFecha(fecha) {
  if (!fecha || fecha === 'Sin fecha') return { valida: true, valor: 'Sin fecha' };
  const fechaLimpia = String(fecha).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) return { valida: false, valor: null };
  const [anio, mes, dia] = fechaLimpia.split('-').map(Number);
  const fechaObj = new Date(anio, mes - 1, dia);
  if (fechaObj.getFullYear() !== anio || fechaObj.getMonth() !== mes - 1 || fechaObj.getDate() !== dia) {
    return { valida: false, valor: null };
  }
  return { valida: true, valor: fechaLimpia };
}

function validarLongitud(texto, maximo, campo) {
  const limpio = String(texto || '').trim();
  if (limpio.length > maximo) {
    return { valida: false, mensaje: `El campo ${campo} no puede superar los ${maximo} caracteres.` };
  }
  return { valida: true, valor: limpio };
}

async function registrarAuditoria({ accion, usuario, detalle, ip }) {
  try {
    await db.execute({
      sql: "INSERT INTO auditoria (id, accion, usuario, detalle, ip, creada_en) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      args: [crearId('aud_'), accion, usuario || 'anónimo', detalle || '', ip || 'unknown']
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
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

// --- AUTENTICACIÓN Y ALUMNOS ---

// Valida credenciales consultando directamente a la tabla alumnos en Turso
export async function validarLoginAction(usuarioInput, passwordInput) {
  try {
    const userClean = String(usuarioInput || '').trim();
    const passClean = String(passwordInput || '').trim();

    if (!userClean || !passClean) {
      return { exito: false, mensaje: MENSAJE_LOGIN_INVALIDO };
    }
    if (userClean.length > MAX_USUARIO_LENGTH || passClean.length > MAX_PASSWORD_LENGTH) {
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
    await registrarAuditoria({ accion: 'login', usuario: usuarioDB.nombre, detalle: 'Inicio de sesión exitoso', ip: await obtenerIPReal() });
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
    if (passNuevaClean.length > MAX_PASSWORD_LENGTH) {
      return { exito: false, mensaje: `La contraseña no puede superar los ${MAX_PASSWORD_LENGTH} caracteres.` };
    }

    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion || usuarioSesion.toLowerCase() !== userClean.toLowerCase()) {
      return { exito: false, mensaje: 'La sesión no es válida. Volvé a iniciar sesión.' };
    }

    // 1. Verificamos la contraseña actual directamente (sin efectos secundarios de login)
    const res = await db.execute({
      sql: 'SELECT password FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [userClean]
    });
    if (res.rows.length === 0) {
      return { exito: false, mensaje: 'La contraseña actual es incorrecta.' };
    }
    const credencialesValidas = await verificarPassword(passActualClean, res.rows[0].password);
    if (!credencialesValidas) {
      return { exito: false, mensaje: 'La contraseña actual es incorrecta.' };
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
    await registrarAuditoria({ accion: 'cambiar_password', usuario: userClean, detalle: 'Cambio de contraseña', ip: await obtenerIPReal() });

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
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede crear alumnos.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre');
    if (!validacionNombre.valida) return validacionNombre;
    const nombreFormateado = validacionNombre.valor;
    if (!nombreFormateado) return { exito: false, mensaje: 'El nombre es obligatorio.' };
    const existente = await db.execute({
      sql: 'SELECT 1 FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [nombreFormateado]
    });
    if (existente.rows.length > 0) return { exito: false, mensaje: 'Ya existe un alumno con ese nombre.' };
    const id = crearId('a_');
    await db.execute({
      sql: 'INSERT INTO alumnos (id, nombre, password) VALUES (?, ?, ?)',
      args: [id, nombreFormateado, await hashearPassword(nombreFormateado)]
    });
    await registrarAuditoria({ accion: 'crear_alumno', usuario: usuarioSesion, detalle: `Creó al alumno ${nombreFormateado}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearAlumnoAction:', error);
    return { exito: false, mensaje: 'No se pudo crear el alumno.' };
  }
}

// Renombrar alumno
export async function editarAlumnoAction(nombreAntiguo, nuevoNombre) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede editar alumnos.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nuevoNombre, MAX_NOMBRE_LENGTH, 'nombre');
    if (!validacionNombre.valida) return validacionNombre;
    const nuevoFormateado = validacionNombre.valor;
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
    await registrarAuditoria({ accion: 'editar_alumno', usuario: usuarioSesion, detalle: `Renombró ${nombreAntiguo} a ${nuevoFormateado}`, ip: await obtenerIPReal() });
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
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const alumnoActual = await obtenerAlumno(nombre);
    if (!alumnoActual) return { exito: false, mensaje: 'El alumno no existe.' };
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM notas_parciales WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM notas_tareas WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM progreso_materias WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM alumnos WHERE id = ?', args: [alumnoActual.id] }
    ], 'write');
    await registrarAuditoria({ accion: 'eliminar_alumno', usuario: usuarioSesion, detalle: `Eliminó al alumno ${alumnoActual.nombre}`, ip: await obtenerIPReal() });
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
        `SELECT t.id, t.materia_id, t.nombre, t.inicio, t.fin, t.detalles, t.unidad, t.con_nota, t.tipo, t.url
         FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE m.periodo_id = ?`,
        `SELECT id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo, url FROM tareas`
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
          url: t.url || '',
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

// Trae todo el estado del dashboard en una sola llamada (materias, alumnos, parciales,
// horarios, cronograma y progreso), evitando 7 roundtrips por cada carga/refresco.
export async function obtenerEstadoCompleto(periodoIdSolicitado = null) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return null;

    const periodos = await obtenerPeriodosAction();
    const periodoParaCargar = periodoIdSolicitado
      || periodos.find((periodo) => Number(periodo.activo) === 1)?.id
      || periodos[0]?.id
      || null;

    const [materias, alumnos, datosParciales, horarios, cronograma, progresoPlan] = await Promise.all([
      obtenerDatos(periodoParaCargar),
      obtenerAlumnosAction(),
      obtenerParcialesAction(periodoParaCargar),
      obtenerHorariosAction(periodoParaCargar),
      obtenerCronogramaAction(periodoParaCargar),
      obtenerProgresoPlanAction()
    ]);

    return {
      usuario: usuarioSesion,
      rol: await obtenerRolUsuario(usuarioSesion),
      periodos,
      periodoActivo: periodoParaCargar,
      materias,
      alumnos,
      parciales: datosParciales?.parciales || [],
      notas: datosParciales?.notas || [],
      horarios,
      cronograma,
      progresoPlan
    };
  } catch (error) {
    console.error('Error en obtenerEstadoCompleto:', error);
    return null;
  }
}

export async function guardarProgresoPlanAction({ alumno, materiaCodigo, estado, nota }) {
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

export async function toggleTareaAction(tareaId, alumno) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
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
      await registrarAuditoria({ accion: 'desmarcar_tarea', usuario: usuarioSesion, detalle: `Desmarcó la tarea ${tareaId} de ${alumnoDB.nombre}`, ip: await obtenerIPReal() });
    } else {
      await db.execute({
        sql: "INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, datetime('now'))",
        args: [tareaId, alumnoDB.id, alumnoDB.nombre]
      });
      await registrarAuditoria({ accion: 'marcar_tarea', usuario: usuarioSesion, detalle: `Marcó la tarea ${tareaId} de ${alumnoDB.nombre}`, ip: await obtenerIPReal() });
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
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre de la materia');
    if (!validacionNombre.valida) return validacionNombre;
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
    await db.execute({
      sql: 'INSERT INTO materias (id, nombre, periodo_id) VALUES (?, ?, ?)',
      args: [id, nombreFormateado.toUpperCase(), periodoId]
    });
    await registrarAuditoria({ accion: 'crear_materia', usuario: usuarioSesion, detalle: `Creó la materia ${nombreFormateado}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la materia.' };
  }
}

export async function renombrarMateriaAction(id, nuevoNombre) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede renombrar materias.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nuevoNombre, MAX_NOMBRE_LENGTH, 'nombre de la materia');
    if (!validacionNombre.valida) return validacionNombre;
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

export async function editarCondicionesMateriaAction({ id, condiciones, notaMinimaRegularizar, notaMinimaPromocionar, reglaPromocion, usuario }) {
  try {
    const regularizar = Number(notaMinimaRegularizar);
    const promocionar = Number(notaMinimaPromocionar);
    const reglasValidas = ['tp_nota', 'tp_porcentaje_nota', 'auditorias_tps', 'ciberdelitos_parciales', 'riesgos_tps', 'activos_porcentaje'];
    const maximo = ['activos_porcentaje', 'tp_porcentaje_nota'].includes(reglaPromocion) ? 100 : 10;
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede editar condiciones.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionCondiciones = validarLongitud(condiciones, MAX_CONDICIONES_LENGTH, 'condiciones');
    if (!validacionCondiciones.valida) return validacionCondiciones;
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

export async function eliminarMateriaAction(id) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar materias.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM notas_tareas WHERE tarea_id IN (SELECT id FROM tareas WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM tareas WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM notas_parciales WHERE parcial_id IN (SELECT id FROM parciales WHERE materia_id = ?)', args: [id] },
      { sql: 'DELETE FROM parciales WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM horarios WHERE materia_id = ?', args: [id] },
      { sql: 'DELETE FROM materias WHERE id = ?', args: [id] }
    ], 'write');
    await registrarAuditoria({ accion: 'eliminar_materia', usuario: usuarioSesion, detalle: `Eliminó la materia ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar la materia y sus datos relacionados.' };
  }
}

export async function crearTareaAction({ materiaId, nombre, inicio, fin, detalles, unidad, conNota, tipo }) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede crear tareas.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre de la tarea');
    if (!validacionNombre.valida) return validacionNombre;
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre de la tarea es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return validacionDetalles;
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

    const id = crearId('t_');
    await db.execute({
      sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, validacionNombre.valor, validacionInicio.valor, validacionFin.valor, validacionDetalles.valor || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado]
    });
    await registrarAuditoria({ accion: 'crear_tarea', usuario: usuarioSesion, detalle: `Creó la tarea ${validacionNombre.valor}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la tarea.' };
  }
}

export async function editarTareaAction({ id, nombre, inicio, fin, detalles, unidad, conNota, tipo }) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede editar tareas.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre de la tarea');
    if (!validacionNombre.valida) return validacionNombre;
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre de la tarea es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return validacionDetalles;
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

    await db.execute({
      sql: 'UPDATE tareas SET nombre = ?, inicio = ?, fin = ?, detalles = ?, unidad = ?, con_nota = ?, tipo = ? WHERE id = ?',
      args: [validacionNombre.valor, validacionInicio.valor, validacionFin.valor, validacionDetalles.valor || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado, id]
    });
    await registrarAuditoria({ accion: 'editar_tarea', usuario: usuarioSesion, detalle: `Editó la tarea ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en editarTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo editar la tarea.' };
  }
}

export async function eliminarTareaAction(id) {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar tareas.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    await db.batch([
      { sql: 'DELETE FROM completadas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM notas_tareas WHERE tarea_id = ?', args: [id] },
      { sql: 'DELETE FROM tareas WHERE id = ?', args: [id] }
    ], 'write');
    await registrarAuditoria({ accion: 'eliminar_tarea', usuario: usuarioSesion, detalle: `Eliminó la tarea ${id}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar la tarea.' };
  }
}

// Sincroniza tareas nuevas desde UGR Virtual. Con `confirmar: false` solo
// detecta (vista previa); con `confirmar: true` inserta únicamente las tareas
// cuyo `idMoodle` esté en `ids` (el admin las tilda una por una en el modal).
export async function syncUgrAction({ confirmar = false, ids = [] } = {}) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede sincronizar con UGR.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const cliente = await conectarUGR();
    const { materiasLocales, cursos, mapeos, detectadas, urlsActualizar, urlsParcialesActualizar } = await detectarTareasNuevas({ db, cliente });

    // Backfill de enlaces: completamos los URLs que faltan en tareas que ya
    // estaban importadas. No agrega nada nuevo, solo deja listo el botón de
    // «Ver en UGR» para las tareas existentes. Lo mismo para los parciales
    // cargados desde el cronograma, que nacen sin enlace a UGR.
    const urlsActualizadas = await actualizarUrlsTareas({ db, urlsActualizar });
    const urlsParcialesActualizadas = await actualizarUrlsParciales({ db, urlsParcialesActualizar });

    let insertadas = 0;
    if (confirmar && detectadas.length > 0) {
      // Nunca insertamos algo que no esté en la detección recién realizada:
      // el front solo puede indicar cuáles de estas quiere cargar.
      const pedidas = new Set(Array.isArray(ids) ? ids : []);
      const seleccionadas = detectadas.filter((t) => pedidas.has(t.idMoodle));
      if (seleccionadas.length > 0) {
        insertadas = await insertarTareasDetectadas({ db, detectadas: seleccionadas });
      }
      await registrarAuditoria({
        accion: 'sync_ugr',
        usuario: usuarioSesion,
        detalle: `Sincronizó UGR: insertó ${insertadas} tarea(s) en ${mapeos.length} materia(s); actualizó ${urlsActualizadas} enlace(s) de tareas y ${urlsParcialesActualizadas} de parciales`,
        ip: await obtenerIPReal()
      });
    }

    return {
      exito: true,
      confirmar,
      materiasLocales: materiasLocales?.length || 0,
      cursos: cursos?.length || 0,
      mapeos: (mapeos || []).map(({ curso, coincidencia }) => ({
        id: curso?.id,
        curso: curso?.nombre,
        materia: coincidencia?.materia?.nombre
      })),
      detectadas,
      insertadas,
      urlsActualizadas,
      urlsParcialesActualizadas
    };
  } catch (error) {
    console.error('Error en syncUgrAction:', error);
    return { exito: false, mensaje: error?.message || 'No se pudo sincronizar con UGR Virtual.' };
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

export async function obtenerCronogramaAction(periodoId = null) {
  try {
    if (!await obtenerUsuarioSesion()) return [];
    const res = await db.execute(consultaPeriodo(
      periodoId,
      `SELECT c.id, c.materia_id, c.fecha, c.modalidad, c.tipo, c.titulo, c.detalles
       FROM cronograma_eventos c JOIN materias m ON m.id = c.materia_id
       WHERE m.periodo_id = ? ORDER BY c.fecha ASC, c.titulo ASC`,
      `SELECT id, materia_id, fecha, modalidad, tipo, titulo, detalles
       FROM cronograma_eventos ORDER BY fecha ASC, titulo ASC`
    ));
    return res.rows;
  } catch (error) {
    console.error('Error al obtener cronograma:', error);
    return [];
  }
}

export async function crearHorarioAction({ materiaId, dia, horaInicio, horaFin, aula, usuario }) {
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
    if (!validacionAula.valida) return validacionAula;

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

export async function eliminarHorarioAction(id, usuario) {
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

// --- PARCIALES Y NOTAS ---

export async function obtenerParcialesAction(periodoId = null) {
  try {
    if (!await obtenerUsuarioSesion()) return { parciales: [], notas: [] };
    const [resParciales, resNotas] = await Promise.all([
      db.execute(consultaPeriodo(
        periodoId,
        `SELECT p.id, p.materia_id, p.nombre, p.fecha, p.detalles, p.url
         FROM parciales p JOIN materias m ON m.id = p.materia_id
         WHERE m.periodo_id = ? ORDER BY p.fecha ASC`,
        `SELECT id, materia_id, nombre, fecha, detalles, url FROM parciales ORDER BY fecha ASC`
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
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre del parcial');
    if (!validacionNombre.valida) return validacionNombre;
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre del parcial es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return validacionDetalles;
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

export async function editarParcialAction({ id, materiaId, nombre, fecha, detalles, usuario }) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede editar parciales.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    if (!await existeMateria(materiaId)) return { exito: false, mensaje: 'La materia seleccionada no existe.' };
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre del parcial');
    if (!validacionNombre.valida) return validacionNombre;
    if (!validacionNombre.valor) return { exito: false, mensaje: 'El nombre del parcial es obligatorio.' };
    const validacionDetalles = validarLongitud(detalles, MAX_DETALLES_LENGTH, 'detalles');
    if (!validacionDetalles.valida) return validacionDetalles;
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

export async function eliminarParcialAction(id, usuario) {
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

export async function guardarNotaParcialAction(parcialId, alumno, nota, usuario) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) {
      return { exito: false, mensaje: 'Debés iniciar sesión para cargar notas.' };
    }
    const alumnoSolicitado = String(alumno || '').trim();
    const esAdmin = await verificarAdmin();
    if (!esAdmin && alumnoSolicitado.toLowerCase() !== usuarioSesion.toLowerCase()) {
      return { exito: false, mensaje: 'Solo podés cargar o editar tu propia nota.' };
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

export async function guardarNotaTareaAction(tareaId, alumno, nota, usuario) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) {
      return { exito: false, mensaje: 'Debés iniciar sesión para cargar notas.' };
    }
    const alumnoSolicitado = String(alumno || '').trim();
    const esAdmin = await verificarAdmin();
    if (!esAdmin && alumnoSolicitado.toLowerCase() !== usuarioSesion.toLowerCase()) {
      return { exito: false, mensaje: 'Solo podés cargar o editar tu propia nota.' };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
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
      await registrarAuditoria({ accion: 'eliminar_nota_tarea', usuario: usuarioSesion, detalle: `Eliminó la nota de ${alumnoDB.nombre} en la tarea ${tareaId}`, ip: await obtenerIPReal() });
    } else {
      const cargadaEn = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id, nota = excluded.nota, cargada_en = excluded.cargada_en',
        args: [crearId('nota_tarea_'), tareaId, alumnoDB.id, alumnoDB.nombre, validacion.valor, cargadaEn]
      });
      await registrarAuditoria({ accion: 'guardar_nota_tarea', usuario: usuarioSesion, detalle: `Cargó nota ${validacion.valor} a ${alumnoDB.nombre} en la tarea ${tareaId}`, ip: await obtenerIPReal() });
    }

    return { exito: true };
  } catch (error) {
    console.error('Error en guardarNotaTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo guardar la nota de la tarea.' };
  }
}
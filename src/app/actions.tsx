'use server';

import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import type { Row, Value } from '@libsql/client';
import { db } from './turso';
import { asignarGrupo, actualizarProgresoTarea, ErrorGrupo } from '../lib/grupos-tareas';
import { PLAN_DE_ESTUDIO } from './plan-utils';
import { convertirValidacion } from '../lib/utils';
import { normalizarUnidad, parcialHabilitado, tareaHabilitada, validarNota } from './validators';
import { alumnosConLaMismaCursada } from '../lib/companeros';
// La sincronización con el campus arrastra cheerio. Se importa solo cuando
// un admin sincroniza, para que el refresco del tablero no cargue ese módulo.

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

function texto(valor: Value | undefined): string {
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor);
  return '';
}

function textoONull(valor: Value | undefined): string | null {
  if (valor == null) return null;
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor);
  return null;
}

interface LoginParams {
  usuario: string;
  password: string;
}

interface AuditoriaParams {
  accion: string;
  usuario: string | null;
  detalle: string;
  ip: string;
}

interface SesionDatos {
  usuario: string;
  versionSesion: number;
}

export interface ResumenMateriaSync {
  materia: string;
  nuevas: string[];
  yaEstaban: string[];
  cronogramaNuevo?: string[];
  cronogramaYa?: string[];
  materiaNueva?: boolean;
}

export interface RespuestaAction {
  exito: boolean;
  mensaje?: string;
  usuario?: string;
  rol?: string;
  origen?: string;
  ugrUsuario?: string | null;
  resumen?: ResumenMateriaSync[];
}

export interface TareaActionParams {
  id?: string;
  materiaId: string;
  nombre: string;
  inicio: string | null;
  fin: string | null;
  detalles: string;
  unidad: string | number;
  conNota: boolean;
  tipo: string;
  grupal?: boolean;
  cupoMaximo?: number;
}




function obtenerSecretoSesion() {
  const secreto = process.env.SESSION_SECRET?.trim();
  if (!secreto) throw new Error('Falta SESSION_SECRET en el entorno.');
  return secreto;
}

function crearId(prefijo: string): string {
  return `${prefijo}${randomUUID()}`;
}

function esIPPrivada(ip: string | undefined | null): boolean {
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

async function obtenerClavesLogin(usuario: string): Promise<{ clave: string; limite: number }[]> {
  const ip = await obtenerIPReal();
  const claves = [{ clave: `ip:${ip}`, limite: LIMITE_LOGIN_IP }];
  if (usuario) claves.push({ clave: `user:${usuario.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO });
  return claves;
}

async function accionEscrituraEstaBloqueada(usuario: string): Promise<boolean> {
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

async function registrarAccionEscritura(usuario: string): Promise<void> {
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

async function leerCuenta(usuario: string) {
  const resultado = await db.execute({
    sql: `SELECT id, nombre, rol, COALESCE(origen, 'comision') AS origen, ugr_usuario
          FROM alumnos WHERE LOWER(nombre) = LOWER(?)`,
    args: [usuario]
  });
  return resultado.rows[0] || null;
}

async function verificarRateLimitEscritura(usuario: string | null): Promise<RespuestaAction> {
  if (!usuario) return { exito: false, mensaje: 'La sesión no es válida.' };
  if (await accionEscrituraEstaBloqueada(usuario)) {
    return { exito: false, mensaje: 'Demasiadas acciones. Probá de nuevo en unos minutos.' };
  }
  await registrarAccionEscritura(usuario);
  return { exito: true };
}

function validarFecha(fecha: string | null | undefined): { valida: true; valor: string } | { valida: false; valor: null } {
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

function validarLongitud(textoIngresado: string | null | undefined, maximo: number, campo: string): { valida: true; valor: string } | { valida: false; mensaje: string } {
  const limpio = String(textoIngresado || '').trim();
  if (limpio.length > maximo) {
    return { valida: false, mensaje: `El campo ${campo} no puede superar los ${maximo} caracteres.` };
  }
  return { valida: true, valor: limpio };
}

async function registrarAuditoria({ accion, usuario, detalle, ip }: AuditoriaParams): Promise<void> {
  try {
    await db.execute({
      sql: "INSERT INTO auditoria (id, accion, usuario, detalle, ip, creada_en) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      args: [crearId('aud_'), accion, usuario || 'anónimo', detalle || '', ip || 'unknown']
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
}

async function loginEstaBloqueado(claves: { clave: string; limite: number }[]): Promise<boolean> {
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

async function registrarFalloLogin(claves: { clave: string; limite: number }[]): Promise<void> {
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

async function limpiarIntentosLogin(claves: { clave: string; limite: number }[]): Promise<void> {
  for (const { clave } of claves) {
    await db.execute({
      sql: 'DELETE FROM login_intentos WHERE clave = ?',
      args: [clave]
    });
  }
}

function firmarSesion(payload: string): string {
  return createHmac('sha256', obtenerSecretoSesion()).update(payload).digest('base64url');
}

function crearValorSesion(usuario: string, versionSesion: number): string {
  const payload = Buffer.from(JSON.stringify({
    usuario,
    versionSesion,
    expira: Date.now() + DURACION_SESION_SEGUNDOS * 1000
  })).toString('base64url');
  return `${payload}.${firmarSesion(payload)}`;
}

function leerValorSesion(valor: string | undefined): SesionDatos | null {
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

async function establecerSesion(usuario: string, versionSesion: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESION, crearValorSesion(usuario, versionSesion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DURACION_SESION_SEGUNDOS,
    path: '/'
  });
}

async function obtenerUsuarioSesion(): Promise<string | null> {
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

async function verificarAdmin(): Promise<boolean> {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) return false;
  const resultado = await db.execute({
    sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [usuario]
  });
  return resultado.rows[0]?.rol === 'admin';
}

async function obtenerRolUsuario(usuario: string | null): Promise<string | null> {
  if (!usuario) return null;
  const resultado = await db.execute({
    sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [usuario]
  });
  return texto(resultado.rows[0]?.rol) || 'alumno';
}

async function existeMateria(id: string | undefined): Promise<boolean> {
  if (!id) return false;
  const resultado = await db.execute({
    sql: 'SELECT 1 FROM materias WHERE id = ?',
    args: [id]
  });
  return resultado.rows.length > 0;
}

async function obtenerAlumno(nombre: string): Promise<{ id: string; nombre: string } | null> {
  const resultado = await db.execute({
    sql: 'SELECT id, nombre FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [nombre]
  });
  const fila = resultado.rows[0];
  if (!fila) return null;
  const id = texto(fila.id);
  const nombreAlumno = texto(fila.nombre);
  if (!id || !nombreAlumno) return null;
  return { id, nombre: nombreAlumno };
}

async function hashearPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivada = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derivada.toString('hex')}`;
}

async function verificarPassword(password: string, almacenada: string | null | undefined): Promise<boolean> {
  if (!almacenada?.startsWith('scrypt$')) return false;

  const [, salt, hashHex] = almacenada.split('$');
  if (!salt || !hashHex) return false;

  try {
    const derivada = await scryptAsync(password, salt, hashHex.length / 2) as Buffer;
    const hashBytes = Buffer.from(hashHex, 'hex');
    const derivadaBytes = derivada;
    return hashBytes.length === derivadaBytes.length && timingSafeEqual(hashBytes, derivadaBytes);
  } catch (error) {
    return false;
  }
}

// --- AUTENTICACIÓN Y ALUMNOS ---

// Valida credenciales consultando directamente a la tabla alumnos en Turso
export async function validarLoginAction(usuarioInput: string, passwordInput: string): Promise<RespuestaAction> {
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
      sql: `SELECT nombre, password, rol, sesion_version, COALESCE(origen, 'comision') AS origen
            FROM alumnos WHERE LOWER(nombre) = LOWER(?)`,
      args: [userClean]
    });

    if (res.rows.length === 0) {
      await registrarFalloLogin(clavesLogin);
      return { exito: false, mensaje: MENSAJE_LOGIN_INVALIDO };
    }

    const usuarioDB = res.rows[0];
    const nombreUsuario = texto(usuarioDB.nombre);
    const credencialesValidas = await verificarPassword(passClean, textoONull(usuarioDB.password));

    if (!credencialesValidas) {
      await registrarFalloLogin(clavesLogin);
      return { exito: false, mensaje: MENSAJE_LOGIN_INVALIDO };
    }

    await limpiarIntentosLogin(clavesLogin);
    await establecerSesion(nombreUsuario, Number(usuarioDB.sesion_version) || 1);
    await registrarAuditoria({ accion: 'login', usuario: nombreUsuario, detalle: 'Inicio de sesión exitoso', ip: await obtenerIPReal() });
    return {
      exito: true,
      usuario: nombreUsuario,
      rol: texto(usuarioDB.rol) || 'alumno',
      origen: texto(usuarioDB.origen) || 'comision'
    };
  } catch (error) {
    console.error('Error en validarLoginAction:', error);
    return { exito: false, mensaje: 'No se pudo iniciar sesión.' };
  }
}

export async function cerrarSesionAction() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESION, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });
  return { exito: true };
}

export async function obtenerSesionAction() {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) return { usuario: null, rol: null, origen: null, ugrUsuario: null };
  const cuenta = await leerCuenta(usuario);
  return {
    usuario,
    rol: texto(cuenta?.rol) || 'alumno',
    origen: texto(cuenta?.origen) || 'comision',
    ugrUsuario: textoONull(cuenta?.ugr_usuario)
  };
}

function normalizarDni(valor: string): string {
  return String(valor || '').trim().replace(/[.\s-]/g, '');
}

export async function registrarCuentaAction(
  usuarioInput: string,
  passwordInput: string,
  confirmacionInput: string,
  dniInput = '',
  claveUgrInput = ''
): Promise<RespuestaAction> {
  const usuario = String(usuarioInput || '').trim();
  const password = String(passwordInput || '');
  const confirmacion = String(confirmacionInput || '');
  const dni = normalizarDni(dniInput);
  const claveUgr = String(claveUgrInput || '');
  let claves: { clave: string; limite: number }[] = [];
  try {
    if (!usuario || !password || !confirmacion || !dni || !claveUgr) {
      return { exito: false, mensaje: 'Completá usuario, contraseña, DNI y clave de UGR Virtual.' };
    }
    if (usuario.length < 3 || usuario.length > MAX_USUARIO_LENGTH) {
      return { exito: false, mensaje: 'El usuario tiene que tener entre 3 y 100 caracteres.' };
    }
    if (password.length < 6 || password.length > MAX_PASSWORD_LENGTH) {
      return { exito: false, mensaje: 'La contraseña tiene que tener entre 6 y 128 caracteres.' };
    }
    if (password !== confirmacion) {
      return { exito: false, mensaje: 'Las contraseñas no coinciden.' };
    }
    if (dni.length < 6 || dni.length > MAX_USUARIO_LENGTH) {
      return { exito: false, mensaje: 'El DNI de UGR Virtual no es válido.' };
    }
    if (claveUgr.length > MAX_PASSWORD_LENGTH) {
      return { exito: false, mensaje: 'La clave de UGR Virtual es demasiado larga.' };
    }

    claves = [
      { clave: `ugr-alta:${dni.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO },
      { clave: `ugr-ip:${await obtenerIPReal()}`, limite: LIMITE_LOGIN_IP }
    ];
    if (await loginEstaBloqueado(claves)) {
      return { exito: false, mensaje: MENSAJE_LOGIN_BLOQUEADO };
    }

    const existente = await db.execute({
      sql: 'SELECT 1 FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [usuario]
    });
    if (existente.rows.length > 0) {
      return { exito: false, mensaje: 'Ese usuario ya existe.' };
    }

    const { conectarUGRCon } = await import('../../ugr-sync/lib/sync-core.mjs');
    let cliente: { autenticar?: () => Promise<unknown> };
    try {
      cliente = await conectarUGRCon({ usuario: dni, contrasena: claveUgr, rutaSesion: null }) as { autenticar?: () => Promise<unknown> };
      if (typeof cliente.autenticar === 'function') await cliente.autenticar();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      const rechazo = mensaje.startsWith('Login rechazado') || mensaje.includes('logintoken');
      if (rechazo) await registrarFalloLogin(claves);
      if (rechazo) return { exito: false, mensaje: 'UGR Virtual no aceptó ese DNI o contraseña.' };
      return { exito: false, mensaje: 'No se pudo comprobar la cuenta en UGR Virtual.' };
    }

    const id = crearId('a_');
    await db.execute({
      sql: `INSERT INTO alumnos (id, nombre, password, rol, origen) VALUES (?, ?, ?, 'alumno', 'propio')`,
      args: [id, usuario, await hashearPassword(password)]
    });
    await establecerSesion(usuario, 1);
    await limpiarIntentosLogin(claves);
    await registrarAuditoria({ accion: 'registrar_cuenta', usuario, detalle: 'Alta de cuenta propia comprobada con UGR Virtual', ip: await obtenerIPReal() });

    try {
      const sync = await sincronizarCursadaDelAlumno({ alumnoId: id, alumnoNombre: usuario, cliente });
      return { exito: true, usuario, rol: 'alumno', origen: 'propio', ugrUsuario: null, mensaje: sync.mensaje, resumen: sync.resumen };
    } catch {
      return {
        exito: true,
        usuario,
        rol: 'alumno',
        origen: 'propio',
        ugrUsuario: null,
        mensaje: 'La cuenta está lista. UGR Virtual no terminó de cargar la cursada: sincronizá de nuevo con el DNI y la clave.'
      };
    }
  } catch (error) {
    console.error('Error en registrarCuentaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la cuenta.' };
  }
}

// Cambiar contraseña en la tabla alumnos en Turso
export async function cambiarPasswordAction(usuarioInput: string, passActualInput: string, passNuevaInput: string): Promise<RespuestaAction> {
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
    const credencialesValidas = await verificarPassword(passActualClean, textoONull(res.rows[0].password));
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


// Crear nuevo alumno en la BD
export async function crearAlumnoAction(nombre: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede crear alumnos.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nombre, MAX_NOMBRE_LENGTH, 'nombre');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
    const nombreFormateado = validacionNombre.valor;
    if (!nombreFormateado) return { exito: false, mensaje: 'El nombre es obligatorio.' };
    const existente = await db.execute({
      sql: 'SELECT 1 FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [nombreFormateado]
    });
    if (existente.rows.length > 0) return { exito: false, mensaje: 'Ya existe un alumno con ese nombre.' };
    const id = crearId('a_');
    await db.batch([
      { sql: 'INSERT INTO alumnos (id, nombre, password) VALUES (?, ?, ?)', args: [id, nombreFormateado, await hashearPassword(nombreFormateado)] },
      { sql: 'INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id) SELECT ?, id FROM materias', args: [id] }
    ], 'write');
    await registrarAuditoria({ accion: 'crear_alumno', usuario: usuarioSesion, detalle: `Creó al alumno ${nombreFormateado}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearAlumnoAction:', error);
    return { exito: false, mensaje: 'No se pudo crear el alumno.' };
  }
}

// Renombrar alumno
export async function editarAlumnoAction(nombreAntiguo: string, nuevoNombre: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede editar alumnos.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const validacionNombre = validarLongitud(nuevoNombre, MAX_NOMBRE_LENGTH, 'nombre');
    if (!validacionNombre.valida) return convertirValidacion(validacionNombre);
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
export async function eliminarAlumnoAction(nombre: string): Promise<RespuestaAction> {
  try {
    if (!await verificarAdmin()) return { exito: false, mensaje: 'Solo el administrador puede eliminar alumnos.' };
    const usuarioSesion = await obtenerUsuarioSesion();
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const alumnoActual = await obtenerAlumno(nombre);
    if (!alumnoActual) return { exito: false, mensaje: 'El alumno no existe.' };
    await db.batch([
      { sql: 'DELETE FROM integrantes_tareas WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM grupos_tareas WHERE NOT EXISTS (SELECT 1 FROM integrantes_tareas WHERE grupo_id = grupos_tareas.id)', args: [] },
      { sql: 'DELETE FROM completadas WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM notas_parciales WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM notas_tareas WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM progreso_materias WHERE alumno_id = ?', args: [alumnoActual.id] },
      { sql: 'DELETE FROM inscripciones WHERE alumno_id = ?', args: [alumnoActual.id] },
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

function consultaPeriodo(periodoId: string | null, sqlConPeriodo: string, sqlSinPeriodo: string) {
  return periodoId
    ? { sql: sqlConPeriodo, args: [periodoId] }
    : { sql: sqlSinPeriodo, args: [] };
}

function armarMaterias(filasMaterias: Row[], filasTareas: Row[], filasCompletadas: Row[], filasNotas: Row[], filasGrupos: Row[]) {
    const gruposPorTarea = new Map<string, Map<string, { id: string; nombre: string; integrantes: string[] }>>();
    for (const fila of filasGrupos) {
      const tareaId = texto(fila.tarea_id);
      const grupoId = texto(fila.id);
      if (!gruposPorTarea.has(tareaId)) gruposPorTarea.set(tareaId, new Map());
      const grupos = gruposPorTarea.get(tareaId)!;
      if (!grupos.has(grupoId)) grupos.set(grupoId, { id: grupoId, nombre: texto(fila.nombre), integrantes: [] });
      const alumnoGrupo = texto(fila.alumno);
      if (alumnoGrupo) grupos.get(grupoId)!.integrantes.push(alumnoGrupo);
    }

    const tareasPorMateria = new Map<string, Row[]>();
    filasTareas.forEach((tarea) => {
      const materiaId = texto(tarea.materia_id);
      const tareasMateria = tareasPorMateria.get(materiaId) || [];
      tareasMateria.push(tarea);
      tareasPorMateria.set(materiaId, tareasMateria);
    });

    const completadasPorTarea = new Map<string, Row[]>();
    filasCompletadas.forEach((completada) => {
      const tareaId = texto(completada.tarea_id);
      const completadasTarea = completadasPorTarea.get(tareaId) || [];
      completadasTarea.push(completada);
      completadasPorTarea.set(tareaId, completadasTarea);
    });

    const notasPorTarea = new Map<string, Record<string, Value>>();
    const fechasNotasPorTarea = new Map<string, Record<string, Value>>();
    filasNotas.forEach((nota) => {
      const tareaId = texto(nota.tarea_id);
      const alumnoNota = texto(nota.alumno);
      const notasTarea = notasPorTarea.get(tareaId) || {};
      notasTarea[alumnoNota] = nota.nota;
      notasPorTarea.set(tareaId, notasTarea);

      const fechasNotasTarea = fechasNotasPorTarea.get(tareaId) || {};
      fechasNotasTarea[alumnoNota] = nota.cargada_en;
      fechasNotasPorTarea.set(tareaId, fechasNotasTarea);
    });

    const materias = filasMaterias.map((m) => {
      const tareasMateria = tareasPorMateria.get(texto(m.id)) || [];

      const tareasConCompletados = tareasMateria.map((t) => {
        const tareaId = texto(t.id);
        const completadas = completadasPorTarea.get(tareaId) || [];
        const notas = notasPorTarea.get(tareaId) || {};
        const notaCargadaEn = fechasNotasPorTarea.get(tareaId) || {};
        const completadoPor = completadas.map((c) => texto(c.alumno));

        return {
          id: texto(t.id),
          nombre: texto(t.nombre),
          inicio: textoONull(t.inicio),
          fin: textoONull(t.fin),
          detalles: texto(t.detalles),
          unidad: t.unidad == null || t.unidad === '' ? '' : texto(t.unidad),
          conNota: Number(t.con_nota) === 1,
          grupal: Number(t.grupal) === 1,
          cupo_maximo: Number(t.cupo_maximo) || 0,
          grupos: [...(gruposPorTarea.get(tareaId)?.values() || [])],
          tipo: texto(t.tipo) || 'actividad',
          url: texto(t.url),
          completadoPor,
          completadoEn: Object.fromEntries(
            completadas.map((c) => [texto(c.alumno), texto(c.completada_en)])
          ),
          notas: Object.fromEntries(
            Object.entries(notas).map(([alumnoNota, valor]) => [alumnoNota, valor == null ? null : texto(valor)])
          ),
          notaCargadaEn: Object.fromEntries(
            Object.entries(notaCargadaEn).map(([alumnoNota, valor]) => [alumnoNota, texto(valor)])
          )
        };
      });

      return {
        id: texto(m.id),
        nombre: texto(m.nombre),
        condiciones: texto(m.condiciones),
        notaMinimaRegularizar: Number(m.nota_minima_regularizar) || 4,
        notaMinimaPromocionar: Number(m.nota_minima_promocionar) || 8,
        reglaPromocion: texto(m.regla_promocion) || 'tp_nota',
        tareas: tareasConCompletados
      };
    });

    return materias;
}


// Una ida a Turso con todas las lecturas del tablero. Antes cada refresco
// repetía la sesión y abría un pedido por tabla (~15 roundtrips).
export async function obtenerEstadoCompleto(periodoIdSolicitado: string | null | undefined = null) {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return null;

    const cuenta = await leerCuenta(usuarioSesion);
    const yaInscripto = texto(cuenta?.id)
      ? await db.execute({ sql: 'SELECT 1 FROM inscripciones WHERE alumno_id = ? LIMIT 1', args: [texto(cuenta?.id)] })
      : { rows: [] };
    if (texto(cuenta?.origen) === 'propio' && yaInscripto.rows.length === 0) {
      return {
        usuario: usuarioSesion,
        rol: 'alumno',
        origen: 'propio',
        ugrUsuario: textoONull(cuenta?.ugr_usuario),
        periodos: [],
        periodoActivo: null,
        materias: [],
        alumnos: [usuarioSesion],
        parciales: [],
        notas: [],
        horarios: [],
        cronograma: [],
        progresoPlan: [],
        avisos: [],
        inscripciones: []
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
      resAlumnos,
      resParciales,
      resNotasParciales,
      resHorarios,
      resCronograma,
      resProgreso,
      resAvisos,
      resRol,
      resInscripciones
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
        `SELECT t.id, t.materia_id, t.nombre, t.inicio, t.fin, t.detalles, t.unidad, t.con_nota, t.tipo, t.url, t.grupal, t.cupo_maximo
         FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE m.periodo_id = ?`,
        `SELECT id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo, url, grupal, cupo_maximo FROM tareas`
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
      { sql: "SELECT nombre FROM alumnos WHERE COALESCE(origen, 'comision') = 'comision' ORDER BY nombre ASC", args: [] },
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
        sql: "SELECT id, curso_nombre, materia_id, materia_nombre, titulo, url FROM avisos_moodle WHERE estado = 'aceptado' ORDER BY fecha DESC",
        args: []
      },
      { sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)', args: [usuarioSesion] },
      {
        sql: `SELECT a.nombre AS alumno, i.materia_id
              FROM inscripciones i
              JOIN alumnos a ON a.id = i.alumno_id`,
        args: []
      }
    ], 'read');

    const materiasArmadas = armarMaterias(resMaterias.rows, resTareas.rows, resCompletadas.rows, resNotasTareas.rows, resGrupos.rows);
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
      inscripciones.filter((fila) => fila.alumno === usuarioSesion).map((fila) => fila.materiaId)
    );
    const materiasVisibles = materiasPropias.size > 0
      ? materiasArmadas.filter((materia) => materiasPropias.has(materia.id))
      : materiasArmadas;
    const alumnosVisibles = companeros.length > 0
      ? companeros
      : resAlumnos.rows.map((fila) => texto(fila.nombre));

    return {
      usuario: usuarioSesion,
      rol: texto(resRol.rows[0]?.rol) || 'alumno',
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
      parciales: resParciales.rows.filter((fila) => materiasPropias.size === 0 || materiasPropias.has(texto(fila.materia_id))).map((fila) => ({
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
        if (materiasPropias.size > 0 && !materiasPropias.has(texto(fila.materia_id))) return false;
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
      cronograma: resCronograma.rows.filter((fila) => materiasPropias.size === 0 || materiasPropias.has(texto(fila.materia_id))).map((fila) => ({
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
      avisos: resAvisos.rows,
      inscripciones
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

export async function toggleTareaAction(tareaId: string, alumno: string): Promise<RespuestaAction> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;
    const alumnoObjetivo = await verificarAdmin() ? alumno : usuarioSesion;
    const alumnoDB = await obtenerAlumno(alumnoObjetivo);
    if (!alumnoDB) return { exito: false, mensaje: 'El alumno no existe.' };
    if (!(await verificarAdmin())) {
      return { exito: false, mensaje: 'La entrega se marca al sincronizar con UGR Virtual.' };
    }
    const resultado = await actualizarProgresoTarea(db, tareaId, alumnoDB, { alternarEntrega: true });
    await registrarAuditoria({ accion: 'alternar_entrega_tarea', usuario: usuarioSesion, detalle: `Cambió entrega de ${tareaId} para: ${resultado.alumnos.join(', ')}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en toggleTareaAction:', error);
    return { exito: false, mensaje: error instanceof ErrorGrupo ? error.message : 'No se pudo actualizar la tarea.' };
  }
}

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
    const reglasValidas = ['tp_nota', 'tp_porcentaje_nota', 'auditorias_tps', 'ciberdelitos_parciales', 'riesgos_tps', 'activos_porcentaje'];
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
  const { materiaId, nombre, inicio, fin, detalles, unidad, conNota, tipo, grupal = false, cupoMaximo = 0 } = params;
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

    const id = crearId('t_');
    await db.execute({
      sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo, grupal, cupo_maximo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, validacionNombre.valor, validacionInicio.valor, validacionFin.valor, validacionDetalles.valor || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado, grupal === true ? 1 : 0, cupo]
    });
    await registrarAuditoria({ accion: 'crear_tarea', usuario: usuarioSesion, detalle: `Creó la tarea ${validacionNombre.valor}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la tarea.' };
  }
}

export async function editarTareaAction(params: TareaActionParams): Promise<RespuestaAction> {
  const { id, nombre, inicio, fin, detalles, unidad, conNota, tipo, grupal = false, cupoMaximo = 0 } = params;
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
    const cupo = Number(cupoMaximo);
    if (!Number.isInteger(cupo) || cupo < 0 || cupo > 30) {
      return { exito: false, mensaje: 'El cupo del grupo tiene que ser un entero entre 0 y 30.' };
    }
    const actualizacion = await db.execute({
      sql: 'UPDATE tareas SET nombre = ?, inicio = ?, fin = ?, detalles = ?, unidad = ?, con_nota = ?, tipo = ?, grupal = ?, cupo_maximo = ? WHERE id = ?',
      args: [validacionNombre.valor, validacionInicio.valor, validacionFin.valor, validacionDetalles.valor || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado, grupalNumerico, cupo, id]
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

// Sincroniza tareas nuevas desde UGR Virtual. Con `confirmar: false` solo
// detecta (vista previa); con `confirmar: true` inserta únicamente las tareas
// cuyo `idMoodle` esté en `ids` (el admin las tilda una por una en el modal).
export async function syncUgrAction({
  confirmar = false,
  previaId = null,
  ids = [],
  idsAvisos = [],
  idsEventos = []
}: {
  confirmar?: boolean;
  previaId?: string | null;
  ids?: string[];
  idsAvisos?: string[];
  idsEventos?: string[];
} = {}) {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede sincronizar con UGR.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const [{ conectarUGR, detectarAvisosMoodle, detectarTareasNuevas, listarCursosDelCampus, asegurarMateriasDeLaCursada }, { sincronizarConPrevia }] = await Promise.all([
      import('../../ugr-sync/lib/sync-core.mjs'),
      import('../../ugr-sync/lib/previa.mjs')
    ]);
    const resultado = await sincronizarConPrevia({
      db, usuario: usuarioSesion, confirmar, previaId, ids, idsAvisos, idsEventos,
      detectar: async () => {
        const cliente = await conectarUGR();
        const cursos = await listarCursosDelCampus(cliente);
        const periodoId = await periodoDeCursada();
        const materiasPeriodo = await db.execute({
          sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre',
          args: [periodoId]
        });
        const cursada = await asegurarMateriasDeLaCursada({
          db,
          cursos,
          materias: materiasPeriodo.rows.map((fila) => ({ id: texto(fila.id), nombre: texto(fila.nombre) })),
          plan: PLAN_DE_ESTUDIO,
          periodoId
        });
        const alumno = await db.execute({
          sql: 'SELECT id FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
          args: [usuarioSesion]
        });
        const alumnoId = texto(alumno.rows[0]?.id);
        if (alumnoId && cursada.materiaIds.length > 0) {
          await db.batch(cursada.materiaIds.map((materiaId: string) => ({
            sql: 'INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id) VALUES (?, ?)',
            args: [alumnoId, materiaId]
          })), 'write');
        }
        const tareas = await detectarTareasNuevas({ db, cliente, cursos, periodoId, mapeos: cursada.mapeos });
        const { avisosDetectados, eventosSugeridos } = await detectarAvisosMoodle({ db, cliente, mapeos: cursada.mapeos });
        return { ...tareas, avisos: avisosDetectados, eventosSugeridos };
      }
    });
    const { materiasLocales, cursos, mapeos = [], detectadas, avisos: avisosDetectados, eventosSugeridos,
      insertadas = 0, avisosAceptados = 0, avisosRechazados = 0, eventosInsertados = 0,
      urlsActualizadas = 0, urlsParcialesActualizadas = 0, parcialesInsertados = 0,
      eventosCalendarioInsertados = 0, horariosInsertados = 0, fechasActualizadas = 0 } = resultado;

    if (confirmar) {

      await registrarAuditoria({
        accion: 'sync_ugr',
        usuario: usuarioSesion,
        detalle: `Sincronizó UGR: insertó ${insertadas} tarea(s) en ${mapeos.length} materia(s); actualizó ${urlsActualizadas} enlace(s) de tareas y ${urlsParcialesActualizadas} de parciales; aprobó ${avisosAceptados} aviso(s) (${avisosRechazados} descartado(s)) y agregó ${eventosInsertados} evento(s) al cronograma`,
        ip: await obtenerIPReal()
      });
    }

    return {
      exito: true,
      confirmar,
      previaId: resultado.previaId,
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
      urlsParcialesActualizadas,
      parcialesInsertados,
      eventosCalendarioInsertados,
      horariosInsertados,
      fechasActualizadas,
      avisos: avisosDetectados,
      eventosSugeridos,
      avisosAceptados,
      avisosRechazados,
      eventosInsertados
    };
  } catch (error) {
    console.error('Error en syncUgrAction:', error);
    return { exito: false, mensaje: error instanceof Error ? error.message : 'No se pudo sincronizar con UGR Virtual.' };
  }
}


async function periodoDeCursada(): Promise<string> {
  const activo = await db.execute('SELECT id FROM periodos WHERE activo = 1 ORDER BY anio DESC, cuatrimestre DESC LIMIT 1');
  const existente = texto(activo.rows[0]?.id);
  if (existente) return existente;
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const cuatrimestre = ahora.getMonth() >= 7 ? 2 : 1;
  const id = `periodo_${anio}_${cuatrimestre}`;
  await db.execute({
    sql: 'INSERT OR IGNORE INTO periodos (id, anio, cuatrimestre, nombre, activo) VALUES (?, ?, ?, ?, 1)',
    args: [id, anio, cuatrimestre, `${anio} - ${cuatrimestre}° cuatrimestre`]
  });
  return id;
}

async function inscribirAlumnoEnPeriodo(alumnoId: string, periodoId: string, materiaIds: string[]) {
  const ids = materiaIds.filter(Boolean);
  if (ids.length > 0) {
    await db.batch(ids.map((materiaId) => ({
      sql: 'INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id) VALUES (?, ?)',
      args: [alumnoId, materiaId]
    })), 'write');
    await db.execute({
      sql: `DELETE FROM inscripciones
            WHERE alumno_id = ?
              AND materia_id IN (SELECT id FROM materias WHERE periodo_id = ?)
              AND materia_id NOT IN (${ids.map(() => '?').join(',')})`,
      args: [alumnoId, periodoId, ...ids]
    });
    return;
  }
  await db.execute({
    sql: 'DELETE FROM inscripciones WHERE alumno_id = ? AND materia_id IN (SELECT id FROM materias WHERE periodo_id = ?)',
    args: [alumnoId, periodoId]
  });
}

function armarMensajeSync({
  materias,
  resumen,
  parciales,
  eventos,
  horarios,
  notas,
  fechas,
  armarMensajeCursada
}: {
  materias: Array<{ nombre: string }>;
  resumen: ResumenMateriaSync[];
  parciales: number;
  eventos: number;
  horarios: number;
  notas: number;
  fechas: number;
  armarMensajeCursada: (opciones: {
    materias?: Array<{ nombre: string } | string>;
    tareasNuevas?: number;
    tareasYa?: number;
    extras?: string[];
  }) => string;
}): string {
  const nuevas = resumen.reduce((total, fila) => total + fila.nuevas.length, 0);
  const ya = resumen.reduce((total, fila) => total + fila.yaEstaban.length, 0);
  const extras: string[] = [];
  const cronNuevo = resumen.reduce((total, fila) => total + (fila.cronogramaNuevo?.length || 0), 0);
  const cronYa = resumen.reduce((total, fila) => total + (fila.cronogramaYa?.length || 0), 0);
  if (cronNuevo) extras.push(`Se cargaron ${cronNuevo} fecha(s) de cronograma.`);
  else if (cronYa) extras.push('El cronograma ya estaba cargado.');
  if (parciales) extras.push(`Se cargaron ${parciales} parcial(es).`);
  if (!cronNuevo && eventos) extras.push(`Se cargaron ${eventos} evento(s).`);
  if (horarios) extras.push(`Se cargaron ${horarios} horario(s).`);
  if (notas) extras.push('Se copiaron las notas publicadas en el campus.');
  if (fechas) extras.push(`Se actualizaron ${fechas} fecha(s) que el campus había cambiado.`);
  return armarMensajeCursada({ materias, tareasNuevas: nuevas, tareasYa: ya, extras });
}

type ItemTareaCampus = {
  materiaId?: string;
  materiaNombre?: string;
  nombre?: string;
  fin?: string;
  url?: string;
};

async function sincronizarCursadaDelAlumno({
  alumnoId,
  alumnoNombre,
  cliente
}: {
  alumnoId: string;
  alumnoNombre: string;
  cliente: unknown;
}): Promise<{ mensaje: string; resumen: ResumenMateriaSync[] }> {
  const {
    listarCursosDelCampus,
    asegurarMateriasDeLaCursada,
    detectarTareasNuevas,
    detectarAvisosMoodle,
    filtrarTareasDuplicadas,
    agruparResumenSync,
    armarMensajeCursada,
    limpiarTextoParaBusqueda,
    insertarTareasDetectadas,
    insertarParcialesSiFaltan,
    actualizarUrlsTareas,
    actualizarUrlsParciales,
    insertarEventosCronograma,
    aplicarComplementoCampus
  } = await import('../../ugr-sync/lib/sync-core.mjs');

  // 1) Materias de la carrera que esta cuenta está cursando (las extras
  //    también: Criptografía, Conceptos de Desarrollo, etc.). Lo que no está
  //    en el plan (Mi Carrera, espacios) se descarta.
  const cursos = await listarCursosDelCampus(cliente);
  const periodoId = await periodoDeCursada();
  const materiasPeriodo = await db.execute({
    sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre',
    args: [periodoId]
  });
  const cursada = await asegurarMateriasDeLaCursada({
    db,
    cursos,
    materias: materiasPeriodo.rows.map((fila) => ({
      id: texto(fila.id),
      nombre: texto(fila.nombre)
    })),
    plan: PLAN_DE_ESTUDIO,
    periodoId
  });
  if (cursada.materiaIds.length === 0) {
    throw new Error('UGR Virtual no mostró materias de la carrera para esta cuenta.');
  }
  const { mapeos, materiaIds, nombresPorId, nombresNuevos } = cursada;
  await inscribirAlumnoEnPeriodo(alumnoId, periodoId, materiaIds);

  const tareas = await detectarTareasNuevas({ db, cliente, cursos, periodoId, alumnoId, mapeos });
  const detectadas = (tareas.detectadas || []) as ItemTareaCampus[];
  const propias = detectadas.filter((item) => item.materiaId && materiaIds.includes(item.materiaId));
  const yaCargadas = ((tareas.yaCargadas || []) as ItemTareaCampus[])
    .filter((item) => item.materiaId && materiaIds.includes(item.materiaId));
  const { nuevas: faltantes, duplicadas } = filtrarTareasDuplicadas(propias, yaCargadas);
  await insertarTareasDetectadas({ db, detectadas: faltantes });
  const parcialesFuente = ((tareas.parcialesDetectados || []) as ItemTareaCampus[])
    .filter((item) => item.materiaId && materiaIds.includes(item.materiaId) && item.nombre && item.fin);
  const parcialesResultado = await insertarParcialesSiFaltan({
    db,
    detectadas: parcialesFuente
  });
  await actualizarUrlsTareas({ db, urlsActualizar: tareas.urlsActualizar });
  await actualizarUrlsParciales({ db, urlsParcialesActualizar: tareas.urlsParcialesActualizar });

  type ItemEventoCampus = { materiaId?: string; materiaNombre?: string; titulo?: string; fecha?: string };
  const conNombreMateria = (item: ItemEventoCampus): ItemEventoCampus => ({
    ...item,
    materiaNombre: nombresPorId.get(item.materiaId || '') || item.materiaNombre
  });
  const claveEvento = (item: ItemEventoCampus) => `${item.materiaId}|${item.fecha}|${String(item.titulo || '').slice(0, 200)}`;
  const existentesCron = new Set<string>();
  for (const materiaId of materiaIds) {
    const yaCron = await db.execute({
      sql: 'SELECT fecha, titulo FROM cronograma_eventos WHERE materia_id = ?',
      args: [materiaId]
    });
    for (const fila of yaCron.rows) existentesCron.add(`${materiaId}|${fila.fecha}|${fila.titulo}`);
  }

  const complemento = await aplicarComplementoCampus({
    db,
    detectado: tareas,
    alumnoId,
    alumnoNombre
  });

  const avisos = await detectarAvisosMoodle({
    db,
    cliente,
    mapeos
  });
  const eventosAvisos = ((avisos.eventosSugeridos || []) as ItemEventoCampus[]).filter((evento) => {
    return !!evento.materiaId && materiaIds.includes(evento.materiaId);
  });
  const eventosInsertados = await insertarEventosCronograma({
    db,
    eventos: eventosAvisos
  });

  const vistosCron = new Set<string>();
  const cronogramaNuevo: ItemEventoCampus[] = [];
  const cronogramaYa: ItemEventoCampus[] = [];
  const eventosCampus = ((tareas.eventosCalendario || []) as ItemEventoCampus[])
    .filter((item) => item.materiaId && materiaIds.includes(item.materiaId));
  for (const item of [...eventosCampus, ...eventosAvisos].map(conNombreMateria)) {
    const clave = claveEvento(item);
    if (!item.titulo || vistosCron.has(clave)) continue;
    vistosCron.add(clave);
    if (existentesCron.has(clave)) cronogramaYa.push(item);
    else cronogramaNuevo.push(item);
  }

  const resumen = agruparResumenSync({
    nuevas: faltantes,
    yaEstaban: [...yaCargadas, ...duplicadas],
    cronogramaNuevo,
    cronogramaYa
  }) as ResumenMateriaSync[];
  for (const nombre of nombresPorId.values()) {
    if (!resumen.some((fila) => fila.materia === nombre)) {
      resumen.push({ materia: nombre, nuevas: [], yaEstaban: [], cronogramaNuevo: [], cronogramaYa: [] });
    }
  }
  for (const fila of resumen) {
    const clave = limpiarTextoParaBusqueda(fila.materia);
    if (clave && nombresNuevos.has(clave)) fila.materiaNueva = true;
  }
  const orden = new Map([...nombresPorId.values()].map((nombre, indice) => [nombre, indice]));
  resumen.sort((a, b) => (orden.get(a.materia) ?? 99) - (orden.get(b.materia) ?? 99));

  return {
    resumen,
    mensaje: armarMensajeSync({
      materias: [...nombresPorId.entries()].map(([, nombre]) => ({ nombre })),
      resumen,
      parciales: parcialesResultado.insertadas,
      eventos: eventosInsertados + complemento.eventos,
      horarios: complemento.horarios,
      notas: complemento.notas,
      fechas: complemento.fechas,
      armarMensajeCursada
    })
  };
}

// Cada alumno trae su cursada del período actual. Las materias, tareas,
// parciales y eventos se guardan una sola vez: el siguiente de la misma
// materia los ve. DNI y clave de UGR no se persisten.
export async function sincronizarCuentaUgrAction(dniInput: string, passwordUgrInput: string): Promise<RespuestaAction> {
  const dni = normalizarDni(dniInput);
  const contrasena = String(passwordUgrInput || '');
  let claves: { clave: string; limite: number }[] = [];
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    if (!dni || !contrasena || dni.length > MAX_USUARIO_LENGTH || contrasena.length > MAX_PASSWORD_LENGTH) {
      return { exito: false, mensaje: 'Completá el DNI y la contraseña de UGR Virtual.' };
    }
    if (dni.length < 6) {
      return { exito: false, mensaje: 'El DNI de UGR Virtual no es válido.' };
    }
    claves = [{ clave: `ugr:${usuarioSesion.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO }, { clave: `ugr-ip:${await obtenerIPReal()}`, limite: LIMITE_LOGIN_IP }];
    if (await loginEstaBloqueado(claves)) {
      return { exito: false, mensaje: MENSAJE_LOGIN_BLOQUEADO };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const resultado = await db.execute({
      sql: 'SELECT id FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [usuarioSesion]
    });
    const alumnoId = texto(resultado.rows[0]?.id);
    if (!alumnoId) return { exito: false, mensaje: 'No se encontró la cuenta.' };

    const { conectarUGRCon } = await import('../../ugr-sync/lib/sync-core.mjs');
    const cliente = await conectarUGRCon({
      usuario: dni,
      contrasena,
      rutaSesion: null
    }) as { autenticar?: () => Promise<unknown> };
    if (typeof cliente.autenticar === 'function') await cliente.autenticar();
    const sync = await sincronizarCursadaDelAlumno({
      alumnoId,
      alumnoNombre: usuarioSesion,
      cliente
    });

    await limpiarIntentosLogin(claves);
    await registrarAuditoria({
      accion: 'sincronizar_cuenta',
      usuario: usuarioSesion,
      detalle: sync.mensaje,
      ip: await obtenerIPReal()
    });

    return {
      exito: true,
      mensaje: sync.mensaje,
      resumen: sync.resumen
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    const rechazo = mensaje.startsWith('Login rechazado') || mensaje.includes('logintoken');
    if (rechazo && claves.length > 0) await registrarFalloLogin(claves);
    console.error('Error en sincronizarCuentaUgrAction:', rechazo ? 'UGR Virtual rechazó el acceso' : 'falló');
    if (rechazo) return { exito: false, mensaje: 'UGR Virtual no aceptó ese DNI o contraseña.' };
    if (mensaje.includes('no mostró materias')) return { exito: false, mensaje };
    return { exito: false, mensaje: 'No se pudo sincronizar con UGR Virtual.' };
  }
}


// --- HORARIOS DE CURSADA ---


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

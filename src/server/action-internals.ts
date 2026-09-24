import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import type { Value } from '@libsql/client';
import { db } from '../app/turso';
import { PLAN_DE_ESTUDIO } from '../app/plan-utils';
import { cuentaPropiaVencida, ipPermiteOtraCuenta, nombreDeUsuarioValido, sentenciaLimpiarGruposVacios, sentenciasBorrarAlumno } from '../lib/cuentas';
import type { RespuestaAction } from '../app/actions/types';

const scryptAsync = promisify(scrypt);

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

export const COOKIE_SESION = 'ugr_sesion';
export const DURACION_SESION_SEGUNDOS = 30 * 60;

export const MENSAJE_LOGIN_INVALIDO = 'Usuario o contraseña incorrectos.';
export const MENSAJE_LOGIN_BLOQUEADO = 'Demasiados intentos. Probá de nuevo en unos minutos.';
export const LIMITE_LOGIN_USUARIO = 5;
export const LIMITE_LOGIN_IP = 20;
export const VENTANA_LOGIN_MS = 15 * 60 * 1000;
export const BLOQUEO_LOGIN_MS = 15 * 60 * 1000;
export const CODIGOS_PLAN = new Set(PLAN_DE_ESTUDIO.map((materia) => materia.codigo));
export const LIMITE_ACCIONES_ESCRITURA = 30;
export const VENTANA_ACCIONES_MS = 60 * 1000;
export const BLOQUEO_ACCIONES_MS = 5 * 60 * 1000;
export const MAX_NOMBRE_LENGTH = 100;
export const MAX_DETALLES_LENGTH = 500;
export const MAX_CONDICIONES_LENGTH = 1000;
export const MAX_AULA_LENGTH = 50;
export const MAX_TITULO_LENGTH = 200;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_USUARIO_LENGTH = 100;

export function texto(valor: Value | undefined): string {
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor);
  return '';
}

export function textoONull(valor: Value | undefined): string | null {
  if (valor == null) return null;
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor);
  return null;
}

interface LoginParams {
  usuario: string;
  password: string;
}

export function obtenerSecretoSesion() {
  const secreto = process.env.SESSION_SECRET?.trim();
  if (!secreto) throw new Error('Falta SESSION_SECRET en el entorno.');
  return secreto;
}

export function crearId(prefijo: string): string {
  return `${prefijo}${randomUUID()}`;
}

export function normalizarDni(valor: string): string {
  return String(valor || '').trim().replace(/[.\s-]/g, '');
}

export function esIPPrivada(ip: string | undefined | null): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('169.254.')) return true;
  return false;
}

export async function obtenerIPReal() {
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

export async function obtenerClavesLogin(usuario: string): Promise<{ clave: string; limite: number }[]> {
  const ip = await obtenerIPReal();
  const claves = [{ clave: `ip:${ip}`, limite: LIMITE_LOGIN_IP }];
  if (usuario) claves.push({ clave: `user:${usuario.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO });
  return claves;
}

export async function accionEscrituraEstaBloqueada(usuario: string): Promise<boolean> {
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

export async function registrarAccionEscritura(usuario: string): Promise<void> {
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

export async function leerCuenta(usuario: string) {
  const resultado = await db.execute({
    sql: `SELECT id, nombre, rol, COALESCE(origen, 'comision') AS origen, ugr_usuario
          FROM alumnos WHERE LOWER(nombre) = LOWER(?)`,
    args: [usuario]
  });
  return resultado.rows[0] || null;
}

export function esNombreRepetido(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : '';
  return /unique/i.test(mensaje);
}

export async function borrarCuentasSinSincronizar(): Promise<void> {
  try {
    const candidatas = await db.execute(`
      SELECT a.id, a.nombre, COALESCE(a.origen, 'comision') AS origen, a.creado_en, a.sincronizado_en,
             (SELECT COUNT(*) FROM inscripciones i WHERE i.alumno_id = a.id) AS inscripciones
      FROM alumnos a
      WHERE COALESCE(a.origen, 'comision') = 'propio'
        AND (a.sincronizado_en IS NULL OR a.sincronizado_en = '')
    `);
    const cuentas = candidatas.rows
      .filter((fila) => cuentaPropiaVencida({
        origen: texto(fila.origen),
        creadoEn: texto(fila.creado_en),
        sincronizadoEn: texto(fila.sincronizado_en),
        inscripciones: Number(fila.inscripciones || 0)
      }))
      .map((fila) => ({ id: texto(fila.id), nombre: texto(fila.nombre) }))
      .filter((cuenta) => cuenta.id && cuenta.nombre);
    if (cuentas.length === 0) return;
    await db.batch([
      ...cuentas.flatMap((cuenta) => sentenciasBorrarAlumno(cuenta.id, cuenta.nombre)),
      sentenciaLimpiarGruposVacios()
    ], 'write');
  } catch (error) {
    console.error('No se pudieron borrar las cuentas sin sincronizar:', error instanceof Error ? error.message : 'falló');
  }
}

export async function verificarRateLimitEscritura(usuario: string | null): Promise<RespuestaAction> {
  if (!usuario) return { exito: false, mensaje: 'La sesión no es válida.' };
  if (await accionEscrituraEstaBloqueada(usuario)) {
    return { exito: false, mensaje: 'Demasiadas acciones. Probá de nuevo en unos minutos.' };
  }
  await registrarAccionEscritura(usuario);
  return { exito: true };
}

export function validarFecha(fecha: string | null | undefined): { valida: true; valor: string } | { valida: false; valor: null } {
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

export function validarLongitud(textoIngresado: string | null | undefined, maximo: number, campo: string): { valida: true; valor: string } | { valida: false; mensaje: string } {
  const limpio = String(textoIngresado || '').trim();
  if (limpio.length > maximo) {
    return { valida: false, mensaje: `El campo ${campo} no puede superar los ${maximo} caracteres.` };
  }
  return { valida: true, valor: limpio };
}

export async function registrarAuditoria({ accion, usuario, detalle, ip }: AuditoriaParams): Promise<void> {
  try {
    await db.execute({
      sql: "INSERT INTO auditoria (id, accion, usuario, detalle, ip, creada_en) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      args: [crearId('aud_'), accion, usuario || 'anónimo', detalle || '', ip || 'unknown']
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
}

export async function loginEstaBloqueado(claves: { clave: string; limite: number }[]): Promise<boolean> {
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

export async function registrarFalloLogin(claves: { clave: string; limite: number }[]): Promise<void> {
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

export async function limpiarIntentosLogin(claves: { clave: string; limite: number }[]): Promise<void> {
  for (const { clave } of claves) {
    await db.execute({
      sql: 'DELETE FROM login_intentos WHERE clave = ?',
      args: [clave]
    });
  }
}

export function firmarSesion(payload: string): string {
  return createHmac('sha256', obtenerSecretoSesion()).update(payload).digest('base64url');
}

export function crearValorSesion(usuario: string, versionSesion: number): string {
  const payload = Buffer.from(JSON.stringify({
    usuario,
    versionSesion,
    expira: Date.now() + DURACION_SESION_SEGUNDOS * 1000
  })).toString('base64url');
  return `${payload}.${firmarSesion(payload)}`;
}

export function leerValorSesion(valor: string | undefined): SesionDatos | null {
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

export async function establecerSesion(usuario: string, versionSesion: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESION, crearValorSesion(usuario, versionSesion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DURACION_SESION_SEGUNDOS,
    path: '/'
  });
}

export async function obtenerUsuarioSesion(): Promise<string | null> {
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

export async function verificarAdmin(): Promise<boolean> {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) return false;
  const resultado = await db.execute({
    sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [usuario]
  });
  return resultado.rows[0]?.rol === 'admin';
}

export async function obtenerRolUsuario(usuario: string | null): Promise<string | null> {
  if (!usuario) return null;
  const resultado = await db.execute({
    sql: 'SELECT rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [usuario]
  });
  return texto(resultado.rows[0]?.rol) || 'alumno';
}

export async function existeMateria(id: string | undefined): Promise<boolean> {
  if (!id) return false;
  const resultado = await db.execute({
    sql: 'SELECT 1 FROM materias WHERE id = ?',
    args: [id]
  });
  return resultado.rows.length > 0;
}

export async function obtenerAlumno(nombre: string): Promise<{ id: string; nombre: string } | null> {
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

export async function hashearPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivada = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derivada.toString('hex')}`;
}

export async function verificarPassword(password: string, almacenada: string | null | undefined): Promise<boolean> {
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


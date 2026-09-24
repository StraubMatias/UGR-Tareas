'use server';

import { cookies } from 'next/headers';
import { db } from '../turso';
import { convertirValidacion } from '../../lib/utils';
import { ipPermiteOtraCuenta, nombreDeUsuarioValido, sentenciaLimpiarGruposVacios, sentenciasBorrarAlumno, sentenciasRenombrarAlumno } from '../../lib/cuentas';
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
  leerCuenta,
  borrarCuentasSinSincronizar,
  hashearPassword,
  verificarPassword,
  validarLongitud,
  loginEstaBloqueado,
  registrarFalloLogin,
  limpiarIntentosLogin,
  obtenerClavesLogin,
  establecerSesion,
  esNombreRepetido,
  COOKIE_SESION,
  MENSAJE_LOGIN_INVALIDO,
  MENSAJE_LOGIN_BLOQUEADO,
  LIMITE_LOGIN_USUARIO,
  LIMITE_LOGIN_IP,
  MAX_NOMBRE_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USUARIO_LENGTH
} from '../../server/action-internals';


// --- AUTENTICACIÓN Y ALUMNOS ---

// Valida credenciales consultando directamente a la tabla alumnos en Turso
export async function validarLoginAction(usuarioInput: string, passwordInput: string): Promise<RespuestaAction> {
  try {
    await borrarCuentasSinSincronizar();
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

export async function registrarCuentaAction(
  usuarioInput: string,
  passwordInput: string,
  confirmacionInput: string
): Promise<RespuestaAction> {
  const usuario = String(usuarioInput || '').trim();
  const password = String(passwordInput || '');
  const confirmacion = String(confirmacionInput || '');
  try {
    await borrarCuentasSinSincronizar();
    if (!usuario || !password || !confirmacion) {
      return { exito: false, mensaje: 'Completá usuario y contraseña.' };
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

    const ip = await obtenerIPReal();
    const claves = [{ clave: `alta-ip:${ip}`, limite: LIMITE_LOGIN_IP }];
    if (await loginEstaBloqueado(claves)) {
      return { exito: false, mensaje: MENSAJE_LOGIN_BLOQUEADO };
    }
    const deLaMismaIp = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM alumnos
            WHERE creado_ip = ? AND COALESCE(origen, 'comision') = 'propio'`,
      args: [ip]
    });
    if (!ipPermiteOtraCuenta(Number(deLaMismaIp.rows[0]?.total || 0))) {
      return { exito: false, mensaje: 'Desde esta conexión ya hay dos cuentas. Si se borra una, se puede crear otra.' };
    }

    const existente = await db.execute({
      sql: 'SELECT 1 FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [usuario]
    });
    if (existente.rows.length > 0) {
      await registrarFalloLogin(claves);
      return { exito: false, mensaje: 'Ese usuario ya existe.' };
    }

    const id = crearId('a_');
    try {
      await db.execute({
        sql: `INSERT INTO alumnos (id, nombre, password, rol, origen, creado_en, creado_ip) VALUES (?, ?, ?, 'alumno', 'propio', ?, ?)`,
        args: [id, usuario, await hashearPassword(password), new Date().toISOString(), ip]
      });
    } catch (error) {
      if (esNombreRepetido(error)) return { exito: false, mensaje: 'Ese usuario ya existe.' };
      throw error;
    }
    await establecerSesion(usuario, 1);
    await registrarAuditoria({ accion: 'registrar_cuenta', usuario, detalle: 'Alta de cuenta propia sin cursada cargada', ip: await obtenerIPReal() });

    return {
      exito: true,
      usuario,
      rol: 'alumno',
      origen: 'propio',
      ugrUsuario: null,
      mensaje: 'La cuenta está lista. El tablero queda vacío hasta que sincronices. Si pasan 7 días sin sincronizar, la cuenta se borra.'
    };
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

export async function actualizarCuentaAction(
  usuarioInput: string,
  passActualInput: string,
  usuarioNuevoInput: string,
  passNuevaInput: string
): Promise<RespuestaAction> {
  const usuario = String(usuarioInput || '').trim();
  const passActual = String(passActualInput || '');
  const usuarioNuevo = String(usuarioNuevoInput || '').trim();
  const passNueva = String(passNuevaInput || '');
  const claves = usuario ? await obtenerClavesLogin(usuario) : [];
  try {
    if (!usuario || !passActual) {
      return { exito: false, mensaje: 'Completá el usuario y la contraseña actual.' };
    }
    if (claves.length > 0 && await loginEstaBloqueado(claves)) {
      return { exito: false, mensaje: MENSAJE_LOGIN_BLOQUEADO };
    }
    const sesion = await obtenerUsuarioSesion();
    if (sesion && sesion.toLowerCase() !== usuario.toLowerCase()) {
      return { exito: false, mensaje: 'La sesión no es válida. Volvé a iniciar sesión.' };
    }

    const quiereNombre = Boolean(usuarioNuevo) && usuarioNuevo.toLowerCase() !== usuario.toLowerCase();
    const quiereClave = Boolean(passNueva);
    if (!quiereNombre && !quiereClave) {
      return { exito: false, mensaje: 'Escribí un usuario nuevo o una contraseña nueva.' };
    }
    if (quiereNombre) {
      const errorNombre = nombreDeUsuarioValido(usuarioNuevo);
      if (errorNombre) return { exito: false, mensaje: errorNombre };
    }
    if (quiereClave && (passNueva.length < 6 || passNueva.length > MAX_PASSWORD_LENGTH)) {
      return { exito: false, mensaje: 'La contraseña tiene que tener entre 6 y 128 caracteres.' };
    }

    const cuenta = await db.execute({
      sql: `SELECT id, nombre, password, rol, sesion_version, COALESCE(origen, 'comision') AS origen
            FROM alumnos WHERE LOWER(nombre) = LOWER(?)`,
      args: [usuario]
    });
    const fila = cuenta.rows[0];
    if (!fila || !await verificarPassword(passActual, textoONull(fila.password))) {
      if (claves.length > 0) await registrarFalloLogin(claves);
      return { exito: false, mensaje: 'La contraseña actual es incorrecta.' };
    }
    const id = texto(fila.id);
    const nombreActual = texto(fila.nombre);
    if (quiereNombre) {
      const ocupado = await db.execute({
        sql: 'SELECT 1 FROM alumnos WHERE LOWER(nombre) = LOWER(?) AND id != ?',
        args: [usuarioNuevo, id]
      });
      if (ocupado.rows.length > 0) return { exito: false, mensaje: 'Ese usuario ya existe.' };
    }

    const nombreFinal = quiereNombre ? usuarioNuevo : nombreActual;
    const sentencias = quiereNombre ? sentenciasRenombrarAlumno(id, nombreActual, nombreFinal) : [];
    if (quiereClave) {
      sentencias.push({
        sql: 'UPDATE alumnos SET password = ?, sesion_version = COALESCE(sesion_version, 1) + 1 WHERE id = ?',
        args: [await hashearPassword(passNueva), id]
      });
    }
    if (sentencias.length > 0) await db.batch(sentencias, 'write');

    const version = await db.execute({
      sql: 'SELECT sesion_version FROM alumnos WHERE id = ?',
      args: [id]
    });
    const nuevaVersion = Number(version.rows[0]?.sesion_version || 1);
    await establecerSesion(nombreFinal, nuevaVersion);
    if (claves.length > 0) await limpiarIntentosLogin(claves);
    await registrarAuditoria({
      accion: quiereNombre ? 'cambiar_usuario' : 'cambiar_password',
      usuario: nombreFinal,
      detalle: quiereNombre ? `Cambió el usuario ${nombreActual}` : 'Cambio de contraseña',
      ip: await obtenerIPReal()
    });
    return {
      exito: true,
      usuario: nombreFinal,
      rol: texto(fila.rol) || 'alumno',
      origen: texto(fila.origen) || 'comision',
      mensaje: quiereNombre && quiereClave
        ? 'Usuario y contraseña actualizados.'
        : quiereNombre
          ? 'Usuario actualizado.'
          : 'Contraseña actualizada.'
    };
  } catch (error) {
    if (esNombreRepetido(error)) return { exito: false, mensaje: 'Ese usuario ya existe.' };
    console.error('Error en actualizarCuentaAction:', error instanceof Error ? error.message : 'falló');
    return { exito: false, mensaje: 'No se pudo actualizar la cuenta.' };
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

    await db.batch(sentenciasRenombrarAlumno(alumnoActual.id, alumnoActual.nombre, nuevoFormateado), 'write');
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
      ...sentenciasBorrarAlumno(alumnoActual.id, alumnoActual.nombre),
      sentenciaLimpiarGruposVacios()
    ], 'write');
    await registrarAuditoria({ accion: 'eliminar_alumno', usuario: usuarioSesion, detalle: `Eliminó al alumno ${alumnoActual.nombre}`, ip: await obtenerIPReal() });
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarAlumnoAction:', error);
    return { exito: false, mensaje: 'No se pudo eliminar el alumno.' };
  }
}

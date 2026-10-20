'use server';

import {
  texto,
  obtenerIPReal,
  verificarRateLimitEscritura,
  registrarAuditoria,
  obtenerUsuarioSesion,
  verificarAdmin,
  normalizarDni,
  loginEstaBloqueado,
  registrarFalloLogin,
  limpiarIntentosLogin,
  MENSAJE_LOGIN_BLOQUEADO,
  LIMITE_LOGIN_USUARIO,
  LIMITE_LOGIN_IP,
  MAX_PASSWORD_LENGTH,
  MAX_USUARIO_LENGTH
} from '../../server/action-internals';

export interface OpcionConstancia {
  valor: string;
  etiqueta: string;
}

export interface TipoConstanciaSiu {
  clave: string;
  valor: string;
  formulario: string;
  etiqueta: string;
  copias: number;
}

export interface RespuestaConstanciasSiu {
  exito: boolean;
  mensaje?: string;
  tipos?: TipoConstanciaSiu[];
  anios?: OpcionConstancia[];
  turnos?: OpcionConstancia[];
  actividades?: OpcionConstancia[];
  mesas?: OpcionConstancia[];
  solicitudes?: Array<{
    constancia: string;
    fecha: string;
    presentar: string;
    solicitadoEn: string;
    copias: string;
    estado: string;
    vencimiento: string;
    comprobante: string;
  }>;
}

export interface RespuestaDescargaComprobante {
  exito: boolean;
  mensaje?: string;
  nombreArchivo?: string;
  base64?: string;
}

async function clienteSiu(usuario: string, contrasena: string) {
  // @ts-expect-error módulo ESM del sync SIU
  const { crearClienteSIU } = await import('../../../siu-sync/lib/red.mjs');
  return crearClienteSIU({ usuario, contrasena, rutaSesion: null });
}

function credencialesOk(usuario: string, contrasena: string) {
  return Boolean(usuario?.trim()) && Boolean(contrasena) && usuario.length <= MAX_USUARIO_LENGTH && contrasena.length <= MAX_PASSWORD_LENGTH;
}

/**
 * Credenciales a usar: las que envía el usuario o, si es el administrador y
 * noiautenticó, las del servidor (SIU_USER / SIU_PASSWORD del entorno).
 */
async function credencialesSiu(usuarioInput: string, passwordInput: string) {
  const usuario = normalizarDni(usuarioInput);
  const contrasena = String(passwordInput || '');
  if (credencialesOk(usuario, contrasena)) return { usuario, contrasena, delServidor: false };
  if (await verificarAdmin()) {
    const usuarioServidor = String(process.env.SIU_USER || '').trim();
    const contrasenaServidor = String(process.env.SIU_PASSWORD || '');
    if (credencialesOk(usuarioServidor, contrasenaServidor)) {
      return { usuario: usuarioServidor, contrasena: contrasenaServidor, delServidor: true };
    }
  }
  return { usuario, contrasena, delServidor: false };
}

/** Datos que necesita el formulario: tipos de constancia, años, turnos, actividades y mesas. */
export async function cargarDatosConstanciasSiuAction(
  usuarioInput: string,
  passwordInput: string
): Promise<RespuestaConstanciasSiu> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const { usuario, contrasena } = await credencialesSiu(usuarioInput, passwordInput);
    if (!credencialesOk(usuario, contrasena)) {
      return { exito: false, mensaje: 'Completá el usuario y la contraseña de SIU Guaraní.' };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    // @ts-expect-error módulo ESM del sync SIU
    const mod = await import('../../../siu-sync/lib/constancias.mjs');
    const { listarTiposConstancia, listarAniosAcademicos, listarTurnosExamen, listarActividadesExamen, listarMesasExamen, listarSolicitudesSiu } = mod;

    const cliente = await clienteSiu(usuario, contrasena);
    await cliente.autenticar();

    const tipos = await listarTiposConstancia(cliente);
    const anios = await listarAniosAcademicos(cliente);
    const anioActual = String(new Date().getFullYear());
    const turnos = await listarTurnosExamen(cliente, anioActual);
    const actividades = await listarActividadesExamen(cliente, anioActual, '');
    const mesas = await listarMesasExamen(cliente, { anioAcademico: anioActual, turnoExamen: '', actividad: '' });
    const solicitudes = await listarSolicitudesSiu(cliente);

    return { exito: true, tipos, anios, turnos, actividades, mesas, solicitudes };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    console.error('Error en cargarDatosConstanciasSiuAction:', mensaje || 'falló');
    if (mensaje.includes('incorrectas') || mensaje.includes('Credenciales')) {
      return { exito: false, mensaje: 'SIU Guaraní no aceptó ese usuario o contraseña.' };
    }
    if (mensaje.includes('mantenimiento') || mensaje.includes('saturado') || mensaje.includes('tardó demasiado')) {
      return { exito: false, mensaje };
    }
    return { exito: false, mensaje: 'No se pudo conectar con SIU Guaraní.' };
  }
}

/** Filtro de examen final: mesa de examen para el año/turno/actividad elegidos. */
export async function cargarMesasExamenSiuAction(
  usuarioInput: string,
  passwordInput: string,
  anioAcademico: string,
  turnoExamen: string,
  actividad: string
): Promise<RespuestaConstanciasSiu> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const { usuario, contrasena } = await credencialesSiu(usuarioInput, passwordInput);
    if (!credencialesOk(usuario, contrasena)) {
      return { exito: false, mensaje: 'Completá el usuario y la contraseña de SIU Guaraní.' };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    // @ts-expect-error módulo ESM del sync SIU
    const { listarMesasExamen } = await import('../../../siu-sync/lib/constancias.mjs');
    const cliente = await clienteSiu(usuario, contrasena);
    await cliente.autenticar();
    const mesas = await listarMesasExamen(cliente, { anioAcademico, turnoExamen, actividad });
    return { exito: true, mesas };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    console.error('Error en cargarMesasExamenSiuAction:', mensaje || 'falló');
    return { exito: false, mensaje: 'No se pudieron cargar las mesas de examen.' };
  }
}

/** Alta de la solicitud de constancia en SIU Guaraní. */
export async function solicitarConstanciaSiuAction(
  usuarioInput: string,
  passwordInput: string,
  datos: {
    tipoClave: string;
    copias?: number;
    presentar: string;
    observaciones?: string;
    filtro?: { campo?: string; valor?: string } | null;
  }
): Promise<RespuestaConstanciasSiu> {
  const presentar = String(datos?.presentar || '').trim();
  let claves: { clave: string; limite: number }[] = [];
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const { usuario, contrasena, delServidor } = await credencialesSiu(usuarioInput, passwordInput);
    if (!credencialesOk(usuario, contrasena)) {
      return { exito: false, mensaje: 'Completá el usuario y la contraseña de SIU Guaraní.' };
    }
    if (!presentar) return { exito: false, mensaje: 'Indicá a quién se presenta la constancia.' };
    // Con credenciales del servidor no se cuentan los intentos de login del usuario.
    if (!delServidor) {
      claves = [
        { clave: `siu:${usuarioSesion.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO },
        { clave: `siu-ip:${await obtenerIPReal()}`, limite: LIMITE_LOGIN_IP }
      ];
      if (await loginEstaBloqueado(claves)) {
        return { exito: false, mensaje: MENSAJE_LOGIN_BLOQUEADO };
      }
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    // @ts-expect-error módulo ESM del sync SIU
    const { solicitarConstanciaSiu, listarSolicitudesSiu } = await import('../../../siu-sync/lib/constancias.mjs');
    const cliente = await clienteSiu(usuario, contrasena);
    await cliente.autenticar();

    await solicitarConstanciaSiu(cliente, {
      tipoClave: datos.tipoClave,
      copias: Math.max(1, Math.min(10, Number(datos.copias) || 1)),
      presentar,
      observaciones: datos.observaciones || '',
      filtro: datos.filtro || null
    });

    const solicitudes = await listarSolicitudesSiu(cliente);
    await limpiarIntentosLogin(claves);
    await registrarAuditoria({
      accion: 'solicitar_constancia_siu',
      usuario: usuarioSesion,
      detalle: `Constancia «${datos.tipoClave}» para «${texto(presentar)}»`,
      ip: await obtenerIPReal()
    });

    return {
      exito: true,
      mensaje: 'Solicitud registrada en SIU Guaraní.',
      solicitudes
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    const rechazo = mensaje.includes('incorrectas') || mensaje.includes('Credenciales');
    if (rechazo && claves.length > 0) await registrarFalloLogin(claves);
    console.error('Error en solicitarConstanciaSiuAction:', rechazo ? 'SIU rechazó el acceso' : mensaje || 'falló');
    if (rechazo) return { exito: false, mensaje: 'SIU Guaraní no aceptó ese usuario o contraseña.' };
    if (mensaje && mensaje.length <= 200 && !/^\s*at\s/m.test(mensaje)) {
      return { exito: false, mensaje };
    }
    return { exito: false, mensaje: 'No se pudo registrar la solicitud en SIU Guaraní.' };
  }
}

/**
 * Descarga el PDF de un comprobante de constancia.
 * El enlace de SIU necesita la sesión del alumno: se abre con las mismas
 * credenciales con las que se conectó el modal.
 */
export async function descargarComprobanteSiuAction(
  usuarioInput: string,
  passwordInput: string,
  datos: { url: string; nombre?: string }
): Promise<RespuestaDescargaComprobante> {
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const { usuario, contrasena } = await credencialesSiu(usuarioInput, passwordInput);
    if (!credencialesOk(usuario, contrasena)) {
      return { exito: false, mensaje: 'Completá el usuario y la contraseña de SIU Guaraní.' };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    // @ts-expect-error módulo ESM del sync SIU
    const { descargarComprobanteSiu } = await import('../../../siu-sync/lib/constancias.mjs');
    const cliente = await clienteSiu(usuario, contrasena);
    await cliente.autenticar();

    const descarga = await descargarComprobanteSiu(cliente, {
      url: String(datos?.url || ''),
      nombre: datos?.nombre || 'constancia'
    });
    if (!descarga.ok) return { exito: false, mensaje: descarga.mensaje };

    await registrarAuditoria({
      accion: 'descargar_comprobante_siu',
      usuario: usuarioSesion,
      detalle: `Descargó el comprobante «${texto(descarga.nombreArchivo)}»`,
      ip: await obtenerIPReal()
    });

    return {
      exito: true,
      nombreArchivo: descarga.nombreArchivo,
      base64: descarga.base64
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    console.error('Error en descargarComprobanteSiuAction:', mensaje || 'falló');
    return { exito: false, mensaje: 'No se pudo descargar el comprobante de SIU Guaraní.' };
  }
}

'use server';

import { db } from '../turso';
import type { RespuestaAction, RespuestaSiuSync } from './types';
import {
  texto,
  obtenerIPReal,
  verificarRateLimitEscritura,
  registrarAuditoria,
  obtenerUsuarioSesion,
  verificarAdmin,
  obtenerAlumno,
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
import { asegurarEsquemaCuentasEnServidor } from '../../server/asegurar-esquema-cuentas';
import { mensajeDesdeInforme } from '../../lib/informe-sync-ugr';
import { propagarNotaGrupalTrasCargaCampus } from '../../lib/grupos-tareas';
import { sincronizarCursadaDelAlumno } from '../../server/sync-ugr-cursada';

// Admin: usa SIU_USER / SIU_PASSWORD del servidor (atajo sin tipear clave).
export async function syncSiuAction(): Promise<RespuestaSiuSync> {
  try {
    if (!await verificarAdmin()) {
      return { exito: false, mensaje: 'Solo el administrador puede usar el atajo SIU del servidor.' };
    }
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const alumnoDB = await obtenerAlumno(usuarioSesion);
    if (!alumnoDB) return { exito: false, mensaje: 'No encontramos tu usuario en el tablero.' };

    // @ts-expect-error módulo ESM del sync SIU
    const { conectarSIU } = await import('../../../siu-sync/lib/sync-core.mjs');
    const cliente = await conectarSIU();
    const { importarPlanSiuDesdeCliente } = await import('../../lib/importar-plan-siu');
    const importado = await importarPlanSiuDesdeCliente(db, alumnoDB, cliente);

    await registrarAuditoria({
      accion: 'sync_siu',
      usuario: usuarioSesion,
      detalle: `Sincronizó SIU Guaraní (admin): ${importado.notasCargadas.length} nota(s) nueva(s), ${importado.notasYaCargadas.length} ya cargada(s)`,
      ip: await obtenerIPReal()
    });

    return { exito: true, ...importado };
  } catch (error) {
    console.error('Error en syncSiuAction:', error);
    return { exito: false, mensaje: error instanceof Error ? error.message : 'No se pudo sincronizar con SIU Guaraní.' };
  }
}

// Cualquier alumno: DNI y clave de SIU solo en memoria para importar su plan.
export async function sincronizarCuentaSiuAction(usuarioInput: string, passwordInput: string): Promise<RespuestaSiuSync> {
  const usuarioSiu = normalizarDni(usuarioInput);
  const contrasena = String(passwordInput || '');
  if (!usuarioSiu.trim() && !contrasena.trim() && await verificarAdmin()) {
    return syncSiuAction();
  }
  let claves: { clave: string; limite: number }[] = [];
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    if (!usuarioSiu || !contrasena || usuarioSiu.length > MAX_USUARIO_LENGTH || contrasena.length > MAX_PASSWORD_LENGTH) {
      return { exito: false, mensaje: 'Completá el usuario y la contraseña de SIU Guaraní.' };
    }
    if (usuarioSiu.length < 6) {
      return { exito: false, mensaje: 'El usuario de SIU Guaraní no es válido.' };
    }
    claves = [
      { clave: `siu:${usuarioSesion.toLowerCase()}`, limite: LIMITE_LOGIN_USUARIO },
      { clave: `siu-ip:${await obtenerIPReal()}`, limite: LIMITE_LOGIN_IP }
    ];
    if (await loginEstaBloqueado(claves)) {
      return { exito: false, mensaje: MENSAJE_LOGIN_BLOQUEADO };
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const alumnoDB = await obtenerAlumno(usuarioSesion);
    if (!alumnoDB) return { exito: false, mensaje: 'No se encontró la cuenta.' };

    // @ts-expect-error módulo ESM del sync SIU
    const { crearClienteSIU } = await import('../../../siu-sync/lib/red.mjs');
    const cliente = await crearClienteSIU({ usuario: usuarioSiu, contrasena, rutaSesion: null });
    await cliente.autenticar();

    const { importarPlanSiuDesdeCliente } = await import('../../lib/importar-plan-siu');
    const importado = await importarPlanSiuDesdeCliente(db, alumnoDB, cliente);

    await limpiarIntentosLogin(claves);
    await registrarAuditoria({
      accion: 'sincronizar_siu_cuenta',
      usuario: usuarioSesion,
      detalle: importado.mensaje,
      ip: await obtenerIPReal()
    });

    return { exito: true, ...importado };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    const rechazo = mensaje.includes('incorrectas') || mensaje.includes('Credenciales');
    if (rechazo && claves.length > 0) await registrarFalloLogin(claves);
    console.error('Error en sincronizarCuentaSiuAction:', rechazo ? 'SIU rechazó el acceso' : mensaje || 'falló');
    if (rechazo) return { exito: false, mensaje: 'SIU Guaraní no aceptó ese usuario o contraseña.' };
    if (mensaje.includes('mantenimiento') || mensaje.includes('saturado') || mensaje.includes('tardó demasiado')) {
      return { exito: false, mensaje };
    }
    return { exito: false, mensaje: 'No se pudo sincronizar con SIU Guaraní.' };
  }
}

// Cada alumno trae su cursada del período actual. Las materias, tareas,
// parciales y eventos se guardan una sola vez: el siguiente de la misma
// materia los ve. DNI y clave de UGR no se persisten.
export async function sincronizarCuentaUgrAction(dniInput: string, passwordUgrInput: string): Promise<RespuestaAction> {
  const dni = normalizarDni(dniInput);
  const contrasena = String(passwordUgrInput || '');
  const usarCredencialesServidor = !dni && !contrasena && await verificarAdmin();
  let claves: { clave: string; limite: number }[] = [];
  try {
    const usuarioSesion = await obtenerUsuarioSesion();
    if (!usuarioSesion) return { exito: false, mensaje: 'La sesión no es válida.' };
    if (!usarCredencialesServidor) {
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
    }
    const rateLimit = await verificarRateLimitEscritura(usuarioSesion);
    if (!rateLimit.exito) return rateLimit;

    const resultado = await db.execute({
      sql: 'SELECT id FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [usuarioSesion]
    });
    const alumnoId = texto(resultado.rows[0]?.id);
    if (!alumnoId) return { exito: false, mensaje: 'No se encontró la cuenta.' };

    await asegurarEsquemaCuentasEnServidor();

    const { conectarUGR, conectarUGRCon } = await import('../../../ugr-sync/lib/sync-core.mjs');
    const cliente = usarCredencialesServidor
      ? await conectarUGR()
      : await conectarUGRCon({
        usuario: dni,
        contrasena,
        rutaSesion: null
      });
    const clienteUgr = cliente as { autenticar?: () => Promise<unknown> };
    if (typeof clienteUgr.autenticar === 'function') await clienteUgr.autenticar();
    const sync = await sincronizarCursadaDelAlumno({
      alumnoId,
      alumnoNombre: usuarioSesion,
      cliente
    });
    const lineasInforme = [...sync.lineasInforme];
    for (const nota of sync.notasCampus) {
      if (!nota.tareaId) continue;
      const grupo = await propagarNotaGrupalTrasCargaCampus(db, nota.tareaId, alumnoId);
      if (nota.yaEstaba || !grupo || grupo.integrantesActualizados.length === 0) continue;
      const nombres = grupo.integrantesGrupo.join(', ');
      lineasInforme.push(
        `Tarea grupal «${grupo.tareaNombre}»: al ser trabajo en grupo, la nota ${grupo.nota} quedó para todo el grupo (${nombres}).`
      );
    }
    const materiasSync = Math.max(sync.materiasInscriptas?.length || 0, 1);
    const ahoraIso = new Date().toISOString();
    await db.execute({
      sql: `UPDATE alumnos SET sincronizado_en = COALESCE(NULLIF(sincronizado_en, ''), ?), ultimo_acceso = ? WHERE id = ?`,
      args: [ahoraIso, ahoraIso, alumnoId]
    });

    if (claves.length > 0) await limpiarIntentosLogin(claves);
    await registrarAuditoria({
      accion: usarCredencialesServidor ? 'sincronizar_cuenta_servidor' : 'sincronizar_cuenta',
      usuario: usuarioSesion,
      detalle: sync.mensaje,
      ip: await obtenerIPReal()
    });

    return {
      exito: true,
      mensaje: mensajeDesdeInforme(lineasInforme, materiasSync),
      informeLineas: lineasInforme,
      resumen: sync.resumen,
      materiasInscriptas: sync.materiasInscriptas
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error || '');
    const esMantenimientoOTimeout =
      mensaje.includes('mantenimiento') ||
      mensaje.includes('fuera de servicio') ||
      mensaje.includes('saturado') ||
      mensaje.includes('tiempo de espera') ||
      mensaje.includes('tardó demasiado');
    const rechazo = !esMantenimientoOTimeout && (mensaje.startsWith('Login rechazado') || mensaje.includes('logintoken'));
    if (rechazo && claves.length > 0) await registrarFalloLogin(claves);
    console.error('Error en sincronizarCuentaUgrAction:', rechazo ? 'UGR Virtual rechazó el acceso' : mensaje || 'falló');
    if (rechazo) return { exito: false, mensaje: 'UGR Virtual no aceptó ese DNI o contraseña.' };
    if (esMantenimientoOTimeout || mensaje.includes('no mostró materias')) return { exito: false, mensaje };
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(mensaje)) {
      return { exito: false, mensaje: 'No pudimos conectar con UGR Virtual. Probá de nuevo en unos minutos.' };
    }
    if (mensaje && mensaje.length <= 200 && !/^\s*at\s/m.test(mensaje)) {
      return { exito: false, mensaje };
    }
    return { exito: false, mensaje: 'No se pudo sincronizar con UGR Virtual.' };
  }
}

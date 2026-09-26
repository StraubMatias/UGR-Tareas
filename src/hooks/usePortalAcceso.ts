import { startTransition, useCallback, useEffect, useRef, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  cerrarSesionAction,
  obtenerSesionAction,
  registrarCuentaAction,
  validarLoginAction,
  actualizarCuentaAction
} from '../app/actions';

interface UsePortalAccesoOptions {
  setIniciado: Dispatch<SetStateAction<boolean>>;
  setUsuarioActual: Dispatch<SetStateAction<string | null>>;
  setRolUsuario: Dispatch<SetStateAction<string | null>>;
  setOrigenCuenta: Dispatch<SetStateAction<string | null>>;
  setUgrUsuarioCuenta: Dispatch<SetStateAction<string | null>>;
  setMostrarAvisoInicio: Dispatch<SetStateAction<boolean>>;
  inputUser: string;
  inputPass: string;
  registroPass: string;
  registroConfirmacion: string;
  setInputUser: Dispatch<SetStateAction<string>>;
  setInputPass: Dispatch<SetStateAction<string>>;
  setRegistroPass: Dispatch<SetStateAction<string>>;
  setRegistroConfirmacion: Dispatch<SetStateAction<string>>;
  setErrorLogin: Dispatch<SetStateAction<string>>;
  setEnviandoAcceso: Dispatch<SetStateAction<boolean>>;
  usuarioActual: string | null;
  userPassChange: string;
  currentPassChange: string;
  nuevoUserChange: string;
  newPassChange: string;
  setUserPassChange: Dispatch<SetStateAction<string>>;
  setNuevoUserChange: Dispatch<SetStateAction<string>>;
  setCurrentPassChange: Dispatch<SetStateAction<string>>;
  setNewPassChange: Dispatch<SetStateAction<string>>;
  setMsgPassChange: Dispatch<SetStateAction<{ tipo: string; texto: string }>>;
  setModalPasswordOpen: Dispatch<SetStateAction<boolean>>;
  cargarBD: (mostrarCarga?: boolean) => Promise<boolean>;
}

export function usePortalAcceso(opts: UsePortalAccesoOptions) {
  const optsRef = useRef(opts);

  useEffect(() => {
    optsRef.current = opts;
  });

  const iniciarSesionLocal = useCallback((usuario: string, rol: string, origen = 'comision', ugrUsuario: string | null = null) => {
    const o = optsRef.current;
    o.setUsuarioActual(usuario);
    o.setRolUsuario(rol);
    o.setOrigenCuenta(origen);
    o.setUgrUsuarioCuenta(ugrUsuario);
  }, []);

  const cerrarSesionLocal = useCallback(async () => {
    await cerrarSesionAction();
    const o = optsRef.current;
    o.setUsuarioActual(null);
    o.setRolUsuario(null);
    o.setOrigenCuenta(null);
    o.setUgrUsuarioCuenta(null);
  }, []);

  useEffect(() => {
    let cancelado = false;
    const restaurarSesion = async () => {
      try {
        const sesion = await obtenerSesionAction();
        if (!cancelado && sesion?.usuario) {
          startTransition(() => {
            const o = optsRef.current;
            o.setUsuarioActual(sesion.usuario);
            o.setRolUsuario(sesion.rol);
            o.setOrigenCuenta(sesion.origen || 'comision');
            o.setUgrUsuarioCuenta(sesion.ugrUsuario || null);
            o.setMostrarAvisoInicio(true);
          });
        }
      } catch (error) {
        console.error('No se pudo restaurar la sesión:', error);
      } finally {
        if (!cancelado) {
          startTransition(() => optsRef.current.setIniciado(true));
        }
      }
    };
    restaurarSesion();
    return () => { cancelado = true; };
  }, []);

  const handleRegistro = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const o = optsRef.current;
    o.setErrorLogin('');
    o.setEnviandoAcceso(true);
    try {
      const res = await registrarCuentaAction(o.inputUser, o.registroPass, o.registroConfirmacion);
      if (res.exito && res.usuario) {
        iniciarSesionLocal(res.usuario, res.rol || 'alumno', res.origen || 'propio', null);
        o.setInputUser('');
        o.setRegistroPass('');
        o.setRegistroConfirmacion('');
        return;
      }
      o.setErrorLogin(res.mensaje || 'No se pudo crear la cuenta.');
    } finally {
      o.setEnviandoAcceso(false);
    }
  }, [iniciarSesionLocal]);

  const handleLogin = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const o = optsRef.current;
    if (!o.inputUser.trim() || !o.inputPass.trim()) return;
    o.setEnviandoAcceso(true);
    try {
      const res = await validarLoginAction(o.inputUser, o.inputPass);
      if (res.exito && res.usuario) {
        iniciarSesionLocal(res.usuario, res.rol || 'alumno', res.origen || 'comision', res.ugrUsuario || null);
        o.setMostrarAvisoInicio(true);
        o.setErrorLogin('');
        o.setInputUser('');
        o.setInputPass('');
      } else {
        o.setErrorLogin(res.mensaje || 'No se pudo iniciar sesión.');
      }
    } finally {
      o.setEnviandoAcceso(false);
    }
  }, [iniciarSesionLocal]);

  const handleCambiarPassword = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const o = optsRef.current;
    o.setMsgPassChange({ tipo: '', texto: '' });
    const res = await actualizarCuentaAction(o.userPassChange, o.currentPassChange, o.nuevoUserChange, o.newPassChange);
    if (res.exito && res.usuario) {
      if (!o.usuarioActual) {
        iniciarSesionLocal(res.usuario, res.rol || 'alumno', res.origen || 'comision', null);
      } else if (res.usuario !== o.usuarioActual) {
        o.setUsuarioActual(res.usuario);
        void o.cargarBD(false);
      }
      o.setMsgPassChange({ tipo: 'exito', texto: res.mensaje || 'Cuenta actualizada.' });
      setTimeout(() => {
        const c = optsRef.current;
        c.setModalPasswordOpen(false);
        c.setUserPassChange('');
        c.setNuevoUserChange('');
        c.setCurrentPassChange('');
        c.setNewPassChange('');
        c.setMsgPassChange({ tipo: '', texto: '' });
      }, 1500);
    } else {
      o.setMsgPassChange({ tipo: 'error', texto: res.mensaje || 'No se pudo cambiar la contraseña.' });
    }
  }, [iniciarSesionLocal]);

  return {
    iniciarSesionLocal,
    cerrarSesionLocal,
    handleRegistro,
    handleLogin,
    handleCambiarPassword
  };
}

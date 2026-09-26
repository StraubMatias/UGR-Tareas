import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { obtenerEstadoCompleto } from '../app/actions';
import {
  aplicarEstadoTablero,
  type AplicarEstadoTableroCallbacks,
  type EstadoCompletoTablero
} from '../lib/aplicar-estado-tablero';

interface UseTableroCargaOptions extends AplicarEstadoTableroCallbacks {
  periodoSeleccionado: string;
  setPeriodoSeleccionado: (id: string) => void;
  periodoEspejoRef: MutableRefObject<boolean>;
  usuarioActual: string | null;
  setCargando: (v: boolean) => void;
  setUsuarioActual: (u: string | null) => void;
  pausarRefrescoRef: MutableRefObject<boolean>;
  refrescandoRef: MutableRefObject<boolean>;
}

export function useTableroCarga(options: UseTableroCargaOptions) {
  const {
    periodoSeleccionado,
    setPeriodoSeleccionado,
    periodoEspejoRef,
    usuarioActual,
    setCargando,
    setUsuarioActual,
    pausarRefrescoRef,
    refrescandoRef
  } = options;

  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const aplicarEstado = useCallback((estado: EstadoCompletoTablero | null | undefined) => {
    aplicarEstadoTablero(estado, optionsRef.current);
  }, []);

  const cargarBD = useCallback(async (mostrarCarga = true): Promise<boolean> => {
    if (mostrarCarga) setCargando(true);
    try {
      const estado = await obtenerEstadoCompleto(periodoSeleccionado || undefined);
      if (!estado) return false;

      if (!periodoSeleccionado && estado.periodoActivo) {
        periodoEspejoRef.current = true;
        setPeriodoSeleccionado(estado.periodoActivo);
      }
      aplicarEstado(estado);
      return true;
    } finally {
      if (mostrarCarga) setCargando(false);
    }
  }, [periodoSeleccionado, aplicarEstado, periodoEspejoRef, setPeriodoSeleccionado, setCargando]);

  useEffect(() => {
    if (!usuarioActual) {
      periodoEspejoRef.current = false;
      return;
    }
    if (periodoEspejoRef.current) {
      periodoEspejoRef.current = false;
      return;
    }
    cargarBD();
  }, [usuarioActual, cargarBD, periodoEspejoRef]);

  useEffect(() => {
    if (!usuarioActual) return undefined;

    const o = optionsRef.current;
    let cancelado = false;
    let ultimoRefresco = 0;
    const refrescarSiVisible = async () => {
      const escribiendo = document.activeElement instanceof HTMLInputElement
        || document.activeElement instanceof HTMLTextAreaElement
        || document.activeElement instanceof HTMLSelectElement;
      if (
        cancelado
        || document.visibilityState !== 'visible'
        || refrescandoRef.current
        || pausarRefrescoRef.current
        || escribiendo
        || Date.now() - ultimoRefresco < 15_000
      ) return;

      ultimoRefresco = Date.now();
      refrescandoRef.current = true;
      try {
        const sesionValida = await cargarBD(false);
        if (!cancelado && !sesionValida) {
          setUsuarioActual(null);
          o.setRolUsuario(null);
          o.setOrigenCuenta(null);
          o.setUgrUsuarioCuenta(null);
          setCargando(false);
        }
      } finally {
        refrescandoRef.current = false;
      }
    };

    const intervalo = window.setInterval(refrescarSiVisible, 120_000);
    const alVolverALaPestana = () => {
      if (document.visibilityState === 'visible') refrescarSiVisible();
    };
    document.addEventListener('visibilitychange', alVolverALaPestana);
    window.addEventListener('focus', alVolverALaPestana);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolverALaPestana);
      window.removeEventListener('focus', alVolverALaPestana);
    };
  }, [
    usuarioActual,
    cargarBD,
    pausarRefrescoRef,
    refrescandoRef,
    setUsuarioActual,
    setCargando
  ]);

  return { cargarBD, aplicarEstado };
}

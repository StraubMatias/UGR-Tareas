import { useCallback, useEffect, useRef, useState } from 'react';

const MS_POR_PUNTO = 320;
/** Mientras espera un paso largo del servidor, puede avanzar un poco más que el hito real (sin llegar a 100). */
const MARGEN_ESPERA = 9;

/**
 * Barra entera 0→100: sube de a 1 % según el hito real del sync y un avance lento si tarda el servidor.
 */
export function useProgresoSyncSuave(activo: boolean, objetivo: number | null) {
  const [visible, setVisible] = useState(0);
  const visibleRef = useRef(0);
  const objetivoRef = useRef(0);

  useEffect(() => {
    visibleRef.current = activo ? visible : 0;
  }, [visible, activo]);

  useEffect(() => {
    objetivoRef.current = Math.max(0, Math.min(100, objetivo ?? 0));
  }, [objetivo]);

  useEffect(() => {
    if (!activo) {
      visibleRef.current = 0;
      objetivoRef.current = 0;
      return undefined;
    }

    const reinicio = window.requestAnimationFrame(() => {
      setVisible(0);
      visibleRef.current = 0;
    });

    const intervalo = window.setInterval(() => {
      setVisible((prev) => {
        if (prev >= 100) return 100;
        const meta = objetivoRef.current;
        const techo = meta >= 100 ? 100 : Math.min(99, meta + MARGEN_ESPERA);
        if (prev < techo) return prev + 1;
        return prev;
      });
    }, MS_POR_PUNTO);

    return () => {
      window.cancelAnimationFrame(reinicio);
      window.clearInterval(intervalo);
    };
  }, [activo]);

  const esperarBarraAlCompleto = useCallback(async (topeMs = 14_000) => {
    const inicio = Date.now();
    while (visibleRef.current < 100 && Date.now() - inicio < topeMs) {
      await new Promise((resolver) => window.setTimeout(resolver, MS_POR_PUNTO / 2));
    }
  }, []);

  return { progreso: activo ? visible : 0, esperarBarraAlCompleto };
}

import { useEffect, type RefObject } from 'react';

export function useNotificacionesPortal(
  usuarioActual: string | null,
  notificacionesAbiertas: boolean,
  notificacionesRef: RefObject<HTMLDivElement | null>,
  setNotificacionesVistas: (v: string[]) => void,
  setNotificacionesAbiertas: (v: boolean) => void
) {
  useEffect(() => {
    if (!usuarioActual) {
      setNotificacionesVistas([]);
      return;
    }
    const claveVistas = `ugr_novedades_vistas_${encodeURIComponent(usuarioActual)}`;
    try {
      const guardadas = JSON.parse(localStorage.getItem(claveVistas) || '[]');
      setNotificacionesVistas(Array.isArray(guardadas) ? guardadas : []);
    } catch {
      setNotificacionesVistas([]);
    }
  }, [usuarioActual, setNotificacionesVistas]);

  useEffect(() => {
    if (!notificacionesAbiertas) return undefined;
    const cerrarAlHacerClickAfuera = (evento: PointerEvent) => {
      if (!(evento.target instanceof Node) || !notificacionesRef.current?.contains(evento.target)) {
        setNotificacionesAbiertas(false);
      }
    };
    document.addEventListener('pointerdown', cerrarAlHacerClickAfuera);
    return () => document.removeEventListener('pointerdown', cerrarAlHacerClickAfuera);
  }, [notificacionesAbiertas, notificacionesRef, setNotificacionesAbiertas]);
}

export function marcarNotificacionesVistasEnStorage(
  usuarioActual: string,
  notificacionesVistas: string[],
  ids: string[],
  setNotificacionesVistas: (v: string[]) => void
) {
  if (ids.length === 0) return;
  const idsActualizados = [...new Set([...notificacionesVistas, ...ids])];
  setNotificacionesVistas(idsActualizados);
  localStorage.setItem(
    `ugr_novedades_vistas_${encodeURIComponent(usuarioActual)}`,
    JSON.stringify(idsActualizados)
  );
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { precargarAlInteractuarNav, precargarSyncPortal } from './portal-vista-prefetch';

const btnBase =
  'shrink-0 rounded-lg border text-xs font-semibold transition-all cursor-pointer px-2.5 py-1.5 sm:px-3 sm:py-2';

interface BarraSesionPortalProps {
  campana: ReactNode;
  esAdmin: boolean;
  sincronizadoEn: string | null;
  onAbrirSync: () => void;
  onAbrirSolicitudes: () => void;
  onAbrirPassword: () => void;
  onAbrirAdmin: () => void;
  onSalir: () => void;
}

export default function BarraSesionPortal({
  campana,
  esAdmin,
  sincronizadoEn,
  onAbrirSync,
  onAbrirSolicitudes,
  onAbrirPassword,
  onAbrirAdmin,
  onSalir
}: BarraSesionPortalProps) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(intervalo);
  }, []);
  const diasDesdeSync = sincronizadoEn
    ? Math.max(0, Math.floor((ahora - new Date(sincronizadoEn).getTime()) / 86400000))
    : null;
  const diasRestantes = diasDesdeSync === null ? null : Math.max(0, 7 - diasDesdeSync);
  const etiquetaSync = diasRestantes === null
    ? 'Sin sincronización registrada'
    : `${diasRestantes} día${diasRestantes === 1 ? '' : 's'} restantes`;

  return (
    <div className="portal-header-actions flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 w-full min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {campana}
        <button
          type="button"
          onClick={onAbrirSync}
          onPointerEnter={precargarSyncPortal}
          onFocus={precargarSyncPortal}
          onTouchStart={precargarSyncPortal}
          title={`${etiquetaSync}. Sincronizar con UGR Virtual o SIU Guaraní`}
          className={`${btnBase} bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border-cyan-500/40 ${diasRestantes !== null && diasRestantes <= 1 && !esAdmin ? 'animate-pulse border-amber-400 text-amber-200' : ''}`}
        >
          🔄 Sincronizar <span className="ml-1 text-[10px] opacity-80">({etiquetaSync})</span>
        </button>
        <button
          type="button"
          onClick={onAbrirSolicitudes}
          title="Solicitar constancias y certificados"
          className={`${btnBase} bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border-cyan-500/40`}
        >
          📜 Solicitudes
        </button>
        {esAdmin && (
          <button
            type="button"
            onClick={onAbrirAdmin}
            onPointerEnter={() => precargarAlInteractuarNav('admin', false)}
            onFocus={() => precargarAlInteractuarNav('admin', false)}
            onTouchStart={() => precargarAlInteractuarNav('admin', false)}
            className={`${btnBase} bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40`}
          >
            ⚙️ Panel de Carga
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onAbrirPassword}
          className={`${btnBase} bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700`}
        >
          🔑 Usuario o clave
        </button>
        <button
          type="button"
          onClick={onSalir}
          className={`${btnBase} bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 flex items-center gap-1.5`}
        >
          <span aria-hidden="true">🚪</span> Salir
        </button>
      </div>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { precargarAlInteractuarNav, precargarSyncPortal } from './portal-vista-prefetch';

const btnBase =
  'shrink-0 rounded-lg border text-xs font-semibold transition-all cursor-pointer px-2.5 py-1.5 sm:px-3 sm:py-2';

interface BarraSesionPortalProps {
  campana: ReactNode;
  esAdmin: boolean;
  onAbrirSync: () => void;
  onAbrirPassword: () => void;
  onAbrirAdmin: () => void;
  onSalir: () => void;
}

export default function BarraSesionPortal({
  campana,
  esAdmin,
  onAbrirSync,
  onAbrirPassword,
  onAbrirAdmin,
  onSalir
}: BarraSesionPortalProps) {
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
          title="Sincronizar con UGR Virtual o SIU Guaraní"
          className={`${btnBase} bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border-cyan-500/40`}
        >
          🔄 Sincronizar
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

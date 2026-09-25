'use client';

import { precargarAlInteractuarNav, precargarSyncPortal } from './portal-vista-prefetch';

interface BarraSesionPortalProps {
  esAdmin: boolean;
  onAbrirSync: () => void;
  onAbrirPassword: () => void;
  onAbrirAdmin: () => void;
  onSalir: () => void;
}

export default function BarraSesionPortal({
  esAdmin,
  onAbrirSync,
  onAbrirPassword,
  onAbrirAdmin,
  onSalir
}: BarraSesionPortalProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onAbrirPassword}
        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
      >
        🔑 Usuario o clave
      </button>
      <button
        type="button"
        onClick={onAbrirSync}
        onPointerEnter={precargarSyncPortal}
        onFocus={precargarSyncPortal}
        onTouchStart={precargarSyncPortal}
        title="Sincronizar con UGR Virtual o SIU Guaraní"
        className="bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
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
          className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          ⚙️ Panel de Carga
        </button>
      )}
      <button
        type="button"
        onClick={onSalir}
        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
      >
        <span>🚪</span> Salir
      </button>
    </div>
  );
}

'use client';

import { precargarAlInteractuarNav, precargarSyncPortal } from './portal-vista-prefetch';

const btnBase =
  'shrink-0 rounded-lg border text-xs font-semibold transition-all cursor-pointer px-2.5 py-1.5 sm:px-3 sm:py-2';

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
    <>
      <button
        type="button"
        onClick={onAbrirPassword}
        className={`${btnBase} bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700`}
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
      <span className="flex-1 min-w-2 basis-8 sm:basis-auto" aria-hidden="true" />
      <button
        type="button"
        onClick={onSalir}
        className={`${btnBase} bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 flex items-center gap-1.5`}
      >
        <span aria-hidden="true">🚪</span> Salir
      </button>
    </>
  );
}

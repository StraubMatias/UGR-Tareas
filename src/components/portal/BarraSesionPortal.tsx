'use client';

interface BarraSesionPortalProps {
  esAdmin: boolean;
  mensajeSyncCuenta: string;
  onAbrirCuenta: () => void;
  onAbrirPassword: () => void;
  onAbrirSyncUgrAdmin: () => void;
  onAbrirSyncSiuAdmin: () => void;
  onAbrirAdmin: () => void;
  onSalir: () => void;
}

export default function BarraSesionPortal({
  esAdmin,
  mensajeSyncCuenta,
  onAbrirCuenta,
  onAbrirPassword,
  onAbrirSyncUgrAdmin,
  onAbrirSyncSiuAdmin,
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
        onClick={onAbrirCuenta}
        className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
      >
        Sincronizar cuenta
      </button>
      {mensajeSyncCuenta && (
        <span className="self-center text-xs text-emerald-200 max-w-xl leading-snug" title={mensajeSyncCuenta}>
          {mensajeSyncCuenta}
        </span>
      )}
      {esAdmin && (
        <button
          type="button"
          onClick={onAbrirSyncUgrAdmin}
          title="Busca tareas nuevas en UGR Virtual y las carga en la página"
          className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          🔄 Sincronizar UGR
        </button>
      )}
      {esAdmin && (
        <button
          type="button"
          onClick={onAbrirSyncSiuAdmin}
          title="Importa notas del plan con las credenciales SIU del servidor (admin)"
          className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          🎓 Sincronizar SIU (admin)
        </button>
      )}
      {esAdmin && (
        <button
          type="button"
          onClick={onAbrirAdmin}
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

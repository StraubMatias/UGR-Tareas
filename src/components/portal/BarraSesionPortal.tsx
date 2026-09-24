'use client';

interface BarraSesionPortalProps {
  esAdmin: boolean;
  onAbrirSyncCuentaUgr: () => void;
  onAbrirSyncCuentaSiu: () => void;
  onAbrirPassword: () => void;
  onAbrirSyncUgrAdmin: () => void;
  onAbrirSyncSiuAdmin: () => void;
  onAbrirAdmin: () => void;
  onSalir: () => void;
}

export default function BarraSesionPortal({
  esAdmin,
  onAbrirSyncCuentaUgr,
  onAbrirSyncCuentaSiu,
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
      {!esAdmin && (
        <>
          <button
            type="button"
            onClick={onAbrirSyncCuentaUgr}
            title="Traé tu cursada y tareas desde UGR Virtual con tu DNI y clave del campus"
            className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            🔄 Sincronizar UGR
          </button>
          <button
            type="button"
            onClick={onAbrirSyncCuentaSiu}
            title="Importá notas del plan de estudio desde SIU Guaraní"
            className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            🎓 Sincronizar SIU Guaraní
          </button>
        </>
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

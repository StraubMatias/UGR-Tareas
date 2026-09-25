'use client';

interface BarraSesionPortalProps {
  esAdmin: boolean;
  onAbrirSyncCuentaUgr: () => void;
  onAbrirSyncCuentaSiu: () => void;
  onAbrirPassword: () => void;
  onAbrirSyncUgrAdmin: () => void;
  onAbrirAdmin: () => void;
  onSalir: () => void;
}

export default function BarraSesionPortal({
  esAdmin,
  onAbrirSyncCuentaUgr,
  onAbrirSyncCuentaSiu,
  onAbrirPassword,
  onAbrirSyncUgrAdmin,
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
        onClick={onAbrirSyncCuentaUgr}
        title="UGR Virtual con tu DNI y clave: cursada, tareas y notas de tu usuario"
        className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
      >
        🔄 Sincronizar UGR
      </button>
      <button
        type="button"
        onClick={onAbrirSyncCuentaSiu}
        title="SIU Guaraní con tu usuario y clave: importa tu plan de estudio a la pestaña Plan"
        className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
      >
        🎓 Sincronizar SIU Guaraní
      </button>
      {esAdmin && (
        <button
          type="button"
          onClick={onAbrirSyncUgrAdmin}
          title="Importa tareas y avisos del campus para toda la comisión (sin pedir tu clave; usa la sesión del servidor)"
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200/90 border border-emerald-500/25 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          📋 UGR · tablero comisión
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

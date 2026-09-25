import ModalOverlay from './ModalOverlay';

interface ModalElegirSyncFuenteProps {
  onElegirUgr: () => void;
  onElegirSiu: () => void;
  onCerrar: () => void;
}

export default function ModalElegirSyncFuente({ onElegirUgr, onElegirSiu, onCerrar }: ModalElegirSyncFuenteProps) {
  return (
    <ModalOverlay maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Sincronizar</h3>
            <p className="mt-1 text-xs text-slate-400">Elegí con qué sistema querés sincronizar tu cuenta.</p>
          </div>
          <button type="button" onClick={onCerrar} className="text-xs text-slate-400 hover:text-white cursor-pointer">
            Cerrar
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onElegirUgr}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-left hover:bg-emerald-500/15 transition-colors cursor-pointer"
          >
            <span className="text-lg" aria-hidden="true">🔄</span>
            <p className="mt-2 text-sm font-bold text-emerald-100">UGR Virtual</p>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Cursada, tareas y notas del campus con tu DNI y clave.
            </p>
          </button>
          <button
            type="button"
            onClick={onElegirSiu}
            className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 text-left hover:bg-blue-500/15 transition-colors cursor-pointer"
          >
            <span className="text-lg" aria-hidden="true">🎓</span>
            <p className="mt-2 text-sm font-bold text-blue-100">SIU Guaraní</p>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Plan de estudio y notas finales a la pestaña Plan.
            </p>
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

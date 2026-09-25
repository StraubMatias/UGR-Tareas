import type { ReactNode } from 'react';
import type { Periodo } from './types';

interface PortalHeaderProps {
  usuarioActual: string | null;
  diasPagina: number;
  periodos: Periodo[];
  periodoSeleccionado: string;
  onPeriodoChange: (id: string) => void;
  barraSesion?: ReactNode;
}

export default function PortalHeader({
  usuarioActual,
  diasPagina,
  periodos,
  periodoSeleccionado,
  onPeriodoChange,
  barraSesion
}: PortalHeaderProps) {
  return (
    <header className="portal-header max-w-9xl mx-auto mb-3 border border-t-0 px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-b-xl">
      <div className="flex flex-col gap-2 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 w-full min-w-0">
          <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight shrink-0">
            UGR - Tareas y Parciales
          </h1>
          <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] sm:text-xs font-bold text-amber-300">
            {diasPagina} {diasPagina === 1 ? 'día' : 'días'}
          </span>
          {usuarioActual && (
            <strong className="text-cyan-300 font-semibold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md text-xs truncate max-w-[40vw] sm:max-w-[12rem]">
              {usuarioActual}
            </strong>
          )}
          {usuarioActual && periodos.length > 0 && (
            <label className="ml-auto flex items-center shrink-0">
              <span className="sr-only">Período</span>
              <select
                value={periodoSeleccionado}
                onChange={(evento) => onPeriodoChange(evento.target.value)}
                aria-label="Período"
                className="rounded-md border border-cyan-500/30 bg-[#0f141c] px-2 py-1 text-[11px] font-semibold text-cyan-200 outline-none focus:border-cyan-400 max-w-[min(100%,14rem)]"
              >
                {periodos.map((periodo) => (
                  <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {usuarioActual && barraSesion}
      </div>
    </header>
  );
}

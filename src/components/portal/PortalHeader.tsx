import type { RefObject, ReactNode } from 'react';
import type { NovedadTablero, Periodo } from './types';
import CampanaNotificaciones from './CampanaNotificaciones';
interface PortalHeaderProps {
  usuarioActual: string | null;
  diasPagina: number;
  periodos: Periodo[];
  periodoSeleccionado: string;
  onPeriodoChange: (id: string) => void;
  notificaciones: NovedadTablero[];
  notificacionesVistas: string[];
  notificacionesAbiertas: boolean;
  onToggleNotificaciones: () => void;
  onMarcarNotificacionesVistas: (ids: string[]) => void;
  onNavegarDesdeCampana: (pestana: 'parciales' | 'horarios' | 'materias') => void;
  notificacionesRef: RefObject<HTMLDivElement | null>;
  etiquetaMateria: (nombre: string) => string;
  accionesSesion?: ReactNode;
}

export default function PortalHeader({
  usuarioActual,
  diasPagina,
  periodos,
  periodoSeleccionado,
  onPeriodoChange,
  notificaciones,
  notificacionesVistas,
  notificacionesAbiertas,
  onToggleNotificaciones,
  onMarcarNotificacionesVistas,
  onNavegarDesdeCampana,
  notificacionesRef,
  etiquetaMateria,
  accionesSesion
}: PortalHeaderProps) {
  return (
    <header className="portal-header max-w-9xl mx-auto mb-4 border border-t-0 p-4 sm:p-5 rounded-b-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      <div className="min-w-0 w-full">
        <p className="portal-kicker mb-3">Portal de cursada · UGR</p>
        <div className="flex items-start sm:items-center gap-3 mb-1">
          <span className="text-2xl shrink-0" aria-hidden="true">✦</span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            UGR - Tareas y Parciales
          </h1>
          <span className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
            {diasPagina} {diasPagina === 1 ? 'día' : 'días'}
          </span>
        </div>
        <p className="text-sm sm:text-base text-slate-400 flex items-center gap-2 mt-1">
          {usuarioActual ? (
            <>
              <span>Alumno activo:</span>
              <strong className="text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-lg text-sm sm:text-base">
                {usuarioActual}
              </strong>
            </>
          ) : (
            ''
          )}
        </p>
        {usuarioActual && periodos.length > 0 && (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Período
            <select
              value={periodoSeleccionado}
              onChange={(evento) => onPeriodoChange(evento.target.value)}
              className="rounded-lg border border-cyan-500/30 bg-[#0f141c] px-3 py-2 text-xs font-semibold normal-case tracking-normal text-cyan-200 outline-none focus:border-cyan-400"
            >
              {periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {usuarioActual && (
        <div className="portal-header-actions flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <CampanaNotificaciones
            contenedorRef={notificacionesRef}
            notificaciones={notificaciones}
            notificacionesVistas={notificacionesVistas}
            abiertas={notificacionesAbiertas}
            onToggleAbiertas={onToggleNotificaciones}
            onMarcarVistas={onMarcarNotificacionesVistas}
            onNavegar={onNavegarDesdeCampana}
            etiquetaMateria={etiquetaMateria}
          />
          {accionesSesion}
        </div>
      )}
    </header>
  );
}

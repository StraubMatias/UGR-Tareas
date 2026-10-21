'use client';

import type { PortalPestana } from './types';
import { precargarAlInteractuarNav } from './portal-vista-prefetch';

interface PortalNavProps {
  pestana: PortalPestana;
  onNavegar: (destino: PortalPestana) => void;
  /** Abre el modal de material en Drive (igual que el selector de sincronización). */
  onAbrirDrive: () => void;
}

const PESTANAS: { id: PortalPestana; icon: string; label: string; labelSm?: string; activeClass: string }[] = [
  { id: 'alumnos', icon: '👥', label: 'Estado por Alumno', labelSm: 'Estado', activeClass: 'bg-blue-600/20 text-blue-300 border-blue-500/40' },
  { id: 'materias', icon: '📚', label: 'Materias', activeClass: 'bg-blue-600/20 text-blue-300 border-blue-500/40' },
  { id: 'horarios', icon: '🗓️', label: 'Cronograma', activeClass: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40' },
  { id: 'plan', icon: '🧭', label: 'Plan de estudio', labelSm: 'Plan', activeClass: 'bg-amber-600/20 text-amber-300 border-amber-500/40' },
  { id: 'promocion', icon: '🎯', label: 'Promoción', activeClass: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40' },
  { id: 'historial', icon: '🕘', label: 'Historial', activeClass: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40' },
  { id: 'parciales', icon: '📋', label: 'Parciales', activeClass: 'bg-purple-600/20 text-purple-300 border-purple-500/40' },
  { id: 'ranking', icon: '🏆', label: 'Ranking', activeClass: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40' }
];

export default function PortalNav({ pestana, onNavegar, onAbrirDrive }: PortalNavProps) {
  return (
    <div className="portal-nav sticky top-0 z-40 -mx-3 px-3 py-3 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 mb-6 sm:mb-8 border-b shadow-lg backdrop-blur-sm">
      <div className="flex flex-nowrap gap-2 sm:gap-3 overflow-x-auto">
        {PESTANAS.map((item) => {
          const activa = pestana === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavegar(item.id)}
              onPointerEnter={() => precargarAlInteractuarNav(item.id, activa)}
              onFocus={() => precargarAlInteractuarNav(item.id, activa)}
              onTouchStart={() => precargarAlInteractuarNav(item.id, activa)}
              className={`portal-nav-item px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                activa
                  ? `${item.activeClass} shadow-sm`
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>{item.icon}</span>
              {item.labelSm ? (
                <>
                  <span className="sm:hidden">{item.labelSm}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </>
              ) : (
                item.label
              )}
            </button>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onAbrirDrive}
          className="portal-nav-item shrink-0 px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-slate-800 bg-[#161c26] text-slate-400 hover:bg-slate-800/60 hover:text-white cursor-pointer"
        >
          <span>📁</span> Drive
        </button>
      </div>
    </div>
  );
}

import type { PortalPestana } from './types';

interface PortalNavProps {
  pestana: PortalPestana;
  onNavegar: (destino: PortalPestana) => void;
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

export default function PortalNav({ pestana, onNavegar }: PortalNavProps) {
  return (
    <div className="portal-nav sticky top-0 z-40 -mx-3 px-3 py-3 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 mb-6 sm:mb-8 border-b shadow-lg backdrop-blur-sm flex flex-nowrap gap-2 sm:gap-3 overflow-x-auto">
      {PESTANAS.map((item) => {
        const activa = pestana === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavegar(item.id)}
            className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
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
      <a
        href="https://drive.google.com/drive/folders/1DdVDpLcRHGLk19XnbICzCtVxw8xbo9Vg?usp=sharing"
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-slate-800 bg-[#161c26] text-slate-400 hover:bg-slate-800/60 hover:text-white"
      >
        <span>📁</span> Drive
      </a>
    </div>
  );
}

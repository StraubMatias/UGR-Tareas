import {
  segmentosGradoAvanceMateria,
  type Materia
} from '../core/cursada';

const COLOR: Record<string, string> = {
  completada: 'bg-emerald-500',
  pendiente: 'bg-sky-600',
  urgente: 'bg-amber-400',
  futura: 'bg-slate-600'
};

interface GradoAvanceMateriaProps {
  materia: Materia;
  alumno: string;
}

export default function GradoAvanceMateria({ materia, alumno }: GradoAvanceMateriaProps) {
  const { segmentos, indiceAhora, actividadActual } = segmentosGradoAvanceMateria(materia, alumno);
  if (!segmentos.length) return null;

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
        Grado de avance
      </p>
      <p className="text-[11px] text-slate-500 leading-snug">
        Consignas del tablero y lecturas del campus (teoría, archivos) según lo que marcaste como hecho en UGR Virtual.
      </p>
      <div className="relative pt-5">
        {indiceAhora != null && segmentos.length > 1 && (
          <div
            className="absolute top-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
            style={{ left: `${((indiceAhora + 0.5) / segmentos.length) * 100}%` }}
          >
            <span className="text-[10px] font-bold text-slate-200 whitespace-nowrap">▼ AHORA</span>
          </div>
        )}
        <div className="flex gap-[2px] h-8 rounded-md overflow-hidden border border-slate-700/80 bg-slate-900/80">
          {segmentos.map((seg) => (
            <div
              key={seg.id}
              title={seg.titulo}
              className={`flex-1 min-w-[3px] ${COLOR[seg.estado] || COLOR.futura} opacity-90 hover:opacity-100 transition-opacity`}
            />
          ))}
        </div>
      </div>
      {actividadActual && (
        <div className="flex items-start gap-2 text-sm text-slate-200">
          <span className="text-lg shrink-0" aria-hidden="true">📄</span>
          <div className="min-w-0">
            <p className="font-medium break-words leading-snug">{actividadActual.titulo}</p>
            <p className="text-xs text-slate-400">{actividadActual.etiquetaEstado}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Finalizada</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-600" /> Pendiente</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" /> Urgente</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-600" /> Aún no habilitada</span>
      </div>
    </div>
  );
}

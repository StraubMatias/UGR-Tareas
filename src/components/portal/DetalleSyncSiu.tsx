import type { NotaPlanSiu } from '../../lib/importar-plan-siu';

export interface DetalleSyncSiuProps {
  mensaje: string;
  enCurso: number;
  notasCargadas: NotaPlanSiu[];
  notasYaCargadas: NotaPlanSiu[];
}

export default function DetalleSyncSiu({
  mensaje,
  enCurso,
  notasCargadas,
  notasYaCargadas
}: DetalleSyncSiuProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-2">Resultado</p>
        <p>{mensaje}</p>
        {enCurso > 0 && (
          <p className="mt-2 text-xs text-emerald-200/80">
            {enCurso} materia(s) figuran en curso en SIU y no se importaron.
          </p>
        )}
      </div>
      {notasCargadas.length > 0 && (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-2">Notas importadas</p>
          <ul className="space-y-1">
            {notasCargadas.map((item) => (
              <li key={item.codigo}>
                {item.codigo} · {item.nombre}: nota {item.nota} ({item.estado})
              </li>
            ))}
          </ul>
        </div>
      )}
      {notasYaCargadas.length > 0 && (
        <div className="rounded-xl border border-slate-600 bg-slate-800/40 p-4 text-sm text-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Ya las tenías cargadas</p>
          <ul className="space-y-1">
            {notasYaCargadas.map((item) => (
              <li key={item.codigo}>
                {item.codigo} · {item.nombre}: nota {item.nota} ({item.estado})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

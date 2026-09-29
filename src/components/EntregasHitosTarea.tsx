import {
  faseEntregaDesdeHitos,
  formatearFechaDDMMAAAA,
  obtenerDiasHastaTarea,
  type EntregaHitoTarea
} from '../core/cursada';

interface EntregasHitosTareaProps {
  entregas: EntregaHitoTarea[];
  usuarioActual: string | null;
  fechaVence?: string | null;
}

export default function EntregasHitosTarea({ entregas, usuarioActual, fechaVence }: EntregasHitosTareaProps) {
  if (!usuarioActual || !entregas?.length) return null;

  const ordenadas = [...entregas]
    .filter((e) => e.indiceEntrega != null)
    .sort((a, b) => (a.indiceEntrega ?? 0) - (b.indiceEntrega ?? 0));
  const fase = faseEntregaDesdeHitos(entregas);
  const diasRestantes = fechaVence ? obtenerDiasHastaTarea(fechaVence) : null;

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
        Entregas del trabajo (sincronizado desde UGR)
      </p>
      {fase?.requiereEntrega && fase.indice != null && (
        <p className="text-sm text-amber-100/95 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2">
          <span className="font-semibold">Fase actual en UGR Virtual: {fase.etiqueta}.</span>
          {' '}Subí el trabajo en el campus.
          {diasRestantes != null && diasRestantes >= 0 && (
            <span className="block mt-1 text-amber-200/90 text-xs">
              Vence {formatearFechaDDMMAAAA(fechaVence)}
              {diasRestantes === 0 ? ' (hoy)' : ` · quedan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`}
            </span>
          )}
        </p>
      )}
      <ul className="space-y-2">
        {ordenadas.map((entrega) => {
          const etiqueta = `Entrega ${entrega.indiceEntrega}`;
          const nota = entrega.nota != null && entrega.nota !== '' ? String(entrega.nota) : null;
          return (
            <li
              key={`${entrega.numero}-${entrega.indiceEntrega}`}
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                entrega.esActiva
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-slate-700 bg-[#161c26]/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-100">{etiqueta}</span>
                {nota && !entrega.esActiva ? (
                  <span className="text-emerald-300 font-semibold text-xs">
                    Entregada · Nota {nota}
                    {entrega.notaOrigen === 'devolucion_docx' && (
                      <span className="text-[10px] font-normal text-slate-400 ml-1">(Word)</span>
                    )}
                  </span>
                ) : entrega.pendiente || entrega.esActiva ? (
                  <span className="text-amber-300 text-xs font-semibold">
                    {entrega.esActiva && entrega.indiceEntrega
                      ? `A entregar ahora · Entrega ${entrega.indiceEntrega}`
                      : 'Pendiente'}
                  </span>
                ) : null}
              </div>
              {entrega.estado && (
                <p className="text-xs text-slate-400 mt-1">Estado campus: {entrega.estado}</p>
              )}
              {entrega.comentarioProf && (
                <p className="text-xs text-slate-300 mt-2 line-clamp-3">{entrega.comentarioProf}</p>
              )}
              {entrega.feedbackUrl && (
                <a
                  href={entrega.feedbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs font-semibold text-cyan-300 hover:text-cyan-100"
                >
                  {entrega.feedbackNombre || 'Abrir devolución'} ↗
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

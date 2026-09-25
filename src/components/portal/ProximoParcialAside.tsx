import { NOMBRES_DIAS as nombresDias } from '../../lib/calendario-tablero';
import type { Horario, Parcial } from '../../core/cursada';
import { etiquetaMateria, formatearFechaDDMMAAAA, obtenerDiasHastaParcial } from '../../core/cursada';

interface ProximoParcialAsideProps {
  proximoParcial: Parcial;
  materiaNombre?: string;
  horariosProximoParcial: Horario[];
}

export default function ProximoParcialAside({
  proximoParcial,
  materiaNombre,
  horariosProximoParcial
}: ProximoParcialAsideProps) {
  const diasHastaParcial = obtenerDiasHastaParcial(proximoParcial.fecha);

  return (
    <aside className="xl:sticky xl:top-6 bg-purple-950/20 border border-purple-500/30 rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-4">Próximo examen</p>
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-white leading-snug">{proximoParcial.nombre}</h2>
        <p className="text-sm text-purple-200 leading-relaxed">
          {etiquetaMateria(materiaNombre || 'Materia')}
        </p>
        <p className="text-xs font-semibold text-purple-300 border-t border-purple-500/20 pt-3">
          Fecha: {formatearFechaDDMMAAAA(proximoParcial.fecha)}
        </p>
        {proximoParcial.url && (
          <a
            href={proximoParcial.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir el parcial en UGR Virtual"
            className="text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline mt-2 inline-block"
          >
            Ver en UGR ↗
          </a>
        )}
        <div className="border-t border-purple-500/20 pt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">Cursada</p>
          {horariosProximoParcial.length === 0 ? (
            <p className="text-xs text-purple-200/70">Horario no cargado</p>
          ) : (
            <div className="space-y-2">
              {horariosProximoParcial.map((horario) => (
                <div key={horario.id} className="text-xs text-purple-100">
                  <p className="font-bold">{nombresDias[Number(horario.dia)] || `Día ${horario.dia}`}</p>
                  <p className="text-purple-200">
                    {horario.hora_inicio} - {horario.hora_fin}
                    {horario.aula ? ` · Aula ${horario.aula}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        {diasHastaParcial !== null && (
          <p className="text-sm font-bold text-amber-300 pt-2">
            {diasHastaParcial === 0 ? 'Es hoy' : `Faltan ${diasHastaParcial} días`}
          </p>
        )}
      </div>
    </aside>
  );
}

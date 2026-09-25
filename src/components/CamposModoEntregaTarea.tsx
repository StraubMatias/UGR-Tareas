'use client';

import { flagsDeModoEntrega, modoEntregaDeTarea, type ModoEntregaTarea, type Tarea } from '../core/cursada';

const OPCIONES: { valor: ModoEntregaTarea; titulo: string; detalle: string }[] = [
  { valor: 'individual', titulo: 'Solo individual', detalle: 'Cada alumno entrega por su cuenta.' },
  { valor: 'grupal_opcional', titulo: 'Grupal o individual', detalle: 'Pueden armar grupos o entregar solos.' },
  { valor: 'grupal_obligatorio', titulo: 'Solo en grupo', detalle: 'Hay que unirse a un grupo para marcar entrega.' }
];

export function modoEntregaDesdeTarea(tarea: Pick<Tarea, 'grupal' | 'permite_individual'>): ModoEntregaTarea {
  return modoEntregaDeTarea(tarea);
}

export default function CamposModoEntregaTarea({
  modo,
  onModo,
  cupoMaximo,
  onCupoMaximo
}: {
  modo: ModoEntregaTarea;
  onModo: (modo: ModoEntregaTarea) => void;
  cupoMaximo: number;
  onCupoMaximo: (cupo: number) => void;
}) {
  const grupal = modo !== 'individual';

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0d1117]/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Forma de entrega</p>
      <div className="space-y-2">
        {OPCIONES.map((opcion) => (
          <label
            key={opcion.valor}
            className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              modo === opcion.valor
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-50'
                : 'border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="modo-entrega-tarea"
              className="mt-1"
              checked={modo === opcion.valor}
              onChange={() => onModo(opcion.valor)}
            />
            <span>
              <span className="font-semibold text-white">{opcion.titulo}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{opcion.detalle}</span>
            </span>
          </label>
        ))}
      </div>
      {grupal && (
        <div>
          <label className="block text-xs font-semibold text-slate-300">Cupo máximo por grupo (0 = sin límite)</label>
          <input
            type="number"
            min={0}
            max={30}
            value={cupoMaximo}
            onChange={(e) => onCupoMaximo(parseInt(e.target.value, 10) || 0)}
            className="mt-1 w-full rounded-xl border border-slate-800 bg-[#0f141c] p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

export function modoYCupoParaGuardar(modo: ModoEntregaTarea, cupoMaximo: number) {
  const { grupal, permiteIndividual } = flagsDeModoEntrega(modo);
  return { grupal, permiteIndividual, cupoMaximo: grupal ? cupoMaximo : 0 };
}

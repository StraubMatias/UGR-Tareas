import type { FormEvent } from 'react';
import type { Materia } from '../../core/cursada';
import ModalOverlay from './ModalOverlay';

interface ModalParcialEdicionProps {
  materias: Materia[];
  etiquetaMateria: (nombre: string) => string;
  materiaParcialSel: string;
  nombreParcial: string;
  fechaParcial: string;
  detallesParcial: string;
  onMateriaParcialSel: (v: string) => void;
  onNombreParcial: (v: string) => void;
  onFechaParcial: (v: string) => void;
  onDetallesParcial: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCerrar: () => void;
}

export default function ModalParcialEdicion({
  materias,
  etiquetaMateria,
  materiaParcialSel,
  nombreParcial,
  fechaParcial,
  detallesParcial,
  onMateriaParcialSel,
  onNombreParcial,
  onFechaParcial,
  onDetallesParcial,
  onSubmit,
  onCerrar
}: ModalParcialEdicionProps) {
  return (
    <ModalOverlay maxWidth="md">
      <h3 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
        <span>📋</span> Editar Parcial
      </h3>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Materia</label>
          <select
            value={materiaParcialSel}
            onChange={(e) => onMateriaParcialSel(e.target.value)}
            className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none font-medium cursor-pointer"
          >
            {materias.map((m) => (
              <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Título / Instancia</label>
          <input
            type="text"
            required
            value={nombreParcial}
            onChange={(e) => onNombreParcial(e.target.value)}
            className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha del Examen</label>
          <input
            type="date"
            value={fechaParcial}
            onChange={(e) => onFechaParcial(e.target.value)}
            className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Temas / Aclaraciones</label>
          <textarea
            rows={3}
            value={detallesParcial}
            onChange={(e) => onDetallesParcial(e.target.value)}
            className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCerrar} className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
            Cancelar
          </button>
          <button type="submit" className="w-1/2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
            Guardar Cambios
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

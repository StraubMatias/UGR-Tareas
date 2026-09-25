import type { FormEvent } from 'react';
import type { Materia } from '../../core/cursada';
import ModalOverlay, { ModalOverlayBody, ModalOverlayFooter, ModalOverlayHeader } from './ModalOverlay';

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
    <ModalOverlay maxWidth="xl">
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalOverlayHeader title="Editar parcial" onClose={onCerrar} closeLabel="Cancelar" />
        <ModalOverlayBody className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Materia</label>
            <select
              value={materiaParcialSel}
              onChange={(e) => onMateriaParcialSel(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm font-medium text-white focus:border-purple-500 focus:outline-none"
            >
              {materias.map((m) => (
                <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Título / Instancia</label>
            <input
              type="text"
              required
              value={nombreParcial}
              onChange={(e) => onNombreParcial(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Fecha del examen</label>
            <input
              type="date"
              value={fechaParcial}
              onChange={(e) => onFechaParcial(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-800 bg-[#0f141c] p-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Temas / Aclaraciones</label>
            <textarea
              rows={5}
              value={detallesParcial}
              onChange={(e) => onDetallesParcial(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
        </ModalOverlayBody>
        <ModalOverlayFooter>
          <div className="flex gap-3">
            <button type="button" onClick={onCerrar} className="w-1/2 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" className="w-1/2 rounded-xl bg-purple-600 py-3 text-xs font-bold text-white hover:bg-purple-500 cursor-pointer">
              Guardar cambios
            </button>
          </div>
        </ModalOverlayFooter>
      </form>
    </ModalOverlay>
  );
}

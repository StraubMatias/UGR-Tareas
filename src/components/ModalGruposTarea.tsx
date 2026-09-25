'use client';

import { useEffect } from 'react';
import GrupoTarea from './GrupoTarea';
import type { Tarea } from '../core/cursada';

export default function ModalGruposTarea({
  abierto,
  cerrar,
  tarea,
  materiaNombre,
  usuarioActual,
  alumnos,
  recargar,
  esAdmin = false
}: {
  abierto: boolean;
  cerrar: () => void;
  tarea: Tarea;
  materiaNombre: string;
  usuarioActual: string | null;
  alumnos: string[];
  recargar: (mostrarCarga?: boolean) => void | Promise<unknown>;
  esAdmin?: boolean;
}) {
  useEffect(() => {
    if (!abierto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', cerrarConEscape);
    };
  }, [abierto, cerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="modal-grupos-titulo">
      <button type="button" className="absolute inset-0 bg-black/70 cursor-pointer" aria-label="Cerrar" onClick={cerrar} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-[#0d1117] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-5">
          <div className="min-w-0 pr-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Grupos de la tarea</p>
            <h2 id="modal-grupos-titulo" className="mt-1 text-base font-bold text-white truncate">{tarea.nombre}</h2>
            <p className="mt-0.5 text-xs text-slate-400 truncate">{materiaNombre}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            Cerrar
          </button>
        </header>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <GrupoTarea
            tarea={tarea}
            materiaNombre={materiaNombre}
            usuarioActual={usuarioActual}
            recargar={recargar}
            esAdmin={esAdmin}
            alumnos={alumnos}
            alumnoContexto={usuarioActual}
          />
        </div>
      </div>
    </div>
  );
}

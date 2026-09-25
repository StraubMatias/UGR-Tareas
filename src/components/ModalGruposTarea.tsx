'use client';

import { useEffect } from 'react';
import GrupoTarea from './GrupoTarea';
import type { InvitacionGrupoEnviadaTablero } from './portal/types';
import type { Tarea } from '../core/cursada';

export default function ModalGruposTarea({
  abierto,
  cerrar,
  tarea,
  materiaNombre,
  usuarioActual,
  alumnos,
  recargar,
  esAdmin = false,
  invitacionesGrupoEnviadas = []
}: {
  abierto: boolean;
  cerrar: () => void;
  tarea: Tarea;
  materiaNombre: string;
  usuarioActual: string | null;
  alumnos: string[];
  recargar: (mostrarCarga?: boolean) => void | Promise<unknown>;
  esAdmin?: boolean;
  invitacionesGrupoEnviadas?: InvitacionGrupoEnviadaTablero[];
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

  const invitacionesTarea = invitacionesGrupoEnviadas.filter((inv) => inv.tareaId === tarea.id);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/85 sm:p-3 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-grupos-titulo"
    >
      <button type="button" className="absolute inset-0 cursor-pointer" aria-label="Cerrar" onClick={cerrar} />
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden border border-slate-700 bg-[#0d1117] shadow-2xl sm:rounded-2xl sm:max-h-[min(100dvh,920px)]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
          <div className="min-w-0 pr-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Grupos de la tarea</p>
            <h2 id="modal-grupos-titulo" className="mt-1 text-lg font-bold text-white truncate">{tarea.nombre}</h2>
            <p className="mt-0.5 text-xs text-slate-400 truncate">{materiaNombre}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            Cerrar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <GrupoTarea
            tarea={tarea}
            materiaNombre={materiaNombre}
            usuarioActual={usuarioActual}
            recargar={recargar}
            esAdmin={esAdmin}
            alumnos={alumnos}
            alumnoContexto={usuarioActual}
            embebido
            invitacionesPendientesEnviadas={invitacionesTarea}
          />
        </div>
      </div>
    </div>
  );
}

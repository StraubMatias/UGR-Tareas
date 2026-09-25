'use client';

import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';

export default function TableroAvisoInicio({ vm }: { vm: TableroPortalViewModel }) {
  const { acceso, ui, esAdmin, derivados } = vm;

  if (!acceso.usuarioActual || esAdmin || !ui.mostrarAvisoInicio || derivados.notificaciones.length === 0) {
    return null;
  }

  return (
    <div className="max-w-9xl mx-auto mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <span className="text-lg" aria-hidden="true">🔔</span>
      <p className="flex-1">
        {ui.novedades.length > 0
          ? `Hay ${ui.novedades.length} ${ui.novedades.length === 1 ? 'novedad nueva' : 'novedades nuevas'}: se cargaron tareas o parciales.`
          : `Tenés ${derivados.notificaciones.length} ${derivados.notificaciones.length === 1 ? 'tarea próxima' : 'tareas próximas'} a vencer. Revisá tus recordatorios.`}
      </p>
      <button
        type="button"
        aria-label="Cerrar aviso de tareas próximas a vencer"
        onClick={() => ui.setMostrarAvisoInicio(false)}
        className="text-amber-200 hover:text-white text-lg leading-none cursor-pointer"
      >
        ×
      </button>
    </div>
  );
}

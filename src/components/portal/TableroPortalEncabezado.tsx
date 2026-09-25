'use client';

import { etiquetaMateria } from '../../core/cursada';
import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import PortalHeader from './PortalHeader';
import TableroPortalSesion from './TableroPortalSesion';

export default function TableroPortalEncabezado({ vm }: { vm: TableroPortalViewModel }) {
  const { datos, ui, acceso, derivados, diasPagina, marcarNotificacionesVistas, navegarA } = vm;

  return (
    <PortalHeader
      usuarioActual={acceso.usuarioActual}
      diasPagina={diasPagina}
      periodos={datos.periodos}
      periodoSeleccionado={datos.periodoSeleccionado}
      onPeriodoChange={datos.setPeriodoSeleccionado}
      notificaciones={derivados.notificaciones}
      notificacionesVistas={ui.notificacionesVistas}
      notificacionesAbiertas={ui.notificacionesAbiertas}
      onToggleNotificaciones={() => ui.setNotificacionesAbiertas((abiertas) => !abiertas)}
      onMarcarNotificacionesVistas={marcarNotificacionesVistas}
      onNavegarDesdeCampana={(pestanaDestino) => {
        navegarA(pestanaDestino);
        ui.setNotificacionesAbiertas(false);
      }}
      notificacionesRef={ui.notificacionesRef}
      etiquetaMateria={etiquetaMateria}
      accionesSesion={acceso.usuarioActual ? <TableroPortalSesion vm={vm} /> : null}
    />
  );
}

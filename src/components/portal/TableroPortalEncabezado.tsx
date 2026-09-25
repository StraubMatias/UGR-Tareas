'use client';

import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import PortalHeader from './PortalHeader';
import TableroPortalSesion from './TableroPortalSesion';

export default function TableroPortalEncabezado({ vm }: { vm: TableroPortalViewModel }) {
  const { datos, acceso, diasPagina } = vm;

  return (
    <PortalHeader
      usuarioActual={acceso.usuarioActual}
      diasPagina={diasPagina}
      periodos={datos.periodos}
      periodoSeleccionado={datos.periodoSeleccionado}
      onPeriodoChange={datos.setPeriodoSeleccionado}
      barraSesion={acceso.usuarioActual ? <TableroPortalSesion vm={vm} /> : null}
    />
  );
}

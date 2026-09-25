'use client';

import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import BarraSesionPortal from './BarraSesionPortal';
import ModalCuentaSync from './ModalCuentaSync';

export default function TableroPortalSesion({ vm }: { vm: TableroPortalViewModel }) {
  const { ui, acceso, esAdmin, cargarBD, sync, portalAcceso, navegarA, abrirModalPassword } = vm;
  const usuario = acceso.usuarioActual;
  if (!usuario) return null;

  return (
    <>
      <BarraSesionPortal
        esAdmin={esAdmin}
        onAbrirSyncCuentaUgr={() => ui.setSyncCuentaFuente('ugr')}
        onAbrirSyncCuentaSiu={() => ui.setSyncCuentaFuente('siu')}
        onAbrirPassword={abrirModalPassword}
        onAbrirSyncUgrAdmin={sync.abrirSyncUGR}
        onAbrirAdmin={() => navegarA('admin')}
        onSalir={portalAcceso.cerrarSesionLocal}
      />
      {ui.syncCuentaFuente && (
        <ModalCuentaSync
          usuario={usuario}
          fuente={ui.syncCuentaFuente}
          onCerrar={() => ui.setSyncCuentaFuente(null)}
          onCompletado={() => { void cargarBD(false); }}
          onInterrumpida={() => { void cargarBD(false); }}
        />
      )}
    </>
  );
}

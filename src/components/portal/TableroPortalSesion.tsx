'use client';

import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import BarraSesionPortal from './BarraSesionPortal';
import ModalCuentaSync from './ModalCuentaSync';
import ModalElegirSyncFuente from './ModalElegirSyncFuente';

export default function TableroPortalSesion({ vm }: { vm: TableroPortalViewModel }) {
  const { ui, acceso, esAdmin, cargarBD, portalAcceso, navegarA, abrirModalPassword } = vm;
  const usuario = acceso.usuarioActual;
  if (!usuario) return null;

  return (
    <>
      <BarraSesionPortal
        esAdmin={esAdmin}
        onAbrirSync={() => ui.setSyncPickerAbierto(true)}
        onAbrirPassword={abrirModalPassword}
        onAbrirAdmin={() => navegarA('admin')}
        onSalir={portalAcceso.cerrarSesionLocal}
      />
      {ui.syncPickerAbierto && !ui.syncCuentaFuente && (
        <ModalElegirSyncFuente
          onCerrar={() => ui.setSyncPickerAbierto(false)}
          onElegirUgr={() => {
            ui.setSyncPickerAbierto(false);
            ui.setSyncCuentaFuente('ugr');
          }}
          onElegirSiu={() => {
            ui.setSyncPickerAbierto(false);
            ui.setSyncCuentaFuente('siu');
          }}
        />
      )}
      {ui.syncCuentaFuente && (
        <ModalCuentaSync
          usuario={usuario}
          fuente={ui.syncCuentaFuente}
          usarCredencialesServidor={esAdmin}
          onCerrar={() => {
            ui.setSyncCuentaFuente(null);
            ui.setSyncPickerAbierto(false);
          }}
          onCompletado={() => { void cargarBD(false); }}
          onInterrumpida={() => { void cargarBD(false); }}
        />
      )}
    </>
  );
}

'use client';

import { etiquetaMateria } from '../../core/cursada';
import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import BarraSesionPortal from './BarraSesionPortal';
import CampanaNotificaciones from './CampanaNotificaciones';
import ModalCuentaSync from './ModalCuentaSync';
import ModalElegirSyncFuente from './ModalElegirSyncFuente';

export default function TableroPortalSesion({ vm }: { vm: TableroPortalViewModel }) {
  const { ui, acceso, esAdmin, derivados, cargarBD, portalAcceso, navegarA, abrirModalPassword, marcarNotificacionesVistas, responderInvitacionGrupo } = vm;
  const usuario = acceso.usuarioActual;
  if (!usuario) return null;

  return (
    <>
      <BarraSesionPortal
        campana={
          <CampanaNotificaciones
            contenedorRef={ui.notificacionesRef}
            notificaciones={derivados.notificaciones}
            notificacionesVistas={ui.notificacionesVistas}
            abiertas={ui.notificacionesAbiertas}
            onToggleAbiertas={() => ui.setNotificacionesAbiertas((abiertas) => !abiertas)}
            onMarcarVistas={marcarNotificacionesVistas}
            onNavegar={(pestanaDestino) => {
              navegarA(pestanaDestino);
              ui.setNotificacionesAbiertas(false);
            }}
            onResponderInvitacion={responderInvitacionGrupo}
            etiquetaMateria={etiquetaMateria}
          />
        }
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

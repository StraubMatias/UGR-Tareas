import { useRef, useState } from 'react';
import { syncSiuAction, syncUgrAction } from '../app/actions';
import type { DetalleSyncSiuProps } from '../components/portal/DetalleSyncSiu';
import type { SyncEstado, SyncResult, SyncTipo } from '../components/portal/types';
import { mapSyncUgrActionResult } from '../lib/map-sync-ugr-result';

type CargarBD = (mostrarCargando?: boolean) => Promise<void>;

export function useSyncAdmin(cargarBD: CargarBD) {
  const [syncAbierto, setSyncAbierto] = useState(false);
  const [syncEstado, setSyncEstado] = useState<SyncEstado>('idle');
  const [syncTipo, setSyncTipo] = useState<SyncTipo>('ugr');
  const [syncSiuDetalle, setSyncSiuDetalle] = useState<DetalleSyncSiuProps | null>(null);
  const [syncDatos, setSyncDatos] = useState<SyncResult | null>(null);
  const [syncMensaje, setSyncMensaje] = useState('');
  const [syncSeleccionados, setSyncSeleccionados] = useState<Set<string>>(() => new Set());
  const [syncAvisosSeleccionados, setSyncAvisosSeleccionados] = useState<Set<string>>(() => new Set());
  const [syncEventosSeleccionados, setSyncEventosSeleccionados] = useState<Set<string>>(() => new Set());
  const syncEnCurso = useRef(false);

  const cerrarSync = () => {
    setSyncAbierto(false);
    setSyncTipo('ugr');
    setSyncSiuDetalle(null);
    setSyncEstado('idle');
    setSyncMensaje('');
  };

  const ejecutarSyncUGR = async (
    confirmar = false,
    ids: string[] = [],
    idsAvisos: string[] = [],
    idsEventos: string[] = []
  ): Promise<void> => {
    if (syncEnCurso.current) return;
    syncEnCurso.current = true;
    setSyncTipo('ugr');
    setSyncEstado('cargando');
    setSyncMensaje('');
    try {
      const res = await syncUgrAction({ confirmar, previaId: syncDatos?.previaId, ids, idsAvisos, idsEventos });
      if (!res || !res.exito || !('detectadas' in res)) {
        setSyncEstado('error');
        setSyncMensaje(res && 'mensaje' in res ? res.mensaje || 'No se pudo sincronizar.' : 'No se pudo sincronizar.');
        return;
      }
      const datos = mapSyncUgrActionResult(res as Record<string, unknown>);
      setSyncDatos(datos);
      setSyncEstado('listo');
      if (!confirmar) {
        setSyncSeleccionados(new Set(datos.detectadas.map((t) => t.idMoodle)));
        setSyncAvisosSeleccionados(new Set(datos.avisos.map((a) => a.id)));
        setSyncEventosSeleccionados(new Set(datos.eventosSugeridos.map((e) => e.avisoId)));
      }
      if (confirmar && (datos.insertadas > 0 || datos.avisosAceptados > 0 || datos.eventosInsertados > 0)) {
        await cargarBD(false);
      }
    } catch (error) {
      const crudo = error instanceof Error ? error.message : '';
      const cortada = /unexpected response/i.test(crudo);
      setSyncEstado('error');
      setSyncMensaje(
        cortada
          ? 'Se cortó la respuesta del servidor. Lo que ya se había guardado sigue en la página. Tocá «Buscar de nuevo».'
          : (crudo || 'Error inesperado al sincronizar con UGR.')
      );
      if (cortada) void cargarBD(false);
    } finally {
      syncEnCurso.current = false;
    }
  };

  const toggleSyncTarea = (id: string) => {
    setSyncSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const marcarTodasSync = (marcadas: boolean) => {
    if (!syncDatos) return;
    setSyncSeleccionados(marcadas ? new Set(syncDatos.detectadas.map((t) => t.idMoodle)) : new Set());
  };

  const toggleSyncAviso = (id: string) => {
    setSyncAvisosSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
        setSyncEventosSeleccionados((prevEventos) => {
          const nuevosEventos = new Set(prevEventos);
          nuevosEventos.delete(id);
          return nuevosEventos;
        });
      } else {
        nuevo.add(id);
      }
      return nuevo;
    });
  };

  const toggleSyncEvento = (avisoId: string) => {
    setSyncEventosSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(avisoId)) nuevo.delete(avisoId);
      else nuevo.add(avisoId);
      return nuevo;
    });
  };

  const marcarTodasAvisosSync = (marcadas: boolean) => {
    if (!syncDatos) return;
    setSyncAvisosSeleccionados(marcadas ? new Set(syncDatos.avisos.map((a) => a.id)) : new Set());
    if (!marcadas) setSyncEventosSeleccionados(new Set());
  };

  const abrirSyncUGR = () => {
    setSyncAbierto(true);
    if (!syncDatos && !syncEnCurso.current) void ejecutarSyncUGR(false);
  };

  const abrirSyncSIU = () => {
    if (syncEnCurso.current) return;
    syncEnCurso.current = true;
    setSyncTipo('siu');
    setSyncAbierto(true);
    setSyncEstado('cargando');
    setSyncMensaje('Conectando con SIU Guaraní...');
    setSyncSiuDetalle(null);
    syncSiuAction()
      .then(async (res) => {
        if (!res || !res.exito) {
          setSyncEstado('error');
          setSyncMensaje(res?.mensaje || 'No se pudo sincronizar con SIU.');
          return;
        }
        setSyncEstado('listo');
        setSyncMensaje(res.mensaje || 'Sincronización completada.');
        setSyncSiuDetalle({
          notasCargadas: res.notasCargadas || [],
          notasYaCargadas: res.notasYaCargadas || [],
          enCurso: res.enCurso || 0,
          mensaje: res.mensaje || ''
        });
        await cargarBD();
      })
      .catch((err: unknown) => {
        setSyncEstado('error');
        setSyncMensaje(err instanceof Error ? err.message : 'Error desconocido');
      })
      .finally(() => {
        syncEnCurso.current = false;
      });
  };

  const aplicarCambiosSync = () =>
    ejecutarSyncUGR(true, [...syncSeleccionados], [...syncAvisosSeleccionados], [...syncEventosSeleccionados]);

  return {
    syncAbierto,
    syncEstado,
    syncTipo,
    syncSiuDetalle,
    syncDatos,
    syncMensaje,
    syncSeleccionados,
    syncAvisosSeleccionados,
    syncEventosSeleccionados,
    cerrarSync,
    abrirSyncUGR,
    abrirSyncSIU,
    ejecutarSyncUGR,
    toggleSyncTarea,
    marcarTodasSync,
    toggleSyncAviso,
    toggleSyncEvento,
    marcarTodasAvisosSync,
    aplicarCambiosSync
  };
}

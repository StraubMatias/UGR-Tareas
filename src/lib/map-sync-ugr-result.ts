import type { AvisoSync, EventoSync, SyncResult, TareaDetectada } from '../components/portal/types';

/** Normaliza la respuesta de `syncUgrAction` para el modal de admin. */
export function mapSyncUgrActionResult(res: Record<string, unknown>): SyncResult {
  return {
    exito: true,
    confirmar: Boolean(res.confirmar),
    previaId: res.previaId as string | undefined,
    materiasLocales: res.materiasLocales as number | undefined,
    cursos: res.cursos as number | undefined,
    mapeos: res.mapeos as SyncResult['mapeos'],
    detectadas: Array.isArray(res.detectadas) ? res.detectadas as TareaDetectada[] : [],
    avisos: Array.isArray(res.avisos) ? res.avisos as AvisoSync[] : [],
    eventosSugeridos: Array.isArray(res.eventosSugeridos) ? res.eventosSugeridos as EventoSync[] : [],
    insertadas: (res.insertadas as number) ?? 0,
    urlsActualizadas: (res.urlsActualizadas as number) ?? 0,
    eventosCalendarioInsertados: (res.eventosCalendarioInsertados as number) ?? 0,
    horariosInsertados: (res.horariosInsertados as number) ?? 0,
    fechasActualizadas: (res.fechasActualizadas as number) ?? 0,
    avisosAceptados: (res.avisosAceptados as number) ?? 0,
    eventosInsertados: (res.eventosInsertados as number) ?? 0,
    notasCargadas: Array.isArray(res.notasCargadas) ? res.notasCargadas as SyncResult['notasCargadas'] : [],
    pendientesEntrega: Array.isArray(res.pendientesEntrega) ? res.pendientesEntrega as SyncResult['pendientesEntrega'] : []
  };
}

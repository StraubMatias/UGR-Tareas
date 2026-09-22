import type { MapeoCurso, ResultadoTareasNuevas } from './sync-core.mjs';

export interface ResultadoPrevia extends ResultadoTareasNuevas {
  avisos?: unknown[];
  eventosSugeridos?: unknown[];
  insertadas?: number;
  urlsActualizadas?: number;
  urlsParcialesActualizadas?: number;
  avisosAceptados?: number;
  avisosRechazados?: number;
  eventosInsertados?: number;
  eventosCalendarioInsertados?: number;
  horariosInsertados?: number;
  fechasActualizadas?: number;
  previaId?: string;
  confirmar?: boolean;
}

export function sincronizarConPrevia(opciones: {
  db: unknown;
  usuario: string;
  confirmar?: boolean;
  previaId?: string | null;
  ids?: string[];
  idsAvisos?: string[];
  idsEventos?: string[];
  detectar?: () => Promise<ResultadoPrevia>;
  ahora?: number;
}): Promise<ResultadoPrevia>;

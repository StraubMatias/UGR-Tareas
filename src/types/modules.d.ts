declare module '../../ugr-sync/lib/sync-core.mjs' {
  export interface MapeoCurso {
    curso?: { id?: string | number; nombre?: string };
    coincidencia?: { materia?: { nombre?: string } };
  }
  export interface ResultadoTareasNuevas {
    materiasLocales?: unknown[];
    cursos?: unknown[];
    mapeos?: MapeoCurso[];
    detectadas?: unknown[];
    urlsActualizar?: unknown[];
    urlsParcialesActualizar?: unknown[];
  }
  export interface ResultadoAvisosMoodle {
    avisosDetectados: unknown[];
    eventosSugeridos: unknown[];
  }
  export function aprobarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
  export function rechazarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
  export function conectarUGR(): Promise<unknown>;
  export function detectarAvisosMoodle(opciones: {
    db: unknown;
    cliente: unknown;
    mapeos?: MapeoCurso[];
    hoy?: string;
    diasAtras?: number;
  }): Promise<ResultadoAvisosMoodle>;
  export function detectarTareasNuevas(opciones: { db: unknown; cliente: unknown }): Promise<ResultadoTareasNuevas>;
}

declare module '../../ugr-sync/lib/previa.mjs' {
  import type { MapeoCurso, ResultadoTareasNuevas } from '../../ugr-sync/lib/sync-core.mjs';
  export interface ResultadoPrevia extends ResultadoTareasNuevas {
    avisos?: unknown[];
    eventosSugeridos?: unknown[];
    insertadas?: number;
    urlsActualizadas?: number;
    urlsParcialesActualizadas?: number;
    avisosAceptados?: number;
    avisosRechazados?: number;
    eventosInsertados?: number;
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
}

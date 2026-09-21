declare module '../lib/grupos-tareas.mjs' {
  export class ErrorGrupo extends Error {}
  export function asignarGrupo(
    db: unknown,
    tareaId: string,
    alumnoId: string | null,
    opciones?: {
      nombre?: string;
      grupoId?: string | null;
      salir?: boolean;
      eliminarGrupoId?: string | null;
      permitirMover?: boolean;
    }
  ): Promise<{ grupoId: string | null; eliminado?: boolean }>;
  export function actualizarProgresoTarea(
    db: unknown,
    tareaId: string,
    alumno: { id: string; nombre: string },
    opciones?: { nota?: string | number; alternarEntrega?: boolean }
  ): Promise<{ alumnos: string[] }>;
}

declare module '../../ugr-sync/lib/sync-core.mjs' {
  export function aprobarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
  export function rechazarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
  export function conectarUGR(): Promise<unknown>;
  export function detectarAvisosMoodle(): Promise<unknown>;
  export function detectarTareasNuevas(): Promise<unknown>;
}

declare module '../../ugr-sync/lib/previa.mjs' {
  export function sincronizarConPrevia(opciones: {
    db: unknown;
    usuario: string;
    confirmar?: boolean;
    previaId?: string;
    ids?: string[];
    idsAvisos?: string[];
    idsEventos?: string[];
    detectar?: () => Promise<unknown>;
    ahora?: number;
  }): Promise<{
    insertadas?: number;
    urlsActualizadas?: number;
    urlsParcialesActualizadas?: number;
    avisosAceptados?: number;
    avisosRechazados?: number;
    eventosInsertados?: number;
    previaId?: string;
    confirmar?: boolean;
    [clave: string]: unknown;
  }>;
}

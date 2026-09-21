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

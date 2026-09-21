export function aprobarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
export function rechazarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
export function conectarUGR(): Promise<unknown>;
export function detectarAvisosMoodle(): Promise<unknown>;
export function detectarTareasNuevas(): Promise<unknown>;

declare module '../lib/grupos-tareas.mjs' {
  export function obtenerDatosDesdeArchivo(codigo: string): Promise<any>;
  export const ESTADOS: Record<string, string>;
}

declare module '../../ugr-sync/lib/sync-core.mjs' {
  export function ejecutarSincronizacion(
    confirmar: boolean,
    seleccionados: string[],
    avisosSeleccionados: string[],
    eventosSeleccionados: string[]
  ): Promise<{ 
    insertadas: number; 
    urlsActualizadas: number; 
    avisosAceptados: number; 
    eventosInsertados: number;
    detectadas: any[]; // Placeholder, definiremos mejor si es necesario
    avisos: any[];
    confirmar: boolean;
  }>;
}

declare module '../../ugr-sync/lib/previa.mjs' {
  export function obtenerPrevia(): Promise<any>;
}

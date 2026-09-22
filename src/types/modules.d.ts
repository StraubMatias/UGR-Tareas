declare module '../../ugr-sync/lib/autenticar.mjs' {
  export function validarCredencialesUgr(opciones: { usuario?: string; contrasena?: string }): Promise<{ usuario: string }>;
}

declare module '../../ugr-sync/lib/sync-core.mjs' {
  export interface MapeoCurso {
    curso?: { id?: string | number; nombre?: string; [clave: string]: unknown };
    coincidencia?: { materia?: { id?: string; nombre?: string } };
  }
  export interface ResultadoTareasNuevas {
    materiasLocales?: unknown[];
    cursos?: unknown[];
    mapeos?: MapeoCurso[];
    detectadas?: unknown[];
    yaCargadas?: unknown[];
    parcialesDetectados?: unknown[];
    eventosCalendario?: unknown[];
    urlsActualizar?: unknown[];
    urlsParcialesActualizar?: unknown[];
    condicionesActualizadas?: number;
  }
  export interface ResultadoAvisosMoodle {
    avisosDetectados: unknown[];
    eventosSugeridos: unknown[];
  }
  export function aprobarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
  export function rechazarAvisos(opciones: { db: unknown; ids: string[] }): Promise<number>;
  export function conectarUGR(): Promise<unknown>;
  export function conectarUGRCon(opciones: { usuario?: string; contrasena?: string; rutaSesion?: string | null }): Promise<unknown>;
  export function listarCursosDelCampus(cliente: unknown): Promise<Array<{ id?: string | number; nombre?: string }>>;
  export function emparejarCursosConMaterias(cursos: unknown[], materias: unknown[], plan?: unknown[]): Array<{ curso: unknown; materiaId: string | null; nombre: string; nueva: boolean }>;
  export function separarEvaluaciones(detectadas: unknown[]): { tareas: unknown[]; parciales: unknown[] };
  export function filtrarTareasDuplicadas(candidatas?: unknown[], existentes?: unknown[]): { nuevas: unknown[]; duplicadas: unknown[] };
  export function agruparResumenSync(opciones?: { nuevas?: unknown[]; yaEstaban?: unknown[]; cronogramaNuevo?: unknown[]; cronogramaYa?: unknown[] }): Array<{ materia: string; nuevas: string[]; yaEstaban: string[]; cronogramaNuevo: string[]; cronogramaYa: string[] }>;
  export function armarMensajeCursada(opciones?: { materias?: Array<{ nombre?: string } | string>; tareasNuevas?: number; tareasYa?: number; extras?: string[] }): string;
  export function limpiarTextoParaBusqueda(texto: string): string;
  export function detectarAvisosMoodle(opciones: {
    db: unknown;
    cliente: unknown;
    mapeos?: MapeoCurso[];
    hoy?: string;
    diasAtras?: number;
  }): Promise<ResultadoAvisosMoodle>;
  export function asegurarMateriasDeLaCursada(opciones: {
    db: unknown;
    cursos?: unknown[];
    materias?: unknown[];
    plan?: unknown[];
    periodoId?: string;
  }): Promise<{
    mapeos: MapeoCurso[];
    materiaIds: string[];
    materiasNuevas: number;
    nombresPorId: Map<string, string>;
    nombresNuevos: Set<string>;
  }>;
  export function detectarTareasNuevas(opciones: { db: unknown; cliente: unknown; cursos?: unknown[]; periodoId?: string; alumnoId?: string; mapeos?: MapeoCurso[] }): Promise<ResultadoTareasNuevas>;
  export function insertarTareasDetectadas(opciones: { db: unknown; detectadas: unknown[] }): Promise<number>;
  export function insertarParcialesSiFaltan(opciones: { db: unknown; detectadas: unknown[] }): Promise<{ insertadas: number; omitidas: unknown[] }>;
  export function actualizarUrlsTareas(opciones: { db: unknown; urlsActualizar: unknown }): Promise<number>;
  export function actualizarUrlsParciales(opciones: { db: unknown; urlsParcialesActualizar: unknown }): Promise<number>;
  export function insertarEventosCronograma(opciones: { db: unknown; eventos: unknown[] }): Promise<number>;
  export function aplicarComplementoCampus(opciones: { db: unknown; detectado: unknown; alumnoId?: string; alumnoNombre?: string }): Promise<{ eventos: number; horarios: number; fechas: number; notas: number }>;
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
    eventosCalendarioInsertados?: number;
    horariosInsertados?: number;
    fechasActualizadas?: number;
    parcialesInsertados?: number;
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

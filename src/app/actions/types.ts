export interface ResumenMateriaSync {
  materia: string;
  nuevas: string[];
  yaEstaban: string[];
  cronogramaNuevo?: string[];
  cronogramaYa?: string[];
  fechasActualizadas?: string[];
  parcialesNuevos?: string[];
  materiaNueva?: boolean;
  notasCargadas?: string[];
  notasNoLeidas?: string[];
  pendientesEntrega?: string[];
}

export interface MateriaInscriptaSync {
  materia: string;
  materiaNueva?: boolean;
}

export type FaseSincronizarUgr = 'preparar' | 'materias' | 'avisos' | 'nucleo';
// nucleo: atajo servidor (preparar + todas las materias en una pasada)

export interface OpcionesSincronizarUgr {
  /** Pasadas cortas: preparar → materias (por lote) → avisos (por lote). */
  fase?: FaseSincronizarUgr;
  /** IDs de materias para `materias` o `avisos` en esa pasada. */
  materiaIds?: string[];
}

export interface RespuestaAction {
  exito: boolean;
  mensaje?: string;
  /** Hubo aviso o paso opcional sin terminar, pero el núcleo sí se guardó. */
  syncParcial?: boolean;
  usuario?: string;
  rol?: string;
  origen?: string;
  ugrUsuario?: string | null;
  resumen?: ResumenMateriaSync[];
  materiasInscriptas?: MateriaInscriptaSync[];
  /** Lista detallada de lo que hizo la última sync UGR (para mostrar en pantalla). */
  informeLineas?: string[];
  /** Tras `preparar`, las materias que se van a sincronizar en lotes. */
  materiaIdsSync?: string[];
}

export interface RespuestaSiuSync {
  exito: boolean;
  mensaje?: string;
  enCurso?: number;
  notasCargadas?: Array<{ codigo: string; nombre: string; nota: string; estado: string }>;
  notasYaCargadas?: Array<{ codigo: string; nombre: string; nota: string; estado: string }>;
}

export interface TareaActionParams {
  id?: string;
  materiaId: string;
  nombre: string;
  inicio: string | null;
  fin: string | null;
  detalles: string;
  unidad: string | number;
  conNota: boolean;
  tipo: string;
  grupal?: boolean;
  permiteIndividual?: boolean;
  cupoMaximo?: number;
}

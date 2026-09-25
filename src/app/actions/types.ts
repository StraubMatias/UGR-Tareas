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

export interface RespuestaAction {
  exito: boolean;
  mensaje?: string;
  usuario?: string;
  rol?: string;
  origen?: string;
  ugrUsuario?: string | null;
  resumen?: ResumenMateriaSync[];
  materiasInscriptas?: MateriaInscriptaSync[];
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
  cupoMaximo?: number;
}

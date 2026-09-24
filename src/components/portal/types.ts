import type { DetalleSyncSiuProps } from './DetalleSyncSiu';

export type PortalPestana =
  | 'alumnos'
  | 'materias'
  | 'plan'
  | 'parciales'
  | 'horarios'
  | 'ranking'
  | 'promocion'
  | 'historial'
  | 'admin';

export interface Periodo {
  id: string;
  anio: number;
  cuatrimestre: number;
  nombre: string;
  activo: number;
}

export interface NotificacionTablero {
  id: string;
  tipo: string;
  nombre: string;
  materia: string;
  dias?: number | null;
  url?: string;
}

/** Recordatorio o novedad en campana / aviso de inicio. */
export type NovedadTablero = NotificacionTablero;

export interface TareaDetectada {
  idMoodle: string;
  nombre?: string;
  materiaNombre?: string;
  url?: string;
  unidad?: string | number | null;
  inicio?: string | null;
  fin?: string | null;
  tipo?: string;
}

/** Aviso de foro importado desde Moodle (estado del tablero). */
export interface AvisoCampusMoodle {
  id: string;
  curso_id: string;
  curso_nombre: string;
  materia_nombre: string;
  foro_nombre: string;
  titulo: string;
  autor: string;
  fecha: string;
  contenido: string;
  url: string;
  estado: string;
}

export interface AvisoSync {
  id: string;
  titulo?: string;
  materiaNombre?: string;
  cursoNombre?: string;
  foroNombre?: string;
  fecha?: string;
  contenido?: string;
  url?: string;
}

export interface EventoSync {
  avisoId: string;
  titulo?: string;
  fecha?: string;
  tipo?: string;
}

export interface SyncResult {
  exito: boolean;
  confirmar?: boolean;
  previaId?: string;
  materiasLocales?: number;
  cursos?: number;
  mapeos?: { id?: string | number; curso?: string; materia?: string }[];
  detectadas: TareaDetectada[];
  avisos: AvisoSync[];
  eventosSugeridos: EventoSync[];
  insertadas: number;
  urlsActualizadas: number;
  avisosAceptados: number;
  eventosInsertados: number;
  eventosCalendarioInsertados?: number;
  horariosInsertados?: number;
  fechasActualizadas?: number;
  parcialesInsertados?: number;
  notasCargadas?: Array<{ materia?: string; nombre?: string; nota?: string; yaEstaba?: boolean }>;
  pendientesEntrega?: Array<{ materia?: string; nombre?: string }>;
}

export type SyncEstado = 'idle' | 'cargando' | 'listo' | 'error';
export type SyncTipo = 'ugr' | 'siu';

export interface ModalSincronizacionProps {
  syncTipo: SyncTipo;
  syncEstado: SyncEstado;
  syncMensaje: string;
  syncDatos: SyncResult | null;
  syncSiuDetalle: DetalleSyncSiuProps | null;
  syncSeleccionados: Set<string>;
  syncAvisosSeleccionados: Set<string>;
  syncEventosSeleccionados: Set<string>;
  etiquetaMateria: (nombre: string) => string;
  onCerrar: () => void;
  onBuscarDeNuevo: () => void;
  onMarcarTodasTareas: (valor: boolean) => void;
  onToggleTarea: (idMoodle: string) => void;
  onMarcarTodasAvisos: (valor: boolean) => void;
  onToggleAviso: (id: string) => void;
  onToggleEvento: (avisoId: string) => void;
  onAplicarCambios: () => void;
}

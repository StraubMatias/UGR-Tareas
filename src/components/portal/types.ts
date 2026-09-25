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
  invitacionId?: string;
  grupoNombre?: string;
  deAlumno?: string;
  tareaId?: string;
}

export interface InvitacionGrupoTablero {
  id: string;
  grupoId: string;
  tareaId: string;
  grupoNombre: string;
  tareaNombre: string;
  materiaNombre: string;
  deAlumno: string;
}

/** Invitaciones que vos enviaste y siguen pendientes (para deshabilitar reenvío). */
export interface InvitacionGrupoEnviadaTablero {
  tareaId: string;
  grupoId: string;
  paraAlumno: string;
}

/** Recordatorio o novedad en campana / aviso de inicio. */
export type NovedadTablero = NotificacionTablero;

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

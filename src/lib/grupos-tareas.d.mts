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

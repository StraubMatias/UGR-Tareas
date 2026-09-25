import { useTableroAccionesAlumnos } from './tablero-acciones/useTableroAccionesAlumnos';
import { useTableroAccionesEntregas } from './tablero-acciones/useTableroAccionesEntregas';
import { useTableroAccionesHorarios } from './tablero-acciones/useTableroAccionesHorarios';
import { useTableroAccionesMaterias } from './tablero-acciones/useTableroAccionesMaterias';
import { useTableroAccionesNavegacion } from './tablero-acciones/useTableroAccionesNavegacion';
import { useTableroAccionesParciales } from './tablero-acciones/useTableroAccionesParciales';
import { useTableroAccionesPlan } from './tablero-acciones/useTableroAccionesPlan';
import { useTableroAccionesTareas } from './tablero-acciones/useTableroAccionesTareas';
import type { UseTableroAccionesOptions } from './tablero-acciones/types';

export type { UseTableroAccionesOptions } from './tablero-acciones/types';

export function useTableroAcciones(opts: UseTableroAccionesOptions) {
  const navegacion = useTableroAccionesNavegacion(opts);
  const entregas = useTableroAccionesEntregas(opts);
  const plan = useTableroAccionesPlan(opts);
  const alumnos = useTableroAccionesAlumnos(opts);
  const materias = useTableroAccionesMaterias(opts);
  const tareas = useTableroAccionesTareas(opts);
  const horarios = useTableroAccionesHorarios(opts);
  const parciales = useTableroAccionesParciales(opts);

  return {
    ...navegacion,
    ...entregas,
    ...plan,
    ...alumnos,
    ...materias,
    ...tareas,
    ...horarios,
    ...parciales
  };
}

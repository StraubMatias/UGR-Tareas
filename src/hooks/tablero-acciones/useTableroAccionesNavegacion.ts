import { useCallback } from 'react';
import { tareaPendienteAlumno } from '../../core/cursada';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesNavegacion(opts: UseTableroAccionesOptions) {
  const {
    usuarioActual,
    materias,
    materiasDesplegadas,
    setAlumnosDesplegados,
    setMateriasExpandidas,
    setMateriasDesplegadas,
    setNotasDesplegadas,
    setTareaFoco,
    setTareaFocoVisible,
    setPestana
  } = opts;

  const toggleDesplegarAlumno = useCallback((nombreAlumno: string) => {
    setAlumnosDesplegados((prev) => ({ ...prev, [nombreAlumno]: !prev[nombreAlumno] }));
  }, [setAlumnosDesplegados]);

  const toggleExpandirMateria = useCallback((materiaId: string) => {
    setMateriasExpandidas((prev) => ({ ...prev, [materiaId]: !prev[materiaId] }));
  }, [setMateriasExpandidas]);

  const toggleDesplegarMateria = useCallback((materiaId: string) => {
    setMateriasDesplegadas((prev) => ({ ...prev, [materiaId]: !prev[materiaId] }));
  }, [setMateriasDesplegadas]);

  const toggleNotasParcial = useCallback((parcialId: string) => {
    setNotasDesplegadas((prev) => ({ ...prev, [parcialId]: !prev[parcialId] }));
  }, [setNotasDesplegadas]);

  const irATareaEnMaterias = useCallback((tareaId: string) => {
    if (!usuarioActual) return;
    const materia = materias.find((m) => m.tareas.some((t) => t.id === tareaId));
    if (!materia) return;
    const tarea = materia.tareas.find((t) => t.id === tareaId);
    setMateriasExpandidas((prev) => ({ ...prev, [materia.id]: true }));
    if (tarea && !tareaPendienteAlumno(tarea, usuarioActual) && !materiasDesplegadas[materia.id]) {
      setMateriasDesplegadas((prev) => ({ ...prev, [materia.id]: true }));
    }
    setTareaFoco({ materiaId: materia.id, tareaId });
    setTareaFocoVisible(true);
    setPestana('materias');
  }, [
    usuarioActual,
    materias,
    materiasDesplegadas,
    setMateriasExpandidas,
    setMateriasDesplegadas,
    setTareaFoco,
    setTareaFocoVisible,
    setPestana
  ]);

  return {
    toggleDesplegarAlumno,
    toggleExpandirMateria,
    toggleDesplegarMateria,
    toggleNotasParcial,
    irATareaEnMaterias
  };
}

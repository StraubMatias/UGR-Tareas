import { startTransition, useEffect } from 'react';
import { materiasQueCursa } from '../lib/companeros';
import type { NovedadTablero } from '../components/portal/types';
import type { Materia, Parcial } from '../core/cursada';

/** Detecta tareas/parciales nuevos en la cursada y actualiza `novedades` + localStorage. */
export function useNovedadesConocidas(
  usuarioActual: string | null,
  cargando: boolean,
  materias: Materia[],
  parciales: Parcial[],
  inscripciones: { alumno: string; materiaId: string }[],
  setNovedades: (n: NovedadTablero[]) => void
) {
  useEffect(() => {
    if (!usuarioActual || cargando) return;

    const ids = materiasQueCursa(inscripciones, usuarioActual);
    const materiasAvisos = materias.filter((materia) => ids.has(materia.id));
    const parcialesAvisos = parciales.filter((parcial) => ids.has(parcial.materia_id));
    const tareasActuales = materiasAvisos.flatMap((materia) => materia.tareas.map((tarea) => ({
      id: `tarea-${tarea.id}`,
      tipo: 'nueva-tarea',
      nombre: tarea.nombre,
      materia: materia.nombre
    })));
    const parcialesActuales = parcialesAvisos.map((parcial) => ({
      id: `nuevo-parcial-${parcial.id}`,
      tipo: 'nuevo-parcial',
      nombre: parcial.nombre,
      materia: materiasAvisos.find((materia) => materia.id === parcial.materia_id)?.nombre || 'Materia'
    }));
    const elementosActuales = [...tareasActuales, ...parcialesActuales];
    const claveNovedades = `ugr_novedades_conocidas_${encodeURIComponent(usuarioActual)}`;
    const novedadesGuardadas = localStorage.getItem(claveNovedades);

    if (!novedadesGuardadas) {
      localStorage.setItem(claveNovedades, JSON.stringify(elementosActuales.map((elemento) => elemento.id)));
      return;
    }

    let idsConocidos: string[] = [];
    try {
      idsConocidos = JSON.parse(novedadesGuardadas);
    } catch {
      idsConocidos = [];
    }

    const nuevas = elementosActuales.filter((elemento) => !idsConocidos.includes(elemento.id)) as NovedadTablero[];
    startTransition(() => {
      setNovedades(nuevas);
    });
    localStorage.setItem(claveNovedades, JSON.stringify(elementosActuales.map((elemento) => elemento.id)));
  }, [usuarioActual, cargando, materias, parciales, inscripciones, setNovedades]);
}

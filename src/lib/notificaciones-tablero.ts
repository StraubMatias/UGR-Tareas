import { nombreNotificacionAviso } from './avisos';
import { materiasQueCursa } from './companeros';
import type { AvisoCampusMoodle, NovedadTablero } from '../components/portal/types';
import type { EventoCronograma, Materia, Parcial } from '../core/cursada';
import { obtenerDiasHastaFecha, obtenerDiasHastaTarea, tareaCompletadaPor } from '../core/cursada';

export function armarNotificacionesTablero({
  usuarioActual,
  novedades,
  avisos,
  materias,
  parciales,
  inscripciones,
  cronogramaCursada
}: {
  usuarioActual: string | null;
  novedades: NovedadTablero[];
  avisos: AvisoCampusMoodle[];
  materias: Materia[];
  parciales: Parcial[];
  inscripciones: { alumno: string; materiaId: string }[];
  cronogramaCursada: EventoCronograma[];
}): NovedadTablero[] {
  if (!usuarioActual) return [];

  const idsCursada = materiasQueCursa(inscripciones, usuarioActual);
  const materiasDeLaCursada = materias.filter((materia) => idsCursada.has(materia.id));
  const parcialesDeLaCursada = parciales.filter((parcial) => idsCursada.has(parcial.materia_id));
  const nombresDeLaCursada = new Set(materiasDeLaCursada.map((materia) => materia.nombre));

  return ([
    ...novedades,
    ...avisos.filter((aviso) => nombresDeLaCursada.has(aviso.materia_nombre)).map((aviso) => ({
      id: `aviso-${aviso.id}`,
      tipo: 'aviso-nuevo',
      nombre: nombreNotificacionAviso(
        { titulo: aviso.titulo, url: aviso.url, materia_id: aviso.curso_id },
        cronogramaCursada
      ),
      materia: aviso.materia_nombre || aviso.curso_nombre || 'Materia',
      url: aviso.url || ''
    })),
    ...materiasDeLaCursada.flatMap((materia) => materia.tareas
      .map((tarea) => ({ tarea, materia }))
      .filter(({ tarea }) => {
        const dias = obtenerDiasHastaTarea(tarea.fin);
        return dias !== null && dias >= 0 && dias <= 7 && !tareaCompletadaPor(tarea, usuarioActual);
      })
      .map(({ tarea, materia: m }) => ({
        id: `vencimiento-${tarea.id}`,
        tipo: 'vencimiento',
        nombre: tarea.nombre,
        materia: m.nombre,
        dias: obtenerDiasHastaTarea(tarea.fin)
      }))),
    ...parcialesDeLaCursada
      .map((parcial) => ({
        id: `parcial-${parcial.id}`,
        tipo: 'parcial',
        nombre: parcial.nombre,
        materia: materiasDeLaCursada.find((m) => m.id === parcial.materia_id)?.nombre || 'Materia',
        dias: obtenerDiasHastaFecha(parcial.fecha)
      }))
      .filter(({ dias }) => dias === 1),
    ...materiasDeLaCursada.flatMap((materia) => materia.tareas
      .map((tarea) => ({
        id: `apertura-${tarea.id}`,
        tipo: 'apertura',
        nombre: tarea.nombre,
        materia: materia.nombre,
        dias: obtenerDiasHastaFecha(tarea.inicio)
      }))
      .filter(({ dias }) => dias === 1))
  ] as NovedadTablero[]).sort((a, b) => (a.dias ?? -1) - (b.dias ?? -1) || a.nombre.localeCompare(b.nombre));
}

import { avisoVigenteEnCampana, nombreNotificacionAviso } from './avisos';
import { materiasQueCursa } from './companeros';
import type { AvisoCampusMoodle, InvitacionGrupoTablero, NovedadTablero } from '../components/portal/types';
import type { EventoCronograma, Materia, Parcial } from '../core/cursada';
import { obtenerDiasHastaFecha, obtenerDiasHastaTarea, tareaCompletadaPor } from '../core/cursada';

export function pesoNotificacionTablero(item: NovedadTablero): number {
  switch (item.tipo) {
    case 'parcial':
      return item.dias === 0 ? 0 : 1;
    case 'vencimiento':
      return 10 + Math.min(item.dias ?? 99, 99);
    case 'invitacion-grupo':
      return 20;
    case 'apertura':
      return 25;
    case 'nuevo-parcial':
    case 'nueva-tarea':
      return 30;
    case 'aviso-nuevo':
      return 40;
    default:
      return 50;
  }
}

export function ordenarNotificacionesTablero(lista: NovedadTablero[]): NovedadTablero[] {
  return [...lista].sort((a, b) => (
    pesoNotificacionTablero(a) - pesoNotificacionTablero(b)
    || (a.dias ?? 99) - (b.dias ?? 99)
    || a.nombre.localeCompare(b.nombre, 'es')
  ));
}

export function armarNotificacionesTablero({
  usuarioActual,
  novedades,
  avisos,
  materias,
  parciales,
  inscripciones,
  cronogramaCursada,
  invitacionesGrupo = []
}: {
  usuarioActual: string | null;
  novedades: NovedadTablero[];
  avisos: AvisoCampusMoodle[];
  invitacionesGrupo?: InvitacionGrupoTablero[];
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

  const lista: NovedadTablero[] = [
    ...invitacionesGrupo.map((inv) => ({
      id: `invitacion-grupo-${inv.id}`,
      tipo: 'invitacion-grupo',
      nombre: inv.tareaNombre,
      materia: inv.materiaNombre,
      invitacionId: inv.id,
      grupoNombre: inv.grupoNombre,
      deAlumno: inv.deAlumno,
      tareaId: inv.tareaId
    })),
    ...novedades,
    ...avisos
      .filter((aviso) => nombresDeLaCursada.has(aviso.materia_nombre))
      .filter((aviso) => avisoVigenteEnCampana({
        titulo: aviso.titulo,
        url: aviso.url,
        materia_id: aviso.materia_id,
        fecha: aviso.fecha,
        contenido: aviso.contenido
      }, cronogramaCursada))
      .map((aviso) => ({
        id: `aviso-${aviso.id}`,
        tipo: 'aviso-nuevo',
        nombre: nombreNotificacionAviso(
          { titulo: aviso.titulo, url: aviso.url, materia_id: aviso.materia_id },
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
      .filter(({ dias }) => dias === 0 || dias === 1),
    ...materiasDeLaCursada.flatMap((materia) => materia.tareas
      .map((tarea) => ({
        id: `apertura-${tarea.id}`,
        tipo: 'apertura',
        nombre: tarea.nombre,
        materia: materia.nombre,
        dias: obtenerDiasHastaFecha(tarea.inicio)
      }))
      .filter(({ dias }) => dias === 1))
  ];

  return ordenarNotificacionesTablero(lista);
}

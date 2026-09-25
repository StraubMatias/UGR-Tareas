import { alumnosDeLaMateria, materiasQueCursa } from './companeros';
import { armarNotificacionesTablero } from './notificaciones-tablero';
import {
  calcularDatosComparacionRanking,
  calcularRankingTablero,
  ordenarAlumnosParaHistorial
} from './ranking-tablero';
import {
  claveHoyCalendario,
  diasCalendarioDelMes,
  eventosDelDiaCalendario
} from './calendario-tablero';
import type { AvisoCampusMoodle, InvitacionGrupoTablero, NovedadTablero } from '../components/portal/types';
import type { EventoCronograma, Horario, Materia, Nota, Parcial } from '../core/cursada';
import { obtenerFechaParcialEnMs, ordenarParciales } from '../core/cursada';
const FECHA_CREACION_PORTAL = new Date(2026, 7, 24);

export function diasDesdeCreacionPortal(ref = Date.now()) {
  return Math.max(0, Math.floor((ref - FECHA_CREACION_PORTAL.getTime()) / (1000 * 60 * 60 * 24)));
}

export function agruparParcialesPorMateria(
  parcialesOrdenados: Parcial[],
  materias: Materia[]
) {
  return parcialesOrdenados.reduce<{ id: string; nombre: string; parciales: Parcial[] }[]>((grupos, parcial) => {
    const materia = materias.find((item) => item.id === parcial.materia_id);
    const claveMateria = parcial.materia_id || 'sin-materia';
    const grupoExistente = grupos.find((grupo) => grupo.id === claveMateria);

    if (grupoExistente) {
      grupoExistente.parciales.push(parcial);
    } else {
      grupos.push({
        id: claveMateria,
        nombre: materia ? materia.nombre : 'MATERIA NO DISPONIBLE',
        parciales: [parcial]
      });
    }

    return grupos;
  }, []);
}

export function resolverMateriaRankingVisible(
  materiaRanking: string,
  materiasMisCursadas: Materia[]
) {
  return materiaRanking && materiasMisCursadas.some((materia) => materia.id === materiaRanking)
    ? materiaRanking
    : materiasMisCursadas[0]?.id ?? '';
}

export function armarDerivadosTablero({
  usuarioActual,
  materias,
  parciales,
  horarios,
  cronograma,
  inscripciones,
  notas,
  alumnos,
  novedades,
  avisos,
  invitacionesGrupo = [],
  mesCalendario,
  materiasMisCursadas,
  materiaRankingVisible,
  alumnoComparar
}: {
  usuarioActual: string | null;
  materias: Materia[];
  parciales: Parcial[];
  horarios: Horario[];
  cronograma: EventoCronograma[];
  inscripciones: { alumno: string; materiaId: string }[];
  notas: Nota[];
  alumnos: string[];
  novedades: NovedadTablero[];
  avisos: AvisoCampusMoodle[];
  invitacionesGrupo?: InvitacionGrupoTablero[];
  mesCalendario: Date;
  materiasMisCursadas: Materia[];
  materiaRankingVisible: string;
  alumnoComparar: string;
}) {
  const idsCursada = materiasQueCursa(inscripciones, usuarioActual || '');
  const materiasDeLaCursada = materias.filter((materia) => idsCursada.has(materia.id));
  const parcialesDeLaCursada = parciales.filter((parcial) => idsCursada.has(parcial.materia_id));
  const cronogramaDeLaCursada = cronograma.filter((evento) => idsCursada.has(evento.materia_id));
  const horariosDeLaCursada = horarios.filter((horario) => idsCursada.has(horario.materia_id));
  const parcialesOrdenados = ordenarParciales(parcialesDeLaCursada);
  const proximoParcial = parcialesOrdenados.find((parcial) => {
    const ms = obtenerFechaParcialEnMs(parcial.fecha);
    return ms !== null && ms >= new Date().setHours(0, 0, 0, 0);
  });
  const materiaProximoParcial = proximoParcial
    ? materias.find((materia) => materia.id === proximoParcial.materia_id)
    : null;
  const notificaciones = armarNotificacionesTablero({
    usuarioActual,
    novedades,
    avisos,
    invitacionesGrupo,
    materias,
    parciales,
    inscripciones,
    cronogramaCursada: cronogramaDeLaCursada
  });
  const horariosProximoParcial = proximoParcial
    ? horarios
      .filter((horario) => horario.materia_id === proximoParcial.materia_id)
      .sort((a, b) => String(a.dia).localeCompare(String(b.dia)) || a.hora_inicio.localeCompare(b.hora_inicio))
    : [];
  const diasCalendario = diasCalendarioDelMes(mesCalendario);
  const claveHoy = claveHoyCalendario();
  const tareasCalendario = materiasDeLaCursada.flatMap((materia) => materia.tareas.map((tarea) => ({ tarea, materia })));
  const eventosDelDiaCalendarioFn = (fecha: Date | null) => eventosDelDiaCalendario(fecha, {
    parcialesDeLaCursada,
    tareasCalendario,
    horariosDeLaCursada,
    cronogramaDeLaCursada
  });
  const materiasDelRanking = materiasMisCursadas.filter((materia) => materia.id === materiaRankingVisible);
  const alumnosDelRanking = materiaRankingVisible
    ? alumnosDeLaMateria(inscripciones, materiaRankingVisible)
    : [];
  const ranking = calcularRankingTablero({
    alumnosRanking: alumnosDelRanking.length > 0 ? alumnosDelRanking : alumnos,
    materiasDelRanking,
    materias,
    parciales,
    notas
  });
  const rankingPodio = ranking.slice(0, 3);
  const restoRanking = ranking.slice(3);
  const alumnosDelHistorial = ordenarAlumnosParaHistorial(usuarioActual, alumnos, ranking);
  const parcialesAgrupados = agruparParcialesPorMateria(parcialesOrdenados, materias);
  const alumnosOrdenadosPromocion = usuarioActual
    ? [usuarioActual, ...alumnos.filter((alumno) => alumno !== usuarioActual)]
    : alumnos;

  return {
    materiasDeLaCursada,
    parcialesDeLaCursada,
    cronogramaDeLaCursada,
    horariosDeLaCursada,
    parcialesOrdenados,
    proximoParcial,
    materiaProximoParcial,
    notificaciones,
    horariosProximoParcial,
    diasCalendario,
    claveHoy,
    tareasCalendario,
    eventosDelDiaCalendarioFn,
    ranking,
    rankingPodio,
    restoRanking,
    alumnosDelHistorial,
    parcialesAgrupados,
    alumnosOrdenadosPromocion,
    datosComparacion: usuarioActual && alumnoComparar
      ? calcularDatosComparacionRanking({
        usuarioActual,
        alumnoComparar,
        ranking,
        materias,
        notas,
        parciales
      })
      : null
  };
}

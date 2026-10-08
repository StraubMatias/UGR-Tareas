import {
  type Materia,
  type Nota,
  type Parcial,
  esForo,
  fechaEntregaTarea,
  formatearFechaHora,
  historialPorAlumno,
  obtenerTimestamp,
  aportesRankingDeTarea,
  puntosDeNotaParcial,
  tareaCuentaParaRanking
} from '../core/cursada.ts';
import { materiasQueCursa } from './companeros.ts';
import { esParcialRecuperatorio } from './recuperatorios-calendario.ts';
function parcialesRankingDelAlumno({
  alumno,
  notas,
  parciales,
  materiasDelRanking
}: {
  alumno: string;
  notas: Nota[];
  parciales: Parcial[];
  materiasDelRanking: Materia[];
}) {
  const idsMateria = new Set(materiasDelRanking.map((m) => m.id));
  const mejorPorParcial = new Map<string, { parcial: Parcial; puntos: number }>();

  notas
    .filter((nota) => nota.alumno === alumno)
    .forEach((nota) => {
      const parcial = parciales.find((item) => item.id === nota.parcial_id);
      if (!parcial || esParcialRecuperatorio(parcial) || !idsMateria.has(parcial.materia_id)) return;
      const puntos = puntosDeNotaParcial(nota.nota);
      if (puntos <= 0) return;
      const prev = mejorPorParcial.get(parcial.id);
      if (!prev || puntos > prev.puntos) {
        mejorPorParcial.set(parcial.id, { parcial, puntos });
      }
    });

  return [...mejorPorParcial.values()];
}

export interface EntradaRankingTablero {
  alumno: string;
  puntos: number;
  foros: number;
  actividades: number;
  tareasConPuntaje: Array<{
    alumno: string;
    materia: string;
    nombre: string;
    fechaCarga: string | null;
    puntos: number;
    puntosBase: number;
    tipo: string;
  }>;
  parcialesConPuntaje: Array<{
    nombre: string;
    materia: string;
    puntos: number;
    nota: number;
  }>;
  ultimaCompletadaEn: number;
}

export function calcularRankingTablero({
  alumnosRanking,
  materiasDelRanking,
  materias,
  parciales,
  notas
}: {
  alumnosRanking: string[];
  materiasDelRanking: Materia[];
  materias: Materia[];
  parciales: Parcial[];
  notas: Nota[];
}): EntradaRankingTablero[] {
  return alumnosRanking
    .map((alumno) => {
      const tareasDelRanking = materiasDelRanking.flatMap((materia) => materia.tareas);
      const tareasCompletadas = tareasDelRanking.filter(
        (tarea) => tareaCuentaParaRanking(tarea, alumno) || aportesRankingDeTarea(tarea, alumno).length > 0
      );
      const foros = tareasCompletadas.filter((tarea) => !tarea.conNota && esForo(tarea.nombre)).length;
      const actividades = tareasCompletadas.filter((tarea) => !tarea.conNota && !esForo(tarea.nombre)).length;
      const lineasTareas = tareasDelRanking.flatMap((tarea) => aportesRankingDeTarea(tarea, alumno));
      const puntosTareas = lineasTareas.map((linea) => linea.puntos);
      const parcialesRanking = parcialesRankingDelAlumno({
        alumno,
        notas,
        parciales,
        materiasDelRanking
      });
      const puntosParciales = parcialesRanking.map((item) => item.puntos);
      const tareasConPuntaje = materiasDelRanking.flatMap((materia) => materia.tareas
        .flatMap((tarea) => aportesRankingDeTarea(tarea, alumno).map((aporte) => ({
          alumno,
          materia: materia.nombre,
          nombre: aporte.nombre,
          fechaCarga: aporte.fechaCarga,
          puntos: aporte.puntos,
          puntosBase: aporte.puntosBase,
          tipo: aporte.tipo
        }))));
      const parcialesConPuntaje = parcialesRanking.map(({ parcial, puntos }) => ({
        nombre: parcial.nombre || 'Parcial',
        materia: materias.find((materia) => materia.id === parcial.materia_id)?.nombre || 'Materia',
        puntos,
        nota: puntos
      }));
      const ultimaCompletadaEn = [
        ...lineasTareas.map((linea) => linea.fechaCarga),
        ...tareasCompletadas.map((tarea) => fechaEntregaTarea(tarea, alumno))
      ]
        .map(obtenerTimestamp)
        .filter((fecha): fecha is number => fecha !== null)
        .sort((a, b) => b - a)[0] ?? Number.MAX_SAFE_INTEGER;

      return {
        alumno,
        puntos: puntosTareas.reduce((total, p) => total + p, 0) + puntosParciales.reduce((total, p) => total + p, 0),
        foros,
        actividades,
        tareasConPuntaje,
        parcialesConPuntaje,
        ultimaCompletadaEn
      };
    })
    .sort((a, b) => b.puntos - a.puntos || a.ultimaCompletadaEn - b.ultimaCompletadaEn || b.actividades - a.actividades || a.alumno.localeCompare(b.alumno));
}

export function ordenarAlumnosParaHistorial(
  usuarioActual: string | null,
  alumnos: string[],
  ranking: EntradaRankingTablero[]
): string[] {
  if (!usuarioActual) return alumnos;

  const puntosUsuarioHistorial = ranking.find((item) => item.alumno === usuarioActual)?.puntos ?? 0;
  const restoDeAlumnos = alumnos.filter((a) => a !== usuarioActual);

  return [
    usuarioActual,
    ...restoDeAlumnos.sort((alumnoA, alumnoB) => {
      const puntosA = ranking.find((item) => item.alumno === alumnoA)?.puntos ?? 0;
      const puntosB = ranking.find((item) => item.alumno === alumnoB)?.puntos ?? 0;
      const empateA = Math.abs(puntosA - puntosUsuarioHistorial) < 0.0001;
      const empateB = Math.abs(puntosB - puntosUsuarioHistorial) < 0.0001;
      return Number(empateB) - Number(empateA)
        || Math.abs(puntosA - puntosUsuarioHistorial) - Math.abs(puntosB - puntosUsuarioHistorial)
        || puntosB - puntosA
        || alumnoA.localeCompare(alumnoB);
    })
  ];
}

export function calcularDatosComparacionRanking({
  usuarioActual,
  alumnoComparar,
  ranking,
  materias,
  notas,
  parciales,
  inscripciones = []
}: {
  usuarioActual: string;
  alumnoComparar: string;
  ranking: EntradaRankingTablero[];
  materias: Materia[];
  notas: Nota[];
  parciales: Parcial[];
  inscripciones?: { alumno: string; materiaId: string }[];
}) {
  const usuarioRanking = ranking.find((item) => item.alumno === usuarioActual);
  const comparadoRanking = ranking.find((item) => item.alumno === alumnoComparar);
  if (!usuarioRanking || !comparadoRanking) return null;

  const historialUsuario = historialPorAlumno(
    usuarioActual,
    materias,
    notas,
    parciales,
    materiasQueCursa(inscripciones, usuarioActual)
  );
  const historialComparado = historialPorAlumno(
    alumnoComparar,
    materias,
    notas,
    parciales,
    materiasQueCursa(inscripciones, alumnoComparar)
  );

  const diferenciaPuntos = usuarioRanking.puntos - comparadoRanking.puntos;
  const puntosEmpatados = Math.abs(diferenciaPuntos) < 0.0001;
  const ultimaTareaUsuario = historialUsuario.find((registro) => obtenerTimestamp(registro.fecha) !== null);
  const ultimaTareaComparado = historialComparado.find((registro) => obtenerTimestamp(registro.fecha) !== null);
  const razonesPuntos: { id: string; texto: string; diferencia: number }[] = [];
  const registrosPorClave = new Map<string, Record<string, { alumno?: string; materia: string; nombre: string; puntos?: number }>>();

  [...usuarioRanking.tareasConPuntaje, ...comparadoRanking.tareasConPuntaje].forEach((registro) => {
    const clave = `tarea-${registro.materia}-${registro.nombre}`;
    const registros = registrosPorClave.get(clave) || {};
    registros[registro.alumno || ''] = registro;
    registrosPorClave.set(clave, registros);
  });

  usuarioRanking.parcialesConPuntaje.forEach((registro) => {
    const clave = `parcial-${registro.materia}-${registro.nombre}`;
    const registros = registrosPorClave.get(clave) || {};
    registros[usuarioActual] = registro;
    registrosPorClave.set(clave, registros);
  });
  comparadoRanking.parcialesConPuntaje.forEach((registro) => {
    const clave = `parcial-${registro.materia}-${registro.nombre}`;
    const registros = registrosPorClave.get(clave) || {};
    registros[alumnoComparar] = registro;
    registrosPorClave.set(clave, registros);
  });

  registrosPorClave.forEach((registros) => {
    const registroUsuario = registros[usuarioActual];
    const registroComparado = registros[alumnoComparar];
    const puntosUsuario = registroUsuario?.puntos || 0;
    const puntosComparado = registroComparado?.puntos || 0;
    const diferencia = puntosUsuario - puntosComparado;
    if (Math.abs(diferencia) < 0.0001) return;

    const registro = registroUsuario || registroComparado;
    razonesPuntos.push({
      id: `${registro.materia}-${registro.nombre}`,
      texto: registroUsuario && registroComparado
        ? `${registro.materia}: ${registro.nombre} aporta ${puntosUsuario.toFixed(1)} vs. ${puntosComparado.toFixed(1)} puntos.`
        : `${registro.materia}: ${registro.nombre} aporta ${registroUsuario ? puntosUsuario.toFixed(1) : '0.0'} vs. ${registroComparado ? puntosComparado.toFixed(1) : '0.0'} puntos porque solo lo tiene registrado ${registroUsuario ? usuarioActual : alumnoComparar}.`,
      diferencia
    });
  });

  razonesPuntos.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
  let motivo;

  if (!puntosEmpatados) {
    const ganador = diferenciaPuntos > 0 ? usuarioActual : alumnoComparar;
    motivo = `${ganador} está arriba por ${Math.abs(diferenciaPuntos).toFixed(1)} puntos.`;
  } else if (usuarioRanking.ultimaCompletadaEn !== comparadoRanking.ultimaCompletadaEn) {
    const ganador = usuarioRanking.ultimaCompletadaEn < comparadoRanking.ultimaCompletadaEn
      ? usuarioActual
      : alumnoComparar;
    const fechaGanador = ganador === usuarioActual
      ? usuarioRanking.ultimaCompletadaEn
      : comparadoRanking.ultimaCompletadaEn;
    motivo = `${ganador} queda primero porque su última tarea registrada fue realizada antes: ${formatearFechaHora(new Date(fechaGanador).toISOString())}.`;
  } else if (usuarioRanking.actividades !== comparadoRanking.actividades) {
    const ganador = usuarioRanking.actividades > comparadoRanking.actividades ? usuarioActual : alumnoComparar;
    motivo = `${ganador} queda primero porque tiene más actividades completas (${Math.max(usuarioRanking.actividades, comparadoRanking.actividades)} contra ${Math.min(usuarioRanking.actividades, comparadoRanking.actividades)}).`;
  } else {
    motivo = 'Empatan también en el desempate por fecha y cantidad de actividades; el orden actual se define por nombre.';
  }

  return {
    usuarioRanking,
    comparadoRanking,
    historialUsuario,
    historialComparado,
    ultimaTareaUsuario,
    ultimaTareaComparado,
    puntosEmpatados,
    motivo,
    diferenciaPuntos,
    razonesPuntos
  };
}

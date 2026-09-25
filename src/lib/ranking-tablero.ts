import {
  type Materia,
  type Nota,
  type Parcial,
  esForo,
  fechaEntregaTarea,
  formatearFechaHora,
  historialPorAlumno,
  multiplicadorPuntosTarea,
  obtenerTimestamp,
  puntosBaseTarea,
  tareaCompletadaPor
} from '../core/cursada';

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
      const tareasCompletadas = materiasDelRanking.flatMap((materia) => materia.tareas)
        .filter((tarea) => tareaCompletadaPor(tarea, alumno));
      const foros = tareasCompletadas.filter((tarea) => !tarea.conNota && esForo(tarea.nombre)).length;
      const actividades = tareasCompletadas.filter((tarea) => !tarea.conNota && !esForo(tarea.nombre)).length;
      const notasTareasAlumno = tareasCompletadas
        .filter((tarea) => tarea.conNota)
        .filter((tarea) => {
          const nota = puntosBaseTarea(tarea, alumno);
          return Number.isFinite(nota) && nota >= 1 && nota <= 10;
        })
        .map((tarea) => puntosBaseTarea(tarea, alumno) * multiplicadorPuntosTarea(tarea, alumno));
      const puntosActividades = tareasCompletadas
        .filter((tarea) => !tarea.conNota)
        .reduce((total, tarea) => total + puntosBaseTarea(tarea, alumno) * multiplicadorPuntosTarea(tarea, alumno), 0);
      const notasAlumno = notas
        .filter((nota) => nota.alumno === alumno)
        .filter((nota) => {
          const parcial = parciales.find((item) => item.id === nota.parcial_id);
          return materiasDelRanking.some((materia) => materia.id === parcial?.materia_id);
        })
        .map((nota) => Number.parseFloat(String(nota.nota).replace(',', '.')))
        .filter((nota) => Number.isFinite(nota) && nota >= 0 && nota <= 10);
      const tareasConPuntaje = materiasDelRanking.flatMap((materia) => materia.tareas
        .filter((tarea) => tareaCompletadaPor(tarea, alumno))
        .map((tarea) => ({
          alumno,
          materia: materia.nombre,
          nombre: tarea.nombre,
          fechaCarga: fechaEntregaTarea(tarea, alumno),
          puntos: puntosBaseTarea(tarea, alumno) * multiplicadorPuntosTarea(tarea, alumno),
          puntosBase: puntosBaseTarea(tarea, alumno),
          tipo: tarea.conNota ? 'Nota de tarea' : esForo(tarea.nombre) ? 'Foro' : 'Actividad'
        }))
        .filter((tarea) => tarea.puntosBase >= (tarea.tipo === 'Nota de tarea' ? 1 : 0) && tarea.puntosBase <= (tarea.tipo === 'Nota de tarea' ? 10 : 2)));
      const parcialesConPuntaje = notas
        .filter((nota) => nota.alumno === alumno)
        .map((nota) => {
          const parcial = parciales.find((item) => item.id === nota.parcial_id);
          const valor = Number.parseFloat(String(nota.nota).replace(',', '.'));
          return {
            nombre: parcial?.nombre || 'Parcial',
            materia: materias.find((materia) => materia.id === parcial?.materia_id)?.nombre || 'Materia',
            puntos: valor / 10,
            nota: valor
          };
        })
        .filter((parcial) => materiasDelRanking.some((materia) => materia.nombre === parcial.materia))
        .filter((parcial) => Number.isFinite(parcial.nota) && parcial.nota >= 0 && parcial.nota <= 10);
      const ultimaCompletadaEn = tareasCompletadas
        .map((tarea) => fechaEntregaTarea(tarea, alumno))
        .map(obtenerTimestamp)
        .filter((fecha) => fecha !== null)
        .sort((a, b) => b - a)[0] || Number.MAX_SAFE_INTEGER;

      return {
        alumno,
        puntos: puntosActividades + notasAlumno.reduce((total, nota) => total + nota / 10, 0) + notasTareasAlumno.reduce((total, nota) => total + nota, 0),
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
  parciales
}: {
  usuarioActual: string;
  alumnoComparar: string;
  ranking: EntradaRankingTablero[];
  materias: Materia[];
  notas: Nota[];
  parciales: Parcial[];
}) {
  const usuarioRanking = ranking.find((item) => item.alumno === usuarioActual);
  const comparadoRanking = ranking.find((item) => item.alumno === alumnoComparar);
  if (!usuarioRanking || !comparadoRanking) return null;

  const historialUsuario = historialPorAlumno(usuarioActual, materias, notas, parciales);
  const historialComparado = historialPorAlumno(alumnoComparar, materias, notas, parciales);
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

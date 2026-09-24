import {
  type MateriaPlan,
  CUATRIMESTRES_PLAN,
  PLAN_DE_ESTUDIO,
  crearIndicePlan,
  obtenerCorrelativasPendientesSimuladas as obtenerCorrelativasPendientesDelPlan,
  calcularMateriasPriorizadas
} from '../app/plan-utils';

export type RegistroProgresoPlan = {
  alumno: string | null;
  materia_codigo: string;
  estado: string;
  nota: number | null;
  actualizado_en: string;
};

export function calcularDerivadosPlanEstudio(
  progresoPlan: RegistroProgresoPlan[],
  usuarioActual: string | null,
  materiasSimuladas: string[],
  cuatrimestreSimulado: string
) {
  const planDeEstudio = PLAN_DE_ESTUDIO;
  const cuatrimestresPlan = CUATRIMESTRES_PLAN;
  const materiaPlanPorCodigo = crearIndicePlan(planDeEstudio);
  const progresoPlanPorClave = Object.fromEntries(
    progresoPlan.map((registro) => [`${registro.alumno}_${registro.materia_codigo}`, registro])
  );

  const obtenerMateriaPlan = (codigo: string) => materiaPlanPorCodigo[codigo];
  const obtenerProgresoMateria = (alumno: string | null, codigo: string) => progresoPlanPorClave[`${alumno}_${codigo}`];
  const obtenerCorrelativasPendientes = (materia: MateriaPlan, alumno: string | null) => materia.correlativas.filter((correlativa) => {
    const materiaCorrelativa = obtenerMateriaPlan(correlativa);
    if (!materiaCorrelativa) return true;
    const estado = obtenerProgresoMateria(alumno, materiaCorrelativa.codigo)?.estado;
    return !['aprobada', 'promocionada'].includes(estado);
  });

  const materiasAprobadasUsuario = planDeEstudio.filter((materia) => ['aprobada', 'promocionada'].includes(obtenerProgresoMateria(usuarioActual, materia.codigo)?.estado));
  const materiasPendientesUsuario = planDeEstudio.filter((materia) => !materiasAprobadasUsuario.some((aprobada) => aprobada.codigo === materia.codigo));
  const codigosAprobadosSimulados = new Set([...materiasAprobadasUsuario.map((materia) => materia.codigo), ...materiasSimuladas]);
  const cuatrimestreSugerido = cuatrimestresPlan.find((cuatrimestre) => planDeEstudio.some((materia) => (
    materia.cuatrimestre === cuatrimestre && !codigosAprobadosSimulados.has(materia.codigo)
  ))) || cuatrimestresPlan[0];
  const cuatrimestreActivo = cuatrimestreSimulado || cuatrimestreSugerido;
  const materiasDelSimulador = planDeEstudio.filter((materia) => materia.cuatrimestre === cuatrimestreActivo && !codigosAprobadosSimulados.has(materia.codigo));
  const obtenerCorrelativasPendientesSimuladas = (materia: MateriaPlan) => obtenerCorrelativasPendientesDelPlan(materia, codigosAprobadosSimulados, materiaPlanPorCodigo);
  const materiasRecomendadas = materiasDelSimulador.filter((materia) => obtenerCorrelativasPendientesSimuladas(materia).length === 0);
  const materiasExtraDisponibles = materiasPendientesUsuario
    .filter((materia) => materia.cuatrimestre !== cuatrimestreActivo && !codigosAprobadosSimulados.has(materia.codigo))
    .map((materia) => ({
      materia,
      habilita: materiasPendientesUsuario.filter((otra) => otra.codigo !== materia.codigo && otra.correlativas.includes(materia.codigo)).length,
      pendientes: obtenerCorrelativasPendientesSimuladas(materia).length
    }))
    .filter(({ pendientes }) => pendientes === 0)
    .sort((a, b) => b.habilita - a.habilita);
  const materiasPriorizadas = calcularMateriasPriorizadas(planDeEstudio, codigosAprobadosSimulados);

  return {
    planDeEstudio,
    cuatrimestresPlan,
    obtenerMateriaPlan,
    obtenerProgresoMateria,
    obtenerCorrelativasPendientes,
    obtenerCorrelativasPendientesSimuladas,
    materiasAprobadasUsuario,
    materiasPendientesUsuario,
    cuatrimestreActivo,
    cuatrimestreSugerido,
    materiasDelSimulador,
    materiasRecomendadas,
    materiasExtraDisponibles,
    materiasPriorizadas
  };
}

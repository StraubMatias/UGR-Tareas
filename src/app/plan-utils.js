export const CUATRIMESTRES_PLAN = [
  '1° año · 1° cuatrimestre',
  '1° año · 2° cuatrimestre',
  '2° año · 1° cuatrimestre',
  '2° año · 2° cuatrimestre',
  '3° año · 1° cuatrimestre'
];

export const PLAN_DE_ESTUDIO = [
  { codigo: '1.1.1', nombre: 'Introducción a la Seguridad de la Información', cuatrimestre: '1° año · 1° cuatrimestre', correlativas: [] },
  { codigo: '1.2.1', nombre: 'Introducción a Tecnologías de la Información y las Comunicaciones (TIC)', cuatrimestre: '1° año · 1° cuatrimestre', correlativas: [] },
  { codigo: '1.3.1', nombre: 'Tecnologías de las Comunicaciones', cuatrimestre: '1° año · 1° cuatrimestre', correlativas: [] },
  { codigo: '1.4.1', nombre: 'Seguridad Física', cuatrimestre: '1° año · 1° cuatrimestre', correlativas: [] },
  { codigo: '1.5.1', nombre: 'Inglés Técnico', cuatrimestre: '1° año · 1° cuatrimestre', correlativas: [] },
  { codigo: '1.6.2', nombre: 'Sistemas de Gestión de Seguridad de la Información (Marcos Normativos)', cuatrimestre: '1° año · 2° cuatrimestre', correlativas: ['1.1.1'] },
  { codigo: '1.7.2', nombre: 'Auditorías de Seguridad de la Información', cuatrimestre: '1° año · 2° cuatrimestre', correlativas: ['1.1.1'] },
  { codigo: '1.8.2', nombre: 'Ciberdelitos', cuatrimestre: '1° año · 2° cuatrimestre', correlativas: [] },
  { codigo: '1.9.2', nombre: 'Evaluación y Gestión de Riesgos', cuatrimestre: '1° año · 2° cuatrimestre', correlativas: [] },
  { codigo: '1.10.2', nombre: 'Gestión de Activos de la Información', cuatrimestre: '1° año · 2° cuatrimestre', correlativas: ['1.2.1'] },
  { codigo: '2.11.1', nombre: 'Tratamiento de Vulnerabilidades', cuatrimestre: '2° año · 1° cuatrimestre', correlativas: ['1.9.2'] },
  { codigo: '2.12.1', nombre: 'Aspectos Legales y Normativos', cuatrimestre: '2° año · 1° cuatrimestre', correlativas: ['1.8.2'] },
  { codigo: '2.13.1', nombre: 'Gestión de Continuidad del Negocio', cuatrimestre: '2° año · 1° cuatrimestre', correlativas: ['1.9.2'] },
  { codigo: '2.14.1', nombre: 'Seguridad en el Software Base y las Aplicaciones', cuatrimestre: '2° año · 1° cuatrimestre', correlativas: ['1.2.1'] },
  { codigo: '2.15.1', nombre: 'Gestión de Accesos', cuatrimestre: '2° año · 1° cuatrimestre', correlativas: ['1.6.2'] },
  { codigo: '2.16.1', nombre: 'Conceptos de Desarrollo de Software', cuatrimestre: '2° año · 1° cuatrimestre', correlativas: [] },
  { codigo: '2.17.2', nombre: 'Tratamiento de Incidentes', cuatrimestre: '2° año · 2° cuatrimestre', correlativas: ['2.13.1'] },
  { codigo: '2.18.2', nombre: 'Introducción a la Criptografía', cuatrimestre: '2° año · 2° cuatrimestre', correlativas: [] },
  { codigo: '2.19.2', nombre: 'Técnicas de Hacking Ético', cuatrimestre: '2° año · 2° cuatrimestre', correlativas: ['2.11.1'] },
  { codigo: '2.20.2', nombre: 'Infraestructuras Críticas', cuatrimestre: '2° año · 2° cuatrimestre', correlativas: ['2.13.1'] },
  { codigo: '2.21.2', nombre: 'Desarrollo de Software Seguro', cuatrimestre: '2° año · 2° cuatrimestre', correlativas: ['2.14.1', '2.16.1'] },
  { codigo: '2.22.2', nombre: 'Seguridad en Cloud Services', cuatrimestre: '2° año · 2° cuatrimestre', correlativas: ['1.6.2'] },
  { codigo: '3.23.1', nombre: 'Análisis Forense', cuatrimestre: '3° año · 1° cuatrimestre', correlativas: ['2.12.1'] },
  { codigo: '3.24.1', nombre: 'Cibercrimen, Evidencia e Investigación Digital', cuatrimestre: '3° año · 1° cuatrimestre', correlativas: [] },
  { codigo: '3.25.1', nombre: 'Ciberdefensa', cuatrimestre: '3° año · 1° cuatrimestre', correlativas: ['2.12.1', '2.20.2'] },
  { codigo: '3.26.1', nombre: 'Pasantía Profesional', cuatrimestre: '3° año · 1° cuatrimestre', correlativas: ['1° año aprobado', '1° cuatrimestre de 2° año regularizado'] }
];

export function crearIndicePlan(plan = PLAN_DE_ESTUDIO) {
  return Object.fromEntries(plan.map((materia) => [materia.codigo, materia]));
}

export function obtenerCorrelativasPendientesSimuladas(materia, codigosAprobados, indicePlan = crearIndicePlan()) {
  return materia.correlativas.filter((correlativa) => {
    const materiaCorrelativa = indicePlan[correlativa];
    return materiaCorrelativa ? !codigosAprobados.has(materiaCorrelativa.codigo) : true;
  });
}

export function calcularMateriasPriorizadas(plan, codigosAprobados) {
  const indicePlan = crearIndicePlan(plan);
  return plan
    .filter((materia) => !codigosAprobados.has(materia.codigo))
    .map((materia) => ({
      materia,
      habilita: plan.filter((otra) => otra.codigo !== materia.codigo && otra.correlativas.includes(materia.codigo)).length,
      pendientes: obtenerCorrelativasPendientesSimuladas(materia, codigosAprobados, indicePlan).length
    }))
    .filter(({ pendientes }) => pendientes === 0)
    .sort((a, b) => b.habilita - a.habilita);
}

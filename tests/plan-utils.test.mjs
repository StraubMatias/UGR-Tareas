import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_DE_ESTUDIO,
  crearIndicePlan,
  obtenerCorrelativasPendientesSimuladas,
  calcularMateriasPriorizadas
} from '../src/app/plan-utils.js';

test('identifica correlativas pendientes', () => {
  const indice = crearIndicePlan();
  const materia = indice['1.6.2'];

  assert.deepEqual(obtenerCorrelativasPendientesSimuladas(materia, new Set(), indice), ['1.1.1']);
  assert.deepEqual(obtenerCorrelativasPendientesSimuladas(materia, new Set(['1.1.1']), indice), []);
});

test('prioriza una materia habilitada que desbloquea otras', () => {
  const aprobadas = new Set(['1.1.1', '1.2.1', '1.8.2', '1.9.2']);
  const prioridades = calcularMateriasPriorizadas(PLAN_DE_ESTUDIO, aprobadas);
  const tratamientoVulnerabilidades = prioridades.find(({ materia }) => materia.codigo === '2.11.1');

  assert.equal(tratamientoVulnerabilidades?.pendientes, 0);
  assert.equal(tratamientoVulnerabilidades?.habilita, 1);
});

test('no recomienda materias con correlativas desconocidas', () => {
  const prioridades = calcularMateriasPriorizadas(PLAN_DE_ESTUDIO, new Set(PLAN_DE_ESTUDIO.slice(0, 25).map((materia) => materia.codigo)));

  assert.equal(prioridades.some(({ materia }) => materia.codigo === '3.26.1'), false);
});

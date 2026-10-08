import test from 'node:test';
import assert from 'node:assert/strict';
import {
  indicesParcialesARecuperar,
  etiquetaParcialesRecuperatorio,
  personalizarParcialesDelDia,
  esParcialRecuperatorio
} from '../src/lib/recuperatorios-calendario.ts';

const parciales = [
  { id: 'p1', materia_id: 'dev', nombre: '1er Parcial', fecha: '2026-09-20' },
  { id: 'p2', materia_id: 'dev', nombre: '2do Parcial', fecha: '2026-10-01' },
  { id: 'pr', materia_id: 'dev', nombre: 'Recuperatorio', fecha: '2026-11-26' }
];
const HOY_REF = '2026-10-08';

test('esParcialRecuperatorio detecta el nombre del campus', () => {
  assert.equal(esParcialRecuperatorio({ nombre: 'Recuperatorio noviembre' }), true);
  assert.equal(esParcialRecuperatorio({ nombre: '1er Parcial' }), false);
});

test('indicesParcialesARecuperar solo cuenta notas cargadas bajo 6', () => {
  const notasSoloP1 = [{ parcial_id: 'p1', alumno: 'Ana', nota: 4 }];
  assert.deepEqual(
    indicesParcialesARecuperar('Ana', 'dev', parciales, notasSoloP1, HOY_REF),
    [0]
  );
  const notasAmbos = [
    { parcial_id: 'p1', alumno: 'Ana', nota: 4 },
    { parcial_id: 'p2', alumno: 'Ana', nota: 3 }
  ];
  assert.deepEqual(
    indicesParcialesARecuperar('Ana', 'dev', parciales, notasAmbos, HOY_REF),
    [0, 1]
  );
  const apruebaP1 = [{ parcial_id: 'p1', alumno: 'Ana', nota: 8 }, { parcial_id: 'p2', alumno: 'Ana', nota: 4 }];
  assert.deepEqual(
    indicesParcialesARecuperar('Ana', 'dev', parciales, apruebaP1, HOY_REF),
    [1]
  );
});

test('etiquetaParcialesRecuperatorio arma el texto del día', () => {
  assert.match(etiquetaParcialesRecuperatorio([0]), /1\.er parcial/);
  assert.match(etiquetaParcialesRecuperatorio([0, 1]), /1\.er parcial y 2\.do parcial/);
});

test('personalizarParcialesDelDia oculta recuperatorio si no hay nada pendiente', () => {
  const dia = personalizarParcialesDelDia(
    [parciales[2]],
    parciales,
    'Ana',
    [{ parcial_id: 'p1', alumno: 'Ana', nota: 9 }, { parcial_id: 'p2', alumno: 'Ana', nota: 7 }],
    [],
    '2026-11-26'
  );
  assert.equal(dia.length, 0);
});

test('personalizarParcialesDelDia muestra qué parciales recupera', () => {
  const dia = personalizarParcialesDelDia(
    [parciales[2]],
    parciales,
    'Ana',
    [{ parcial_id: 'p1', alumno: 'Ana', nota: 5 }],
    [],
    '2026-11-26'
  );
  assert.equal(dia.length, 1);
  assert.match(dia[0].nombre, /1\.er parcial/);
});

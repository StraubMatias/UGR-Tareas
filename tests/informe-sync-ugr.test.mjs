import test from 'node:test';
import assert from 'node:assert/strict';
import {
  construirLineasInformeSync,
  fusionarLineasInforme,
  mensajeDesdeInforme
} from '../src/lib/informe-sync-ugr.ts';

test('el informe lista notas nuevas del campus con materia y tarea', () => {
  const lineas = construirLineasInformeSync({
    notasCampus: [{
      tareaId: 't1',
      nombre: 'TP DIS-A',
      materia: 'Evaluación y Gestión de Riesgos',
      nota: '8',
      yaEstaba: false
    }]
  });
  assert.equal(lineas.length, 1);
  assert.match(lineas[0], /nota 8/i);
  assert.match(lineas[0], /Evaluación/);
  assert.match(lineas[0], /TP DIS-A/);
});

test('notas que ya estaban no generan línea', () => {
  const lineas = construirLineasInformeSync({
    notasCampus: [{ nombre: 'TP', nota: '8', yaEstaba: true }]
  });
  assert.equal(lineas.length, 0);
});

test('fusionarLineasInforme une sin duplicar', () => {
  const lineas = fusionarLineasInforme(['A'], ['A', 'B']);
  assert.deepEqual(lineas, ['A', 'B']);
});

test('sin cambios el mensaje lo dice claro', () => {
  const msg = mensajeDesdeInforme([], 3);
  assert.match(msg, /no había nada nuevo/i);
  assert.match(msg, /3 materias/);
});

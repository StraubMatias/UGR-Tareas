import test from 'node:test';
import assert from 'node:assert/strict';
import { alumnosConLaMismaCursada, alumnosDeLaMateria, materiasQueCursa } from '../src/lib/companeros.ts';

const inscripciones = [
  { alumno: 'Ana', materiaId: 'm1' },
  { alumno: 'Ana', materiaId: 'm2' },
  { alumno: 'Luis', materiaId: 'm1' },
  { alumno: 'Luis', materiaId: 'm2' },
  { alumno: 'Sol', materiaId: 'm1' },
  { alumno: 'Sol', materiaId: 'm2' },
  { alumno: 'Sol', materiaId: 'm3' },
  { alumno: 'Nico', materiaId: 'm9' }
];

test('el ranking y el estado solo incluyen a quien cursa exactamente las mismas materias', () => {
  assert.deepEqual(
    alumnosConLaMismaCursada(inscripciones, 'Ana', ['m1', 'm2', 'm3', 'm9']),
    ['Ana', 'Luis']
  );
});

test('dos materias de más dejan afuera a ese alumno', () => {
  const companeros = alumnosConLaMismaCursada(inscripciones, 'Sol', ['m1', 'm2', 'm3']);
  assert.deepEqual(companeros, ['Sol']);
  assert.equal(companeros.includes('Ana'), false);
});

test('el ranking de una materia incluye a quien la cursa aunque tenga otras', () => {
  assert.deepEqual(alumnosDeLaMateria(inscripciones, 'm1'), ['Ana', 'Luis', 'Sol']);
  assert.deepEqual(alumnosDeLaMateria(inscripciones, 'm3'), ['Sol']);
});

test('las materias de un alumno son solo las de su inscripción', () => {
  assert.deepEqual([...materiasQueCursa(inscripciones, 'Ana')].sort(), ['m1', 'm2']);
  assert.equal(materiasQueCursa(inscripciones, 'Nadie').size, 0);
});

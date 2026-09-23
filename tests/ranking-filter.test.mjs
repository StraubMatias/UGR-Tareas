import test from 'node:test';
import assert from 'node:assert/strict';
import { materiasQueCursa, alumnosDeLaMateria } from '../src/lib/companeros.ts';

// Datos de prueba: 3 materias, 3 alumnos con inscripciones distintas
const inscripciones = [
  { alumno: 'Ana', materiaId: 'm1' },
  { alumno: 'Ana', materiaId: 'm2' },
  { alumno: 'Luis', materiaId: 'm1' },
  { alumno: 'Luis', materiaId: 'm2' },
  { alumno: 'Sol', materiaId: 'm1' },
  { alumno: 'Sol', materiaId: 'm2' },
  { alumno: 'Sol', materiaId: 'm3' },
  { alumno: 'Nico', materiaId: 'm9' },
];

const todasLasMaterias = [
  { id: 'm1', nombre: 'Matemática' },
  { id: 'm2', nombre: 'Física' },
  { id: 'm3', nombre: 'Química' },
  { id: 'm9', nombre: 'Historia' },
];

test('el selector de ranking solo muestra las materias que el usuario cursa', () => {
  const idsCursadas = materiasQueCursa(inscripciones, 'Ana');
  const materiasFiltradas = todasLasMaterias.filter((m) => idsCursadas.has(m.id));
  assert.deepEqual(
    materiasFiltradas.map((m) => m.id).sort(),
    ['m1', 'm2'],
    'Ana solo debe ver Matemática y Física, no Química ni Historia'
  );
});

test('el ranking de una materia visible solo incluye alumnos que la cursan', () => {
  // Ana cursa m1 y m2; el ranking de m1 debe mostrar a Ana, Luis y Sol (no a Nico)
  const alumnosM1 = alumnosDeLaMateria(inscripciones, 'm1');
  assert.deepEqual(alumnosM1, ['Ana', 'Luis', 'Sol']);
  assert.equal(alumnosM1.includes('Nico'), false);
});

test('un usuario sin inscripciones no ve ninguna materia en el ranking', () => {
  const idsCursadas = materiasQueCursa(inscripciones, 'Eva');
  assert.equal(idsCursadas.size, 0);
});

test('la materia seleccionada por defecto es la primera cursada', () => {
  const idsCursadas = materiasQueCursa(inscripciones, 'Sol');
  const primerId = todasLasMaterias
    .filter((m) => idsCursadas.has(m.id))
    .map((m) => m.id)[0];
  assert.equal(primerId, 'm1', 'Sol cursa m1, m2, m3; la primera debe ser m1');
});

test('el fallback a la primera materia visible evita selecciones inválidas', () => {
  // Simula la lógica de materiaRankingVisible: si la seleccionada actual no está en las cursadas, usar la primera
  const idsCursadas = materiasQueCursa(inscripciones, 'Luis');
  const materiasVisibles = todasLasMaterias.filter((m) => idsCursadas.has(m.id));
  const seleccionInvalida = 'm3'; // Luis no cursa m3
  const visible = materiasVisibles.some((m) => m.id === seleccionInvalida)
    ? seleccionInvalida
    : materiasVisibles[0]?.id ?? '';
  assert.equal(visible, 'm1', 'Debe fallback a la primera materia cursada por Luis');
});

test('alumnos en el ranking de una materia no incluyen a quien no la cursa', () => {
  // Nico solo cursa m9, que no está en las materias visibles de Ana
  const alumnosM2 = alumnosDeLaMateria(inscripciones, 'm2');
  assert.deepEqual(alumnosM2, ['Ana', 'Luis', 'Sol']);
  assert.equal(alumnosM2.includes('Nico'), false);
});
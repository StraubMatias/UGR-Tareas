import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerCursos, extraerNombreCursoDesdePagina } from '../../src/lib/ugr/materias.mjs';
import { extraerFechasActividad, extraerTareas } from '../../src/lib/ugr/tareas.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('extraerCursos lista los cursos de la página de cursos', async () => {
  const html = await readFile(path.join(DIR, 'cursos.html'), 'utf8');
  const cursos = extraerCursos(html, 'https://virtual.ugr.edu.ar');

  assert.ok(cursos.length >= 5);
  assert.deepEqual(cursos[0].id, '101');
  assert.ok(cursos[0].nombre.includes('GESTIÓN DE ACTIVOS'));
  assert.ok(cursos[0].url.startsWith('https://virtual.ugr.edu.ar/course/view.php'));

  // No se repiten cursos con el mismo id (el link "Mis cursos" del nav no cuenta).
  const ids = cursos.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('extraerCursos captura también los cursos del select del calendario', async () => {
  const html = await readFile(path.join(DIR, 'cursos.html'), 'utf8');
  const cursos = extraerCursos(html, 'https://virtual.ugr.edu.ar');

  // El select trae los cursos reales del periodo, con prefijo de versión y
  // nombre truncado (termina en "...").
  const auditorias = cursos.find((c) => c.id === '1310');
  assert.ok(auditorias, 'debería existir el curso de Auditorías');
  assert.equal(auditorias.nombreIncompleto, true);
  assert.ok(auditorias.nombre.includes('AUDITORÍAS'));

  const sistemas = cursos.find((c) => c.id === '1309');
  assert.ok(sistemas);
  assert.equal(sistemas.nombreIncompleto, true);

  // Las categorías (value con ruta) no cuentan como cursos.
  assert.equal(cursos.some((c) => c.id === '1'), false);
  assert.equal(cursos.some((c) => c.url.includes('categoryid')), false);
});

test('extraerCursos no se engancha con el enlace genérico "Mis cursos"', async () => {
  const html = await readFile(path.join(DIR, 'cursos.html'), 'utf8');
  const cursos = extraerCursos(html);
  assert.equal(cursos.some((c) => c.nombre === 'Mis cursos'), false);
});

test('extraerNombreCursoDesdePagina saca el nombre completo del breadcrumb', async () => {
  const html = await readFile(path.join(DIR, 'curso.html'), 'utf8');
  const nombre = extraerNombreCursoDesdePagina(html, '1310');
  assert.equal(nombre, '(V.TUCS.1.07.2) AUDITORÍAS DE SEGURIDAD DE LA INFORMACIÓN');
});

test('extraerTareas parsea nombre y fechas del índice de asignaciones', async () => {
  const html = await readFile(path.join(DIR, 'tareas.html'), 'utf8');
  const tareas = extraerTareas(html, 'https://virtual.ugr.edu.ar');

  assert.equal(tareas.length, 2); // el foro no es un assign
  assert.equal(tareas[0].id, '7001');
  assert.equal(tareas[0].nombre, 'Contexto organizacional y activos de información');
  assert.equal(tareas[0].inicio, '2026-09-04');
  assert.equal(tareas[0].fin, '2026-10-02');
  assert.equal(tareas[1].inicio, '2026-10-08');
  assert.equal(tareas[1].fin, '2026-10-29');
});

test('extraerTareas completa URL del detalle', async () => {
  const html = await readFile(path.join(DIR, 'tareas.html'), 'utf8');
  const tareas = extraerTareas(html, 'https://virtual.ugr.edu.ar');
  assert.ok(tareas[0].url.includes('/mod/assign/view.php?id=7001'));
});

test('extraerTareas parsea el formato overview de Moodle 4.5 (Auditorías)', async () => {
  const html = await readFile(path.join(DIR, 'tareas-overview.html'), 'utf8');
  const tareas = extraerTareas(html, 'https://virtual.ugr.edu.ar');

  assert.equal(tareas.length, 2);
  assert.equal(tareas[0].id, '199391');
  assert.equal(tareas[0].nombre, 'Auditorías de SI, UII Tarea nro.1');
  assert.ok(tareas[0].url.includes('/mod/assign/view.php?id=199391'));
  assert.equal(tareas[0].fin, '2026-09-25');
  assert.equal(tareas[0].unidad, 2); // <div class="small">Unidad II</div>
  assert.equal(tareas[1].id, '201629');
  assert.equal(tareas[1].nombre, 'Trabajo nro. 2, UII.');
  assert.equal(tareas[1].fin, '2026-10-16');
  assert.equal(tareas[1].unidad, 2);
});

test('extraerFechasActividad lee la apertura y el cierre del detalle de la tarea', async () => {
  const html = await readFile(path.join(DIR, 'actividad.html'), 'utf8');
  const fechas = extraerFechasActividad(html);

  assert.deepEqual(fechas, { inicio: '2026-09-10', fin: '2026-10-16' });
});

test('extraerFechasActividad devuelve null si no hay bloque de fechas', () => {
  assert.deepEqual(extraerFechasActividad('<html><body>hola</body></html>'), { inicio: null, fin: null });
  assert.deepEqual(extraerFechasActividad(''), { inicio: null, fin: null });
  assert.deepEqual(extraerFechasActividad(null), { inicio: null, fin: null });
});
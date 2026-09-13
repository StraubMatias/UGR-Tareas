import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerCursos, extraerNombreCursoDesdePagina } from '../lib/materias.mjs';
import { esActividadInformativa, esForoInformativo, extraerActividadesOverview, extraerFechasActividad, extraerForos, extraerTareas } from '../lib/tareas.mjs';

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

  assert.equal(tareas.length, 3); // 2 assigns + el foro que también lista la página
  assert.equal(tareas[0].id, '7001');
  assert.equal(tareas[0].nombre, 'Contexto organizacional y activos de información');
  assert.equal(tareas[0].inicio, '2026-09-04');
  assert.equal(tareas[0].fin, '2026-10-02');
  assert.equal(tareas[1].inicio, '2026-10-08');
  assert.equal(tareas[1].fin, '2026-10-29');
});

test('extraerTareas también captura los foros y les arma el enlace de forum', async () => {
  const html = await readFile(path.join(DIR, 'tareas.html'), 'utf8');
  const tareas = extraerTareas(html, 'https://virtual.ugr.edu.ar');
  const foro = tareas.find((t) => t.id === '7003');

  assert.ok(foro, 'debería existir la fila del foro');
  assert.equal(foro.nombre, 'Foro de presentación');
  assert.equal(foro.tipo, 'foro');
  assert.equal(foro.conNota, false); // un foro no llega automáticamente como calificable
  assert.equal(foro.inicio, 'Sin fecha');
  assert.equal(foro.fin, 'Sin fecha');
  assert.ok(foro.url.includes('/mod/forum/view.php?id=7003'));
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

test('extraerForos captura los foros del índice de foros con su sección', async () => {
  const html = await readFile(path.join(DIR, 'foros.html'), 'utf8');
  const foros = extraerForos(html, 'https://virtual.ugr.edu.ar');

  // «Avisos» es un foro informativo: no es una consigna, así que se descarta.
  assert.equal(foros.length, 2);
  assert.equal(foros.some((f) => f.nombre === 'Avisos'), false);
  for (const foro of foros) {
    assert.equal(foro.tipo, 'foro');
    assert.equal(foro.conNota, false);
    assert.equal(foro.inicio, 'Sin fecha');
    assert.equal(foro.fin, 'Sin fecha');
  }

  const hallazgos = foros.find((f) => f.id === '267799');
  assert.equal(hallazgos.nombre, 'Hallazgos de la Semana');
  assert.ok(hallazgos.url.includes('/mod/forum/view.php?id=267799'));
  assert.equal(hallazgos.unidad, null); // sección «General»

  const wifi = foros.find((f) => f.id === '336671');
  assert.equal(wifi.nombre, 'Descubramos activos en nuestro WiFi hogareño');
  assert.equal(wifi.unidad, 1); // sección «Unidad 1»
});

test('esForoInformativo descarta avisos y foros de consultas, conserva consignas', () => {
  assert.equal(esForoInformativo('Avisos'), true);
  assert.equal(esForoInformativo('Novedades'), true);
  assert.equal(esForoInformativo('Foro de Consultas'), true);
  assert.equal(esForoInformativo('Foro interactivo Consultas'), true);
  assert.equal(esForoInformativo('Foro de Consulta Módulo II'), true);
  assert.equal(esForoInformativo('Foro general'), true);
  assert.equal(esForoInformativo('Los encuentros sincrónicos para ambas comisiones conjuntamente, serán los días lunes'), true);
  assert.equal(esForoInformativo('Horario adicional de encuentro sincrónico'), true);

  assert.equal(esForoInformativo('Hallazgos de la Semana'), false);
  assert.equal(esForoInformativo('Presentación individual'), false);
  assert.equal(esForoInformativo('Casos de exfiltración por Metadatos y Borrado (in)seguro'), false);
});

test('esActividadInformativa descarta anuncios/encuestas de organización en cualquier tipo', () => {
  // La encuesta «choice» de coordinación del horario no es una consigna.
  assert.equal(esActividadInformativa('Horario Adicional de encuentro sincrónico'), true);
  assert.equal(esActividadInformativa('Los encuentros sincrónicos para ambas comisiones conjuntamente, serán los días lunes'), true);
  assert.equal(esActividadInformativa('Avisos'), true);
  assert.equal(esActividadInformativa('Novedades'), true);
  // Quizzes/consignas reales no se tocan.
  assert.equal(esActividadInformativa('Lea y responda (Basadre)'), false);
  assert.equal(esActividadInformativa('Evaluación de avance de medio cursado'), false);
  assert.equal(esActividadInformativa('Examen PARCIAL de Auditorías, martes 9 de Junio 18hs.'), false);
  assert.equal(esActividadInformativa('Hallazgos de la Semana'), false);
});

test('extraerForos no captura nada sin índice o sin foros', () => {
  assert.deepEqual(extraerForos(''), []);
  assert.deepEqual(extraerForos('<html><body><table><tr><td>sin foros</td></tr></table></body></html>'), []);
});

test('extraerActividadesOverview parsea todas las consignas del overview unificado', async () => {
  const html = await readFile(path.join(DIR, 'overview.html'), 'utf8');
  const actividades = extraerActividadesOverview(html, 'https://virtual.ugr.edu.ar');

  // 2 quiz + 1 feedback + 2 foros (Avisos descartado) + 1 assign = 6 consignas.
  // El recurso (url «Video de presentación») no es consigna y se ignora.
  assert.equal(actividades.length, 6);

  // Quiz con vencimiento y sección.
  const basadre = actividades.find((a) => a.id === '215115');
  assert.equal(basadre.nombre, 'Lea y responda (Basadre)');
  assert.equal(basadre.tipo, 'actividad');
  assert.equal(basadre.conNota, true);
  assert.equal(basadre.fin, '2026-09-19');
  assert.equal(basadre.unidad, 1);
  assert.equal(basadre.url, 'https://virtual.ugr.edu.ar/mod/quiz/view.php?id=215115');

  // Quiz sin fecha.
  const vargas = actividades.find((a) => a.id === '220959');
  assert.equal(vargas.nombre, 'Lea y responda- Vargas y Ollarves');
  assert.equal(vargas.inicio, 'Sin fecha');
  assert.equal(vargas.fin, 'Sin fecha');
  assert.equal(vargas.unidad, 2);

  // Feedback: consigna pero sin nota.
  const inciber = actividades.find((a) => a.id === '306254');
  assert.equal(inciber.nombre, 'Activos según INCIBE');
  assert.equal(inciber.tipo, 'actividad');
  assert.equal(inciber.conNota, false);
  assert.equal(inciber.unidad, 1);

  // Foros: informativos descartados, resto tipo 'foro' con url.
  assert.equal(actividades.some((a) => a.nombre === 'Avisos'), false);
  // Foro de organización de CIBERDELITOS (horarios de encuentros) → descartado.
  assert.equal(actividades.some((a) => a.nombre.includes('Los encuentros sincrónicos')), false);
  // Encuesta «choice» de organización de horario → descartada como no-consigna.
  assert.equal(actividades.some((a) => a.nombre.includes('Horario Adicional')), false);
  const hallazgos = actividades.find((a) => a.id === '267799');
  assert.equal(hallazgos.tipo, 'foro');
  assert.equal(hallazgos.conNota, false);
  assert.equal(hallazgos.unidad, null); // sección «General»
  assert.ok(hallazgos.url.includes('/mod/forum/view.php?id=267799'));

  // Assign: fechas de apertura y vencimiento + sección.
  const auditorias = actividades.find((a) => a.id === '199391');
  assert.equal(auditorias.nombre, 'Auditorías de SI, UII Tarea nro.1');
  assert.equal(auditorias.tipo, 'actividad'); // inferirTipoTarea no marca "Tarea" como TP
  assert.equal(auditorias.inicio, '2025-09-08');
  assert.equal(auditorias.fin, '2025-09-27');
  assert.equal(auditorias.unidad, 2);
  assert.equal(auditorias.conNota, true);

  // Recursos de lectura (url/page/resource) no aparecen como tareas.
  assert.equal(actividades.some((a) => a.nombre.includes('Video de presentación')), false);
});

test('extraerActividadesOverview no captura nada sin overview o sin filas', async () => {
  assert.deepEqual(extraerActividadesOverview(''), []);
  assert.deepEqual(
    extraerActividadesOverview('<html><body><div id="quiz_overview"><table><tr><td>x</td></tr></table></div></body></html>'),
    []
  );
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
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerCursos, extraerCursosDeAjax, extraerNombreCursoDesdePagina, extraerSesskey, extraerUserid, esCursoOrganizativo } from '../lib/materias.mjs';
import { esActividadInformativa, esForoInformativo, extraerActividadesOverview, extraerFechasActividad, extraerForos, extraerNotaUltimoIntento, extraerNotasDeLibreta, extraerTareas, parsearNotaCampus, priorizarNotaDeUltimoIntento, urlDeUltimaRevision } from '../lib/tareas.mjs';

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

test('extraerCursos descarta el espacio de carrera y lee las tarjetas de Moodle 4', () => {
  const html = `
    <div class="card dashboard-card" data-region="course-content" data-course-id="2216">
      <a href="https://virtual.ugr.edu.ar/course/view.php?id=2216" class="aalink coursename">
        <span class="multiline">(V.TUCS.2.16.1) CONCEPTOS DE DESARROLLO DE SOFTWARE</span>
      </a>
    </div>
    <div class="card dashboard-card" data-course-id="2218">
      <span class="coursename">(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA</span>
    </div>
    <div data-course-id="2572"><span class="coursename">Mi Carrera - Espacio de Seguridad</span></div>
    <select>
      <option value="2572">Mi Carrera - Espacio de Seguridad</option>
      <option value="1311">(V.TUCS.1.08.2) CIBERDELITOS</option>
    </select>`;
  const cursos = extraerCursos(html, 'https://virtual.ugr.edu.ar');
  assert.ok(cursos.find((c) => c.id === '2216')?.nombre.includes('CONCEPTOS DE DESARROLLO'));
  assert.ok(cursos.find((c) => c.id === '2218')?.nombre.includes('CRIPTOGRAFÍA'));
  assert.ok(cursos.find((c) => c.id === '1311'));
  assert.equal(cursos.some((c) => c.id === '2572'), false);
});

test('esCursoOrganizativo y extraerCursosDeAjax toman las extras enroladas', () => {
  assert.equal(esCursoOrganizativo('Mi Carrera - Espacio de Seguridad'), true);
  assert.equal(esCursoOrganizativo('Introducción a la Criptografía'), false);
  const cursos = extraerCursosDeAjax([{
    error: false,
    data: {
      courses: [
        { id: 2216, fullname: '(V.TUCS.2.16.1) CONCEPTOS DE DESARROLLO DE SOFTWARE' },
        { id: 2218, fullname: '(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA' },
        { id: 2572, fullname: 'Mi Carrera - Espacio de Seguridad' }
      ]
    }
  }]);
  assert.deepEqual(cursos.map((c) => c.id).sort(), ['2216', '2218']);
  assert.equal(cursos[0].timeaccess, 0);
});

test('extraerUserid lee M.cfg y extraerCursosDeAjax lee las inscripciones del alumno', () => {
  assert.equal(extraerUserid('M.cfg = {"sesskey":"ABC","userid":42,"siteId":1};'), '42');
  assert.equal(extraerUserid('M.cfg = {"userid":0};'), null);
  const inscritos = extraerCursosDeAjax([{
    error: false,
    data: [
      { id: 2218, fullname: '(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA' },
      { id: 2216, fullname: '(V.TUCS.2.16.1) CONCEPTOS DE DESARROLLO DE SOFTWARE' },
      { id: 2572, fullname: 'Mi Carrera - Espacio de Seguridad' }
    ]
  }]);
  assert.deepEqual(inscritos.map((c) => c.id).sort(), ['2216', '2218']);
});

test('extraerSesskey lee M.cfg', () => {
  assert.equal(extraerSesskey('M.cfg = {"sesskey":"R0I01W51bV","siteId":1};'), 'R0I01W51bV');
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

  assert.equal(esForoInformativo('Avisos de la cátedra'), true);
  assert.equal(esForoInformativo('Foro de novedades'), true);
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

test('la nota del cuestionario es la del último intento terminado, no la más alta', () => {
  const html = `
    <body>
      <p>Calificación para aprobar: 10,00 de 10,00</p>
      <p>Calificación más alta: 10,00 / 10,00.</p>
      <h3>Sus intentos</h3>
      <section>
        <h4>Intento 2</h4>
        <p>Estado Finalizado</p>
        <p>Calificación 7,50 de 10,00 (75%)</p>
      </section>
      <section>
        <h4>Intento 1</h4>
        <p>Estado Finalizado</p>
        <p>Calificación 10,00 de 10,00 (100%)</p>
      </section>
    </body>`;
  assert.equal(extraerNotaUltimoIntento(html), 7.5);
  assert.equal(extraerNotaUltimoIntento('<body><p>Calificación para aprobar: 10,00 de 10,00</p></body>'), null);
  assert.equal(extraerNotaUltimoIntento('<body><p>Su calificación es 8,00 / 10,00</p></body>'), 8);
  const conCurso = `
    <body>
      <h4>Intento 3</h4><p>Estado En curso</p>
      <h4>Intento 2</h4><p>Estado Finalizado</p><p>Calificación 0,00 de 10,00 (0%)</p>
    </body>`;
  assert.equal(extraerNotaUltimoIntento(conCurso), 0);
});

test('la tarjeta de Moodle trae la nota del último intento, no la más alta', () => {
  const html = `
    <body>
      <p>Calificación para aprobar: 10,00 de 10,00</p>
      <p>Calificación más alta: 10,00 / 10,00</p>
      <h3>Resumen de sus intentos previos</h3>
      <ul>
        <li class="col">
          <div class="card">
            <h4 class="card-title">Intento 2</h4>
            <table class="generaltable quizreviewsummary">
              <tr><th class="cell" scope="row">Estado</th><td class="cell">Finalizado</td></tr>
              <tr><th class="cell" scope="row">Calificación</th><td class="cell">10,00 de 10,00 (100%)</td></tr>
            </table>
            <a href="https://virtual.ugr.edu.ar/mod/quiz/review.php?attempt=22">Revisión</a>
          </div>
        </li>
        <li class="col">
          <div class="card">
            <h4 class="card-title">Intento 1</h4>
            <table class="generaltable quizreviewsummary">
              <tr><th class="cell" scope="row">Estado</th><td class="cell">Finalizado</td></tr>
              <tr><th class="cell" scope="row">Calificación</th><td class="cell">0,00 de 10,00 (0%)</td></tr>
            </table>
            <a href="https://virtual.ugr.edu.ar/mod/quiz/review.php?attempt=11">Revisión</a>
          </div>
        </li>
      </ul>
    </body>`;
  assert.equal(extraerNotaUltimoIntento(html), 10);
  assert.equal(urlDeUltimaRevision(html), 'https://virtual.ugr.edu.ar/mod/quiz/review.php?attempt=22');
  assert.equal(extraerNotaUltimoIntento(`
    <p>Calificación para aprobar: 10,00 de 10,00</p>
    <h3>Tu calificación final en este cuestionario es 10,00 de 10,00.</h3>
  `), 10);
  assert.equal(extraerNotaUltimoIntento(`
    <table class="quizreviewsummary"><tr><th>Estado</th><td>Finalizado</td></tr><tr><th>Calificación</th><td><b>10,00</b> de 10,00 (<b>100</b>%)</td></tr></table>
    <table class="quizreviewsummary"><tr><th>Estado</th><td>Finalizado</td></tr><tr><th>Calificación</th><td>0,00 de 10,00 (0%)</td></tr></table>
  `), 10);
});

test('si el resumen no trae número, la revisión del último intento es la que hay que abrir', () => {
  const html = `
    <div class="card">
      <h4 class="card-title">Intento 2</h4>
      <table><tr><th>Estado</th><td>Finalizado</td></tr><tr><th>Calificación</th><td>Sin calificar</td></tr></table>
      <a href="/mod/quiz/review.php?attempt=22">Revisión</a>
    </div>`;
  assert.equal(extraerNotaUltimoIntento(html), null);
  assert.equal(urlDeUltimaRevision(html, 'https://virtual.ugr.edu.ar'), 'https://virtual.ugr.edu.ar/mod/quiz/review.php?attempt=22');
  assert.equal(extraerNotaUltimoIntento(`
    <table class="quizreviewsummary"><tr><th>Calificación</th><td>10,00 de 10,00 (100%)</td></tr></table>
  `), 10);
});

test('el último intento pisa la nota de la libreta', () => {
  const progreso = priorizarNotaDeUltimoIntento(
    [{ materiaId: 'act', nombre: 'Lea y responda- Vargas y Ollarves', id: 't1', tabla: 'tareas', nota: 10, entregada: true }],
    [{ materiaId: 'act', nombre: 'Lea y responda- Vargas y Ollarves', id: 't1', nota: 7.5 }]
  );
  assert.equal(progreso[0].nota, 7.5);
  assert.equal(progreso[0].forzar, true);
});

test('parsearNotaCampus lee la calificación que publica el campus', () => {
  assert.equal(parsearNotaCampus('10.00000'), 10);
  assert.equal(parsearNotaCampus('10,00 Acciones'), 10);
  assert.equal(parsearNotaCampus('-'), null);
  assert.equal(parsearNotaCampus('11'), null);
});

test('extraerNotasDeLibreta toma el ítem y la nota de la libreta del alumno', () => {
  const notas = extraerNotasDeLibreta(`
    <table class="user-grade">
      <tr>
        <th><a class="gradeitemheader" href="https://virtual.ugr.edu.ar/mod/quiz/view.php?id=215115">Lea y responda (Basadre)</a></th>
        <td class="column-grade">10,00 Acciones</td>
      </tr>
      <tr>
        <th><a class="gradeitemheader" href="https://virtual.ugr.edu.ar/mod/quiz/view.php?id=999">Sin nota</a></th>
        <td class="column-grade">-</td>
      </tr>
    </table>
  `);
  assert.equal(notas.length, 1);
  assert.equal(notas[0].id, '215115');
  assert.equal(notas[0].nota, 10);
});

test('extraerFechasActividad entiende Abre y Cierra, los rótulos actuales de Moodle', () => {
  const html = `<div data-region="activity-dates">
    <div>Abre: jueves, 10 de septiembre de 2026, 00:00</div>
    <div>Cierra: viernes, 16 de octubre de 2026, 23:59</div>
  </div>`;
  assert.deepEqual(extraerFechasActividad(html), { inicio: '2026-09-10', fin: '2026-10-16' });
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
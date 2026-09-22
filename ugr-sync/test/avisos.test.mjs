import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analizarAvisoParaCronograma,
  analizarAvisosParaCronograma,
  DIAS_HACIA_ATRAS,
  esForoDeAvisos,
  extraerDiscusionesDeForo,
  extraerForosDelIndice,
  avisoEsRelevante,
  extraerPostsDeHilo,
  extraerPrimerPostDeHilo,
  fechaHoyLocal,
  sumarDias
} from '../lib/avisos.mjs';
import { conPool, detectarAvisosMoodle } from '../lib/sync-core.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const HOY = '2026-09-15'; // martes

test('esForoDeAvisos identifica los foros informativos (Avisos/Consultas/…)', () => {
  assert.equal(esForoDeAvisos('Avisos'), true);
  assert.equal(esForoDeAvisos('Novedades'), true);
  assert.equal(esForoDeAvisos('Foro de Consultas'), true);
  assert.equal(esForoDeAvisos('Anuncios'), true);
  assert.equal(esForoDeAvisos('Avisos de la cátedra'), true);
  assert.equal(esForoDeAvisos('Foro de novedades'), true);
  assert.equal(esForoDeAvisos('Hallazgos de la Semana'), false);
  assert.equal(esForoDeAvisos('Descubramos activos en nuestro WiFi hogareño'), false);
});

test('extraerForosDelIndice lista los foros del índice y marca los de avisos', async () => {
  const html = await readFile(path.join(DIR, 'foros.html'), 'utf8');
  const foros = extraerForosDelIndice(html, 'https://virtual.ugr.edu.ar');

  assert.equal(foros.length, 3);
  const avisos = foros.find((f) => f.id === '110427');
  assert.equal(avisos.nombre, 'Avisos');
  assert.equal(avisos.esAvisos, true);
  assert.equal(avisos.url, 'https://virtual.ugr.edu.ar/mod/forum/view.php?id=110427');

  const hallazgos = foros.find((f) => f.id === '267799');
  assert.equal(hallazgos.esAvisos, false);
  const wifihogar = foros.find((f) => f.id === '336671');
  assert.equal(wifihogar.esAvisos, false);
  assert.equal(wifihogar.unidad, 1);
});

test('extraerDiscusionesDeForo extrae los hilos del foro', async () => {
  const html = await readFile(path.join(DIR, 'discusiones.html'), 'utf8');
  const discusiones = extraerDiscusionesDeForo(html, 'https://virtual.ugr.edu.ar');

  assert.equal(discusiones.length, 2);
  const consulta = discusiones.find((d) => d.id === '991721');
  assert.equal(consulta.titulo, 'Clase de consulta del lunes 21 de septiembre');
  assert.equal(consulta.autor, 'Juan Pérez');
  assert.equal(consulta.actualizado, '2026-09-15');
  assert.ok(consulta.url.includes('/mod/forum/discuss.php?d=991721'));
});

test('extraerPrimerPostDeHilo lee el post que abre el hilo', async () => {
  const html = await readFile(path.join(DIR, 'hilo.html'), 'utf8');
  const post = extraerPrimerPostDeHilo(html, 'https://virtual.ugr.edu.ar');

  assert.ok(post, 'debería encontrar el post');
  assert.equal(post.titulo, 'Clase de consulta del lunes 21 de septiembre');
  assert.equal(post.autor, 'Juan Pérez');
  assert.equal(post.fecha, '2026-09-15');
  assert.ok(post.contenido.includes('clase de consulta por Zoom'));
  assert.ok(post.urlHilo.includes('/mod/forum/discuss.php?d=991721'));
});

test('avisoEsRelevante deja pasar un cambio de cursada y frena el material', () => {
  assert.equal(avisoEsRelevante({
    titulo: 'Cambio de aula',
    contenido: 'Desde esta clase cursamos en el aula 4.'
  }), true);
  assert.equal(avisoEsRelevante({
    titulo: 'Prórroga',
    contenido: 'Se prorrogó la entrega del trabajo práctico. La nueva fecha se confirma después.'
  }), true);
  assert.equal(avisoEsRelevante({
    titulo: 'Material de la clase',
    contenido: 'Mañana estará disponible la grabación de la clase.'
  }), false);
  assert.equal(avisoEsRelevante({
    titulo: 'Notas',
    contenido: 'Mañana publicaremos las notas del parcial.'
  }), false);
});

test('extraerPostsDeHilo lee también el recordatorio posterior del docente', () => {
  const html = `
    <article class="forumpost" data-post-id="1">
      <h3 class="subject">Avisos de la unidad</h3>
      <div class="author">por <a href="/user/view.php?id=7">Alumno</a> <time datetime="2026-09-01T10:00:00-03:00">1 de septiembre de 2026</time></div>
      <div class="posting">¿Alguien sabe el aula?</div>
    </article>
    <article class="forumpost" data-post-id="2">
      <h3 class="subject">Re: Avisos de la unidad</h3>
      <div class="author">por <a href="/user/view.php?id=42">Docente</a> <time datetime="2026-09-15T10:00:00-03:00">15 de septiembre de 2026</time></div>
      <div class="posting">Cursamos en el aula 4.</div>
    </article>`;
  const posts = extraerPostsDeHilo(html);
  assert.equal(posts.length, 2);
  assert.equal(posts[1].autor, 'Docente');
  assert.equal(posts[1].fecha, '2026-09-15');
  assert.ok(posts[1].contenido.includes('aula 4'));
});

test('un cambio de aula sin fecha llega a la campana y no inventa un evento', async () => {
  const html = `<article class="forumpost" data-post-id="8">
    <h3 class="subject">Cambio de aula</h3>
    <div class="author">por <a href="/user/view.php?id=42">Juan Pérez</a>
      <time datetime="2026-09-15T10:00:00-03:00">martes, 15 de septiembre de 2026, 10:00</time>
    </div>
    <div class="posting">Desde esta clase cursamos en el aula 4.</div>
  </article>`;
  const cliente = { async pedir(ruta) {
    const clave = new URL(ruta, 'https://virtual.ugr.edu.ar').pathname;
    const paginas = {
      '/mod/forum/index.php': '<table><tr><td><a href="/mod/forum/view.php?id=10">Avisos de la cátedra</a></td></tr></table>',
      '/course/view.php': '<div class="summarytext"><a href="/user/view.php?id=42">Juan Pérez</a></div>',
      '/mod/forum/view.php': '<table><tr><td><a href="/mod/forum/discuss.php?d=11">Cambio de aula</a></td></tr></table>',
      '/mod/forum/discuss.php': html
    };
    return { html: paginas[clave] };
  } };
  const { avisosDetectados, eventosSugeridos } = await detectarAvisosMoodle({
    db: { async execute() { return { rows: [] }; } },
    cliente,
    hoy: '2026-09-15',
    mapeos: [{
      curso: { id: '9', nombre: 'Auditorías' },
      coincidencia: { materia: { id: 'm', nombre: 'Auditorías' } }
    }]
  });
  assert.equal(avisosDetectados.length, 1);
  assert.equal(avisosDetectados[0].titulo, 'Cambio de aula');
  assert.deepEqual(eventosSugeridos, []);
});

test('extraerPrimerPostDeHilo devuelve null sin posts', () => {
  assert.equal(extraerPrimerPostDeHilo('<html><body>nada</body></html>'), null);
  assert.equal(extraerPrimerPostDeHilo(''), null);
});

test('analizarAvisoParaCronograma detecta fechas desde hoy hacia adelante', () => {
  const analizar = (titulo, contenido) => analizarAvisoParaCronograma({
    titulo,
    contenido,
    materiaNombre: 'GESTIÓN DE ACTIVOS',
    hoy: HOY
  });

  // «mañana» → hoy + 1.
  const manana = analizar('Clase de consulta', 'Mañana a las 18 h tenemos clase de consulta por Zoom.');
  assert.equal(manana.tipo, 'consulta');
  assert.equal(manana.fecha, '2026-09-16');
  assert.equal(manana.confianza, 'alta');

  // Fecha explícita con mes.
  const parcial = analizar('Aviso importante', 'El lunes 21 de septiembre se realizará el parcial de la unidad 3.');
  assert.equal(parcial.tipo, 'examen');
  assert.equal(parcial.fecha, '2026-09-21');

  // «hoy» → hoy.
  const hoy = analizar('Consulta', 'Hoy hay clase de consulta a las 20:00.');
  assert.equal(hoy.fecha, HOY);

  // Numérica DD/MM/YYYY.
  const entrega = analizar('Entrega TP', 'Hay que entregar el trabajo práctico el 30/11/2026.');
  assert.equal(entrega.tipo, 'entrega');
  assert.equal(entrega.fecha, '2026-11-30');

  // Día de la semana → próxima ocurrencia (lunes próximo al martes 15).
  const dia = analizar('Examen', 'El examen final es el lunes que viene.');
  assert.equal(dia.tipo, 'examen');
  assert.equal(dia.fecha, '2026-09-21');
  assert.equal(dia.confianza, 'media');

  // Eventos con fecha pasada se ignoran.
  assert.equal(analizar('Reunión', 'La clase pasada vimos los activos de información.'), null);
  // Sin fecha ni tipo no se sugiere evento (el aviso igual puede publicarse).
  assert.equal(analizar('Material', 'Subí la grabación de la clase.'), null);
});

test('analizarAvisoParaCronograma resuelve «día de la semana + número»', () => {
  const analizar = (titulo, contenido) => analizarAvisoParaCronograma({
    titulo,
    contenido,
    materiaNombre: 'EVALUACIÓN Y GESTIÓN DE RIESGOS',
    hoy: HOY
  });

  // El ejemplo real del aviso de Riesgos: el encuentro es HOY (martes 15), no
  // el martes siguiente.
  const encontroHoy = analizar('Encuentro de consultas', 'Para acompañarlos, el martes 15 a las 20:00 tendremos un encuentro para responder dudas sobre el TP.');
  assert.equal(encontroHoy.tipo, 'consulta');
  assert.equal(encontroHoy.fecha, HOY);

  // «viernes 18» → 18/09/2026 (día 18 del mes actual y en adelante).
  const entrega = analizar('Clase 3', 'La primera entrega del Trabajo Práctico vence el próximo viernes 18.');
  assert.equal(entrega.tipo, 'entrega');
  assert.equal(entrega.fecha, '2026-09-18');

  // Si el día del mes ya pasó, se interpreta como del mes siguiente.
  const proximoMes = analizar('Consulta', 'El martes 8 tendremos una clase de consulta por Zoom.');
  assert.equal(proximoMes.fecha, '2026-10-08');
});

test('la ventana de avisos mira 7 días hacia atrás', () => {
  assert.equal(DIAS_HACIA_ATRAS, 7);
  // Límite de la ventana: hoy − 7 (aviso del jueves que anuncia el martes 15).
  assert.equal(sumarDias(HOY, -7), '2026-09-08');
  assert.equal(sumarDias('2026-09-08', 7), HOY);
  // Los eventos ya pasados se siguen descartando dentro de la ventana.
  const pasado = analizarAvisoParaCronograma({
    titulo: 'Clase 2',
    contenido: 'La clase pasada vimos la matriz de riesgo.',
    materiaNombre: 'GESTIÓN DE ACTIVOS',
    hoy: HOY
  });
  assert.equal(pasado, null);
});

test('un aviso de cancelación genera «sin clases» hoy y la clase corrida mañana', () => {
  const eventos = analizarAvisosParaCronograma({
    titulo: 'Encuentro Sincrónico de hoy y mañana',
    contenido: 'Estimados alumnos los saludo y les comunico que hoy no tendremos encuentro sincrónico debido a los exámenes finales de esta y otras materias. Si mañana tienen disponibilidad desde las 20:30 Hs estaré disponbiles para dictar el primer encuentro de los jueves.',
    materiaNombre: 'GESTIÓN DE ACTIVOS',
    hoy: '2026-09-16'
  });

  assert.equal(eventos.length, 2);
  const [miercoles, jueves] = eventos;

  assert.equal(miercoles.tipo, 'sin_clases');
  assert.equal(miercoles.fecha, '2026-09-16');
  assert.equal(miercoles.confianza, 'alta');
  assert.equal(miercoles.titulo, 'Sin clases');

  assert.equal(jueves.tipo, 'clase');
  assert.equal(jueves.fecha, '2026-09-17');
  assert.equal(jueves.confianza, 'alta');
  assert.ok(jueves.titulo.includes('20:30'), `la hora debería estar en el título: «${jueves.titulo}»`);
  assert.match(jueves.titulo, /jueves/i);
});

test('las variantes de cancelación se clasifican como sin_clases', () => {
  const analizar = (titulo, contenido) => analizarAvisoParaCronograma({
    titulo,
    contenido,
    materiaNombre: 'X',
    hoy: HOY
  });

  // «no hay clases».
  const noHay = analizar('Aviso', 'El miércoles no hay clases por el paro de colectivos.');
  assert.equal(noHay.tipo, 'sin_clases');
  assert.equal(noHay.fecha, '2026-09-16');

  // «…se cancela». El día de la semana gana sobre la mención «por viaje».
  const cancela = analizar('Aviso 2', 'La clase del viernes 18 se cancela por viaje.');
  assert.equal(cancela.tipo, 'sin_clases');
  assert.equal(cancela.fecha, '2026-09-18');

  // «…suspendidas».
  const suspendidas = analizar('Aviso 3', 'Clases suspendidas el jueves por asamblea.');
  assert.equal(suspendidas.tipo, 'sin_clases');
  assert.equal(suspendidas.fecha, '2026-09-17');

  // Una cancelación domina aunque la razón mencione exámenes.
  const conExamenes = analizar('Encuentro de hoy', 'Hoy no tendremos encuentro sincrónico por los exámenes finales.');
  assert.equal(conExamenes.tipo, 'sin_clases');
  assert.equal(conExamenes.fecha, HOY);
});

test('la hora mencionada con la fecha se refleja en el título del evento', () => {
  const consulta = analizarAvisoParaCronograma({
    titulo: 'Clase de consulta',
    contenido: 'Mañana a las 18 h tenemos clase de consulta por Zoom.',
    materiaNombre: 'X',
    hoy: HOY
  });
  assert.equal(consulta.tipo, 'consulta');
  assert.equal(consulta.fecha, '2026-09-16');
  assert.ok(consulta.titulo.includes('18:00'), `titulo: «${consulta.titulo}»`);

  const clase = analizarAvisoParaCronograma({
    titulo: 'Encuentro',
    contenido: 'El jueves a las 20:30 tendremos el primer encuentro de los jueves.',
    materiaNombre: 'X',
    hoy: '2026-09-16'
  });
  assert.equal(clase.tipo, 'clase');
  assert.equal(clase.fecha, '2026-09-17'); // jueves siguiente al miércoles 16
  assert.ok(clase.titulo.includes('20:30'), `titulo: «${clase.titulo}»`);
  assert.match(clase.titulo, /jueves/i);
});

test('conPool corre en paralelo y mantiene el orden', async () => {
  const activos = { actual: 0, maximo: 0 };
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const resultados = await conPool(items, 4, async (valor) => {
    activos.actual += 1;
    activos.maximo = Math.max(activos.maximo, activos.actual);
    await new Promise((resolver) => setTimeout(resolver, 10));
    activos.actual -= 1;
    return valor * 2;
  });
  assert.deepEqual(resultados, [2, 4, 6, 8, 10, 12, 14, 16]);
  assert.ok(activos.maximo <= 4, `la concurrencia no debería superar 4 (vimos ${activos.maximo})`);
});

test('fechaHoyLocal devuelve YYYY-MM-DD válido', () => {
  const fecha = fechaHoyLocal();
  assert.match(fecha, /^\d{4}-\d{2}-\d{2}$/);
});
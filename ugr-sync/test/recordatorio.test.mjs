import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearFechaMoodle } from '../lib/normalizar.mjs';
import { createClient } from '@libsql/client';
import { detectarAvisosMoodle, insertarAvisosDetectados, aprobarAvisos, insertarEventosCronograma, rechazarAvisos } from '../lib/sync-core.mjs';
import { nombreNotificacionAviso } from '../../src/lib/avisos.ts';
import { extraerPrimerPostDeHilo, analizarAvisosParaCronograma } from '../lib/avisos.mjs';

// Muestra sintética basada en el texto recibido, no HTML descargado del campus.
const HTML = `<article class="forumpost" data-post-id="1709">
  <h3 class="subject">Recordatorio – mañana no hay clases</h3>
  <div class="author">de <a href="/user/view.php?id=42">Pablo Lionel Pi</a> -
    <time datetime="2026-09-17T10:55:00-03:00">jueves, 17 de septiembre de 2026, 10:55</time>
  </div>
  <div class="posting">Les recuerdo que mañana no tendremos clases debido a la semana de exámenes finales. Nos reencontramos la próxima semana.</div>
</article>`;

test('recordatorio: publicación el 17/09, sin clases el 18/09 aunque se sincronice el viernes', () => {
  assert.equal(parsearFechaMoodle('jueves, 17 de septiembre de 2026, 10:55'), '2026-09-17');
  const post = extraerPrimerPostDeHilo(HTML);
  assert.equal(post.fecha, '2026-09-17');
  const eventos = analizarAvisosParaCronograma({
    ...post,
    fechaPublicacion: post.fecha,
    materiaNombre: 'Evaluación y Gestión de Riesgos',
    hoy: '2026-09-18'
  });
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].tipo, 'sin_clases');
  assert.equal(eventos[0].fecha, '2026-09-18');
  console.log(`Publicación: ${post.fecha}; sin clases: ${eventos[0].fecha}`);
});

test('integración: pendiente → aprobación → campana/cronograma, sin duplicar al repetir', async () => {
  const db = createClient({ url: 'file::memory:' });
  try {
    await db.batch([
      `CREATE TABLE avisos_moodle (
        id TEXT PRIMARY KEY, curso_id TEXT NOT NULL, curso_nombre TEXT NOT NULL,
        materia_id TEXT, materia_nombre TEXT, foro_id TEXT NOT NULL, foro_nombre TEXT NOT NULL,
        hilo_id TEXT NOT NULL, titulo TEXT NOT NULL, autor TEXT NOT NULL DEFAULT '',
        fecha TEXT NOT NULL, contenido TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
        estado TEXT NOT NULL DEFAULT 'pendiente', creado_en TEXT NOT NULL,
        UNIQUE(curso_id, hilo_id))`,
      `CREATE TABLE cronograma_eventos (
        id TEXT PRIMARY KEY, materia_id TEXT NOT NULL, fecha TEXT NOT NULL,
        modalidad TEXT NOT NULL, tipo TEXT NOT NULL, titulo TEXT NOT NULL,
        detalles TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
        origen TEXT NOT NULL DEFAULT 'manual', UNIQUE(materia_id, fecha, titulo))`
    ], 'write');
    const paginas = {
      '/mod/forum/index.php?id=9': '<table><tr><td><a href="/mod/forum/view.php?id=10">Avisos</a></td></tr></table>',
      '/course/view.php?id=9': '<div class="summarytext"><a href="/user/view.php?id=42">Pablo Lionel Pi</a></div>',
      '/mod/forum/view.php?id=10': '<table><tr><td><a href="/mod/forum/discuss.php?d=11">Recordatorio – mañana no hay clases</a></td></tr></table>',
      '/mod/forum/discuss.php?d=11': HTML
    };
    const cliente = { async pedir(ruta) {
      const url = new URL(ruta, 'https://virtual.ugr.edu.ar');
      const clave = url.pathname + url.search;
      assert.ok(paginas[clave], `Ruta inesperada: ${clave}`);
      return { html: paginas[clave] };
    } };
    const detectar = () => detectarAvisosMoodle({ db, cliente, hoy: '2026-09-18', mapeos: [{
      curso: { id: '9', nombre: '(V.TUCS.1.09.2) EVALUACIÓN Y GESTIÓN DE RIESGOS' },
      coincidencia: { materia: { id: 'riesgos', nombre: 'Evaluación y Gestión de Riesgos' } }
    }] });
    // Los anuncios generales no deben llegar ni a la campana ni al cronograma.
    paginas['/mod/forum/discuss.php?d=11'] = HTML
      .replace('Recordatorio – mañana no hay clases', 'Material de la clase')
      .replace('Les recuerdo que mañana no tendremos clases debido a la semana de exámenes finales. Nos reencontramos la próxima semana.', 'Mañana estará disponible la grabación de la clase.');
    assert.deepEqual(await detectar(), { avisosDetectados: [], eventosSugeridos: [] });
    paginas['/mod/forum/discuss.php?d=11'] = HTML;
    const previa = await detectar();
    assert.equal(previa.avisosDetectados.length, 1);
    await insertarAvisosDetectados({ db, avisos: previa.avisosDetectados });
    assert.equal((await db.execute("SELECT * FROM avisos_moodle WHERE estado = 'aceptado'")).rows.length, 0);
    assert.equal((await db.execute('SELECT * FROM cronograma_eventos')).rows.length, 0);

    const confirmacion = await detectar();
    assert.equal(confirmacion.avisosDetectados.length, 1, 'el pendiente no debe desaparecer al confirmar');
    assert.equal(confirmacion.eventosSugeridos.length, 1);
    assert.equal(confirmacion.eventosSugeridos[0].fecha, '2026-09-18');
    assert.equal(confirmacion.eventosSugeridos[0].tipo, 'sin_clases');
    await insertarAvisosDetectados({ db, avisos: confirmacion.avisosDetectados });
    await aprobarAvisos({ db, ids: confirmacion.avisosDetectados.map((a) => a.id) });
    await insertarEventosCronograma({ db, eventos: confirmacion.eventosSugeridos });
    // Una repetición del insert también debe ser idempotente.
    await insertarEventosCronograma({ db, eventos: confirmacion.eventosSugeridos });
    const avisos = (await db.execute("SELECT * FROM avisos_moodle WHERE estado = 'aceptado'")).rows;
    const cronograma = (await db.execute('SELECT * FROM cronograma_eventos')).rows;
    assert.equal(avisos.length, 1);
    assert.equal(cronograma.length, 1);
    assert.equal(cronograma[0].materia_id, 'riesgos');
    assert.equal(nombreNotificacionAviso(avisos[0], cronograma), 'viernes 18/09/2026: no hay clases');
    assert.equal(nombreNotificacionAviso(avisos[0], []), avisos[0].titulo);
    assert.deepEqual(await detectar(), { avisosDetectados: [], eventosSugeridos: [] });
    await rechazarAvisos({ db, ids: [avisos[0].id] });
    assert.deepEqual(await detectar(), { avisosDetectados: [], eventosSugeridos: [] });
  } finally {
    db.close();
  }
});

test('fecha en encabezado sin time y cancelación pasada no se desplaza al futuro', () => {
  const post = extraerPrimerPostDeHilo(HTML.replace(/<time[^>]*>(.*?)<\/time>/, '$1'));
  assert.equal(post.fecha, '2026-09-17');
  assert.deepEqual(analizarAvisosParaCronograma({ ...post, fechaPublicacion: post.fecha, hoy: '2026-09-19' }), []);
});


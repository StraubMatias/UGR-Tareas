import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analizarAvisoParaCronograma,
  esForoDeAvisos,
  extraerDiscusionesDeForo,
  extraerForosDelIndice,
  extraerPrimerPostDeHilo,
  fechaHoyLocal
} from '../lib/avisos.mjs';
import { conPool } from '../lib/sync-core.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const HOY = '2026-09-15'; // martes

test('esForoDeAvisos identifica los foros informativos (Avisos/Consultas/…)', () => {
  assert.equal(esForoDeAvisos('Avisos'), true);
  assert.equal(esForoDeAvisos('Novedades'), true);
  assert.equal(esForoDeAvisos('Foro de Consultas'), true);
  assert.equal(esForoDeAvisos('Anuncios'), true);
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
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buscarNotaEnForo,
  esIndiceDeForo,
  extraerDiscusionesConAutor,
  extraerIdDeUsuarioSesion,
  extraerNotasDePublicaciones
} from '../lib/foros-notas.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const INDICE = path.join(DIR, 'foro-indice-hallazgos.html');
const DISCUSION = path.join(DIR, 'foro-calificado-hallazgos.html');
const URL_INDICE = 'https://virtual.ugr.edu.ar/mod/forum/view.php?id=267799';

function clienteFalso(respostas) {
  const pedidos = [];
  return {
    pedidos,
    async pedir(ruta) {
      pedidos.push(ruta);
      const html = respostas[ruta];
      if (!html) return { url: ruta, html: '', status: 404 };
      return { url: ruta, html, status: 200 };
    }
  };
}

test('esIndiceDeForo reconoce la URL del índice de un foro', () => {
  assert.equal(esIndiceDeForo(URL_INDICE), true);
  assert.equal(esIndiceDeForo('https://virtual.ugr.edu.ar/mod/forum/discuss.php?d=115556'), false);
  assert.equal(esIndiceDeForo(''), false);
});

test('extraerIdDeUsuarioSesion lee el id de usuario de la barra del campus', async () => {
  const html = await readFile(INDICE, 'utf8');
  assert.equal(extraerIdDeUsuarioSesion(html), '44861');
});

test('extraerDiscusionesConAutor lista los hilos con su autor', async () => {
  const html = await readFile(INDICE, 'utf8');
  const discusiones = extraerDiscusionesConAutor(html);
  assert.equal(discusiones.length, 3);
  const propia = discusiones.find((d) => d.id === '115556');
  assert.equal(propia.autor, 'Matias Straub');
  assert.equal(propia.autorId, '44861');
  assert.match(propia.titulo, /Filtración masiva en Dinamarca/);
});

test('extraerNotasDePublicaciones toma solo los posts con nota publicada', async () => {
  const html = await readFile(DISCUSION, 'utf8');
  const notas = extraerNotasDePublicaciones(html);
  assert.equal(notas.length, 1);
  assert.equal(notas[0].nota, 7);
  assert.equal(notas[0].postId, '348231');
  assert.equal(notas[0].autor, 'Matias Straub');
  assert.equal(notas[0].autorId, '44861');
});

test('buscarNotaEnForo encuentra la nota del alumno en su discusión', async () => {
  const indice = await readFile(INDICE, 'utf8');
  const discusion = await readFile(DISCUSION, 'utf8');
  const cliente = clienteFalso({
    [URL_INDICE]: indice,
    '/mod/forum/discuss.php?d=115556': discusion
  });

  const hallada = await buscarNotaEnForo(cliente, { url: URL_INDICE });
  assert.equal(hallada.nota, 7);
  assert.equal(hallada.discusionId, '115556');
  assert.equal(hallada.postId, '348231');
});

test('buscarNotaEnForo no toma la nota de otro alumno', async () => {
  const indice = await readFile(INDICE, 'utf8');
  const discusion = await readFile(DISCUSION, 'utf8');
  const cliente = clienteFalso({
    [URL_INDICE]: indice,
    '/mod/forum/discuss.php?d=115556': discusion
  });

  // Sesión de otro usuario: su id no aparece en ningún post con nota.
  const hallada = await buscarNotaEnForo(cliente, { url: URL_INDICE, autorId: '77777' });
  assert.equal(hallada.nota, null);
});

test('buscarNotaEnForo devuelve vacío si el foro no tiene discusiones', async () => {
  const cliente = clienteFalso({ [URL_INDICE]: '<html><body><div id="discussions"></div></body></html>' });
  const hallada = await buscarNotaEnForo(cliente, { url: URL_INDICE });
  assert.equal(hallada.nota, null);
  assert.equal(hallada.discusionId, null);
});

test('buscarNotaEnForo ignora una URL que no es índice de foro', async () => {
  const cliente = clienteFalso({});
  const hallada = await buscarNotaEnForo(cliente, { url: 'https://virtual.ugr.edu.ar/mod/assign/view.php?id=1' });
  assert.equal(hallada.nota, null);
});

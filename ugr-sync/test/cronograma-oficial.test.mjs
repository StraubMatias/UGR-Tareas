import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsearTextoCronogramaOficial, extraerRecursoCronogramaDeHtml } from '../lib/cronograma-oficial.mjs';

test('parsearTextoCronogramaOficial lee fechas del PDF de Activos', () => {
  let texto = '';
  try {
    texto = readFileSync('/tmp/cronograma-activos.txt', 'utf8');
  } catch {
    texto = `
   1         Lunes        Introducción
          24/08/2026
   4         Lunes       Sin Clases – Semana Turno de Examen Septiembre
          14/09/2026
   6       Lunes      Parcial (opcional) unidades 1 y 2.
     28/09/2026
    `;
  }
  const filas = parsearTextoCronogramaOficial(texto);
  assert.ok(filas.length >= 3);
  const intro = filas.find((f) => f.fecha === '2026-08-24');
  assert.ok(intro);
  assert.equal(intro.tipo, 'clase');
  const sin = filas.find((f) => f.fecha === '2026-09-14');
  assert.ok(sin);
  assert.equal(sin.tipo, 'sin_clases');
  const parcial = filas.find((f) => f.fecha === '2026-09-28');
  assert.ok(parcial);
  assert.equal(parcial.tipo, 'examen');
});

test('extraerRecursoCronogramaDeHtml elige el título más útil', () => {
  const html = `
    <a href="/mod/resource/view.php?id=1">Programa</a>
    <a href="/mod/resource/view.php?id=2">Cronograma de cursado 2do Cuatrimestre 2026</a>
    <a href="/mod/resource/view.php?id=3">Cronograma (archivo adjunto)</a>
  `;
  const recurso = extraerRecursoCronogramaDeHtml(html, 'https://virtual.ugr.edu.ar');
  assert.equal(recurso.resourceId, '2');
});

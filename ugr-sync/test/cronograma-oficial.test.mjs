import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearTextoCronogramaOficial, extraerRecursoCronogramaDeHtml } from '../lib/cronograma-oficial.mjs';

test('parsearTextoCronogramaOficial lee fechas del PDF de Activos', () => {
  const texto = `
   1         Lunes        Introducción
          24/08/2026
   4         Lunes       Sin Clases – Semana Turno de Examen Septiembre
          14/09/2026
   6       Lunes      Parcial (opcional) unidades 1 y 2.
     28/09/2026
    `;
  const filas = parsearTextoCronogramaOficial(texto);
  assert.ok(filas.length >= 3);
  const intro = filas.find((f) => f.fecha === '2026-08-24');
  assert.ok(intro);
  assert.equal(intro.tipo, 'clase');
  const sin = filas.find((f) => f.fecha === '2026-09-14');
  assert.ok(sin);
  assert.equal(sin.tipo, 'sin_clases');
  const conParcialOpcional = filas.find((f) => f.fecha === '2026-09-28');
  assert.ok(conParcialOpcional);
  assert.equal(conParcialOpcional.tipo, 'clase', 'parcial opcional en texto de clase no es examen del cronograma');
});

test('parsearTextoCronogramaOficial toma solo el texto tras la fecha (Módulo II)', () => {
  const texto = `
07/10/2026
MODULO II
06/10/2026
MODULO II 5 – Turno examen Septiembre
  `;
  const filas = parsearTextoCronogramaOficial(texto);
  const oct7 = filas.find((f) => f.fecha === '2026-10-07');
  assert.ok(oct7);
  assert.equal(oct7.tipo, 'clase');
  assert.match(oct7.titulo, /modulo\s*ii/i);
  assert.ok(!/turno\s+examen/i.test(oct7.titulo));
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

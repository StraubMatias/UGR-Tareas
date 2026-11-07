import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extraerFilasCronogramaDeItemsPdf,
  parsearTextoCronogramaOficial,
  extraerRecursoCronogramaDeHtml,
  textoPareceColumnasFusionadas
} from '../lib/cronograma-oficial.mjs';

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

test('parsearTextoCronogramaOficial reconoce fechas día-mes y parciales con unidades', () => {
  const filas = parsearTextoCronogramaOficial(`
Calendario 2026
19-8 Introducción a la materia
20-8 1er Parcial - Unidades 1 y 2
`);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].fecha, '2026-08-19');
  assert.equal(filas[1].fecha, '2026-08-20');
  assert.equal(filas[1].tipo, 'examen');
  assert.match(filas[1].titulo, /parcial/i);
});

test('parsearTextoCronogramaOficial admite separadores de fecha con espacios', () => {
  const filas = parsearTextoCronogramaOficial(`
Calendario 2026
9 - 8 Sincrónico
10 - 8 Clase de consulta
`);
  assert.equal(filas[0].fecha, '2026-08-09');
  assert.equal(filas[1].fecha, '2026-08-10');
  assert.equal(filas[1].tipo, 'consulta');
});

test('extraerFilasCronogramaDeItemsPdf conserva filas de tabla por columna Actividad', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const texto = extraerFilasCronogramaDeItemsPdf([[
    item('Fecha', 64, 700),
    item('Bibliografía', 250, 700),
    item('Actividad', 432, 700),
    item('1', 58, 650),
    item('9', 66, 650),
    item('-', 73, 650),
    item('8', 77, 650),
    item('Sincrónico', 107, 650),
    item('Bibliografía obligatoria', 194, 650),
    item('Clase de consulta', 401, 650),
    item('7', 58, 590),
    item('-', 73, 590),
    item('10', 77, 590),
    item('CIS CONTROL V8 Marco de Seguridad de la Información publicado por el Centro para la Seguridad de la Información y sus recomendaciones para organizaciones. '.repeat(2), 365, 590),
    item('2', 58, 620),
    item('6', 66, 620),
    item('-', 73, 620),
    item('8', 77, 620),
    item('1er Parcial - Unidades 1 y 2', 401, 620)
  ]]);
  const filas = parsearTextoCronogramaOficial(`Cronograma 2026\n${texto}`);
  assert.equal(filas.length, 3);
  assert.equal(filas[0].fecha, '2026-08-19');
  assert.equal(filas[0].tipo, 'consulta');
  assert.equal(filas[1].fecha, '2026-08-26');
  assert.equal(filas[1].tipo, 'examen');
  assert.equal(filas[2].fecha, '2026-10-07');
  assert.equal(filas[2].tipo, 'clase');
});

test('una clase de consulta que menciona un llamado no se clasifica como final', () => {
  const filas = parsearTextoCronogramaOficial(`
Calendario 2026
26/11 Clase de consulta Examen 1er llamado
03/12 Examen 1er llamado
`);
  assert.equal(filas.find((fila) => fila.fecha === '2026-11-26')?.tipo, 'consulta');
  assert.equal(filas.find((fila) => fila.fecha === '2026-12-03')?.tipo, 'examen_final');
});

test('corrige el rótulo Julio/Agosto en los finales de diciembre del Turno 5', () => {
  const filas = parsearTextoCronogramaOficial(`
Calendario 2026
04/12/2026 1er llamado turno Julio/Agosto Viernes
18/12/2026 2do llamado turno Julio/Agosto
`);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].tipo, 'examen_final');
  assert.match(filas[0].titulo, /1er llamado turno 5/i);
  assert.ok(!/julio\/agosto/i.test(filas[0].detalles));
  assert.equal(filas[1].tipo, 'examen_final');
  assert.match(filas[1].titulo, /2do llamado turno 5/i);
});

test('rechaza una fecha corta imposible', () => {
  const filas = parsearTextoCronogramaOficial(`
Calendario 2026
31-2 Fecha inválida
`);
  assert.equal(filas.length, 0);
});

test('no interpreta 9/2026 como fecha de cronograma', () => {
  const texto = `
05/10/2026
Herramientas de inventariado de hardware.
9/2026 consideración de personas y roles. Inventarios de cloud e IA.
  `;
  const filas = parsearTextoCronogramaOficial(texto);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].fecha, '2026-10-05');
  assert.match(filas[0].titulo, /inventariado/i);
  assert.ok(!/consideraci[oó]n de personas/i.test(filas[0].titulo));
});

test('recorta columnas fusionadas en una fila del PDF', () => {
  const texto = `
05/10/2026 Rodríguez 6 UNIDAD 3 IMPLICANCIAS GEOPOLÍTICAS 7 UNIDAD 4 PROTECCIÓN DE DATOS 8 1er. Examen
  `;
  const filas = parsearTextoCronogramaOficial(texto);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].tipo, 'clase');
  assert.ok(textoPareceColumnasFusionadas('UNIDAD 3 x UNIDAD 4 y'));
  assert.match(filas[0].titulo, /unidad\s+4/i);
  assert.ok(!/unidad\s+3/i.test(filas[0].titulo));
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

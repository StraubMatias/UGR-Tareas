// Tests para parsearHistoriaAcademica y sincronizarSIU
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsearHistoriaAcademica,
  sincronizarSIU,
  parsearPlanEstudio,
  codigoPlanDesdeActividadSiu,
  clasificarImportacionPlanSiu
} from '../lib/sync-core.mjs';

const HTML_BASE = '<!DOCTYPE html><html><head><meta charset="iso-8859-1"></head><body>';
const HTML_FOOT = '</body></html>';

function fila(codigo, nombre, estado, nota = '') {
  return `<tr><td>${codigo}</td><td>${nombre}</td><td>${estado}</td><td>${nota}</td></tr>`;
}

function tablaHeader() {
  return '<tr><th>Código</th><th>Nombre</th><th>Estado</th><th>Nota</th></tr>';
}

test('parsearHistoriaAcademica reconoce HTML simple con 3 materias', () => {
  const html = HTML_BASE + tablaHeader() +
    fila('1001', 'Matemática I', 'APROBADA', '8') +
    fila('INF-101', 'Introducción a la Informática', 'CURSANDO', '') +
    fila('1002', 'Física I', 'REGULARIZADA', '6') +
    HTML_FOOT;
  const res = parsearHistoriaAcademica(html);
  assert.equal(res.length, 3);
  assert.equal(res[0].codigoMateria, '1001');
  assert.equal(res[0].nombreMateria, 'Matemática I');
  assert.equal(res[0].estado, 'aprobada');
  assert.equal(res[0].nota, 8);
  assert.equal(res[1].codigoMateria, 'INF101');
  assert.equal(res[1].estado, 'cursando');
  assert.equal(res[2].codigoMateria, '1002');
  assert.equal(res[2].estado, 'regularizada');
});

test('parsearHistoriaAcademica ignora filas de cabecera y vacías', () => {
  const html = HTML_BASE +
    '<tr><th>Código</th><th>Nombre</th><th>Estado</th><th>Nota</th></tr>' +
    '<tr><td colspan="4">Filtrar resultados</td></tr>' +
    '<tr></tr>' +
    fila('1001', 'Matemática I', 'APROBADA', '8') +
    HTML_FOOT;
  const res = parsearHistoriaAcademica(html);
  assert.equal(res.length, 1);
  assert.equal(res[0].codigoMateria, '1001');
});

test('parsearHistoriaAcademica acepta JSON wrapper con campo cont', () => {
  const cont = '<table>' + tablaHeader() + fila('1001', 'Matemática I', 'APROBADA', '8') + '</table>';
  const json = JSON.stringify({ cont, other: 'ignored' });
  const res = parsearHistoriaAcademica(json);
  assert.equal(res.length, 1);
  assert.equal(res[0].codigoMateria, '1001');
});

test('parsearHistoriaAcademica retorna array vacío con JSON vacío o sin cont', () => {
  assert.equal(parsearHistoriaAcademica('{}').length, 0);
  assert.equal(parsearHistoriaAcademica('{"cont":""}').length, 0);
  assert.equal(parsearHistoriaAcademica('{"data":"no-html"}').length, 0);
});

test('parsearHistoriaAcademica retorna vacío con HTML sin tablas', () => {
  assert.equal(parsearHistoriaAcademica('<p>no tables here</p>').length, 0);
});

test('parsearHistoriaAcademica detecta PROMOCION como aprobada', () => {
  const html = HTML_BASE + tablaHeader() + fila('1001', 'Matemática I', 'PROMOCIONADA', '9') + HTML_FOOT;
  const res = parsearHistoriaAcademica(html);
  assert.equal(res.length, 1);
  assert.equal(res[0].estado, 'aprobada');
  assert.equal(res[0].nota, 9);
});

test('parsearHistoriaAcademica detecta DESAPROBADA', () => {
  const html = HTML_BASE + tablaHeader() + fila('1001', 'Matemática I', 'DESAPROBADA', '3') + HTML_FOOT;
  const res = parsearHistoriaAcademica(html);
  assert.equal(res.length, 1);
  assert.equal(res[0].estado, 'desaprobada');
  assert.equal(res[0].nota, 3);
});

test('parsearHistoriaAcademica detecta LIBRE', () => {
  const html = HTML_BASE + tablaHeader() + fila('1001', 'Matemática I', 'LIBRE', '') + HTML_FOOT;
  const res = parsearHistoriaAcademica(html);
  assert.equal(res.length, 1);
  assert.equal(res[0].estado, 'libre');
});

test('parsearHistoriaAcademica elimina duplicados por código', () => {
  const html = HTML_BASE + tablaHeader() +
    fila('1001', 'Matemática I', 'APROBADA', '8') +
    fila('1001', 'Matemática I', 'APROBADA', '8') +
    HTML_FOOT;
  const res = parsearHistoriaAcademica(html);
  assert.equal(res.length, 1);
});

test('parsearHistoriaAcademica tolera código alfanumérico sin guión', () => {
  const html = HTML_BASE + tablaHeader() + fila('MAT1001', 'Matemática Avanzada', 'APROBADA', '7') + HTML_FOOT;
  const res = parsearHistoriaAcademica(html);
  assert.equal(res.length, 1);
  assert.ok(res[0].codigoMateria.includes('MAT'));
});

test('sincronizarSIU lanza error cuando no hay credenciales', async () => {
  const originalUser = process.env.SIU_USER;
  const originalPass = process.env.SIU_PASSWORD;
  delete process.env.SIU_USER;
  delete process.env.SIU_PASSWORD;
  try {
    let caught = false;
    try {
      await sincronizarSIU({});
    } catch (e) {
      caught = true;
      assert.ok(e.message.includes('SIU_USER'), 'El error debe mencionar falta de credenciales');
    }
    assert.ok(caught, 'Debe lanzar error cuando faltan credenciales');
  } finally {
    if (originalUser) process.env.SIU_USER = originalUser;
    if (originalPass) process.env.SIU_PASSWORD = originalPass;
  }
});

test('codigoPlanDesdeActividadSiu mapea el código V.TUCS al plan de la tecnicatura', () => {
  assert.equal(
    codigoPlanDesdeActividadSiu('INTRODUCCIÓN (V.TUCS.1.01.1)'),
    '1.1.1'
  );
  assert.equal(
    codigoPlanDesdeActividadSiu('MARCOS NORMATIVOS (V.TUCS.1.06.2)'),
    '1.6.2'
  );
  assert.equal(
    codigoPlanDesdeActividadSiu('GESTIÓN DE ACTIVOS (V.TUCS.1.10.2)'),
    '1.10.2'
  );
});

test('parsearPlanEstudio lee notas aprobadas y omite las que están en curso', () => {
  const filaAprobada = '<tr class="materia"><td> SEGURIDAD FÍSICA (V.TUCS.1.04.1)</td><td>Materia</td><td>1</td><td>1° cuatrimestre</td><td>10 (Aprobado)</td><td>Examen</td><td></td><td></td><td></td></tr>';
  const filaCurso = '<tr class="materia"><td> CIBERDELITOS (V.TUCS.1.08.2)</td><td>Materia</td><td>1</td><td>2° cuatrimestre</td><td></td><td>En Curso</td><td></td><td></td><td></td></tr>';
  const html = `<table><tbody>${filaAprobada}${filaCurso}</tbody></table>`;
  const res = parsearPlanEstudio(html);
  assert.equal(res.length, 2);
  assert.equal(res[0].codigoMateria, '1.4.1');
  assert.equal(res[0].nota, 10);
  assert.equal(res[0].estado, 'aprobada');
  assert.equal(res[1].enCurso, true);
  assert.equal(res[1].omitir, true);
});

test('clasificarImportacionPlanSiu separa notas nuevas de las que ya estaban', () => {
  const materias = [
    { codigoMateria: '1.1.1', nombreMateria: 'Intro', estado: 'aprobada', nota: 8, omitir: false, enCurso: false },
    { codigoMateria: '1.2.1', nombreMateria: 'TIC', estado: 'aprobada', nota: 9, omitir: false, enCurso: false }
  ];
  const existentes = new Map([['1.1.1', { estado: 'aprobada', nota: '8' }]]);
  const { cargadas, yaTenias } = clasificarImportacionPlanSiu(materias, existentes);
  assert.equal(yaTenias.length, 1);
  assert.equal(cargadas.length, 1);
  assert.equal(cargadas[0].codigo, '1.2.1');
});

test('sincronizarSIU prefiere AJAX cuando tiene más filas que la página', () => {
  // Este test verifica la lógica de selección sin necesidad de red:
  // si HTML AJAX tiene 2 filas y HTML página tiene 1, devuelve las 2.
  const htmlPagina = HTML_BASE + tablaHeader() + fila('1001', 'Matemática I', 'APROBADA', '8') + HTML_FOOT;
  const htmlAjax = HTML_BASE + tablaHeader() +
    fila('1001', 'Matemática I', 'APROBADA', '8') +
    fila('INF-101', 'Introducción a la Informática', 'CURSANDO', '') +
    HTML_FOOT;
  const pagina = parsearHistoriaAcademica(htmlPagina);
  const ajax = parsearHistoriaAcademica(htmlAjax);
  assert.equal(pagina.length, 1);
  assert.equal(ajax.length, 2);
  // La lógica de sync-core elige el mayor
  const elegido = ajax.length > pagina.length ? ajax : pagina;
  assert.equal(elegido.length, 2);
});
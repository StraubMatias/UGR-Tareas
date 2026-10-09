import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cuentaAlumnoDebeBorrarse,
  cuentaSinLoginReciente,
  cuentaSinSyncReciente,
  ipPermiteOtraCuenta,
  nombreDeUsuarioValido,
  sentenciasBorrarAlumno,
  sentenciasRenombrarAlumno
} from '../src/lib/cuentas.ts';

const ahora = Date.parse('2026-09-22T15:00:00.000Z');
const haceOchoDias = '2026-09-14T15:00:00.000Z';
const haceDosDias = '2026-09-20T15:00:00.000Z';

const cuentaBase = {
  origen: 'comision',
  rol: 'alumno',
  creadoEn: haceOchoDias
};

test('sin login en 7 días (comisión o propio)', () => {
  assert.equal(cuentaSinLoginReciente({
    ...cuentaBase,
    ultimoAcceso: haceOchoDias
  }, ahora), true);
  assert.equal(cuentaSinLoginReciente({
    ...cuentaBase,
    ultimoAcceso: haceDosDias
  }, ahora), false);
});

test('sin sync UGR en 7 días', () => {
  assert.equal(cuentaSinSyncReciente({
    ...cuentaBase,
    sincronizadoEn: haceOchoDias
  }, ahora), true);
  assert.equal(cuentaSinSyncReciente({
    ...cuentaBase,
    sincronizadoEn: haceDosDias
  }, ahora), false);
});

test('nunca sincronizó: cuenta desde el alta', () => {
  assert.equal(cuentaSinSyncReciente({
    ...cuentaBase,
    creadoEn: haceDosDias
  }, ahora), false);
  assert.equal(cuentaSinSyncReciente({
    ...cuentaBase,
    creadoEn: haceOchoDias
  }, ahora), true);
});

test('cuentaAlumnoDebeBorrarse: login reciente pero sync vieja', () => {
  assert.equal(cuentaAlumnoDebeBorrarse({
    ...cuentaBase,
    ultimoAcceso: haceDosDias,
    sincronizadoEn: haceOchoDias
  }, ahora), true);
});

test('cuenta activa: login y sync dentro de la semana', () => {
  assert.equal(cuentaAlumnoDebeBorrarse({
    ...cuentaBase,
    ultimoAcceso: haceDosDias,
    sincronizadoEn: haceDosDias
  }, ahora), false);
});

test('admin no se borra aunque esté inactivo', () => {
  assert.equal(cuentaAlumnoDebeBorrarse({
    origen: 'propio',
    rol: 'admin',
    ultimoAcceso: haceOchoDias,
    sincronizadoEn: haceOchoDias,
    creadoEn: haceOchoDias
  }, ahora), false);
});

test('desde la misma conexión entran dos cuentas y la tercera no', () => {
  assert.equal(ipPermiteOtraCuenta(0), true);
  assert.equal(ipPermiteOtraCuenta(1), true);
  assert.equal(ipPermiteOtraCuenta(2), false);
});

test('renombrar un alumno conserva el id y mueve el nombre copiado', () => {
  assert.equal(nombreDeUsuarioValido('Ana'), null);
  assert.equal(nombreDeUsuarioValido('ab'), 'El usuario tiene que tener entre 3 y 100 caracteres.');
  const sql = sentenciasRenombrarAlumno('a_1', '12345678', 'Ana').map((sentencia) => sentencia.sql).join('\n');
  for (const tabla of ['alumnos', 'completadas', 'notas_parciales', 'notas_tareas', 'progreso_materias', 'auditoria', 'login_intentos']) {
    assert.match(sql, new RegExp(tabla));
  }
  assert.doesNotMatch(sql, /DELETE FROM alumnos/);
});

test('borrar un alumno saca sus datos y deja las materias compartidas', () => {
  const sql = sentenciasBorrarAlumno('a_1', 'Ana').map((sentencia) => sentencia.sql).join('\n');
  for (const tabla of [
    'tareas_entregas',
    'invitaciones_grupo',
    'preferencias_tarea_alumno',
    'integrantes_tareas',
    'completadas',
    'notas_parciales',
    'notas_tareas',
    'progreso_materias',
    'inscripciones',
    'horarios',
    'auditoria',
    'login_intentos',
    'alumnos'
  ]) {
    assert.match(sql, new RegExp(`DELETE FROM ${tabla}`));
  }
  assert.doesNotMatch(sql, /DELETE FROM materias/);
  assert.doesNotMatch(sql, /DELETE FROM tareas WHERE/);
  assert.doesNotMatch(sql, /DELETE FROM cronograma_eventos/);
  assert.doesNotMatch(sql, /DELETE FROM avisos_moodle/);
});

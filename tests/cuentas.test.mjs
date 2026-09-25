import test from 'node:test';
import assert from 'node:assert/strict';
import { cuentaPropiaVencida, ipPermiteOtraCuenta, nombreDeUsuarioValido, sentenciasBorrarAlumno, sentenciasRenombrarAlumno } from '../src/lib/cuentas.ts';

const ahora = Date.parse('2026-09-22T15:00:00.000Z');
const haceOchoDias = '2026-09-14T15:00:00.000Z';
const haceDosDias = '2026-09-20T15:00:00.000Z';

test('una cuenta propia sin sincronizar se vence a los 7 días', () => {
  assert.equal(cuentaPropiaVencida({
    origen: 'propio',
    creadoEn: haceOchoDias,
    inscripciones: 0
  }, ahora), true);
});

test('dentro de los 7 días la cuenta sigue', () => {
  assert.equal(cuentaPropiaVencida({
    origen: 'propio',
    creadoEn: haceDosDias,
    inscripciones: 0
  }, ahora), false);
});

test('si ya sincronizó o cursa una materia, no se borra', () => {
  assert.equal(cuentaPropiaVencida({
    origen: 'propio',
    creadoEn: haceOchoDias,
    sincronizadoEn: '2026-09-15T12:00:00.000Z',
    inscripciones: 0
  }, ahora), false);
  assert.equal(cuentaPropiaVencida({
    origen: 'propio',
    creadoEn: haceOchoDias,
    inscripciones: 1
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
  const sql = sentenciasRenombrarAlumno('a_1', '40269153', 'Ana').map((sentencia) => sentencia.sql).join('\n');
  for (const tabla of ['alumnos', 'completadas', 'notas_parciales', 'notas_tareas', 'progreso_materias', 'auditoria', 'login_intentos']) {
    assert.match(sql, new RegExp(tabla));
  }
  assert.doesNotMatch(sql, /DELETE FROM alumnos/);
});

test('borrar un alumno saca sus datos y deja las materias compartidas', () => {
  const sql = sentenciasBorrarAlumno('a_1', 'Ana').map((sentencia) => sentencia.sql).join('\n');
  for (const tabla of ['integrantes_tareas', 'completadas', 'notas_parciales', 'notas_tareas', 'progreso_materias', 'inscripciones', 'horarios', 'auditoria', 'login_intentos', 'alumnos']) {
    assert.match(sql, new RegExp(`DELETE FROM ${tabla}`));
  }
  assert.doesNotMatch(sql, /DELETE FROM (materias|tareas|cronograma_eventos|avisos_moodle)/);
  const horarios = sentenciasBorrarAlumno('a_1', 'Ana').find((sentencia) => sentencia.sql.includes('horarios'));
  assert.deepEqual(horarios?.args, ['a_1']);
});

test('una cuenta de la comisión no entra en esa limpieza', () => {
  assert.equal(cuentaPropiaVencida({
    origen: 'comision',
    creadoEn: haceOchoDias,
    inscripciones: 0
  }, ahora), false);
});

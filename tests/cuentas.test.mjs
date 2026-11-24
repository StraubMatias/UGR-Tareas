import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cuentaDebeBorrarsePorInactividad,
  DIAS_INACTIVIDAD_CUENTA,
  ipPermiteOtraCuenta,
  nombreDeUsuarioValido,
  sentenciasBorrarAlumno,
  sentenciasRenombrarAlumno
} from '../src/lib/cuentas.ts';

const ahora = Date.parse('2026-11-24T12:00:00.000Z');
const haceTreintaDias = '2026-10-25T12:00:00.000Z';

test('elimina por inactividad a los 30 días y conserva accesos recientes', () => {
  assert.equal(DIAS_INACTIVIDAD_CUENTA, 30);
  assert.equal(cuentaDebeBorrarsePorInactividad({ ultimoAcceso: haceTreintaDias }, ahora), true);
  assert.equal(cuentaDebeBorrarsePorInactividad({
    ultimoAcceso: '2026-11-23T12:00:00.000Z',
    creadoEn: haceTreintaDias
  }, ahora), false);
});

test('el admin no se elimina y cuentas sin fecha válida no se consideran vencidas', () => {
  assert.equal(cuentaDebeBorrarsePorInactividad({
    rol: 'admin',
    ultimoAcceso: haceTreintaDias
  }, ahora), false);
  assert.equal(cuentaDebeBorrarsePorInactividad({}), false);
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

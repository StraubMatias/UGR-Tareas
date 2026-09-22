import test from 'node:test';
import assert from 'node:assert/strict';
import { cuentaPropiaVencida } from '../src/lib/cuentas.ts';

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

test('una cuenta de la comisión no entra en esa limpieza', () => {
  assert.equal(cuentaPropiaVencida({
    origen: 'comision',
    creadoEn: haceOchoDias,
    inscripciones: 0
  }, ahora), false);
});

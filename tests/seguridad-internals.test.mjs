import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generarClaveTemporal,
  validarHoraReloj,
  LONGITUD_MINIMA_SESSION_SECRET
} from '../src/lib/seguridad.ts';

test('clave temporal tiene longitud y variedad', () => {
  const a = generarClaveTemporal(20);
  const b = generarClaveTemporal(20);
  assert.equal(a.length, 20);
  assert.notEqual(a, b);
});

test('validar hora reloj', () => {
  assert.equal(validarHoraReloj('09:30'), true);
  assert.equal(validarHoraReloj('25:00'), false);
  assert.equal(validarHoraReloj('9:30'), false);
});

test('session secret mínimo documentado', () => {
  assert.ok(LONGITUD_MINIMA_SESSION_SECRET >= 32);
});

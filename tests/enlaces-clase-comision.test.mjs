import test from 'node:test';
import assert from 'node:assert/strict';
import { enlaceClaseComisionParaHorario } from '../src/lib/enlaces-clase-comision.ts';

test('enlace SGSI según día de cursada', () => {
  const mie = enlaceClaseComisionParaHorario('SISTEMAS DE GESTIÓN DE SEGURIDAD', 3, '19:00');
  const jue = enlaceClaseComisionParaHorario('SISTEMAS DE GESTIÓN DE SEGURIDAD', 4, '20:30');
  assert.match(mie, /280032/);
  assert.match(jue, /342068/);
});

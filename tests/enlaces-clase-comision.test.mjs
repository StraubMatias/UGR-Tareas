import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enlaceClaseComisionParaContexto,
  enlaceClaseComisionParaHorario
} from '../src/lib/enlaces-clase-comision.ts';

test('ciberdelitos: Rodríguez en el plan usa su Zoom', () => {
  const url = enlaceClaseComisionParaContexto('CIBERDELITOS', {
    dia: 1,
    horaInicio: '19:00',
    textoPlan: 'Unidad 4. Gonzalo Rodríguez.'
  });
  assert.match(url, /344433/);
});

test('ciberdelitos: Gianzone sin link cargado no fuerza el de Rodríguez', () => {
  const url = enlaceClaseComisionParaContexto('CIBERDELITOS', {
    dia: 1,
    horaInicio: '19:00',
    textoPlan: 'Leonardo Gianzone.'
  });
  assert.equal(url, '');
});

test('enlace SGSI según día de cursada', () => {
  const mie = enlaceClaseComisionParaHorario('SISTEMAS DE GESTIÓN DE SEGURIDAD', 3, '19:00');
  const jue = enlaceClaseComisionParaHorario('SISTEMAS DE GESTIÓN DE SEGURIDAD', 4, '20:30');
  assert.match(mie, /280032/);
  assert.match(jue, /342068/);
});

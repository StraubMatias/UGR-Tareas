import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enlaceClaseComisionParaContexto,
  enlaceClaseComisionParaHorario,
  resolverEnlaceClaseComision
} from '../src/lib/enlaces-clase-comision.ts';

test('ciberdelitos: Rodríguez en el plan usa su Zoom', () => {
  const url = enlaceClaseComisionParaContexto('CIBERDELITOS', {
    dia: 1,
    horaInicio: '19:00',
    textoPlan: 'Unidad 4. Gonzalo Rodríguez.'
  });
  assert.match(url, /344433/);
});

test('ciberdelitos: Gianzone en el plan usa su enlace', () => {
  const url = enlaceClaseComisionParaContexto('CIBERDELITOS', {
    dia: 1,
    horaInicio: '19:00',
    textoPlan: 'Leonardo Gianzone.'
  });
  assert.match(url, /173820/);
});

test('ciberdelitos: el docente del plan prevalece sobre el enlace guardado en horario', () => {
  const url = resolverEnlaceClaseComision(
    'CIBERDELITOS',
    'https://virtual.ugr.edu.ar/mod/zoom/view.php?id=344433',
    {
      dia: 1,
      horaInicio: '19:00',
      textoPlan: 'Características y clases. Leonardo Gianzone.'
    }
  );
  assert.match(url, /173820/);
});

test('calendario: mantiene el enlace guardado cuando el plan no cambia el enlace de catálogo', () => {
  const urlGuardada = 'https://example.test/enlace-guardado';
  const url = resolverEnlaceClaseComision(
    'SISTEMAS DE GESTIÓN DE SEGURIDAD',
    urlGuardada,
    { dia: 3, horaInicio: '19:00' }
  );

  assert.equal(url, urlGuardada);
});

test('enlace SGSI según día de cursada', () => {
  const mie = enlaceClaseComisionParaHorario('SISTEMAS DE GESTIÓN DE SEGURIDAD', 3, '19:00');
  const jue = enlaceClaseComisionParaHorario('SISTEMAS DE GESTIÓN DE SEGURIDAD', 4, '20:30');
  assert.match(mie, /280032/);
  assert.match(jue, /342068/);
});

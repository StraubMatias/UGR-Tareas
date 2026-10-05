import test from 'node:test';
import assert from 'node:assert/strict';
import {
  instanteCierreCampus,
  obtenerDiasHastaTarea,
  textoPlazoHastaCierreTarea,
  etiquetaDiasRestantes,
} from '../src/core/cursada.ts';

test('cierre 7 oct 23:59 AR no es medianoche del 8', () => {
  const cierre = instanteCierreCampus('2026-10-07');
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(new Date(cierre));
  const tomar = (t) => partes.find((p) => p.type === t)?.value;
  assert.equal(Number(tomar('day')), 7);
  assert.equal(Number(tomar('month')), 10);
  assert.equal(tomar('hour'), '23');
  assert.equal(tomar('minute'), '59');
});

test('dos días antes del cierre cuenta 2 días (no 1 por restar uno)', () => {
  const ahora = new Date('2026-10-05T12:00:00-03:00').getTime();
  assert.equal(obtenerDiasHastaTarea('2026-10-07', ahora), 2);
});

test('menos de 24 h muestra horas en el plazo', () => {
  const ahora = new Date('2026-10-07T10:00:00-03:00').getTime();
  const plazo = textoPlazoHastaCierreTarea('2026-10-07', ahora);
  assert.equal(plazo.dias, 0);
  assert.ok(plazo.detalleHoras?.includes('h'));
});

test('un día restante: Queda, no Quedan', () => {
  assert.equal(etiquetaDiasRestantes(1), 'Queda 1 día');
  assert.equal(etiquetaDiasRestantes(2), 'Quedan 2 días');
});

test('con 48 h o más solo días, sin horas', () => {
  const ahora = new Date('2026-10-05T10:00:00-03:00').getTime();
  const plazo = textoPlazoHastaCierreTarea('2026-10-07', ahora);
  assert.equal(plazo.dias, 2);
  assert.equal(plazo.detalleHoras, null);
});

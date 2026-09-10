import test from 'node:test';
import assert from 'node:assert/strict';
import { parcialHabilitado, tareaHabilitada, tareaDentroDelPlazo, validarNota, normalizarUnidad } from '../src/app/validators.js';

const hoy = new Date();
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyStr = fmt(hoy);

function fechaFutura(dias) {
  const d = new Date(hoy);
  d.setDate(d.getDate() + dias);
  return fmt(d);
}

function fechaPasada(dias) {
  const d = new Date(hoy);
  d.setDate(d.getDate() - dias);
  return fmt(d);
}

// --- parcialHabilitado ---

test('parcialHabilitado: fecha vacía o inválida devuelve false', () => {
  assert.equal(parcialHabilitado(null), false);
  assert.equal(parcialHabilitado(''), false);
  assert.equal(parcialHabilitado('Sin fecha'), false);
});

test('parcialHabilitado: fecha pasada devuelve true', () => {
  assert.equal(parcialHabilitado(fechaPasada(1)), true);
});

test('parcialHabilitado: hoy devuelve true', () => {
  assert.equal(parcialHabilitado(hoyStr), true);
});

test('parcialHabilitado: fecha futura devuelve false', () => {
  assert.equal(parcialHabilitado(fechaFutura(1)), false);
});

// --- tareaHabilitada ---

test('tareaHabilitada: fecha vacía o inválida devuelve true (sin restricción)', () => {
  assert.equal(tareaHabilitada(null), true);
  assert.equal(tareaHabilitada(''), true);
  assert.equal(tareaHabilitada('Sin fecha'), true);
});

test('tareaHabilitada: fecha pasada devuelve true', () => {
  assert.equal(tareaHabilitada(fechaPasada(1)), true);
});

test('tareaHabilitada: hoy devuelve true', () => {
  assert.equal(tareaHabilitada(hoyStr), true);
});

test('tareaHabilitada: fecha futura devuelve false', () => {
  assert.equal(tareaHabilitada(fechaFutura(1)), false);
});

// --- tareaDentroDelPlazo ---

test('tareaDentroDelPlazo: fecha vacía o inválida devuelve true', () => {
  assert.equal(tareaDentroDelPlazo(null), true);
  assert.equal(tareaDentroDelPlazo(''), true);
  assert.equal(tareaDentroDelPlazo('Sin fecha'), true);
});

test('tareaDentroDelPlazo: hoy devuelve false (ya venció el plazo)', () => {
  assert.equal(tareaDentroDelPlazo(hoyStr), false);
});

test('tareaDentroDelPlazo: mañana devuelve true', () => {
  assert.equal(tareaDentroDelPlazo(fechaFutura(1)), true);
});

test('tareaDentroDelPlazo: ayer devuelve false', () => {
  assert.equal(tareaDentroDelPlazo(fechaPasada(1)), false);
});

// --- validarNota ---

test('validarNota: valores vacíos retornan vacía=true', () => {
  assert.deepEqual(validarNota(''), { valida: false, vacia: true, valor: '' });
  assert.deepEqual(validarNota(null), { valida: false, vacia: true, valor: '' });
  assert.deepEqual(validarNota(undefined), { valida: false, vacia: true, valor: '' });
});

test('validarNota: notas válidas 1-10', () => {
  assert.deepEqual(validarNota('1'), { valida: true, vacia: false, valor: '1' });
  assert.deepEqual(validarNota('10'), { valida: true, vacia: false, valor: '10' });
  assert.deepEqual(validarNota('7'), { valida: true, vacia: false, valor: '7' });
  assert.deepEqual(validarNota(8), { valida: true, vacia: false, valor: '8' });
});

test('validarNota: convierte coma a punto', () => {
  assert.deepEqual(validarNota('7,5'), { valida: true, vacia: false, valor: '7.5' });
});

test('validarNota: valores fuera de rango', () => {
  assert.equal(validarNota('0').valida, false);
  assert.equal(validarNota('11').valida, false);
  assert.equal(validarNota('-1').valida, false);
});

test('validarNota: strings no numéricos', () => {
  assert.equal(validarNota('abc').valida, false);
  assert.equal(validarNota('diez').valida, false);
});

// --- normalizarUnidad ---

test('normalizarUnidad: vacío o nulo → válida null', () => {
  assert.deepEqual(normalizarUnidad(''), { valida: true, valor: null });
  assert.deepEqual(normalizarUnidad(null), { valida: true, valor: null });
  assert.deepEqual(normalizarUnidad(undefined), { valida: true, valor: null });
});

test('normalizarUnidad: números válidos >= 1', () => {
  assert.deepEqual(normalizarUnidad('1'), { valida: true, valor: 1 });
  assert.deepEqual(normalizarUnidad('5'), { valida: true, valor: 5 });
  assert.deepEqual(normalizarUnidad(3), { valida: true, valor: 3 });
});

test('normalizarUnidad: 0 o negativos → inválida', () => {
  assert.equal(normalizarUnidad('0').valida, false);
  assert.equal(normalizarUnidad('-1').valida, false);
});

test('normalizarUnidad: no numéricos → inválida', () => {
  assert.equal(normalizarUnidad('abc').valida, false);
});

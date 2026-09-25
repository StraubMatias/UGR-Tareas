import test from 'node:test';
import assert from 'node:assert/strict';
import {
  etiquetaSyncMaterias,
  planPasadasSyncUgr,
  tamanoLoteMateriasSync
} from '../src/lib/sync-ugr-orquestacion.ts';

test('tamanoLoteMateriasSync: pocas materias en una sola pasada', () => {
  assert.equal(tamanoLoteMateriasSync(1), 1);
  assert.equal(tamanoLoteMateriasSync(3), 3);
  assert.equal(tamanoLoteMateriasSync(5), 2);
  assert.equal(tamanoLoteMateriasSync(7), 3);
});

test('planPasadasSyncUgr divide en lotes de materias y avisos', () => {
  const ids = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const plan = planPasadasSyncUgr(ids);
  assert.deepEqual(plan.materiaIds, ids);
  assert.equal(plan.lotesMaterias.length, 3);
  assert.deepEqual(plan.lotesMaterias[0], ['m1', 'm2']);
  assert.equal(plan.totalPasos, 1 + 3 + 3);
});

test('etiquetaSyncMaterias deja claro paso vs total de materias', () => {
  const plan = planPasadasSyncUgr(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.match(etiquetaSyncMaterias(0, plan.lotesMaterias, 7), /paso 1\/3/);
  assert.match(etiquetaSyncMaterias(0, plan.lotesMaterias, 7), /de 7/);
});

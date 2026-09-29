import test from 'node:test';
import assert from 'node:assert/strict';
import {
  etiquetaSyncMateriaCompleta,
  planPasadasSyncUgr
} from '../src/lib/sync-ugr-orquestacion.ts';

test('planPasadasSyncUgr: una pasada completa por materia', () => {
  const ids = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const plan = planPasadasSyncUgr(ids);
  assert.deepEqual(plan.materiaIds, ids);
  assert.equal(plan.pasadasMaterias.length, 5);
  assert.deepEqual(plan.pasadasMaterias[0], ['m1']);
  assert.deepEqual(plan.pasadasMaterias[4], ['m5']);
  assert.equal(plan.totalPasos, 6);
});

test('etiquetaSyncMateriaCompleta muestra nombre y paso', () => {
  const plan = planPasadasSyncUgr(['a', 'b', 'c']);
  assert.match(
    etiquetaSyncMateriaCompleta(1, plan.pasadasMaterias, 3, 'Sistemas de Gestión'),
    /Materia 2\/3/
  );
  assert.match(
    etiquetaSyncMateriaCompleta(1, plan.pasadasMaterias, 3, 'Sistemas de Gestión'),
    /avisos/
  );
});

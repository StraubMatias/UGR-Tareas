import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_OMITIR_REVISION_CAMPO,
  diasDesdeIso,
  debeOmitirSyncHitosAssign,
  evaluarFilaRevisionCampus,
  priorizarYFiltrarRevisionCampus
} from '../lib/sync-optimizacion.mjs';

test('omite tarea con nota cerrada hace más de una semana', () => {
  const haceOcho = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const { omitir } = evaluarFilaRevisionCampus({
    tabla: 'tareas',
    con_nota: 1,
    nota_guardada: '10',
    nota_cerrada: 1,
    nota_cargada_en: haceOcho
  });
  assert.equal(omitir, true);
});

test('sigue revisando tarea sin nota aunque esté marcada entregada', () => {
  const { omitir, prioridad } = evaluarFilaRevisionCampus({
    tabla: 'tareas',
    con_nota: 1,
    nota_guardada: null,
    nota_cerrada: 0,
    completada_en: '2026-01-01T10:00:00.000Z'
  });
  assert.equal(omitir, false);
  assert.equal(prioridad, 0);
});

test('prioriza pendientes de nota antes que el resto', () => {
  const { consultar } = priorizarYFiltrarRevisionCampus([
    { tabla: 'tareas', nombre: 'B', con_nota: 1, nota_guardada: '8', nota_cerrada: 1, nota_cargada_en: new Date().toISOString() },
    { tabla: 'tareas', nombre: 'A', con_nota: 1, nota_guardada: null, nota_cerrada: 0 }
  ]);
  assert.equal(consultar[0].nombre, 'A');
});

test('debeOmitirSyncHitosAssign si no hay fase activa y sincronizó hace días', () => {
  const viejo = new Date(Date.now() - (DIAS_OMITIR_REVISION_CAMPO + 1) * 24 * 3600 * 1000).toISOString();
  assert.equal(
    debeOmitirSyncHitosAssign([
      { es_activa: 0, nota: '10', sincronizado_en: viejo },
      { es_activa: 0, nota: '8', sincronizado_en: viejo }
    ]),
    true
  );
});

test('no omite hitos assign con entrega activa', () => {
  assert.equal(
    debeOmitirSyncHitosAssign([{ es_activa: 1, nota: null, sincronizado_en: new Date().toISOString() }]),
    false
  );
});

test('diasDesdeIso calcula días enteros aproximados', () => {
  const haceTres = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  assert.ok(diasDesdeIso(haceTres) >= 2.9);
});

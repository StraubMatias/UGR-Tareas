import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizarLecturas } from '../lib/lecturas.mjs';

test('lecturas: 24 lecturas repetidas generan 8 pedidos, máximo 4 simultáneos', async () => {
  let llamadas = 0;
  let activos = 0;
  let maximo = 0;
  const base = { async pedir(ruta) {
    llamadas++;
    activos++;
    maximo = Math.max(maximo, activos);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activos--;
    return { html: ruta, status: 200 };
  } };
  const cliente = optimizarLecturas(base);
  const rutas = Array.from({ length: 24 }, (_, i) => `/curso/${i % 8}`);
  const paginas = await Promise.all(rutas.map((r) => cliente.pedir(r)));
  assert.deepEqual(paginas.map((p) => p.html), rutas);
  assert.equal(llamadas, 8);
  assert.equal(maximo, 4);
  await cliente.pedir('/curso/0');
  assert.equal(llamadas, 8);
  await optimizarLecturas(base).pedir('/curso/0');
  assert.equal(llamadas, 9, 'una búsqueda nueva no usa contenido viejo');
});

test('lecturas: los errores y escrituras no se cachean', async () => {
  let llamadas = 0;
  const cliente = optimizarLecturas({ async pedir() {
    llamadas++;
    if (llamadas === 1) throw new Error('temporal');
    return { html: 'ok', status: llamadas === 2 ? 503 : 200 };
  } });
  await assert.rejects(cliente.pedir('/curso'), /temporal/);
  assert.equal((await cliente.pedir('/curso')).status, 503);
  assert.equal((await cliente.pedir('/curso')).status, 200);
  await cliente.pedir('/curso', { method: 'POST', cuerpo: 'x=1' });
  await cliente.pedir('/curso', { method: 'POST', cuerpo: 'x=1' });
  assert.equal(llamadas, 5);
});

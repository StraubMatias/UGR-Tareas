/**
 * Ejecuta `fn` sobre `items` con hasta `concurrency` llamadas HTTP en paralelo.
 * Mantiene el orden de los resultados. Usado en overviews, foros y calendarios.
 */
export async function conPool(items, concurrency = 4, fn) {
  const resultados = new Array(items.length);
  let indice = 0;
  async function trabajador() {
    for (;;) {
      const actual = indice;
      indice += 1;
      if (actual >= items.length) return;
      resultados[actual] = await fn(items[actual], actual);
    }
  }
  const hilos = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  await Promise.all(Array.from({ length: hilos }, () => trabajador()));
  return resultados;
}

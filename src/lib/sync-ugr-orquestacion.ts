/** Máximo de materias por server action (techo ~60 s en Vercel). */
export const MATERIAS_POR_PASADA_SYNC = 2;

/** Con pocas materias, una sola pasada alcanza sin trocear. */
export const UMBRAL_MATERIAS_UNA_PASADA = 3;

export function partirEnLotes<T>(items: T[], tamano: number): T[][] {
  if (!items.length) return [];
  const n = Math.max(1, tamano);
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += n) lotes.push(items.slice(i, i + n));
  return lotes;
}

export function tamanoLoteMateriasSync(cantidadMaterias: number): number {
  if (cantidadMaterias <= UMBRAL_MATERIAS_UNA_PASADA) return cantidadMaterias;
  if (cantidadMaterias <= 6) return MATERIAS_POR_PASADA_SYNC;
  return MATERIAS_POR_PASADA_SYNC;
}

export function planPasadasSyncUgr(materiaIds: string[]) {
  const ids = [...new Set(materiaIds.filter(Boolean))];
  const tamano = tamanoLoteMateriasSync(ids.length);
  const lotes = partirEnLotes(ids, tamano);
  const pasosMaterias = lotes.length;
  const pasosAvisos = lotes.length;
  return {
    materiaIds: ids,
    lotesMaterias: lotes,
    lotesAvisos: lotes,
    totalPasos: 1 + pasosMaterias + pasosAvisos
  };
}

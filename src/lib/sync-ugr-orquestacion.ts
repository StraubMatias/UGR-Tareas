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
  return 3;
}

/** Para el texto de carga: qué materias (por número) entran en este lote. */
export function rangoMateriasEnLote(lotes: string[][] , indiceLote: number, totalMaterias: number) {
  let antes = 0;
  for (let i = 0; i < indiceLote; i += 1) antes += lotes[i]?.length ?? 0;
  const enLote = lotes[indiceLote]?.length ?? 0;
  return {
    desde: antes + 1,
    hasta: antes + enLote,
    enLote,
    total: totalMaterias
  };
}

export function etiquetaSyncMaterias(indiceLote: number, lotes: string[][], totalMaterias: number): string {
  if (lotes.length <= 1) {
    return `Sincronizando tareas, fechas y notas de tus ${totalMaterias} materia${totalMaterias === 1 ? '' : 's'}…`;
  }
  const { desde, hasta, enLote, total } = rangoMateriasEnLote(lotes, indiceLote, totalMaterias);
  const rango = enLote === 1 ? `la materia ${desde}` : `las materias ${desde} a ${hasta}`;
  return `Tareas y notas — paso ${indiceLote + 1}/${lotes.length} (${rango} de ${total})…`;
}

export function etiquetaSyncAvisos(indiceLote: number, lotes: string[][], totalMaterias: number): string {
  if (lotes.length <= 1) {
    return `Revisando foros de avisos de tus ${totalMaterias} materia${totalMaterias === 1 ? '' : 's'}…`;
  }
  const { desde, hasta, enLote, total } = rangoMateriasEnLote(lotes, indiceLote, totalMaterias);
  const rango = enLote === 1 ? `materia ${desde}` : `materias ${desde}–${hasta}`;
  return `Avisos del campus — paso ${indiceLote + 1}/${lotes.length} (${rango} de ${total})…`;
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

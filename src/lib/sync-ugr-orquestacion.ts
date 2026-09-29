/** Una materia por pasada: tareas, notas, hitos y avisos del campus en el mismo request. */
export const MATERIAS_POR_PASADA_SYNC = 1;

export function partirEnLotes<T>(items: T[], tamano: number): T[][] {
  if (!items.length) return [];
  const n = Math.max(1, tamano);
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += n) lotes.push(items.slice(i, i + n));
  return lotes;
}

/** Cada pasada sincroniza una materia entera (núcleo + foros de avisos). */
export function planPasadasSyncUgr(materiaIds: string[]) {
  const ids = [...new Set(materiaIds.filter(Boolean))];
  const pasadasMaterias = partirEnLotes(ids, MATERIAS_POR_PASADA_SYNC);
  return {
    materiaIds: ids,
    pasadasMaterias,
    /** Compatibilidad con código que aún lee lotes separados. */
    lotesMaterias: pasadasMaterias,
    lotesAvisos: pasadasMaterias,
    totalPasos: 1 + pasadasMaterias.length
  };
}

export function etiquetaSyncMateriaCompleta(
  indice: number,
  pasadas: string[][],
  totalMaterias: number,
  nombreMateria?: string
): string {
  const paso = indice + 1;
  const totalPasos = pasadas.length;
  const nombre = nombreMateria?.trim();
  if (nombre) {
    return totalPasos <= 1
      ? `Sincronizando «${nombre}»: tareas, notas y avisos…`
      : `Materia ${paso}/${totalPasos} · «${nombre}» (tareas, notas y avisos)…`;
  }
  return totalPasos <= 1
    ? `Sincronizando tareas, notas y avisos de tus ${totalMaterias} materia${totalMaterias === 1 ? '' : 's'}…`
    : `Sincronizando materia ${paso}/${totalPasos} (tareas, notas y avisos)…`;
}

/** @deprecated Usar etiquetaSyncMateriaCompleta */
export function etiquetaSyncMaterias(indiceLote: number, lotes: string[][], totalMaterias: number): string {
  return etiquetaSyncMateriaCompleta(indiceLote, lotes, totalMaterias);
}

/** @deprecated Avisos van en la misma pasada que la materia */
export function etiquetaSyncAvisos(indiceLote: number, lotes: string[][], totalMaterias: number): string {
  return etiquetaSyncMateriaCompleta(indiceLote, lotes, totalMaterias);
}

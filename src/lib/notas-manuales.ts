import type { NovedadTablero } from '../components/portal/types';

/** Notas con cerrada=0 en actividades que tienen URL en el campus (el sync puede reemplazarlas). */
export function novedadNotasManualesPendientes(cantidad: number): NovedadTablero | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
  const textoCantidad = cantidad === 1
    ? 'Hay 1 nota cargada a mano en el tablero'
    : `Hay ${cantidad} notas cargadas a mano en el tablero`;
  return {
    id: 'notas-manuales-sync',
    tipo: 'notas-manuales',
    nombre: textoCantidad,
    materia: 'UGR Virtual'
  };
}

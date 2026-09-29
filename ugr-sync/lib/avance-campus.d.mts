import type { MapeoCurso } from './sync-core.mjs';

export interface ItemAvanceCampus {
  cmid: string;
  modulo: string;
  titulo: string;
  url: string;
  completada: boolean;
  orden: number;
  unidad: number | null;
}

export function extraerItemsAvanceCampusDeHtml(html: string, baseUrl?: string): ItemAvanceCampus[];
export function recolectarItemsAvanceCampusDeCurso(
  cliente: unknown,
  cursoId: string | number
): Promise<ItemAvanceCampus[]>;
export function sincronizarAvanceCampusEnMaterias(opciones: {
  cliente: unknown;
  db: unknown;
  mapeos: MapeoCurso[];
  alumnoId: string;
}): Promise<{ items: number }>;
export function urlNormalizadaCampus(url: string): string;

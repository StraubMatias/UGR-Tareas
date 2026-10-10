const ABREVIAR_MATERIA_CALENDARIO: Array<{ prueba: RegExp; etiqueta: string }> = [
  { prueba: /conceptos?\s+de\s+desarrollo\s+de\s+software/i, etiqueta: 'Desarrollo de software' },
  { prueba: /introducci[oó]n\s+a\s+la\s+criptograf[ií]a/i, etiqueta: 'Intro. criptografía' },
  { prueba: /auditor[ií]as?\s+de\s+seguridad/i, etiqueta: 'Auditoría SGSI' },
  { prueba: /sistemas\s+de\s+gesti[oó]n\s+de\s+la\s+seguridad/i, etiqueta: 'SGSI' },
  { prueba: /gesti[oó]n\s+de\s+activos/i, etiqueta: 'Gestión de activos' }
];

function nombreVisibleMateriaCalendario(nombreMateria = ''): string {
  const sinCodigo = String(nombreMateria).replace(/^\s*\([^)]+\)\s*/i, '').trim();
  return sinCodigo || String(nombreMateria).trim();
}

/** Nombre legible en la grilla del mes (sin código campus; abrevia títulos largos de la comisión). */
export function nombreMateriaEnCalendario(nombreMateria = ''): string {
  const visible = nombreVisibleMateriaCalendario(nombreMateria);
  for (const { prueba, etiqueta } of ABREVIAR_MATERIA_CALENDARIO) {
    if (prueba.test(visible)) return etiqueta;
  }
  return visible;
}

export function rangoHorarioCalendario(horaInicio: string, horaFin: string): string {
  const inicio = String(horaInicio || '').trim();
  const fin = String(horaFin || '').trim();
  if (!inicio) return fin;
  if (!fin) return inicio;
  return `${inicio}–${fin}`;
}

/** Más eventos en la celda → más alto el día hábil (lun–vie). */
export function claseDensidadDiaCalendario(cantidadEventos: number, esFinDeSemana: boolean): string {
  if (esFinDeSemana || cantidadEventos < 2) return '';
  if (cantidadEventos >= 4) return 'calendar-day-heavy';
  if (cantidadEventos >= 3) return 'calendar-day-dense';
  return 'calendar-day-medium';
}

export function ordenarHorariosCalendario<T extends { hora_inicio?: string }>(horarios: T[]): T[] {
  return [...horarios].sort((a, b) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || '')));
}

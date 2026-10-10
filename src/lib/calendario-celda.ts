/** Orden importa: patrones más específicos primero. */
const ABREVIAR_MATERIA_CALENDARIO: Array<{ prueba: RegExp; etiqueta: string }> = [
  { prueba: /conceptos?\s+de\s+desarrollo\s+de\s+software/i, etiqueta: 'Desarrollo de software' },
  { prueba: /introducci[oó]n\s+a\s+la\s+criptograf[ií]a/i, etiqueta: 'Intro. criptografía' },
  { prueba: /auditor[ií]as?\s+de\s+seguridad/i, etiqueta: 'Auditoría SI' },
  {
    prueba: /sistemas?\s+de\s+gesti[oó]n\s+de\s+(la\s+)?seguridad/i,
    etiqueta: 'SGSI'
  },
  { prueba: /gesti[oó]n\s+de\s+activos/i, etiqueta: 'Gestión de activos' },
  { prueba: /ciberdelito/i, etiqueta: 'Ciberdelitos' }
];

function nombreVisibleMateriaCalendario(nombreMateria = ''): string {
  const sinCodigo = String(nombreMateria).replace(/^\s*\([^)]+\)\s*/i, '').trim();
  const sinParentesisFinal = sinCodigo.replace(/\s*\([^)]*\)\s*$/i, '').trim();
  return sinParentesisFinal || sinCodigo || String(nombreMateria).trim();
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

/** Agrupa el mes en filas de 7 (lun–dom) para altura por semana. */
export function semanasCalendarioDelMes(dias: (Date | null)[]): (Date | null)[][] {
  const semanas: (Date | null)[][] = [];
  for (let indice = 0; indice < dias.length; indice += 7) {
    semanas.push(dias.slice(indice, indice + 7));
  }
  return semanas;
}

export function ordenarHorariosCalendario<T extends { hora_inicio?: string }>(horarios: T[]): T[] {
  return [...horarios].sort((a, b) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || '')));
}

/** Un bloque de cursada por materia_id (el turno más temprano). */
export function horariosUnicosPorMateriaCalendario<
  T extends { materia_id: string; hora_inicio?: string; id?: string }
>(horarios: T[]): T[] {
  const elegido = new Map<string, T>();
  for (const horario of ordenarHorariosCalendario(horarios)) {
    const previo = elegido.get(horario.materia_id);
    if (!previo || String(horario.hora_inicio).localeCompare(String(previo.hora_inicio)) < 0) {
      elegido.set(horario.materia_id, horario);
    }
  }
  return ordenarHorariosCalendario([...elegido.values()]);
}

/** Evita dos chips iguales si hay materias duplicadas en la base con el mismo nombre y horario. */
export function horariosParaCeldaCalendario<
  T extends { materia_id: string; hora_inicio?: string; hora_fin?: string }
>(horarios: T[], nombreDeMateria: (materiaId: string) => string): T[] {
  const unicos = horariosUnicosPorMateriaCalendario(horarios);
  const vistos = new Set<string>();
  const lista: T[] = [];
  for (const horario of unicos) {
    const nombre = nombreMateriaEnCalendario(nombreDeMateria(horario.materia_id));
    const clave = `${nombre.toLowerCase()}|${horario.hora_inicio}|${horario.hora_fin}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(horario);
  }
  return lista;
}

import type { ResumenMateriaSync } from '../app/actions/types';

export interface NotaCampusInforme {
  tareaId?: string;
  nombre: string;
  materia?: string;
  nota: string;
  yaEstaba?: boolean;
}

/** Líneas concretas de lo que hizo esta corrida de sync (sin lógica de grupos). */
export function construirLineasInformeSync({
  notasCampus = [],
  resumen = [],
  parcialesNuevos = 0,
  eventos = 0,
  horarios = 0,
  fechas = 0,
  fechasDetalle = [],
  condiciones = 0,
  pendientesEntrega = [],
  notasNoLeidas = []
}: {
  notasCampus?: NotaCampusInforme[];
  resumen?: ResumenMateriaSync[];
  parcialesNuevos?: number;
  eventos?: number;
  horarios?: number;
  fechas?: number;
  fechasDetalle?: Array<{ materiaNombre?: string; texto?: string }>;
  condiciones?: number;
  pendientesEntrega?: Array<{ materia?: string; nombre?: string }>;
  notasNoLeidas?: Array<{ materia?: string; nombre?: string }>;
}): string[] {
  const lineas: string[] = [];

  for (const nota of notasCampus) {
    if (!nota.nombre || !nota.nota || nota.yaEstaba) continue;
    const materia = nota.materia ? `${nota.materia} · ` : '';
    lineas.push(`Cargamos nota ${nota.nota} en ${materia}«${nota.nombre}» desde UGR Virtual.`);
  }

  for (const fila of resumen) {
    for (const nombre of fila.nuevas || []) {
      lineas.push(`Tarea nueva en ${fila.materia}: «${nombre}».`);
    }
    for (const linea of fila.fechasActualizadas || []) {
      lineas.push(`${fila.materia}: ${linea}.`);
    }
    for (const nombre of fila.parcialesNuevos || []) {
      lineas.push(`Parcial nuevo en ${fila.materia}: ${nombre}.`);
    }
    for (const linea of fila.cronogramaNuevo || []) {
      lineas.push(`Cronograma en ${fila.materia}: ${linea}.`);
    }
    for (const linea of fila.notasCargadas || []) {
      if (!lineas.some((item) => item.includes(linea))) lineas.push(`${fila.materia}: ${linea}.`);
    }
  }

  if (fechas === 1 && fechasDetalle[0]?.texto) {
    const m = fechasDetalle[0].materiaNombre;
    lineas.push(m ? `${m}: ${fechasDetalle[0].texto}.` : `${fechasDetalle[0].texto}.`);
  } else if (fechas > 1) {
    lineas.push(`${fechas} fechas de tareas actualizadas según UGR Virtual.`);
  }
  if (parcialesNuevos === 1) lineas.push('1 parcial nuevo en el tablero.');
  else if (parcialesNuevos > 1) lineas.push(`${parcialesNuevos} parciales nuevos en el tablero.`);
  if (eventos) lineas.push(`${eventos} evento(s) del campus agregados al cronograma.`);
  if (horarios) lineas.push(`${horarios} horario(s) actualizados.`);
  if (condiciones) lineas.push(`Condiciones de cursada actualizadas en ${condiciones} materia(s).`);

  for (const item of pendientesEntrega) {
    if (item?.nombre) {
      const m = item.materia ? `${item.materia}: ` : '';
      lineas.push(`${m}Falta marcar entregada «${item.nombre}» en el tablero para registrar la nota.`);
    }
  }
  for (const item of notasNoLeidas) {
    if (item?.nombre) {
      const m = item.materia ? `${item.materia}: ` : '';
      lineas.push(`${m}No pudimos leer la nota de «${item.nombre}» en UGR Virtual.`);
    }
  }

  return lineas;
}

export function fusionarLineasInforme(...listas: string[][]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const lista of listas) {
    for (const linea of lista) {
      if (!linea || vistas.has(linea)) continue;
      vistas.add(linea);
      salida.push(linea);
    }
  }
  return salida;
}

export function fusionarResumenSync(a: ResumenMateriaSync[], b: ResumenMateriaSync[]): ResumenMateriaSync[] {
  const porMateria = new Map<string, ResumenMateriaSync>();
  const unir = (prev: string[] = [], extra: string[] = []) => [...new Set([...prev, ...extra])];
  for (const fila of [...a, ...b]) {
    const base = porMateria.get(fila.materia) || {
      materia: fila.materia,
      nuevas: [],
      yaEstaban: [],
      cronogramaNuevo: [],
      cronogramaYa: []
    };
    porMateria.set(fila.materia, {
      ...base,
      nuevas: unir(base.nuevas, fila.nuevas),
      yaEstaban: unir(base.yaEstaban, fila.yaEstaban),
      cronogramaNuevo: unir(base.cronogramaNuevo, fila.cronogramaNuevo),
      cronogramaYa: unir(base.cronogramaYa, fila.cronogramaYa),
      fechasActualizadas: unir(base.fechasActualizadas, fila.fechasActualizadas),
      parcialesNuevos: unir(base.parcialesNuevos, fila.parcialesNuevos),
      notasCargadas: unir(base.notasCargadas, fila.notasCargadas),
      pendientesEntrega: unir(base.pendientesEntrega, fila.pendientesEntrega),
      notasNoLeidas: unir(base.notasNoLeidas, fila.notasNoLeidas),
      materiaNueva: base.materiaNueva || fila.materiaNueva
    });
  }
  return [...porMateria.values()];
}

export function mensajeDesdeInforme(lineas: string[], materiasRevisadas: number): string {
  if (lineas.length === 0) {
    return materiasRevisadas === 1
      ? 'Revisamos tu cursada en UGR Virtual: no había nada nuevo que cargar (tareas, fechas ni notas).'
      : `Revisamos ${materiasRevisadas} materias en UGR Virtual: no había nada nuevo que cargar.`;
  }
  const encabezado = materiasRevisadas === 1
    ? 'Sincronización lista. Esto actualizamos:'
    : `Sincronización lista (${materiasRevisadas} materias). Esto actualizamos:`;
  return `${encabezado}\n${lineas.map((l) => `• ${l}`).join('\n')}`;
}

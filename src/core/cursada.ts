// Lógica pura de la cursada: formato de fechas, estados de tareas, semáforos,
// agrupación por unidad, resúmenes por alumno e historial.

export interface Grupo {
  id?: string;
  nombre?: string;
  integrantes?: string[];
}

export interface Tarea {
  id: string;
  nombre: string;
  inicio: string | null;
  fin: string | null;
  detalles?: string;
  unidad: string | number | null;
  conNota: boolean;
  tipo?: string;
  url?: string;
  notas?: Record<string, string | number | null>;
  completadoPor: string[];
  completadoEn?: Record<string, string | null>;
  notaCargadaEn?: Record<string, string | null>;
  grupal?: boolean;
  permite_individual?: boolean;
  entregaIndividualPor?: Record<string, boolean>;
  grupos?: Grupo[];
  cupo_maximo?: number | string;
  entregas?: Record<string, EntregaHitoTarea[]>;
}

export interface EntregaHitoTarea {
  numero: number;
  indiceEntrega: number | null;
  esActiva: boolean;
  estado: string;
  nota: string | number | null;
  notaOrigen?: string | null;
  comentarioProf?: string | null;
  feedbackUrl?: string | null;
  feedbackNombre?: string | null;
  pendiente?: boolean;
}

export type ModoEntregaTarea = 'individual' | 'grupal_opcional' | 'grupal_obligatorio';

export function modoEntregaDeTarea(tarea: Pick<Tarea, 'grupal' | 'permite_individual'>): ModoEntregaTarea {
  if (!tarea.grupal) return 'individual';
  if (tarea.permite_individual === false) return 'grupal_obligatorio';
  return 'grupal_opcional';
}

export function flagsDeModoEntrega(modo: ModoEntregaTarea): { grupal: boolean; permiteIndividual: boolean } {
  if (modo === 'individual') return { grupal: false, permiteIndividual: true };
  if (modo === 'grupal_obligatorio') return { grupal: true, permiteIndividual: false };
  return { grupal: true, permiteIndividual: true };
}

export function alumnoEligioEntregaIndividual(tarea: Tarea, alumno: string): boolean {
  return Boolean(tarea.entregaIndividualPor?.[alumno]);
}

export interface Materia {
  id: string;
  nombre: string;
  condiciones: string;
  notaMinimaRegularizar: number;
  notaMinimaPromocionar: number;
  reglaPromocion: string;
  tareas: Tarea[];
}

export interface Nota {
  id?: string;
  alumno: string;
  parcial_id: string;
  nota: number | null;
  cargada_en?: string;
}

export interface Parcial {
  id: string;
  materia_id: string;
  nombre: string;
  fecha: string;
  detalles?: string;
  url?: string;
}

export interface Horario {
  id: string;
  materia_id: string;
  dia: number | string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
}

export interface EventoCronograma {
  id: string;
  materia_id: string;
  fecha: string;
  modalidad: string;
  tipo: string;
  titulo: string;
  detalles: string;
  url: string;
  origen: string;
}

export interface HistorialRegistro {
  id: string;
  materia: string;
  nombre: string;
  unidad: string | number | null;
  fecha: string | null;
  fechaCompletada: string | null;
  nota: string | number | null;
  tipo: 'Tarea con nota' | 'Foro' | 'Actividad' | 'Parcial';
}

// Funciones corregidas con tipos explícitos

/** Mismo criterio que el sync: un solo link con varias entregas (SGSI), no “Trabajo práctico…” suelto (EGR). */
export function tareaUsaEntregasMultiplesCampus(tarea: Pick<Tarea, 'nombre'>): boolean {
  return /entregas?\s+del\s+trabajo/i.test(String(tarea.nombre || ''));
}

export const entregaActivaEnHitos = (hitos: EntregaHitoTarea[] | undefined): EntregaHitoTarea | null => {
  if (!hitos?.length) return null;
  return hitos.find((h) => h.esActiva) ?? null;
};

export const entregaActivaDeTarea = (
  tarea: Tarea,
  alumno: string | null | undefined
): EntregaHitoTarea | null => {
  if (!alumno) return null;
  return entregaActivaEnHitos(tarea.entregas?.[alumno as string]);
};

/** Fase de entrega múltiple que Moodle tiene abierta ahora (p. ej. Entrega 2). */
export const faseEntregaDesdeHitos = (
  hitos: EntregaHitoTarea[] | undefined
): { indice: number | null; etiqueta: string; requiereEntrega: boolean } | null => {
  const activa = entregaActivaEnHitos(hitos);
  if (!activa) return null;
  const requiereEntrega = Boolean(
    activa.pendiente || /reabiert|reopened|sin calificar/i.test(activa.estado || '')
  );
  if (activa.indiceEntrega != null) {
    return {
      indice: activa.indiceEntrega,
      etiqueta: `Entrega ${activa.indiceEntrega}`,
      requiereEntrega
    };
  }
  return {
    indice: null,
    etiqueta: `Intento ${activa.numero}`,
    requiereEntrega
  };
};

export const faseEntregaCampus = (
  tarea: Tarea,
  alumno: string | null | undefined
): { indice: number | null; etiqueta: string; requiereEntrega: boolean } | null => {
  if (!alumno || !tareaUsaEntregasMultiplesCampus(tarea)) return null;
  return faseEntregaDesdeHitos(tarea.entregas?.[alumno as string]);
};

export const textoBadgeFaseEntrega = (
  tarea: Tarea,
  alumno: string | null | undefined
): string | null => {
  const fase = faseEntregaCampus(tarea, alumno);
  if (!fase) return null;
  if (fase.indice != null) {
    return fase.requiereEntrega
      ? `${fase.etiqueta} — a entregar en UGR`
      : `${fase.etiqueta} (campus)`;
  }
  return fase.requiereEntrega ? `${fase.etiqueta} — reabierto en UGR` : null;
};

export const tareaCompletadaPor = (tarea: Tarea, alumno: string | null | undefined): boolean => {
  if (!alumno) return false;
  if (tareaUsaEntregasMultiplesCampus(tarea)) {
    const hitos = tarea.entregas?.[alumno as string];
    if (hitos?.length) {
      const activa = hitos.find((h) => h.esActiva);
      if (activa && (activa.pendiente || /reabiert|reopened/i.test(activa.estado || ''))) return false;
      const faseAbierta = hitos.some(
        (h) => h.esActiva && h.indiceEntrega != null && (h.pendiente || !h.nota)
      );
      if (faseAbierta) return false;
    }
    return tarea.completadoPor.includes(alumno as string);
  }
  return tarea.completadoPor.includes(alumno as string)
    || (tarea.conNota && Object.prototype.hasOwnProperty.call(tarea.notas || {}, alumno as string)
      && tarea.notas?.[alumno as string] !== null && tarea.notas?.[alumno as string] !== '');
};

export const fechaEntregaTarea = (tarea: Tarea, alumno: string | null | undefined): string | null => (
  !alumno ? null : tarea.completadoEn?.[alumno] || (tarea.conNota ? tarea.notaCargadaEn?.[alumno] ?? null : null)
);

/** Con varias entregas en UGR, la nota del tablero aplica al cierre; mientras hay otra fase abierta, va en los hitos. */
export const notaTableroVisibleParaAlumno = (
  tarea: Tarea,
  alumno: string | null | undefined
): boolean => {
  if (!alumno || !tareaUsaEntregasMultiplesCampus(tarea)) return true;
  const fase = faseEntregaCampus(tarea, alumno);
  if (!fase) return true;
  return !(fase.requiereEntrega && (fase.indice ?? 0) > 1);
};

export const notasCerradasEntregaCampus = (
  tarea: Tarea,
  alumno: string | null | undefined
): { indice: number; nota: string }[] => {
  if (!alumno) return [];
  const hitos = tarea.entregas?.[alumno as string];
  if (!hitos?.length) return [];
  return hitos
    .filter((h) => h.indiceEntrega != null && !h.esActiva && h.nota != null && h.nota !== '')
    .sort((a, b) => (a.indiceEntrega ?? 0) - (b.indiceEntrega ?? 0))
    .map((h) => ({ indice: h.indiceEntrega as number, nota: String(h.nota) }));
};

export const tareaFaltaNota = (tarea: Tarea, alumno: string | null | undefined): boolean => (
  Boolean(alumno)
  && tarea.conNota
  && tareaCompletadaPor(tarea, alumno)
  && notaTableroVisibleParaAlumno(tarea, alumno)
  && (tarea.notas?.[alumno as string] === undefined || tarea.notas?.[alumno as string] === null || tarea.notas?.[alumno as string] === '')
);

export const tareaPendienteAlumno = (tarea: Tarea, alumno: string | null | undefined): boolean => (
  !tareaCompletadaPor(tarea, alumno) || tareaFaltaNota(tarea, alumno)
);

export const formatearFechaDDMMAAAA = (fechaStr: string | null | undefined): string => {
  if (!fechaStr || fechaStr === 'Sin fecha') return 'Sin fecha';
  if (fechaStr.includes('-')) {
    const partes = fechaStr.split('-');
    if (partes.length === 3 && partes[0].length === 4) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
  }
  return fechaStr;
};
export const formatearFechaHora = (fechaStr: string | null | undefined): string => {
  if (!fechaStr || fechaStr === 'Sin fecha') return 'Sin fecha';
  
  // Si la fecha ya tiene formato DD-MM-YYYY HH:mm, devolverla
  if (/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(fechaStr)) return fechaStr;

  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return fechaStr;

  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '');
};



const ZONA_CAMPUS = 'America/Argentina/Buenos_Aires';
const MS_DIA = 24 * 60 * 60 * 1000;

/** Fecha del tablero (YYYY-MM-DD o DD-MM-YYYY) → componentes calendario. */
export function partesFechaTablero(fechaStr: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!fechaStr || fechaStr === 'Sin fecha') return null;
  const partes = String(fechaStr).split('-').map(Number);
  if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = partes[0] > 31 ? partes : [partes[2], partes[1], partes[0]];
  if (y < 1970 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Cierre de tarea en UGR: fin del día indicado a las 23:59:59 en Argentina (no medianoche del día siguiente). */
export function instanteCierreCampus(fechaStr: string | null | undefined): number | null {
  const p = partesFechaTablero(fechaStr);
  if (!p) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date(`${p.y}-${pad(p.m)}-${pad(p.d)}T23:59:59.999-03:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

export function instanteInicioDiaCampus(fechaStr: string | null | undefined): number | null {
  const p = partesFechaTablero(fechaStr);
  if (!p) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const t = new Date(`${p.y}-${pad(p.m)}-${pad(p.d)}T00:00:00.000-03:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

export function milisegundosHastaCierreCampus(
  fechaStr: string | null | undefined,
  ahoraMs = Date.now()
): number | null {
  const cierre = instanteCierreCampus(fechaStr);
  if (cierre === null) return null;
  return cierre - ahoraMs;
}

export function formatearRestanteHorasMinutos(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  if (totalMin < 60) return `${totalMin} min`;
  const horas = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min > 0 ? `${horas} h ${min} min` : `${horas} h`;
}

export const obtenerTimestamp = (fechaStr: string | null | undefined): number | null => {
  if (!fechaStr || fechaStr === 'Sin fecha') return null;
  const inicio = instanteInicioDiaCampus(fechaStr);
  if (inicio !== null) return inicio;
  const fecha = new Date(String(fechaStr).endsWith('Z') ? fechaStr : `${String(fechaStr).replace(' ', 'T')}Z`);
  const timestamp = fecha.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const tareaEstaHabilitada = (fechaInicio: string | null | undefined): boolean => {
  if (!fechaInicio || fechaInicio === 'Sin fecha') return true;
  const dias = obtenerDiasHastaApertura(fechaInicio);
  return dias === null || dias <= 0;
};


export const multiplicadorPuntosTarea = (tarea: Tarea, alumno: string | null | undefined): number => {
  const fechaCarga = obtenerTimestamp(fechaEntregaTarea(tarea, alumno));
  if (fechaCarga === null) return 1;

  if (tarea.fin && tarea.fin !== 'Sin fecha') {
    const cierre = instanteCierreCampus(tarea.fin);
    if (cierre !== null && fechaCarga >= cierre) return 0;
  }

  if (!tarea.inicio || tarea.inicio === 'Sin fecha') return 1;
  const apertura = instanteInicioDiaCampus(tarea.inicio);
  if (apertura === null) return 1;

  const diasDesdeApertura = Math.floor((fechaCarga - apertura) / (1000 * 60 * 60 * 24));
  return diasDesdeApertura < 7 ? 1 : 0.5;
};

export const puntosBaseTarea = (tarea: Tarea, alumno: string | null | undefined): number => {
  if (!tarea.conNota) {
    return tarea.nombre.toLowerCase().includes('foro') ? 1 : 2;
  }
  const notaStr = String(alumno ? tarea.notas?.[alumno] ?? '' : '');
  if (!notaStr || Number.isNaN(Number.parseFloat(notaStr))) return 0;
  return Number.parseFloat(notaStr.replace(',', '.'));
};

export const obtenerFechaParcialEnMs = (fechaStr: string | null): number | null => (
  instanteInicioDiaCampus(fechaStr)
);

export const obtenerDiasHastaParcial = (fechaStr: string | null, ahoraMs = Date.now()): number | null => {
  const inicio = instanteInicioDiaCampus(fechaStr || '');
  if (inicio === null) return null;
  const diff = inicio - ahoraMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_DIA);
};

export const obtenerDiasHastaFecha = (fechaStr: string | null, ahoraMs = Date.now()): number | null => {
  const inicio = instanteInicioDiaCampus(fechaStr);
  if (inicio === null) return null;
  const diff = inicio - ahoraMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_DIA);
};

export const obtenerDiasHastaApertura = (fechaStr: string | null, ahoraMs = Date.now()): number | null => {
  const inicio = instanteInicioDiaCampus(fechaStr);
  if (inicio === null) return null;
  const diff = inicio - ahoraMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_DIA);
};

export const obtenerTextoApertura = (diasParaAbrir: number | null): string => {
  if (diasParaAbrir === null) return 'Sin fecha de apertura';
  if (diasParaAbrir === 0) return 'Abre hoy';
  return `Abre en ${diasParaAbrir} ${diasParaAbrir === 1 ? 'día' : 'días'}`;
};

/** Días completos hasta el cierre (23:59 Argentina del día `fin`). */
export const obtenerDiasHastaTarea = (fechaStr: string | null, ahoraMs = Date.now()): number | null => {
  const ms = milisegundosHastaCierreCampus(fechaStr, ahoraMs);
  if (ms === null) return null;
  if (ms < 0) return -1;
  return Math.floor(ms / MS_DIA);
};

/** Texto de plazo para hitos: días si faltan ≥24 h; horas/min solo en la última jornada. */
export function textoPlazoHastaCierreTarea(
  fechaFin: string | null | undefined,
  ahoraMs = Date.now()
): { dias: number | null; detalleHoras: string | null } {
  const ms = milisegundosHastaCierreCampus(fechaFin, ahoraMs);
  if (ms === null) return { dias: null, detalleHoras: null };
  if (ms < 0) return { dias: -1, detalleHoras: null };
  const dias = Math.floor(ms / MS_DIA);
  if (dias >= 1) return { dias, detalleHoras: null };
  return { dias: 0, detalleHoras: formatearRestanteHorasMinutos(ms) };
}

export const etiquetaDiasRestantes = (dias: number): string => (
  dias === 1 ? 'Queda 1 día' : `Quedan ${dias} días`
);

const normalizarTextoMateria = (texto = '') => String(texto)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export const obtenerIconoMateria = (nombreMateria = '') => {
  const nombre = normalizarTextoMateria(nombreMateria);
  const reglas = [
    { icono: '⚖️', claves: ['ciberdelito', 'delito'] },
    { icono: '🔎', claves: ['auditor'] },
    { icono: '⚠️', claves: ['riesgo'] },
    { icono: '💾', claves: ['activo'] },
    { icono: '🛡️', claves: ['sistemas de gestion', 'sgsi', 'iso 270'] },
    { icono: '🌐', claves: ['red'] },
    { icono: '🔑', claves: ['cripto', 'cifrado'] },
    { icono: '🕵️', claves: ['forense'] },
    { icono: '📜', claves: ['derecho', 'legal', 'normativ'] },
    { icono: '🛡️', claves: ['seguridad'] }
  ];

  return reglas.find((regla) => regla.claves.some((clave) => nombre.includes(clave)))?.icono || '📘';
};

export const etiquetaMateria = (nombreMateria = '') => `${obtenerIconoMateria(nombreMateria)} ${nombreMateria}`;

export const ordenarParciales = (listaParciales: Parcial[]): Parcial[] => {
  const hoyEnMs = instanteInicioDiaCampus(
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CAMPUS }).format(new Date())
  ) ?? Date.now();

  return [...listaParciales].sort((a: Parcial, b: Parcial) => {
    const fechaA = obtenerFechaParcialEnMs(a.fecha);
    const fechaB = obtenerFechaParcialEnMs(b.fecha);

    if (fechaA === null) return fechaB === null ? a.nombre.localeCompare(b.nombre) : 1;
    if (fechaB === null) return -1;

    const futuroA = fechaA >= hoyEnMs;
    const futuroB = fechaB >= hoyEnMs;
    if (futuroA !== futuroB) return futuroA ? -1 : 1;
    return futuroA ? fechaA - fechaB : fechaB - fechaA;
  });
};

export const ordenarTareas = (listaTareas: Tarea[]): Tarea[] => {
  return [...listaTareas].sort((a: Tarea, b: Tarea) => {
    const tieneFinA = a.fin && a.fin !== 'Sin fecha';
    const tieneFinB = b.fin && b.fin !== 'Sin fecha';

    if (tieneFinA && tieneFinB) return (a.fin as string).localeCompare(b.fin as string);
    if (tieneFinA) return -1;
    if (tieneFinB) return 1;

    const tieneInicioA = a.inicio && a.inicio !== 'Sin fecha';
    const tieneInicioB = b.inicio && b.inicio !== 'Sin fecha';

    if (tieneInicioA && tieneInicioB) return (a.inicio as string).localeCompare(b.inicio as string);
    if (tieneInicioA) return -1;
    if (tieneInicioB) return 1;

    return a.nombre.localeCompare(b.nombre);
  });
};

export const agruparTareasPorUnidad = (listaTareas: Tarea[]): { unidad: string; tareas: Tarea[] }[] => {
  const gruposMap = new Map<string, Tarea[]>();
  listaTareas.forEach((tarea: Tarea) => {
    const unidad = String(tarea.unidad || 'Sin unidad');
    const grupo = gruposMap.get(unidad) || [];
    grupo.push(tarea);
    gruposMap.set(unidad, grupo);
  });
  return Array.from(gruposMap.entries()).map(([unidad, tareas]) => ({
    unidad,
    tareas,
  }));
};

export const formatearUnidad = (unidad: string | number | null | undefined): string => {
  const valor = Number(unidad);
  return Number.isFinite(valor) ? String(valor) : String(unidad || '');
};

export const esForo = (nombreTarea: string | null | undefined): boolean => /\(\s*foro\s*\)/i.test(nombreTarea || '');

export const calcularEstadoSemaforo = (fechaFinStr: string | null | undefined, fechaInicioStr: string | null | undefined = null) => {
  if (fechaInicioStr && !tareaEstaHabilitada(fechaInicioStr)) {
    const diasParaAbrir = obtenerDiasHastaApertura(fechaInicioStr);
    const textoApertura = obtenerTextoApertura(diasParaAbrir);
    if (diasParaAbrir === null) {
      return { texto: 'Sin fecha de apertura', estilo: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
    return {
      texto: `⏳ ${textoApertura}`,
      estilo: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-semibold'
    };
  }

  if (!fechaFinStr || fechaFinStr === 'Sin fecha') {
    return { texto: 'Sin fecha límite', estilo: 'bg-slate-800 text-slate-400 border-slate-700' };
  }

  const plazo = textoPlazoHastaCierreTarea(fechaFinStr);
  const { dias: diasRestantes, detalleHoras } = plazo;

  if (diasRestantes === null) {
    return { texto: 'Sin fecha límite', estilo: 'bg-slate-800 text-slate-400 border-slate-700' };
  }

  if (diasRestantes < 0) {
    return { texto: 'Vencida', estilo: 'bg-red-950/80 text-red-400 border-red-800/80 font-bold' };
  }
  if (diasRestantes === 0 && detalleHoras) {
    return {
      texto: `⚠️ Cierra hoy · quedan ${detalleHoras}`,
      estilo: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold animate-pulse'
    };
  }
  if (diasRestantes === 0) {
    return { texto: '⚠️ Cierra hoy', estilo: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold animate-pulse' };
  }
  if (diasRestantes <= 2) {
    return {
      texto: `🔴 ${etiquetaDiasRestantes(diasRestantes)}`,
      estilo: 'bg-red-500/15 text-red-300 border-red-500/30 font-semibold'
    };
  }
  if (diasRestantes <= 7) {
    return { texto: `🟠 ${etiquetaDiasRestantes(diasRestantes)}`, estilo: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold' };
  }
  return { texto: `🟢 ${etiquetaDiasRestantes(diasRestantes)}`, estilo: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold' };
};

export const tareaPuedeGestionarse = (tarea: Tarea): boolean =>
  tareaEstaHabilitada(tarea.inicio);

export const obtenerGrupoDeAlumno = (tarea: Tarea, alumno: string): Grupo | null => {
  if (!tarea?.grupal || !tarea?.grupos || !alumno) return null;
  return tarea.grupos.find((g: Grupo) =>
    g.integrantes?.some((i: string) => i.toLowerCase() === alumno.toLowerCase())
  ) || null;
};

export function etiquetaModoEntregaTarea(tarea: Tarea, alumno: string): string {
  const modo = modoEntregaDeTarea(tarea);
  if (modo === 'individual') return 'Individual';
  const grupo = obtenerGrupoDeAlumno(tarea, alumno);
  if (grupo?.nombre) return `Grupal · ${grupo.nombre}`;
  if (alumnoEligioEntregaIndividual(tarea, alumno)) return 'Grupal · entrega individual';
  if (modo === 'grupal_obligatorio') return 'Grupal · sin grupo';
  return 'Grupal · podés ir solo o en grupo';
}

export const obtenerCompanerosDeGrupo = (tarea: Tarea, alumno: string): string[] => {
  const grupo = obtenerGrupoDeAlumno(tarea, alumno);
  if (!grupo || !grupo.integrantes) return [];
  return grupo.integrantes.filter((i: string) => i.toLowerCase() !== alumno.toLowerCase());
};

export const obtenerAlumnosSinGrupo = (tarea: Tarea, listaAlumnos: string[] = []): string[] => {
  if (!tarea?.grupal) return [];
  const asignados = new Set(
    (tarea.grupos || []).flatMap((g: Grupo) => (g.integrantes || []).map((i: string) => i.toLowerCase()))
  );
  return (listaAlumnos || []).filter((a: string) => !asignados.has(a.toLowerCase()));
};

export const obtenerResumenGruposTarea = (tarea: Tarea, listaAlumnos: string[] = []) => {
  if (!tarea?.grupal) return null;
  const grupos = tarea.grupos || [];
  const sinGrupo = obtenerAlumnosSinGrupo(tarea, listaAlumnos);
  const totalIntegrantes = grupos.reduce((acc: number, g: Grupo) => acc + (g.integrantes?.length || 0), 0);
  return {
    grupos,
    totalGrupos: grupos.length,
    totalIntegrantes,
    totalSinGrupo: sinGrupo.length,
    sinGrupo,
    cupo: Number(tarea.cupo_maximo) || 0
  };
};

const alumnoTieneNotaEnTarea = (tarea: Tarea, alumno: string): boolean => {
  const nota = tarea.notas?.[alumno];
  return nota !== undefined && nota !== null && String(nota).trim() !== '';
};

/** Grupales: con nota en el tablero → Completadas; sin nota → acá (aunque ya esté entregada). */
export const tareaGrupalPendienteEnTablero = (tarea: Tarea, alumno: string | null | undefined): boolean => {
  if (!tarea.grupal || !alumno) return false;
  if (tarea.conNota) return !alumnoTieneNotaEnTarea(tarea, alumno);
  return !tareaCompletadaPor(tarea, alumno);
};

export interface ResumenTareas {
  pendientes: Tarea[];
  faltaNota: Tarea[];
  futuras: Tarea[];
  completadas: Tarea[];
  grupales: Tarea[];
  tareasNoCompletadas: Tarea[];
  total: number;
  totalGrupales: number;
}

export const obtenerResumenTareasAlumno = (alumno: string, materias: Materia[]): ResumenTareas => {
  const todasTareas: Tarea[] = (materias || []).flatMap((materia) => materia.tareas || []);
  const tareasNoCompletadas = todasTareas
    .filter((tarea) => tareaPendienteAlumno(tarea, alumno));
  const completadas = todasTareas
    .filter((tarea) => tareaCompletadaPor(tarea, alumno) && !tareaFaltaNota(tarea, alumno));
  const faltaNota = tareasNoCompletadas.filter((tarea) => tareaFaltaNota(tarea, alumno));
  const pendientes = tareasNoCompletadas
    .filter((tarea) => !tareaFaltaNota(tarea, alumno) && tareaEstaHabilitada(tarea.inicio));
  const futuras = tareasNoCompletadas
    .filter((tarea) => !tareaFaltaNota(tarea, alumno) && !tareaEstaHabilitada(tarea.inicio));
  const grupales = todasTareas.filter((tarea) => tareaGrupalPendienteEnTablero(tarea, alumno));

  return {
    pendientes,
    faltaNota,
    futuras,
    completadas,
    grupales,
    tareasNoCompletadas,
    total: todasTareas.length,
    totalGrupales: grupales.length
  };
};

export interface HistorialRegistro {
  id: string;
  materia: string;
  nombre: string;
  unidad: string | number | null;
  fecha: string | null;
  fechaCompletada: string | null;
  nota: string | number | null;
  tipo: 'Tarea con nota' | 'Foro' | 'Actividad' | 'Parcial';
}

export const historialPorAlumno = (
  alumno: string,
  materias: Materia[],
  notas: Nota[],
  parciales: Parcial[]
): HistorialRegistro[] => {
  const tareas: HistorialRegistro[] = materias.flatMap((materia) => (materia.tareas || [])
    .filter((tarea: Tarea) => tareaCompletadaPor(tarea, alumno))
    .map((tarea: Tarea) => ({
      id: `tarea-${tarea.id}`,
      materia: materia.nombre,
      nombre: tarea.nombre,
      unidad: tarea.unidad,
      fecha: fechaEntregaTarea(tarea, alumno),
      fechaCompletada: fechaEntregaTarea(tarea, alumno),
      nota: tarea.conNota ? (tarea.notas?.[alumno] ?? null) : null,
      tipo: tarea.conNota ? 'Tarea con nota' : (tarea.nombre.toLowerCase().includes('foro') ? 'Foro' : 'Actividad')
    })));

  const parcialesDelAlumno: HistorialRegistro[] = notas
    .filter((nota: Nota) => nota.alumno === alumno)
    .map((nota: Nota) => {
      const parcial = parciales.find((item: Parcial) => item.id === nota.parcial_id);
      return {
        id: `parcial-${nota.parcial_id}`,
        materia: materias.find((materia: Materia) => materia.id === parcial?.materia_id)?.nombre || 'Materia',
        nombre: parcial?.nombre || 'Parcial',
        unidad: null,
        fecha: nota.cargada_en ?? null,
        fechaCompletada: nota.cargada_en ?? null,
        nota: nota.nota,
        tipo: 'Parcial'
      };
    });

  return [...tareas, ...parcialesDelAlumno].sort((a, b) => (obtenerTimestamp(b.fecha) ?? 0) - (obtenerTimestamp(a.fecha) ?? 0));
};


export interface GrupoUnidad {
  unidad: string | number;
  registros: HistorialRegistro[];
}

export interface MateriaHistorial {
  materia: string;
  grupos: GrupoUnidad[];
}


export const agruparHistorial = (historial: HistorialRegistro[]): MateriaHistorial[] => {
  const materiasHistorial = new Map<string, Map<string | number, HistorialRegistro[]>>();

  historial.forEach((registro: HistorialRegistro) => {
    const gruposPorUnidad = materiasHistorial.get(registro.materia) || new Map<string | number, HistorialRegistro[]>();
    const claveUnidad = registro.tipo === 'Parcial'
      ? 'Evaluaciones'
      : registro.unidad || 'Sin unidad';
    const registrosUnidad = gruposPorUnidad.get(claveUnidad) || [];
    registrosUnidad.push(registro);
    gruposPorUnidad.set(claveUnidad, registrosUnidad);
    materiasHistorial.set(registro.materia, gruposPorUnidad);
  });
  return [...materiasHistorial.entries()]
    .map(([materia, gruposPorUnidad]) => ({
      materia,
      grupos: [...gruposPorUnidad.entries()]
        .map(([unidad, registros]) => ({
          unidad,
          registros: registros.sort((a, b) => (obtenerTimestamp(b.fecha) ?? 0) - (obtenerTimestamp(a.fecha) ?? 0))
        }))
        .sort((a, b) => {
          if (a.unidad === 'Sin unidad') return 1;
          if (b.unidad === 'Sin unidad') return -1;
          if (a.unidad === 'Evaluaciones') return -1;
          if (b.unidad === 'Evaluaciones') return 1;
          return Number(b.unidad) - Number(a.unidad);
        })
    }))
    .sort((a, b) => {
      const fechaA = (obtenerTimestamp(a.grupos[0]?.registros[0]?.fecha) ?? 0);
      const fechaB = (obtenerTimestamp(b.grupos[0]?.registros[0]?.fecha) ?? 0);
      return fechaB - fechaA;
    });
};
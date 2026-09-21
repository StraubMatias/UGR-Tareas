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
  grupos?: Grupo[];
  cupo_maximo?: number | string;
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

export const tareaCompletadaPor = (tarea: Tarea, alumno: string | null | undefined): boolean => (
  Boolean(alumno)
  && (tarea.completadoPor.includes(alumno as string)
    || (tarea.conNota && Object.prototype.hasOwnProperty.call(tarea.notas || {}, alumno as string)))
);

export const fechaEntregaTarea = (tarea: Tarea, alumno: string | null | undefined): string | null => (
  !alumno ? null : tarea.completadoEn?.[alumno] || (tarea.conNota ? tarea.notaCargadaEn?.[alumno] ?? null : null)
);

export const tareaFaltaNota = (tarea: Tarea, alumno: string | null | undefined): boolean => (
  Boolean(alumno)
  && tarea.conNota
  && tareaCompletadaPor(tarea, alumno)
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



export const obtenerTimestamp = (fechaStr: string | null | undefined): number | null => {
  if (!fechaStr || fechaStr === 'Sin fecha') return null;
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
    const cierre = new Date(`${tarea.fin}T23:59:59.999Z`);
    if (!Number.isNaN(cierre.getTime()) && fechaCarga >= cierre.getTime()) return 0;
  }

  if (!tarea.inicio || tarea.inicio === 'Sin fecha') return 1;
  const apertura = new Date(`${tarea.inicio}T00:00:00`);
  if (Number.isNaN(apertura.getTime())) return 1;

  const diasDesdeApertura = Math.floor((fechaCarga - apertura.getTime()) / (1000 * 60 * 60 * 24));
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

export const obtenerFechaParcialEnMs = (fechaStr: string | null): number | null => {
  if (!fechaStr || fechaStr === 'Sin fecha') return null;
  const partes = fechaStr.split('-').map(Number);
  if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) return null;

  const [year, month, day] = partes;
  const fecha = new Date(year, month - 1, day);
  return Number.isNaN(fecha.getTime()) ? null : fecha.getTime();
};

export const obtenerDiasHastaParcial = (fechaStr: string | null): number | null => {
  const fechaParcialEnMs = obtenerFechaParcialEnMs(fechaStr || '');
  if (fechaParcialEnMs === null) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((fechaParcialEnMs - hoy.getTime()) / (1000 * 60 * 60 * 24)));
};

export const obtenerDiasHastaFecha = (fechaStr: string | null): number | null => {
  if (!fechaStr || fechaStr === 'Sin fecha') return null;
  const partes = String(fechaStr).split('-').map(Number);
  if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) return null;

  const [year, month, day] = partes[0] > 31
    ? partes
    : [partes[2], partes[1], partes[0]];
  const fechaLimite = new Date(year, month - 1, day);
  fechaLimite.setHours(0, 0, 0, 0);
  if (Number.isNaN(fechaLimite.getTime())) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

export const obtenerDiasHastaApertura = (fechaStr: string | null): number | null => {
  if (!fechaStr || fechaStr === 'Sin fecha') return null;
  const partes = String(fechaStr).split('-').map(Number);
  if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) return null;

  const [year, month, day] = partes[0] > 31
    ? partes
    : [partes[2], partes[1], partes[0]];
  const fechaApertura = new Date(year, month - 1, day);
  fechaApertura.setHours(0, 0, 0, 0);
  if (Number.isNaN(fechaApertura.getTime())) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((fechaApertura.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

export const obtenerTextoApertura = (diasParaAbrir: number | null): string => {
  if (diasParaAbrir === null) return 'Sin fecha de apertura';
  if (diasParaAbrir === 0) return 'Abre hoy';
  return `Abre en ${diasParaAbrir} ${diasParaAbrir === 1 ? 'día' : 'días'}`;
};

export const obtenerDiasHastaTarea = (fechaStr: string | null): number | null => {
  const diasHastaCierre = obtenerDiasHastaFecha(fechaStr);
  return diasHastaCierre === null ? null : diasHastaCierre - 1;
};

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
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyEnMs = hoy.getTime();

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

  const diasRestantes = obtenerDiasHastaTarea(fechaFinStr);

  if (diasRestantes === null) {
    return { texto: 'Sin fecha límite', estilo: 'bg-slate-800 text-slate-400 border-slate-700' };
  }

  if (diasRestantes < 0) {
    return { texto: 'Vencida', estilo: 'bg-red-950/80 text-red-400 border-red-800/80 font-bold' };
  } else if (diasRestantes === 0) {
    return { texto: '⚠️ Cierra Hoy', estilo: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold animate-pulse' };
  } else if (diasRestantes <= 2) {
    return { texto: `🔴 Quedan ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}`, estilo: 'bg-red-500/15 text-red-300 border-red-500/30 font-semibold' };
  } else if (diasRestantes <= 7) {
    return { texto: `🟠 Quedan ${diasRestantes} días`, estilo: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold' };
  } else {
    return { texto: `🟢 Quedan ${diasRestantes} días`, estilo: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold' };
  }
};

export const tareaPuedeGestionarse = (tarea: Tarea): boolean =>
  tareaEstaHabilitada(tarea.inicio);

export const obtenerGrupoDeAlumno = (tarea: Tarea, alumno: string): Grupo | null => {
  if (!tarea?.grupal || !tarea?.grupos || !alumno) return null;
  return tarea.grupos.find((g: Grupo) =>
    g.integrantes?.some((i: string) => i.toLowerCase() === alumno.toLowerCase())
  ) || null;
};

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

export interface ResumenTareas {
  pendientes: Tarea[];
  faltaNota: Tarea[];
  futuras: Tarea[];
  completadas: Tarea[];
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
  const grupales = todasTareas.filter((tarea) => tarea.grupal);

  return {
    pendientes,
    faltaNota,
    futuras,
    completadas,
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
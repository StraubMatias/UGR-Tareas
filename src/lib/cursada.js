// Lógica pura de la cursada: formato de fechas, estados de tareas, semáforos,
// agrupación por unidad, resúmenes por alumno e historial.
// Todas estas funciones no dependen del estado de la interfaz: reciben los
// datos que necesitan como argumentos y son fáciles de testear aisladas.
import { tareaHabilitada as tareaEstaHabilitada } from '../app/validators';

export const tareaCompletadaPor = (tarea, alumno) => (
  tarea.completadoPor.includes(alumno)
  || (tarea.conNota && Object.prototype.hasOwnProperty.call(tarea.notas || {}, alumno))
);

export const fechaEntregaTarea = (tarea, alumno) => (
  tarea.completadoEn?.[alumno] || (tarea.conNota ? tarea.notaCargadaEn?.[alumno] : null)
);

export const tareaFaltaNota = (tarea, alumno) => (
  tarea.conNota
  && tareaCompletadaPor(tarea, alumno)
  && (tarea.notas?.[alumno] === undefined || tarea.notas?.[alumno] === null || tarea.notas?.[alumno] === '')
);

export const tareaPendienteAlumno = (tarea, alumno) => (
  !tareaCompletadaPor(tarea, alumno) || tareaFaltaNota(tarea, alumno)
);

export const formatearFechaDDMMAAAA = (fechaStr) => {
  if (!fechaStr || fechaStr === 'Sin fecha') return 'Sin fecha';
  if (fechaStr.includes('-')) {
    const partes = fechaStr.split('-');
    if (partes.length === 3 && partes[0].length === 4) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
  }
  return fechaStr;
};

export const formatearFechaHora = (fechaStr) => {
  if (!fechaStr) return 'Fecha no disponible';
  const fecha = new Date(String(fechaStr).endsWith('Z') ? fechaStr : `${String(fechaStr).replace(' ', 'T')}Z`);
  if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible';
  return fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

export const obtenerTimestamp = (fechaStr) => {
  if (!fechaStr) return null;
  const fecha = new Date(String(fechaStr).endsWith('Z') ? fechaStr : `${String(fechaStr).replace(' ', 'T')}Z`);
  const timestamp = fecha.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const multiplicadorPuntosTarea = (tarea, alumno) => {
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

export const puntosBaseTarea = (tarea, alumno) => tarea.conNota
  ? Number.parseFloat(String(tarea.notas?.[alumno]).replace(',', '.'))
  : esForo(tarea.nombre) ? 1 : 2;

export const obtenerFechaParcialEnMs = (fechaStr) => {
  if (!fechaStr || fechaStr === 'Sin fecha') return null;
  const partes = fechaStr.split('-').map(Number);
  if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) return null;

  const [year, month, day] = partes;
  const fecha = new Date(year, month - 1, day);
  return Number.isNaN(fecha.getTime()) ? null : fecha.getTime();
};

export const obtenerDiasHastaParcial = (fechaStr) => {
  const fechaParcialEnMs = obtenerFechaParcialEnMs(fechaStr);
  if (fechaParcialEnMs === null) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((fechaParcialEnMs - hoy.getTime()) / (1000 * 60 * 60 * 24)));
};

export const obtenerDiasHastaFecha = (fechaStr) => {
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

export const obtenerDiasHastaApertura = (fechaStr) => {
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

export const obtenerTextoApertura = (diasParaAbrir) => {
  if (diasParaAbrir === null) return 'Sin fecha de apertura';
  if (diasParaAbrir === 0) return 'Abre hoy';
  return `Abre en ${diasParaAbrir} ${diasParaAbrir === 1 ? 'día' : 'días'}`;
};

export const obtenerDiasHastaTarea = (fechaStr) => {
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

export const ordenarParciales = (listaParciales) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyEnMs = hoy.getTime();

  return [...listaParciales].sort((a, b) => {
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

export const ordenarTareas = (listaTareas) => {
  return [...listaTareas].sort((a, b) => {
    const tieneFinA = a.fin && a.fin !== 'Sin fecha';
    const tieneFinB = b.fin && b.fin !== 'Sin fecha';

    if (tieneFinA && tieneFinB) return a.fin.localeCompare(b.fin);
    if (tieneFinA) return -1;
    if (tieneFinB) return 1;

    const tieneInicioA = a.inicio && a.inicio !== 'Sin fecha';
    const tieneInicioB = b.inicio && b.inicio !== 'Sin fecha';

    if (tieneInicioA && tieneInicioB) return a.inicio.localeCompare(b.inicio);
    if (tieneInicioA) return -1;
    if (tieneInicioB) return 1;

    return a.nombre.localeCompare(b.nombre);
  });
};

export const agruparTareasPorUnidad = (listaTareas) => {
  const grupos = new Map();
  listaTareas.forEach((tarea) => {
    const unidad = tarea.unidad?.trim() || '';
    const grupo = grupos.get(unidad) || [];
    grupo.push(tarea);
    grupos.set(unidad, grupo);
  });

  return [...grupos.entries()]
    .sort(([unidadA], [unidadB]) => {
      if (!unidadA) return -1;
      if (!unidadB) return 1;
      return unidadA.localeCompare(unidadB, 'es', { numeric: true });
    })
    .map(([unidad, tareas]) => ({ unidad, tareas: ordenarTareas(tareas) }));
};

export const formatearUnidad = (unidad) => {
  const valor = Number(unidad);
  return Number.isFinite(valor) ? String(valor) : String(unidad || '');
};

export const esForo = (nombreTarea) => /\(\s*foro\s*\)/i.test(nombreTarea || '');

export const calcularEstadoSemaforo = (fechaFinStr, fechaInicioStr = null) => {
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

export const tareaPuedeGestionarse = (tarea) =>
  tareaEstaHabilitada(tarea.inicio);

export const obtenerResumenTareasAlumno = (alumno, materias) => {
  const tareasNoCompletadas = materias.flatMap((materia) => materia.tareas)
    .filter((tarea) => tareaPendienteAlumno(tarea, alumno));
  const faltaNota = tareasNoCompletadas.filter((tarea) => tareaFaltaNota(tarea, alumno));
  const pendientes = tareasNoCompletadas
    .filter((tarea) => !tareaFaltaNota(tarea, alumno) && tareaEstaHabilitada(tarea.inicio));
  const futuras = tareasNoCompletadas
    .filter((tarea) => !tareaFaltaNota(tarea, alumno) && !tareaEstaHabilitada(tarea.inicio));

  return { pendientes, faltaNota, futuras, tareasNoCompletadas };
};

export const historialPorAlumno = (alumno, materias, notas, parciales) => {
  const tareas = materias.flatMap((materia) => materia.tareas
    .filter((tarea) => tareaCompletadaPor(tarea, alumno))
    .map((tarea) => ({
      id: `tarea-${tarea.id}`,
      materia: materia.nombre,
      nombre: tarea.nombre,
      unidad: tarea.unidad,
      fecha: fechaEntregaTarea(tarea, alumno),
      fechaCompletada: fechaEntregaTarea(tarea, alumno),
      nota: tarea.conNota ? tarea.notas?.[alumno] : null,
      tipo: tarea.conNota ? 'Tarea con nota' : esForo(tarea.nombre) ? 'Foro' : 'Actividad'
    })));
  const parcialesDelAlumno = notas
    .filter((nota) => nota.alumno === alumno)
    .map((nota) => {
      const parcial = parciales.find((item) => item.id === nota.parcial_id);
      return {
        id: `parcial-${nota.parcial_id}`,
        materia: materias.find((materia) => materia.id === parcial?.materia_id)?.nombre || 'Materia',
        nombre: parcial?.nombre || 'Parcial',
        fecha: nota.cargada_en,
        fechaCompletada: nota.cargada_en,
        nota: nota.nota,
        tipo: 'Parcial'
      };
    });

  return [...tareas, ...parcialesDelAlumno].sort((a, b) => obtenerTimestamp(b.fecha) - obtenerTimestamp(a.fecha));
};

export const agruparHistorial = (historial) => {
  const materiasHistorial = new Map();

  historial.forEach((registro) => {
    const gruposPorUnidad = materiasHistorial.get(registro.materia) || new Map();
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
          registros: registros.sort((a, b) => obtenerTimestamp(b.fecha) - obtenerTimestamp(a.fecha))
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
      const fechaA = obtenerTimestamp(a.grupos[0]?.registros[0]?.fecha) || 0;
      const fechaB = obtenerTimestamp(b.grupos[0]?.registros[0]?.fecha) || 0;
      return fechaB - fechaA;
    });
};
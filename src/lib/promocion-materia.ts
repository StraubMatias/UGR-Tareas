import type { Materia, Nota, Parcial, Tarea } from '../core/cursada.ts';
import { obtenerDiasHastaFecha, tareaCompletadaPor } from '../core/cursada.ts';
import { esParcialRecuperatorio } from './recuperatorios-calendario.ts';

export type EstadoPromocion = { texto: string; estilo: string };

const estilos = {
  enCurso: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  desaprueba: 'text-red-300 bg-red-500/10 border-red-500/30',
  regulariza: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  promociona: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  neutro: 'text-slate-400 bg-slate-800/60 border-slate-700'
};

function notaDe(valor: string | number | null | undefined) {
  const n = Number.parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function claveFecha(fecha: string) {
  return String(fecha || '').slice(0, 10);
}

export function parcialesCuatrimestreOrdenados(parciales: Parcial[], materiaId: string) {
  return parciales
    .filter((p) => p.materia_id === materiaId && !esParcialRecuperatorio(p))
    .sort((a, b) => claveFecha(a.fecha).localeCompare(claveFecha(b.fecha)) || a.nombre.localeCompare(b.nombre, 'es'));
}

function parcialYaRendido(parcial: Parcial) {
  const dias = obtenerDiasHastaFecha(parcial.fecha);
  return dias !== null && dias <= 0;
}

/** Metodología con parciales y TPs suele quedar como `metodologia` en DB antigua. */
export function reglaPromocionEfectiva(materia: Materia): string {
  const regla = materia.reglaPromocion || 'tp_nota';
  if (regla !== 'metodologia') return regla;
  const n = String(materia.condiciones || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  const hayParciales = /\bparcial/.test(n);
  const hayTps = /trabajos? practicos?|\btps?\b|actividades practicas/.test(n);
  if (hayParciales && hayTps) return 'parciales_y_tps';
  if (hayParciales && /\bdos parciales\b|\bcada parcial\b|\blos parciales\b/.test(n)) return 'ciberdelitos_parciales';
  return 'metodologia';
}

export interface EvaluacionParcialesCuatrimestre {
  /** Parciales de la materia con fecha ya pasada (o hoy). */
  rendidos: Parcial[];
  /** Notas numéricas de los rendidos que ya tienen nota cargada. */
  notasRendidos: number[];
  /** Rendidos con fecha pasada pero sin nota en el tablero. */
  sinNota: Parcial[];
  pendientes: Parcial[];
}

export function evaluarParcialesCuatrimestre(
  parciales: Parcial[],
  materiaId: string,
  alumno: string,
  notas: Nota[],
  minRegularizar: number,
  minPromocionar: number
): { estado: EstadoPromocion | null; detalle: EvaluacionParcialesCuatrimestre } {
  const cuatrimestre = parcialesCuatrimestreOrdenados(parciales, materiaId);
  const rendidos = cuatrimestre.filter(parcialYaRendido);
  const pendientes = cuatrimestre.filter((p) => !parcialYaRendido(p));
  const notasRendidos: number[] = [];
  const sinNota: Parcial[] = [];

  for (const parcial of rendidos) {
    const fila = notas.find((n) => n.parcial_id === parcial.id && n.alumno === alumno);
    const valor = fila ? notaDe(fila.nota) : null;
    if (valor === null) sinNota.push(parcial);
    else notasRendidos.push(valor);
  }

  const detalle = { rendidos, notasRendidos, sinNota, pendientes };

  if (cuatrimestre.length === 0) {
    return { estado: { texto: 'En curso', estilo: estilos.enCurso }, detalle };
  }

  if (notasRendidos.some((n) => n < minRegularizar)) {
    return { estado: { texto: 'Desaprueba', estilo: estilos.desaprueba }, detalle };
  }

  if (rendidos.length > 0 && notasRendidos.length === rendidos.length && notasRendidos.every((n) => n >= minPromocionar)) {
    return { estado: { texto: 'Promociona', estilo: estilos.promociona }, detalle };
  }

  if (notasRendidos.length > 0 && notasRendidos.every((n) => n >= minRegularizar)) {
    return { estado: { texto: 'Regulariza', estilo: estilos.regulariza }, detalle };
  }

  if (rendidos.length === 0) {
    return { estado: { texto: 'En curso', estilo: estilos.enCurso }, detalle };
  }

  if (sinNota.length > 0) {
    return { estado: { texto: 'En curso', estilo: estilos.enCurso }, detalle };
  }

  return { estado: { texto: 'En curso', estilo: estilos.enCurso }, detalle };
}

function notaDeTarea(tarea: Tarea, alumno: string) {
  return notaDe(tarea.notas?.[alumno]);
}

function tareaCerrada(tarea: Tarea) {
  const dias = obtenerDiasHastaFecha(tarea.fin);
  return Boolean(tarea.fin && tarea.fin !== 'Sin fecha' && dias !== null && dias < 0);
}

export function evaluarPromocionParcialesYTps(
  materia: Materia,
  alumno: string,
  parciales: Parcial[],
  notas: Nota[],
  trabajosPracticos: Tarea[]
) {
  const minReg = materia.notaMinimaRegularizar;
  const minPromo = materia.notaMinimaPromocionar;

  const parcialesEval = evaluarParcialesCuatrimestre(parciales, materia.id, alumno, notas, minReg, minPromo);
  if (parcialesEval.estado?.texto === 'Desaprueba') return parcialesEval.estado;

  if (trabajosPracticos.length === 0) {
    return parcialesEval.estado || { texto: 'Sin TPs cargados', estilo: estilos.neutro };
  }

  const notasTp = trabajosPracticos.map((t) => notaDeTarea(t, alumno));
  const conNota = notasTp.filter((n): n is number => n !== null);
  const faltanNotas = conNota.length < trabajosPracticos.length;

  if (conNota.some((n) => n < minReg)) {
    return { texto: 'Desaprueba', estilo: estilos.desaprueba };
  }

  const parcialesPromocion = parcialesEval.estado?.texto === 'Promociona';
  const tpsPromocion = conNota.length > 0 && conNota.every((n) => n >= minPromo);

  if (parcialesPromocion && tpsPromocion) {
    return { texto: 'Promociona', estilo: estilos.promociona };
  }

  if (parcialesEval.estado?.texto === 'Regulariza') {
    return { texto: 'Regulariza', estilo: estilos.regulariza };
  }

  if (trabajosPracticos.every(tareaCerrada) && faltanNotas) {
    return { texto: 'Desaprueba', estilo: estilos.desaprueba };
  }

  return parcialesEval.estado || { texto: 'En curso', estilo: estilos.enCurso };
}

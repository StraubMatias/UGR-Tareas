import type { Materia, Nota, Parcial, Tarea } from '../core/cursada.ts';
import { obtenerDiasHastaFecha, tareaCompletadaPor } from '../core/cursada.ts';

const ZONA_CAMPUS = 'America/Argentina/Buenos_Aires';
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

function claveHoyCampus(ahoraMs = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CAMPUS }).format(new Date(ahoraMs));
}

/** Cuenta como rendido si hay nota o si la fecha del parcial ya pasó (no el mismo día sin nota). */
export function parcialYaRendido(parcial: Parcial, alumno: string, notas: Nota[]) {
  const fila = notas.find((n) => n.parcial_id === parcial.id && n.alumno === alumno);
  if (fila && notaDe(fila.nota) !== null) return true;
  const clave = claveFecha(parcial.fecha);
  if (!clave) return false;
  return clave < claveHoyCampus();
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
  const rendidos = cuatrimestre.filter((p) => parcialYaRendido(p, alumno, notas));
  const pendientes = cuatrimestre.filter((p) => !parcialYaRendido(p, alumno, notas));
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

  if (sinNota.length > 0) {
    return { estado: { texto: 'En curso', estilo: estilos.enCurso }, detalle };
  }

  if (rendidos.length === 0) {
    return { estado: null, detalle };
  }

  return { estado: { texto: 'En curso', estilo: estilos.enCurso }, detalle };
}

/** Solo cuenta notas ya cargadas; lo pendiente (parciales futuros, TPs sin nota) no bloquea promoción. */
function estadoDesdeNotasParciales(
  notas: number[],
  minRegularizar: number,
  minPromocionar: number,
  esperandoNota: boolean
): EstadoPromocion | null {
  if (esperandoNota) {
    return { texto: 'En curso', estilo: estilos.enCurso };
  }
  if (notas.length === 0) return null;
  if (notas.some((n) => n < minRegularizar)) {
    return { texto: 'Desaprueba', estilo: estilos.desaprueba };
  }
  if (notas.every((n) => n >= minPromocionar)) {
    return { texto: 'Promociona', estilo: estilos.promociona };
  }
  if (notas.every((n) => n >= minRegularizar)) {
    return { texto: 'Regulariza', estilo: estilos.regulariza };
  }
  return { texto: 'En curso', estilo: estilos.enCurso };
}

function promocionProgresivaParcialesYTps(
  notasParcial: number[],
  notasTp: number[],
  esperandoNotaParcial: boolean,
  minReg: number,
  minPromo: number,
  enCurso: EstadoPromocion
): EstadoPromocion {
  if (esperandoNotaParcial) return enCurso;
  if (notasParcial.some((n) => n < minReg) || notasTp.some((n) => n < minReg)) {
    return { texto: 'Desaprueba', estilo: estilos.desaprueba };
  }
  const hayAlgoEvaluado = notasParcial.length > 0 || notasTp.length > 0;
  if (!hayAlgoEvaluado) return enCurso;

  const cumplePromo =
    (notasParcial.length === 0 || notasParcial.every((n) => n >= minPromo))
    && (notasTp.length === 0 || notasTp.every((n) => n >= minPromo));
  if (cumplePromo) {
    return { texto: 'Promociona', estilo: estilos.promociona };
  }

  const cumpleRegular =
    (notasParcial.length === 0 || notasParcial.every((n) => n >= minReg))
    && (notasTp.length === 0 || notasTp.every((n) => n >= minReg));
  if (cumpleRegular) {
    return { texto: 'Regulariza', estilo: estilos.regulariza };
  }

  return enCurso;
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
  const enCurso = { texto: 'En curso', estilo: estilos.enCurso };

  const cuatrimestre = parcialesCuatrimestreOrdenados(parciales, materia.id);
  const notasParcial: number[] = [];
  let esperandoNotaParcial = false;
  for (const parcial of cuatrimestre) {
    if (!parcialYaRendido(parcial, alumno, notas)) continue;
    const fila = notas.find((n) => n.parcial_id === parcial.id && n.alumno === alumno);
    const valor = fila ? notaDe(fila.nota) : null;
    if (valor === null) esperandoNotaParcial = true;
    else notasParcial.push(valor);
  }

  if (trabajosPracticos.length === 0) {
    if (cuatrimestre.length === 0) return { texto: 'Sin TPs cargados', estilo: estilos.neutro };
    const soloParcial = estadoDesdeNotasParciales(notasParcial, minReg, minPromo, esperandoNotaParcial);
    return soloParcial || enCurso;
  }

  const notasTp = trabajosPracticos
    .map((t) => notaDeTarea(t, alumno))
    .filter((n): n is number => n !== null);

  const resultado = promocionProgresivaParcialesYTps(
    notasParcial,
    notasTp,
    esperandoNotaParcial,
    minReg,
    minPromo,
    enCurso
  );
  if (resultado.texto !== 'En curso') return resultado;

  if (trabajosPracticos.every(tareaCerrada) && notasTp.length === 0) {
    return { texto: 'Desaprueba', estilo: estilos.desaprueba };
  }

  return resultado;
}

/** Promoción según TPs (y opcionalmente parciales) ya calificados; TPs/parciales sin nota no restan. */
export function evaluarPromocionSoloTps(
  materia: Materia,
  alumno: string,
  trabajosPracticos: Tarea[],
  parciales: Parcial[] = [],
  notas: Nota[] = []
) {
  const minReg = materia.notaMinimaRegularizar;
  const minPromo = materia.notaMinimaPromocionar;
  const enCurso = { texto: 'En curso', estilo: estilos.enCurso };

  if (trabajosPracticos.length === 0) return null;

  const notasTp = trabajosPracticos
    .map((t) => notaDeTarea(t, alumno))
    .filter((n): n is number => n !== null);
  const cuatrimestre = parcialesCuatrimestreOrdenados(parciales, materia.id);
  const notasParcial: number[] = [];
  let esperandoNotaParcial = false;
  for (const parcial of cuatrimestre) {
    if (!parcialYaRendido(parcial, alumno, notas)) continue;
    const fila = notas.find((n) => n.parcial_id === parcial.id && n.alumno === alumno);
    const valor = fila ? notaDe(fila.nota) : null;
    if (valor === null) esperandoNotaParcial = true;
    else notasParcial.push(valor);
  }

  const resultado = promocionProgresivaParcialesYTps(
    notasParcial,
    notasTp,
    esperandoNotaParcial,
    minReg,
    minPromo,
    enCurso
  );
  if (resultado.texto === 'En curso' && notasTp.length === 0 && !esperandoNotaParcial) {
    if (trabajosPracticos.every(tareaCerrada)) {
      return { texto: 'Desaprueba', estilo: estilos.desaprueba };
    }
    return enCurso;
  }
  return resultado;
}

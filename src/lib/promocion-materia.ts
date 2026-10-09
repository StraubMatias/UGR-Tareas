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

const NOTA_APROBACION_ACTIVIDAD = 6;

/** Parcial futuro no entra al %; el día del examen o después sí (aunque aún no haya nota). */
export function parcialCuentaActividadActivos(parcial: Parcial, ahoraMs = Date.now()) {
  const clave = claveFecha(parcial.fecha);
  if (!clave) return false;
  return clave <= claveHoyCampus(ahoraMs);
}

function actividadesParaUmbral(cumplidas: number, total: number, umbralPct: number) {
  if (total <= 0) return 0;
  const necesarias = Math.ceil((umbralPct / 100) * total);
  return Math.max(0, necesarias - cumplidas);
}

export function avisoProximoHitoActivos(
  cumplidas: number,
  total: number,
  umbralReg: number,
  umbralPromo: number,
  estadoTexto: string
): string | null {
  if (total === 0 || estadoTexto === 'Desaprueba' || estadoTexto === 'Sin actividades') return null;
  const pct = (cumplidas / total) * 100;
  const faltanRegular = actividadesParaUmbral(cumplidas, total, umbralReg);
  const faltanPromo = actividadesParaUmbral(cumplidas, total, umbralPromo);

  if (pct >= umbralPromo) {
    return `${cumplidas}/${total} actividades · ${Math.round(pct)}%`;
  }
  if (faltanPromo === 1) return 'Con 1 actividad más promocionarías.';
  if (pct >= umbralReg && faltanPromo > 0 && faltanPromo <= 3) {
    return `Con ${faltanPromo} actividad${faltanPromo === 1 ? '' : 'es'} más promocionarías.`;
  }
  if (faltanRegular === 1) return 'Con 1 actividad más estarías regularizando.';
  if (pct < umbralReg && faltanRegular > 0 && faltanRegular <= 3) {
    return `Con ${faltanRegular} actividad${faltanRegular === 1 ? '' : 'es'} más regularizarías.`;
  }
  return `${cumplidas}/${total} actividades · ${Math.round(pct)}%`;
}

export type EstadoLineaActivos = 'hecha' | 'pendiente' | 'espera_nota' | 'no_cuenta';

export interface LineaDesgloseActivos {
  nombre: string;
  tipo: 'tarea' | 'parcial';
  estado: EstadoLineaActivos;
}

export interface ResultadoActivosPorcentaje extends EstadoPromocion {
  porcentaje: number;
  cumplidas: number;
  total: number;
  aviso: string | null;
  desglose: LineaDesgloseActivos[];
}

function resultadoActivosParcial(
  estado: EstadoPromocion,
  cumplidas: number,
  total: number,
  umbralReg: number,
  umbralPromo: number,
  desglose: LineaDesgloseActivos[]
): ResultadoActivosPorcentaje {
  const porcentaje = total > 0 ? Math.round((cumplidas / total) * 100) : 0;
  return {
    ...estado,
    porcentaje,
    cumplidas,
    total,
    aviso: avisoProximoHitoActivos(cumplidas, total, umbralReg, umbralPromo, estado.texto),
    desglose
  };
}

/** En Activos importa haberla hecho; la nota no define el % (solo si está entregada o calificada). */
function estadoTareaActivos(tarea: Tarea, alumno: string): 'cumplida' | 'espera_nota' | 'pendiente' {
  if (tareaCompletadaPor(tarea, alumno)) {
    const valor = notaDeTarea(tarea, alumno);
    if ((tarea.conNota || tarea.tipo === 'trabajo_practico') && valor === null) return 'espera_nota';
    return 'cumplida';
  }
  if (notaDeTarea(tarea, alumno) !== null) return 'cumplida';
  return 'pendiente';
}

function lineaEstadoDesdeTarea(estado: ReturnType<typeof estadoTareaActivos>): EstadoLineaActivos {
  if (estado === 'cumplida') return 'hecha';
  if (estado === 'espera_nota') return 'espera_nota';
  return 'pendiente';
}

/** 75% / 90%: todas las tareas cargadas en la materia + parciales con fecha ≤ hoy (el futuro suma el día del examen). */
export function evaluarPromocionActivosPorcentaje(
  materia: Materia,
  alumno: string,
  parciales: Parcial[],
  notas: Nota[],
  tareas: Tarea[],
  ahoraMs = Date.now()
): ResultadoActivosPorcentaje {
  const umbralReg = materia.notaMinimaRegularizar;
  const umbralPromo = materia.notaMinimaPromocionar;
  const enCurso = { texto: 'En curso', estilo: estilos.enCurso };
  const parcialesTodos = parcialesCuatrimestreOrdenados(parciales, materia.id);
  const parcialesMateria = parcialesTodos.filter((p) => parcialCuentaActividadActivos(p, ahoraMs));
  const tareasMateria = tareas;
  const total = parcialesMateria.length + tareasMateria.length;
  const desglose: LineaDesgloseActivos[] = [];
  for (const parcial of parcialesTodos) {
    if (!parcialCuentaActividadActivos(parcial, ahoraMs)) {
      desglose.push({ nombre: parcial.nombre, tipo: 'parcial', estado: 'no_cuenta' });
    }
  }

  if (total === 0) {
    return resultadoActivosParcial(
      { texto: 'Sin actividades', estilo: estilos.neutro },
      0,
      0,
      umbralReg,
      umbralPromo,
      desglose
    );
  }

  let cumplidas = 0;
  for (const parcial of parcialesMateria) {
    const fila = notas.find((n) => n.parcial_id === parcial.id && n.alumno === alumno);
    const valor = fila ? notaDe(fila.nota) : null;
    if (valor !== null && valor < NOTA_APROBACION_ACTIVIDAD) {
      desglose.push({ nombre: parcial.nombre, tipo: 'parcial', estado: 'pendiente' });
      return resultadoActivosParcial(
        { texto: 'Desaprueba', estilo: estilos.desaprueba },
        cumplidas,
        total,
        umbralReg,
        umbralPromo,
        desglose
      );
    }
    if (valor !== null && valor >= NOTA_APROBACION_ACTIVIDAD) {
      cumplidas += 1;
      desglose.push({ nombre: parcial.nombre, tipo: 'parcial', estado: 'hecha' });
    } else {
      desglose.push({
        nombre: parcial.nombre,
        tipo: 'parcial',
        estado: parcialYaRendido(parcial, alumno, notas) ? 'pendiente' : 'pendiente'
      });
    }
  }

  for (const tarea of tareasMateria) {
    const est = estadoTareaActivos(tarea, alumno);
    if (est === 'cumplida' || est === 'espera_nota') cumplidas += 1;
    desglose.push({ nombre: tarea.nombre, tipo: 'tarea', estado: lineaEstadoDesdeTarea(est) });
  }

  const porcentaje = Math.round((cumplidas / total) * 100);
  let estado: EstadoPromocion;
  if (porcentaje >= umbralPromo) estado = { texto: 'Promociona', estilo: estilos.promociona };
  else if (porcentaje >= umbralReg) estado = { texto: 'Regulariza', estilo: estilos.regulariza };
  else {
    const todoCerrado = tareasMateria.every(tareaCerrada)
      && parcialesMateria.every((p) => parcialYaRendido(p, alumno, notas));
    estado = todoCerrado && porcentaje < umbralReg
      ? { texto: 'Desaprueba', estilo: estilos.desaprueba }
      : enCurso;
  }

  return resultadoActivosParcial(estado, cumplidas, total, umbralReg, umbralPromo, desglose);
}

/** Proyecto SGSI: 75% de entregas con ≥6; promoción progresiva con cada entrega calificada ≥8. */
export function evaluarPromocionTpPorcentajeNota(materia: Materia, alumno: string, trabajosPracticos: Tarea[]) {
  const umbralRegPct = materia.notaMinimaRegularizar;
  const minNotaPromo = materia.notaMinimaPromocionar;
  const enCurso = { texto: 'En curso', estilo: estilos.enCurso };
  const total = trabajosPracticos.length;
  if (total === 0) return { texto: 'Sin TPs cargados', estilo: estilos.neutro };

  const notas: number[] = [];
  for (const tarea of trabajosPracticos) {
    const valor = notaDeTarea(tarea, alumno);
    if (valor === null) continue;
    if (valor < NOTA_APROBACION_ACTIVIDAD) {
      return { texto: 'Desaprueba', estilo: estilos.desaprueba };
    }
    notas.push(valor);
  }

  const aprobados = trabajosPracticos.filter((tarea) => {
    const valor = notaDeTarea(tarea, alumno);
    return valor !== null && valor >= NOTA_APROBACION_ACTIVIDAD;
  }).length;
  const porcentaje = (aprobados / total) * 100;

  if (notas.length > 0 && notas.every((n) => n >= minNotaPromo)) {
    return { texto: 'Promociona', estilo: estilos.promociona };
  }
  if (porcentaje >= umbralRegPct) {
    return { texto: 'Regulariza', estilo: estilos.regulariza };
  }
  if (trabajosPracticos.every(tareaCerrada) && porcentaje < umbralRegPct) {
    return { texto: 'Desaprueba', estilo: estilos.desaprueba };
  }
  return enCurso;
}

function esActividadObligatoriaRiesgos(tarea: Tarea) {
  if (tarea.tipo === 'trabajo_practico') return true;
  if (!tarea.conNota) return false;
  const nombre = String(tarea.nombre || '').toLowerCase();
  return /cuestionario|quiz|trabajo\s+pr[aá]ctico|tp\b|actividad\s+pr[aá]ctica/.test(nombre)
    || tarea.tipo === 'quiz';
}

/** Al menos 3 actividades prácticas; cuestionarios con nota cuentan; promoción progresiva ≥8. */
export function evaluarPromocionRiesgosTps(materia: Materia, alumno: string, tareas: Tarea[]) {
  const minReg = materia.notaMinimaRegularizar;
  const minPromo = materia.notaMinimaPromocionar;
  const enCurso = { texto: 'En curso', estilo: estilos.enCurso };
  const actividades = tareas.filter(esActividadObligatoriaRiesgos);
  if (actividades.length === 0) return { texto: 'Sin actividades', estilo: estilos.neutro };

  const notas: number[] = [];
  let aprobados = 0;
  for (const tarea of actividades) {
    const valor = notaDeTarea(tarea, alumno);
    if (valor !== null) {
      if (valor < minReg) return { texto: 'Desaprueba', estilo: estilos.desaprueba };
      notas.push(valor);
      if (valor >= minReg) aprobados += 1;
    } else if (tareaCompletadaPor(tarea, alumno)) {
      aprobados += 1;
    }
  }

  if (notas.length > 0 && notas.every((n) => n >= minPromo)) {
    return { texto: 'Promociona', estilo: estilos.promociona };
  }
  if (aprobados >= 3) {
    return { texto: 'Regulariza', estilo: estilos.regulariza };
  }
  if (actividades.every(tareaCerrada) && aprobados < 3) {
    return { texto: 'Desaprueba', estilo: estilos.desaprueba };
  }
  return enCurso;
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

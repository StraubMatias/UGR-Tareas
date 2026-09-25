import type { Materia, Nota, Parcial, Tarea } from '../core/cursada';
import {
  obtenerDiasHastaFecha,
  obtenerDiasHastaTarea,
  tareaCompletadaPor
} from '../core/cursada';
import { tareaHabilitada as tareaEstaHabilitada } from '../app/validators';

export function calcularBadgeEstadoMateria(
  materia: Materia,
  alumno: string,
  parciales: Parcial[],
  notas: Nota[]): { texto: string; estilo: string } | null {
    const tareasAbiertas = materia.tareas.filter((tarea) => tareaEstaHabilitada(tarea.inicio));
    const trabajosPracticos = tareasAbiertas.filter((tarea) => tarea.tipo === 'trabajo_practico');
    if (!materia.condiciones && trabajosPracticos.length === 0) return null;
    const estado = (texto: string, estilo: string) => ({ texto, estilo });
    const enCurso = estado('En curso', 'text-amber-300 bg-amber-500/10 border-amber-500/30');
    if (materia.reglaPromocion === 'metodologia') return enCurso;
    const desaprueba = estado('Desaprueba', 'text-red-300 bg-red-500/10 border-red-500/30');
    const regulariza = estado('Regulariza', 'text-blue-300 bg-blue-500/10 border-blue-500/30');
    const promociona = estado('Promociona', 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30');
    const notaDe = (registro: string | number | null | undefined) => Number.parseFloat(String(registro ?? '').replace(',', '.'));
    const notaDeTarea = (tarea: Tarea) => notaDe(tarea.notas?.[alumno]);
    const tareaAprobada = (tarea: Tarea) => {
      if (tarea.conNota || tarea.tipo === 'trabajo_practico') {
        const nota = notaDeTarea(tarea);
        return Number.isFinite(nota) && nota >= 6;
      }
      return tareaCompletadaPor(tarea, alumno);
    };
    const tareaCerrada = (tarea: Tarea) => {
      const dias = obtenerDiasHastaTarea(tarea.fin);
      return Boolean(tarea.fin && tarea.fin !== 'Sin fecha' && dias !== null && dias < 0);
    };
    const todasCerradas = (tareas: Tarea[]) => tareas.length > 0 && tareas.every(tareaCerrada);

    if (materia.reglaPromocion === 'ciberdelitos_parciales') {
      const parcialesMateria = parciales.filter((parcial) => {
        const dias = obtenerDiasHastaFecha(parcial.fecha);
        return parcial.materia_id === materia.id
          && parcial.fecha !== 'Sin fecha'
          && dias !== null
          && dias <= 0;
      });
      const notasParciales = parcialesMateria.map((parcial) => {
        const registro = notas.find((nota) => nota.parcial_id === parcial.id && nota.alumno === alumno);
        return registro ? notaDe(registro.nota) : null;
      });
      const notasValidasParciales = notasParciales.filter((nota): nota is number => nota !== null && Number.isFinite(nota));
      if (notasParciales.length < 2 || notasValidasParciales.length !== notasParciales.length) {
        return notasParciales.length === 2 && parcialesMateria.every((parcial) => {
          const dias = obtenerDiasHastaFecha(parcial.fecha);
          return dias !== null && dias < 0;
        })
          ? desaprueba
          : enCurso;
      }
      if (notasValidasParciales.some((nota) => nota < materia.notaMinimaRegularizar)) return desaprueba;
      return notasValidasParciales.every((nota) => nota >= materia.notaMinimaPromocionar) ? promociona : regulariza;
    }

    if (materia.reglaPromocion === 'activos_porcentaje') {
      const total = tareasAbiertas.length;
      if (total === 0) return estado('Sin actividades', 'text-slate-400 bg-slate-800/60 border-slate-700');
      const completadas = tareasAbiertas.filter(tareaAprobada).length;
      const porcentaje = (completadas / total) * 100;
      if (porcentaje >= materia.notaMinimaPromocionar) return promociona;
      if (porcentaje >= materia.notaMinimaRegularizar) return regulariza;
      return tareasAbiertas.every(tareaCerrada) ? desaprueba : enCurso;
    }

    if (materia.reglaPromocion === 'tp_porcentaje_nota') {
      const total = trabajosPracticos.length;
      if (total === 0) return estado('Sin TPs abiertos', 'text-slate-400 bg-slate-800/60 border-slate-700');
      const completados = trabajosPracticos.filter(tareaAprobada).length;
      const porcentaje = (completados / total) * 100;
      const notasValidas = trabajosPracticos.map(notaDeTarea).filter((nota) => Number.isFinite(nota));
      if (porcentaje >= materia.notaMinimaPromocionar && notasValidas.length === total && notasValidas.every((nota) => nota >= materia.notaMinimaPromocionar)) {
        return promociona;
      }
      if (porcentaje >= materia.notaMinimaRegularizar) return regulariza;
      return trabajosPracticos.every(tareaCerrada) ? desaprueba : enCurso;
    }

    if (trabajosPracticos.length === 0) return tareasAbiertas.length === 0
      ? estado('Sin TPs abiertos', 'text-slate-400 bg-slate-800/60 border-slate-700')
      : estado('Sin TPs cargados', 'text-slate-400 bg-slate-800/60 border-slate-700');
    const notasTp = trabajosPracticos.map((tarea) => {
      const valor = tarea.notas?.[alumno];
      return valor === undefined ? null : notaDe(valor);
    });
    const notasCargadas = notasTp.filter((nota): nota is number => nota !== null && Number.isFinite(nota));
    if (materia.reglaPromocion === 'riesgos_tps') {
      const completados = trabajosPracticos.filter(tareaAprobada).length;
      if (completados < 3) return todasCerradas(trabajosPracticos) ? desaprueba : enCurso;
      if (notasCargadas.length === trabajosPracticos.length && notasCargadas.every((nota) => nota >= materia.notaMinimaPromocionar)) return promociona;
      return regulariza;
    }
    if (notasTp.length !== notasCargadas.length) return todasCerradas(trabajosPracticos) ? desaprueba : enCurso;
    const promedio = notasCargadas.reduce((total, nota) => total + nota, 0) / notasCargadas.length;
    if (notasCargadas.some((nota) => nota < materia.notaMinimaRegularizar) || promedio < materia.notaMinimaRegularizar) return desaprueba;
    return notasCargadas.every((nota) => nota >= materia.notaMinimaPromocionar) && promedio >= materia.notaMinimaPromocionar ? promociona : regulariza;
}


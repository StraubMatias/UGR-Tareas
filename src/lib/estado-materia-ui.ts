import type { Materia, Nota, Parcial } from '../core/cursada';
import { tareaHabilitada as tareaEstaHabilitada } from '../app/validators';
import { alumnoCursaMateria, type InscripcionAlumno } from './companeros';
import {
  evaluarParcialesCuatrimestre,
  evaluarPromocionActivosPorcentaje,
  evaluarPromocionParcialesYTps,
  evaluarPromocionRiesgosTps,
  evaluarPromocionSoloTps,
  evaluarPromocionTpPorcentajeNota,
  reglaPromocionEfectiva,
  type LineaDesgloseActivos
} from './promocion-materia';

export type BadgeEstadoMateria = {
  texto: string;
  estilo: string;
  porcentaje?: number;
  cumplidas?: number;
  total?: number;
  aviso?: string | null;
  desgloseActivos?: LineaDesgloseActivos[];
};

export function calcularBadgeEstadoMateria(
  materia: Materia,
  alumno: string,
  parciales: Parcial[],
  notas: Nota[],
  inscripciones?: InscripcionAlumno[]
): BadgeEstadoMateria | null {
  if (inscripciones && !alumnoCursaMateria(inscripciones, alumno, materia.id)) {
    return null;
  }
    const tareasAbiertas = materia.tareas.filter((tarea) => tareaEstaHabilitada(tarea.inicio));
    const trabajosPracticos = materia.tareas.filter((tarea) => tarea.tipo === 'trabajo_practico');
    if (!materia.condiciones && trabajosPracticos.length === 0) return null;
    const estado = (texto: string, estilo: string) => ({ texto, estilo });
    const enCurso = estado('En curso', 'text-amber-300 bg-amber-500/10 border-amber-500/30');
    const regla = reglaPromocionEfectiva(materia);
    if (regla === 'metodologia') return enCurso;

    if (regla === 'parciales_y_tps') {
      return evaluarPromocionParcialesYTps(materia, alumno, parciales, notas, trabajosPracticos);
    }

    if (regla === 'ciberdelitos_parciales') {
      const resultado = evaluarParcialesCuatrimestre(
        parciales,
        materia.id,
        alumno,
        notas,
        materia.notaMinimaRegularizar,
        materia.notaMinimaPromocionar
      );
      return resultado.estado || enCurso;
    }

    if (regla === 'activos_porcentaje') {
      const r = evaluarPromocionActivosPorcentaje(materia, alumno, parciales, notas, materia.tareas);
      return {
        texto: r.texto,
        estilo: r.estilo,
        porcentaje: r.porcentaje,
        cumplidas: r.cumplidas,
        total: r.total,
        aviso: r.aviso,
        desgloseActivos: r.desglose
      };
    }

    if (regla === 'tp_porcentaje_nota') {
      return evaluarPromocionTpPorcentajeNota(materia, alumno, trabajosPracticos);
    }

    if (regla === 'riesgos_tps') {
      return evaluarPromocionRiesgosTps(materia, alumno, materia.tareas);
    }

    if (trabajosPracticos.length === 0) return tareasAbiertas.length === 0
      ? estado('Sin TPs abiertos', 'text-slate-400 bg-slate-800/60 border-slate-700')
      : estado('Sin TPs cargados', 'text-slate-400 bg-slate-800/60 border-slate-700');
    const soloTps = evaluarPromocionSoloTps(materia, alumno, trabajosPracticos, parciales, notas);
    if (soloTps) return soloTps;
    return enCurso;
}

import type { Row, Value } from '@libsql/client';
import { texto, textoONull } from './action-internals';

export function consultaPeriodo(periodoId: string | null, sqlConPeriodo: string, sqlSinPeriodo: string) {
  return periodoId
    ? { sql: sqlConPeriodo, args: [periodoId] }
    : { sql: sqlSinPeriodo, args: [] };
}

export function armarMaterias(
  filasMaterias: Row[],
  filasTareas: Row[],
  filasCompletadas: Row[],
  filasNotas: Row[],
  filasGrupos: Row[]
) {
  const gruposPorTarea = new Map<string, Map<string, { id: string; nombre: string; integrantes: string[] }>>();
  for (const fila of filasGrupos) {
    const tareaId = texto(fila.tarea_id);
    const grupoId = texto(fila.id);
    if (!gruposPorTarea.has(tareaId)) gruposPorTarea.set(tareaId, new Map());
    const grupos = gruposPorTarea.get(tareaId)!;
    if (!grupos.has(grupoId)) grupos.set(grupoId, { id: grupoId, nombre: texto(fila.nombre), integrantes: [] });
    const alumnoGrupo = texto(fila.alumno);
    if (alumnoGrupo) grupos.get(grupoId)!.integrantes.push(alumnoGrupo);
  }

  const tareasPorMateria = new Map<string, Row[]>();
  filasTareas.forEach((tarea) => {
    const materiaId = texto(tarea.materia_id);
    const tareasMateria = tareasPorMateria.get(materiaId) || [];
    tareasMateria.push(tarea);
    tareasPorMateria.set(materiaId, tareasMateria);
  });

  const completadasPorTarea = new Map<string, Row[]>();
  filasCompletadas.forEach((completada) => {
    const tareaId = texto(completada.tarea_id);
    const completadasTarea = completadasPorTarea.get(tareaId) || [];
    completadasTarea.push(completada);
    completadasPorTarea.set(tareaId, completadasTarea);
  });

  const notasPorTarea = new Map<string, Record<string, Value>>();
  const fechasNotasPorTarea = new Map<string, Record<string, Value>>();
  filasNotas.forEach((nota) => {
    const tareaId = texto(nota.tarea_id);
    const alumnoNota = texto(nota.alumno);
    const notasTarea = notasPorTarea.get(tareaId) || {};
    notasTarea[alumnoNota] = nota.nota;
    notasPorTarea.set(tareaId, notasTarea);

    const fechasNotasTarea = fechasNotasPorTarea.get(tareaId) || {};
    fechasNotasTarea[alumnoNota] = nota.cargada_en;
    fechasNotasPorTarea.set(tareaId, fechasNotasTarea);
  });

  return filasMaterias.map((m) => {
    const tareasMateria = tareasPorMateria.get(texto(m.id)) || [];

    const tareasConCompletados = tareasMateria.map((t) => {
      const tareaId = texto(t.id);
      const completadas = completadasPorTarea.get(tareaId) || [];
      const notas = notasPorTarea.get(tareaId) || {};
      const notaCargadaEn = fechasNotasPorTarea.get(tareaId) || {};
      const completadoPor = completadas.map((c) => texto(c.alumno));

      return {
        id: texto(t.id),
        nombre: texto(t.nombre),
        inicio: textoONull(t.inicio),
        fin: textoONull(t.fin),
        detalles: texto(t.detalles),
        unidad: t.unidad == null || t.unidad === '' ? '' : texto(t.unidad),
        conNota: Number(t.con_nota) === 1,
        grupal: Number(t.grupal) === 1,
        cupo_maximo: Number(t.cupo_maximo) || 0,
        grupos: [...(gruposPorTarea.get(tareaId)?.values() || [])],
        tipo: texto(t.tipo) || 'actividad',
        url: texto(t.url),
        completadoPor,
        completadoEn: Object.fromEntries(
          completadas.map((c) => [texto(c.alumno), texto(c.completada_en)])
        ),
        notas: Object.fromEntries(
          Object.entries(notas).map(([alumnoNota, valor]) => [alumnoNota, valor == null ? null : texto(valor)])
        ),
        notaCargadaEn: Object.fromEntries(
          Object.entries(notaCargadaEn).map(([alumnoNota, valor]) => [alumnoNota, texto(valor)])
        )
      };
    });

    return {
      id: texto(m.id),
      nombre: texto(m.nombre),
      condiciones: texto(m.condiciones),
      notaMinimaRegularizar: Number(m.nota_minima_regularizar) || 4,
      notaMinimaPromocionar: Number(m.nota_minima_promocionar) || 8,
      reglaPromocion: texto(m.regla_promocion) || 'tp_nota',
      tareas: tareasConCompletados
    };
  });
}

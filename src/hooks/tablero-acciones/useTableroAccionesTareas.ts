import { useCallback, type FormEvent } from 'react';
import { crearTareaAction, editarTareaAction, eliminarTareaAction } from '../../app/actions';
import { flagsDeModoEntrega, modoEntregaDeTarea } from '../../core/cursada';
import { conRecargaTablero } from '../../lib/action-resultado';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesTareas(opts: UseTableroAccionesOptions) {
  const {
    cargarBD,
    setPestana,
    nombreTarea,
    materiaSel,
    fechaInicio,
    fechaFin,
    detallesTarea,
    unidadTarea,
    tareaConNota,
    modoEntregaTarea,
    cupoMaximo,
    tipoTarea,
    setNombreTarea,
    setFechaInicio,
    setFechaFin,
    setDetallesTarea,
    setUnidadTarea,
    setTareaConNota,
    setModoEntregaTarea,
    setCupoMaximo,
    setTipoTarea,
    tareaEnEdicion,
    setTareaEnEdicion
  } = opts;

  const handleCrearTarea = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nombreTarea.trim() || !materiaSel) return;
    const flags = flagsDeModoEntrega(modoEntregaTarea);
    const ok = await conRecargaTablero(
      () => crearTareaAction({
        materiaId: materiaSel,
        nombre: nombreTarea,
        inicio: fechaInicio,
        fin: fechaFin,
        detalles: detallesTarea,
        unidad: unidadTarea,
        conNota: tareaConNota || tipoTarea === 'trabajo_practico',
        grupal: flags.grupal,
        permiteIndividual: flags.permiteIndividual,
        cupoMaximo: flags.grupal ? cupoMaximo : 0,
        tipo: tipoTarea
      }),
      cargarBD,
      { mensajeError: 'No se pudo crear la tarea.' }
    );
    if (!ok) return;
    setNombreTarea('');
    setFechaInicio('');
    setFechaFin('');
    setDetallesTarea('');
    setUnidadTarea('');
    setTareaConNota(false);
    setModoEntregaTarea('individual');
    setCupoMaximo(0);
    setTipoTarea('actividad');
    setPestana('materias');
  }, [nombreTarea, materiaSel, fechaInicio, fechaFin, detallesTarea, unidadTarea, tareaConNota, modoEntregaTarea, cupoMaximo, tipoTarea, cargarBD, setNombreTarea, setFechaInicio, setFechaFin, setDetallesTarea, setUnidadTarea, setTareaConNota, setModoEntregaTarea, setCupoMaximo, setTipoTarea, setPestana]);

  const handleGuardarEdicionTarea = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tareaEnEdicion) return;
    const flags = flagsDeModoEntrega(modoEntregaDeTarea(tareaEnEdicion.tarea));
    const ok = await conRecargaTablero(
      () => editarTareaAction({
        ...tareaEnEdicion.tarea,
        materiaId: tareaEnEdicion.materiaId,
        unidad: tareaEnEdicion.tarea.unidad ?? '',
        detalles: tareaEnEdicion.tarea.detalles ?? '',
        tipo: tareaEnEdicion.tarea.tipo ?? 'actividad',
        grupal: flags.grupal,
        permiteIndividual: flags.permiteIndividual,
        cupoMaximo: flags.grupal ? (Number(tareaEnEdicion.tarea.cupo_maximo) || 0) : 0
      }),
      cargarBD,
      { mensajeError: 'No se pudo editar la tarea.' }
    );
    if (ok) setTareaEnEdicion(null);
  }, [tareaEnEdicion, cargarBD, setTareaEnEdicion]);

  const handleEliminarTarea = useCallback(async (id: string) => {
    if (!confirm('¿Seguro que querés borrar esta tarea?')) return;
    await conRecargaTablero(() => eliminarTareaAction(id), cargarBD, { mensajeError: 'No se pudo borrar la tarea.' });
  }, [cargarBD]);

  return { handleCrearTarea, handleGuardarEdicionTarea, handleEliminarTarea };
}

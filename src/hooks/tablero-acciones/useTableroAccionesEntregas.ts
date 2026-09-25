import { useCallback } from 'react';
import { guardarNotaTareaAction, toggleTareaAction } from '../../app/actions';
import { tareaHabilitada as tareaEstaHabilitada } from '../../app/validators';
import { mensajeErrorAction } from '../../lib/action-resultado';
import type { Tarea } from '../../core/cursada';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesEntregas(opts: UseTableroAccionesOptions) {
  const { cargarBD, usuarioActual, notasTareasInputs, setNotasTareasInputs } = opts;

  const handleToggleTarea = useCallback(async (tareaId: string, alumno: string) => {
    const resultado = await toggleTareaAction(tareaId, alumno);
    const mensaje = mensajeErrorAction(resultado, 'No se pudo actualizar la entrega.');
    if (mensaje) alert(mensaje);
    await cargarBD();
  }, [cargarBD]);

  const toggleTareaDesdeCliente = useCallback(async (tareaId: string, alumno: string, tarea: Tarea) => {
    if (!tareaEstaHabilitada(tarea.inicio)) {
      alert('La tarea todavía no está habilitada.');
      return;
    }
    await handleToggleTarea(tareaId, alumno);
  }, [handleToggleTarea]);

  const handleNotaTareaChangeLocal = useCallback((tareaId: string, alumno: string, valor: string) => {
    setNotasTareasInputs((prev) => ({ ...prev, [`${tareaId}_${alumno}`]: valor }));
  }, [setNotasTareasInputs]);

  const handleGuardarNotaTareaOnBlur = useCallback(async (tareaId: string, alumno: string) => {
    if (!usuarioActual) return;
    const clave = `${tareaId}_${alumno}`;
    const resultado = await guardarNotaTareaAction(tareaId, alumno, notasTareasInputs[clave] || '', usuarioActual);
    const mensaje = mensajeErrorAction(resultado, 'No se pudo guardar la nota de la tarea.');
    if (mensaje) {
      alert(mensaje);
      await cargarBD();
      return;
    }
    await cargarBD();
  }, [usuarioActual, notasTareasInputs, cargarBD]);

  return {
    handleToggleTarea,
    toggleTareaDesdeCliente,
    handleNotaTareaChangeLocal,
    handleGuardarNotaTareaOnBlur
  };
}

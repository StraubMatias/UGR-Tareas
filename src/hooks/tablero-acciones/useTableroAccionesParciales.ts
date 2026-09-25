import { useCallback, type FormEvent } from 'react';
import {
  crearParcialAction,
  editarParcialAction,
  eliminarParcialAction,
  guardarNotaParcialAction
} from '../../app/actions';
import { conRecargaTablero, mensajeErrorAction } from '../../lib/action-resultado';
import type { Parcial } from '../../core/cursada';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesParciales(opts: UseTableroAccionesOptions) {
  const {
    cargarBD,
    usuarioActual,
    esAdmin,
    notasInputs,
    setNotasInputs,
    setPestana,
    materiaParcialSel,
    nombreParcial,
    fechaParcial,
    detallesParcial,
    parcialEnEdicion,
    setNombreParcial,
    setFechaParcial,
    setDetallesParcial,
    setParcialEnEdicion,
    setMateriaParcialSel
  } = opts;

  const handleCrearParcial = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nombreParcial.trim() || !materiaParcialSel || !usuarioActual) return;
    const datosParcial = {
      materiaId: materiaParcialSel,
      nombre: nombreParcial,
      fecha: fechaParcial,
      detalles: detallesParcial,
      usuario: usuarioActual
    };
    const ok = await conRecargaTablero(
      () => (parcialEnEdicion
        ? editarParcialAction({ id: parcialEnEdicion.id, ...datosParcial })
        : crearParcialAction(datosParcial)),
      cargarBD,
      { mensajeError: 'No se pudo guardar el parcial.' }
    );
    if (!ok) return;
    setNombreParcial('');
    setFechaParcial('');
    setDetallesParcial('');
    setParcialEnEdicion(null);
    setPestana('parciales');
  }, [nombreParcial, materiaParcialSel, usuarioActual, fechaParcial, detallesParcial, parcialEnEdicion, cargarBD, setNombreParcial, setFechaParcial, setDetallesParcial, setParcialEnEdicion, setPestana]);

  const iniciarEdicionParcial = useCallback((parcial: Parcial) => {
    setParcialEnEdicion(parcial);
    setMateriaParcialSel(parcial.materia_id);
    setNombreParcial(parcial.nombre);
    setFechaParcial(parcial.fecha === 'Sin fecha' ? '' : parcial.fecha);
    setDetallesParcial(parcial.detalles === 'Sin observaciones' ? '' : parcial.detalles || '');
  }, [setParcialEnEdicion, setMateriaParcialSel, setNombreParcial, setFechaParcial, setDetallesParcial]);

  const handleEliminarParcial = useCallback(async (id: string) => {
    if (!confirm('¿Seguro que querés borrar este parcial y sus notas cargadas?')) return;
    if (!usuarioActual) return;
    await conRecargaTablero(
      () => eliminarParcialAction(id, usuarioActual),
      cargarBD,
      { mensajeError: 'No se pudo borrar el parcial.' }
    );
  }, [usuarioActual, cargarBD]);

  const handleNotaChangeLocal = useCallback((parcialId: string, alumno: string, valor: string) => {
    setNotasInputs((prev) => ({ ...prev, [`${parcialId}_${alumno}`]: valor }));
  }, [setNotasInputs]);

  const handleGuardarNotaOnBlur = useCallback(async (parcialId: string, alumno: string) => {
    if (!usuarioActual || (!esAdmin && alumno !== usuarioActual)) return;
    const clave = `${parcialId}_${alumno}`;
    const resultado = await guardarNotaParcialAction(parcialId, alumno, notasInputs[clave] || '', usuarioActual);
    const mensaje = mensajeErrorAction(resultado, 'No se pudo guardar la nota.');
    if (mensaje) {
      alert(mensaje);
      await cargarBD();
    }
  }, [usuarioActual, esAdmin, notasInputs, cargarBD]);

  return {
    handleCrearParcial,
    iniciarEdicionParcial,
    handleEliminarParcial,
    handleNotaChangeLocal,
    handleGuardarNotaOnBlur
  };
}

import { useCallback, type FormEvent } from 'react';
import { crearAlumnoAction, editarAlumnoAction, eliminarAlumnoAction } from '../../app/actions';
import { conRecargaTablero } from '../../lib/action-resultado';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesAlumnos(opts: UseTableroAccionesOptions) {
  const { cargarBD, nuevoAlumnoNombre, setNuevoAlumnoNombre, alumnoEnEdicion, setAlumnoEnEdicion } = opts;

  const handleCrearAlumno = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nuevoAlumnoNombre.trim()) return;
    const ok = await conRecargaTablero(() => crearAlumnoAction(nuevoAlumnoNombre), cargarBD);
    if (ok) setNuevoAlumnoNombre('');
  }, [nuevoAlumnoNombre, cargarBD, setNuevoAlumnoNombre]);

  const handleGuardarEdicionAlumno = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumnoEnEdicion || !alumnoEnEdicion.nuevoNombre.trim()) return;
    const ok = await conRecargaTablero(
      () => editarAlumnoAction(alumnoEnEdicion.antiguoNombre, alumnoEnEdicion.nuevoNombre),
      cargarBD
    );
    if (ok) setAlumnoEnEdicion(null);
  }, [alumnoEnEdicion, cargarBD, setAlumnoEnEdicion]);

  const handleEliminarAlumno = useCallback(async (nombre: string) => {
    if (!confirm(`¿Seguro que querés eliminar a "${nombre}" de la lista?`)) return;
    await conRecargaTablero(() => eliminarAlumnoAction(nombre), cargarBD, { mensajeError: 'No se pudo eliminar el alumno.' });
  }, [cargarBD]);

  return { handleCrearAlumno, handleGuardarEdicionAlumno, handleEliminarAlumno };
}

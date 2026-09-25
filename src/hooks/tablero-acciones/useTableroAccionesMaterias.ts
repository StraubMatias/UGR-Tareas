import { useCallback, type FormEvent } from 'react';
import {
  crearMateriaAction,
  editarCondicionesMateriaAction,
  eliminarMateriaAction,
  renombrarMateriaAction
} from '../../app/actions';
import { conRecargaTablero } from '../../lib/action-resultado';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesMaterias(opts: UseTableroAccionesOptions) {
  const {
    cargarBD,
    usuarioActual,
    nuevaMateriaNombre,
    setNuevaMateriaNombre,
    nuevoMateriaAnio,
    nuevoMateriaCuatrimestre,
    materiaCondicionesEnEdicion,
    setMateriaCondicionesEnEdicion,
    materiaEnEdicion,
    setMateriaEnEdicion
  } = opts;

  const handleCrearMateria = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nuevaMateriaNombre.trim()) return;
    const ok = await conRecargaTablero(
      () => crearMateriaAction({ nombre: nuevaMateriaNombre, anio: nuevoMateriaAnio, cuatrimestre: nuevoMateriaCuatrimestre }),
      cargarBD,
      { mensajeError: 'No se pudo crear la materia.' }
    );
    if (ok) setNuevaMateriaNombre('');
  }, [nuevaMateriaNombre, nuevoMateriaAnio, nuevoMateriaCuatrimestre, cargarBD, setNuevaMateriaNombre]);

  const handleGuardarCondicionesMateria = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!materiaCondicionesEnEdicion) return;
    const ok = await conRecargaTablero(
      () => editarCondicionesMateriaAction({
        ...materiaCondicionesEnEdicion,
        reglaPromocion: materiaCondicionesEnEdicion.reglaPromocion || 'tp_nota',
        usuario: usuarioActual
      }),
      cargarBD,
      { mensajeError: 'No se pudieron guardar las condiciones.' }
    );
    if (ok) setMateriaCondicionesEnEdicion(null);
  }, [materiaCondicionesEnEdicion, usuarioActual, cargarBD, setMateriaCondicionesEnEdicion]);

  const handleGuardarRenombrarMateria = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!materiaEnEdicion) return;
    const ok = await conRecargaTablero(
      () => renombrarMateriaAction(materiaEnEdicion.id, materiaEnEdicion.nombre),
      cargarBD
    );
    if (ok) setMateriaEnEdicion(null);
  }, [materiaEnEdicion, cargarBD, setMateriaEnEdicion]);

  const handleEliminarMateria = useCallback(async (id: string, nombre: string) => {
    if (!confirm(`¿Seguro que querés eliminar la materia "${nombre}" y sus tareas?`)) return;
    await conRecargaTablero(() => eliminarMateriaAction(id), cargarBD, { mensajeError: 'No se pudo eliminar la materia.' });
  }, [cargarBD]);

  return {
    handleCrearMateria,
    handleGuardarCondicionesMateria,
    handleGuardarRenombrarMateria,
    handleEliminarMateria
  };
}

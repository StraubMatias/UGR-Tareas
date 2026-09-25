import { useCallback } from 'react';
import { guardarProgresoPlanAction } from '../../app/actions';
import { calcularBadgeEstadoMateria } from '../../lib/estado-materia-ui';
import { conRecargaTablero } from '../../lib/action-resultado';
import type { Materia } from '../../core/cursada';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesPlan(opts: UseTableroAccionesOptions) {
  const { cargarBD, parciales, notas, setProgresoPlanEnEdicion } = opts;

  const handleGuardarProgresoPlan = useCallback(async (alumno: string, materiaCodigo: string, estado: string, nota: string | number = '') => {
    const ok = await conRecargaTablero(
      () => guardarProgresoPlanAction({ alumno, materiaCodigo, estado, nota }),
      () => cargarBD(false),
      { mensajeError: 'No se pudo guardar el progreso.', mostrarCarga: false }
    );
    if (!ok) return;
    setProgresoPlanEnEdicion((actual) => {
      const siguiente = { ...actual };
      delete siguiente[`${alumno}_${materiaCodigo}`];
      return siguiente;
    });
  }, [cargarBD, setProgresoPlanEnEdicion]);

  const obtenerEstadoMateria = useCallback(
    (materia: Materia, alumno: string) => calcularBadgeEstadoMateria(materia, alumno, parciales, notas),
    [parciales, notas]
  );

  return { handleGuardarProgresoPlan, obtenerEstadoMateria };
}

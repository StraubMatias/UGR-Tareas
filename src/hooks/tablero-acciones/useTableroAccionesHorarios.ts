import { useCallback, type FormEvent } from 'react';
import { crearHorarioAction, eliminarHorarioAction } from '../../app/actions';
import { conRecargaTablero } from '../../lib/action-resultado';
import type { UseTableroAccionesOptions } from './types';

export function useTableroAccionesHorarios(opts: UseTableroAccionesOptions) {
  const {
    cargarBD,
    usuarioActual,
    setPestana,
    materiaHorarioSel,
    diaHorario,
    horaInicioHorario,
    horaFinHorario,
    aulaHorario,
    setHoraInicioHorario,
    setHoraFinHorario,
    setAulaHorario
  } = opts;

  const handleCrearHorario = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!materiaHorarioSel || !horaInicioHorario || !horaFinHorario) return;
    if (horaInicioHorario >= horaFinHorario) {
      alert('La hora de inicio debe ser anterior a la hora de finalización.');
      return;
    }
    const ok = await conRecargaTablero(
      () => crearHorarioAction({
        materiaId: materiaHorarioSel,
        dia: diaHorario,
        horaInicio: horaInicioHorario,
        horaFin: horaFinHorario,
        aula: aulaHorario,
        usuario: usuarioActual ?? undefined
      }),
      cargarBD,
      { mensajeError: 'No se pudo guardar el horario.' }
    );
    if (!ok) return;
    setHoraInicioHorario('');
    setHoraFinHorario('');
    setAulaHorario('');
    setPestana('horarios');
  }, [materiaHorarioSel, horaInicioHorario, horaFinHorario, diaHorario, aulaHorario, usuarioActual, cargarBD, setHoraInicioHorario, setHoraFinHorario, setAulaHorario, setPestana]);

  const handleEliminarHorario = useCallback(async (id: string) => {
    if (!confirm('¿Seguro que querés borrar este horario?')) return;
    if (!usuarioActual) return;
    await conRecargaTablero(
      () => eliminarHorarioAction(id, usuarioActual),
      cargarBD,
      { mensajeError: 'No se pudo borrar el horario.' }
    );
  }, [usuarioActual, cargarBD]);

  return { handleCrearHorario, handleEliminarHorario };
}

import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  crearAlumnoAction,
  editarAlumnoAction,
  eliminarAlumnoAction,
  toggleTareaAction,
  crearMateriaAction,
  renombrarMateriaAction,
  eliminarMateriaAction,
  editarCondicionesMateriaAction,
  crearTareaAction,
  editarTareaAction,
  eliminarTareaAction,
  guardarNotaTareaAction,
  crearParcialAction,
  editarParcialAction,
  eliminarParcialAction,
  guardarNotaParcialAction,
  crearHorarioAction,
  eliminarHorarioAction,
  guardarProgresoPlanAction
} from '../app/actions';
import { tareaHabilitada as tareaEstaHabilitada } from '../app/validators';
import { calcularBadgeEstadoMateria } from '../lib/estado-materia-ui';
import { conRecargaTablero, mensajeErrorAction } from '../lib/action-resultado';
import type { PortalPestana } from '../components/portal/types';
import type { Materia, Nota, Parcial, Tarea } from '../core/cursada';
import { tareaPendienteAlumno } from '../core/cursada';

interface UseTableroAccionesOptions {
  cargarBD: (mostrarCarga?: boolean) => Promise<boolean>;
  usuarioActual: string | null;
  esAdmin: boolean;
  materias: Materia[];
  parciales: Parcial[];
  notas: Nota[];
  notasInputs: Record<string, string>;
  notasTareasInputs: Record<string, string>;
  materiasDesplegadas: Record<string, boolean>;
  setPestana: Dispatch<SetStateAction<PortalPestana>>;
  setMateriasDesplegadas: Dispatch<SetStateAction<Record<string, boolean>>>;
  setAlumnosDesplegados: Dispatch<SetStateAction<Record<string, boolean>>>;
  setNotasDesplegadas: Dispatch<SetStateAction<Record<string, boolean>>>;
  setNotasInputs: Dispatch<SetStateAction<Record<string, string>>>;
  setNotasTareasInputs: Dispatch<SetStateAction<Record<string, string>>>;
  setTareaFoco: Dispatch<SetStateAction<{ materiaId: string; tareaId: string } | null>>;
  setTareaFocoVisible: Dispatch<SetStateAction<boolean>>;
  setProgresoPlanEnEdicion: Dispatch<SetStateAction<Record<string, { estado: string; nota: string }>>>;
  nuevoAlumnoNombre: string;
  setNuevoAlumnoNombre: Dispatch<SetStateAction<string>>;
  alumnoEnEdicion: { antiguoNombre: string; nuevoNombre: string } | null;
  setAlumnoEnEdicion: Dispatch<SetStateAction<{ antiguoNombre: string; nuevoNombre: string } | null>>;
  nuevaMateriaNombre: string;
  setNuevaMateriaNombre: Dispatch<SetStateAction<string>>;
  nuevoMateriaAnio: string;
  nuevoMateriaCuatrimestre: string;
  materiaCondicionesEnEdicion: {
    id: string;
    condiciones: string;
    notaMinimaRegularizar: number | string;
    notaMinimaPromocionar: number | string;
    reglaPromocion: string;
  } | null;
  setMateriaCondicionesEnEdicion: Dispatch<SetStateAction<UseTableroAccionesOptions['materiaCondicionesEnEdicion']>>;
  materiaEnEdicion: { id: string; nombre: string } | null;
  setMateriaEnEdicion: Dispatch<SetStateAction<{ id: string; nombre: string } | null>>;
  nombreTarea: string;
  materiaSel: string;
  fechaInicio: string;
  fechaFin: string;
  detallesTarea: string;
  unidadTarea: string;
  tareaConNota: boolean;
  tareaGrupal: boolean;
  cupoMaximo: number;
  tipoTarea: string;
  setNombreTarea: Dispatch<SetStateAction<string>>;
  setFechaInicio: Dispatch<SetStateAction<string>>;
  setFechaFin: Dispatch<SetStateAction<string>>;
  setDetallesTarea: Dispatch<SetStateAction<string>>;
  setUnidadTarea: Dispatch<SetStateAction<string>>;
  setTareaConNota: Dispatch<SetStateAction<boolean>>;
  setTareaGrupal: Dispatch<SetStateAction<boolean>>;
  setCupoMaximo: Dispatch<SetStateAction<number>>;
  setTipoTarea: Dispatch<SetStateAction<string>>;
  tareaEnEdicion: { materiaId: string; tarea: Tarea } | null;
  setTareaEnEdicion: Dispatch<SetStateAction<{ materiaId: string; tarea: Tarea } | null>>;
  materiaHorarioSel: string;
  diaHorario: string;
  horaInicioHorario: string;
  horaFinHorario: string;
  aulaHorario: string;
  setHoraInicioHorario: Dispatch<SetStateAction<string>>;
  setHoraFinHorario: Dispatch<SetStateAction<string>>;
  setAulaHorario: Dispatch<SetStateAction<string>>;
  materiaParcialSel: string;
  nombreParcial: string;
  fechaParcial: string;
  detallesParcial: string;
  parcialEnEdicion: Parcial | null;
  setNombreParcial: Dispatch<SetStateAction<string>>;
  setFechaParcial: Dispatch<SetStateAction<string>>;
  setDetallesParcial: Dispatch<SetStateAction<string>>;
  setParcialEnEdicion: Dispatch<SetStateAction<Parcial | null>>;
  setMateriaParcialSel: Dispatch<SetStateAction<string>>;
}

export function useTableroAcciones(opts: UseTableroAccionesOptions) {
  const {
    cargarBD,
    usuarioActual,
    esAdmin,
    materias,
    parciales,
    notas,
    notasInputs,
    notasTareasInputs,
    materiasDesplegadas,
    setPestana,
    setMateriasDesplegadas,
    setAlumnosDesplegados,
    setNotasDesplegadas,
    setNotasInputs,
    setNotasTareasInputs,
    setTareaFoco,
    setTareaFocoVisible,
    setProgresoPlanEnEdicion,
    nuevoAlumnoNombre,
    setNuevoAlumnoNombre,
    alumnoEnEdicion,
    setAlumnoEnEdicion,
    nuevaMateriaNombre,
    setNuevaMateriaNombre,
    nuevoMateriaAnio,
    nuevoMateriaCuatrimestre,
    materiaCondicionesEnEdicion,
    setMateriaCondicionesEnEdicion,
    materiaEnEdicion,
    setMateriaEnEdicion,
    nombreTarea,
    materiaSel,
    fechaInicio,
    fechaFin,
    detallesTarea,
    unidadTarea,
    tareaConNota,
    tareaGrupal,
    cupoMaximo,
    tipoTarea,
    setNombreTarea,
    setFechaInicio,
    setFechaFin,
    setDetallesTarea,
    setUnidadTarea,
    setTareaConNota,
    setTareaGrupal,
    setCupoMaximo,
    setTipoTarea,
    tareaEnEdicion,
    setTareaEnEdicion,
    materiaHorarioSel,
    diaHorario,
    horaInicioHorario,
    horaFinHorario,
    aulaHorario,
    setHoraInicioHorario,
    setHoraFinHorario,
    setAulaHorario,
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

  const toggleDesplegarAlumno = useCallback((nombreAlumno: string) => {
    setAlumnosDesplegados((prev) => ({ ...prev, [nombreAlumno]: !prev[nombreAlumno] }));
  }, [setAlumnosDesplegados]);

  const toggleDesplegarMateria = useCallback((materiaId: string) => {
    setMateriasDesplegadas((prev) => ({ ...prev, [materiaId]: !prev[materiaId] }));
  }, [setMateriasDesplegadas]);

  const toggleNotasParcial = useCallback((parcialId: string) => {
    setNotasDesplegadas((prev) => ({ ...prev, [parcialId]: !prev[parcialId] }));
  }, [setNotasDesplegadas]);

  const irATareaEnMaterias = useCallback((tareaId: string) => {
    if (!usuarioActual) return;
    const materia = materias.find((m) => m.tareas.some((t) => t.id === tareaId));
    if (!materia) return;
    const tarea = materia.tareas.find((t) => t.id === tareaId);
    if (tarea && !tareaPendienteAlumno(tarea, usuarioActual) && !materiasDesplegadas[materia.id]) {
      setMateriasDesplegadas((prev) => ({ ...prev, [materia.id]: true }));
    }
    setTareaFoco({ materiaId: materia.id, tareaId });
    setTareaFocoVisible(true);
    setPestana('materias');
  }, [usuarioActual, materias, materiasDesplegadas, setMateriasDesplegadas, setTareaFoco, setTareaFocoVisible, setPestana]);

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

  const handleCrearTarea = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nombreTarea.trim() || !materiaSel) return;
    const ok = await conRecargaTablero(
      () => crearTareaAction({
        materiaId: materiaSel,
        nombre: nombreTarea,
        inicio: fechaInicio,
        fin: fechaFin,
        detalles: detallesTarea,
        unidad: unidadTarea,
        conNota: tareaConNota || tipoTarea === 'trabajo_practico',
        grupal: tareaGrupal,
        cupoMaximo,
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
    setTareaGrupal(false);
    setCupoMaximo(0);
    setTipoTarea('actividad');
    setPestana('materias');
  }, [nombreTarea, materiaSel, fechaInicio, fechaFin, detallesTarea, unidadTarea, tareaConNota, tareaGrupal, cupoMaximo, tipoTarea, cargarBD, setNombreTarea, setFechaInicio, setFechaFin, setDetallesTarea, setUnidadTarea, setTareaConNota, setTareaGrupal, setCupoMaximo, setTipoTarea, setPestana]);

  const handleGuardarEdicionTarea = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tareaEnEdicion) return;
    const ok = await conRecargaTablero(
      () => editarTareaAction({
        ...tareaEnEdicion.tarea,
        materiaId: tareaEnEdicion.materiaId,
        unidad: tareaEnEdicion.tarea.unidad ?? '',
        detalles: tareaEnEdicion.tarea.detalles ?? '',
        tipo: tareaEnEdicion.tarea.tipo ?? 'actividad',
        grupal: Boolean(tareaEnEdicion.tarea.grupal),
        cupoMaximo: Number(tareaEnEdicion.tarea.cupo_maximo) || 0
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

  const obtenerEstadoMateria = useCallback(
    (materia: Materia, alumno: string) => calcularBadgeEstadoMateria(materia, alumno, parciales, notas),
    [parciales, notas]
  );

  return {
    toggleDesplegarAlumno,
    toggleDesplegarMateria,
    toggleNotasParcial,
    irATareaEnMaterias,
    handleToggleTarea,
    toggleTareaDesdeCliente,
    handleGuardarProgresoPlan,
    handleCrearAlumno,
    handleGuardarEdicionAlumno,
    handleEliminarAlumno,
    handleCrearMateria,
    handleGuardarCondicionesMateria,
    handleGuardarRenombrarMateria,
    handleEliminarMateria,
    handleCrearTarea,
    handleGuardarEdicionTarea,
    handleEliminarTarea,
    handleNotaTareaChangeLocal,
    handleGuardarNotaTareaOnBlur,
    handleCrearHorario,
    handleEliminarHorario,
    handleCrearParcial,
    iniciarEdicionParcial,
    handleEliminarParcial,
    handleNotaChangeLocal,
    handleGuardarNotaOnBlur,
    obtenerEstadoMateria
  };
}

import { useCallback, useEffect } from 'react';
import { materiasQueCursa } from '../lib/companeros';
import { armarDerivadosTablero, diasDesdeCreacionPortal, resolverMateriaRankingVisible } from '../lib/tablero-cursada';
import { useNovedadesConocidas } from './useNovedadesConocidas';
import { useTableroCarga } from './useTableroCarga';
import { usePlanEstudioDerivados } from './usePlanEstudioDerivados';
import { usePortalAcceso } from './usePortalAcceso';
import { useTableroAcciones } from './useTableroAcciones';
import { marcarNotificacionesVistasEnStorage, useNotificacionesPortal } from './useNotificacionesPortal';
import { useSyncAdmin } from './useSyncAdmin';
import { useTableroEstadoDatos } from './useTableroEstadoDatos';
import { useTableroEstadoUi } from './useTableroEstadoUi';
import { useTableroEstadoAcceso } from './useTableroEstadoAcceso';
import { useTableroAdminForms } from './useTableroAdminForms';
import type { PortalPestana } from '../components/portal/types';

export function useTableroPortal() {
  const datos = useTableroEstadoDatos();
  const ui = useTableroEstadoUi();
  const acceso = useTableroEstadoAcceso();
  const admin = useTableroAdminForms();

  const esAdmin = acceso.rolUsuario === 'admin';
  const plan = usePlanEstudioDerivados(
    datos.progresoPlan,
    acceso.usuarioActual,
    ui.materiasSimuladas,
    ui.cuatrimestreSimulado
  );

  useEffect(() => {
    document.title = 'UGR - Tareas';
  }, []);

  useNotificacionesPortal(
    acceso.usuarioActual,
    ui.notificacionesAbiertas,
    ui.notificacionesRef,
    ui.setNotificacionesVistas,
    (v) => ui.setNotificacionesAbiertas(v)
  );

  useEffect(() => {
    if (!ui.tareaFoco || !ui.tareaFocoVisible) return undefined;

    const temporizadorScroll = setTimeout(() => {
      const elemento = document.getElementById(`tarea-${ui.tareaFoco!.tareaId}`);
      if (elemento) {
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    const apagarFoco = setTimeout(() => {
      ui.setTareaFocoVisible(false);
    }, 2500);

    return () => {
      clearTimeout(temporizadorScroll);
      clearTimeout(apagarFoco);
    };
  }, [ui.tareaFoco, ui.tareaFocoVisible, ui.setTareaFocoVisible]);

  useNovedadesConocidas(
    acceso.usuarioActual,
    ui.cargando,
    datos.materias,
    datos.parciales,
    datos.inscripciones,
    ui.setNovedades
  );

  const idsMisMateriasCursadas = materiasQueCursa(datos.inscripciones, acceso.usuarioActual ?? '');
  const materiasMisCursadas = datos.materias.filter((materia) => idsMisMateriasCursadas.has(materia.id));
  const materiaRankingVisible = resolverMateriaRankingVisible(ui.materiaRanking, materiasMisCursadas);

  const { cargarBD } = useTableroCarga({
    periodoSeleccionado: datos.periodoSeleccionado,
    setPeriodoSeleccionado: datos.setPeriodoSeleccionado,
    periodoEspejoRef: ui.periodoEspejoRef,
    usuarioActual: acceso.usuarioActual,
    setCargando: ui.setCargando,
    setUsuarioActual: acceso.setUsuarioActual,
    pausarRefrescoRef: ui.pausarRefrescoRef,
    refrescandoRef: ui.refrescandoRef,
    setRolUsuario: acceso.setRolUsuario,
    setOrigenCuenta: acceso.setOrigenCuenta,
    setUgrUsuarioCuenta: acceso.setUgrUsuarioCuenta,
    setPeriodos: datos.setPeriodos,
    setMaterias: datos.setMaterias,
    setAlumnos: datos.setAlumnos,
    setRegistrados: datos.setRegistrados,
    setInscripciones: datos.setInscripciones,
    setParciales: datos.setParciales,
    setNotas: datos.setNotas,
    setHorarios: datos.setHorarios,
    setCronograma: datos.setCronograma,
    setProgresoPlan: datos.setProgresoPlan,
    setAvisos: datos.setAvisos,
    setNotasInputs: datos.setNotasInputs,
    setNotasTareasInputs: datos.setNotasTareasInputs,
    setMateriaSel: admin.setMateriaSel,
    setMateriaParcialSel: admin.setMateriaParcialSel,
    setMateriaHorarioSel: admin.setMateriaHorarioSel,
    setMateriaRanking: ui.setMateriaRanking
  });

  const sync = useSyncAdmin(async (mostrarCarga) => {
    await cargarBD(mostrarCarga ?? true);
  });

  ui.pausarRefrescoRef.current = Boolean(
    acceso.modalPasswordOpen
    || sync.syncAbierto
    || admin.hayModalAbierto
    || ui.syncCuentaFuente !== null
  );

  const portalAcceso = usePortalAcceso({
    setIniciado: ui.setIniciado,
    setUsuarioActual: acceso.setUsuarioActual,
    setRolUsuario: acceso.setRolUsuario,
    setOrigenCuenta: acceso.setOrigenCuenta,
    setUgrUsuarioCuenta: acceso.setUgrUsuarioCuenta,
    setMostrarAvisoInicio: ui.setMostrarAvisoInicio,
    inputUser: acceso.inputUser,
    inputPass: acceso.inputPass,
    registroPass: acceso.registroPass,
    registroConfirmacion: acceso.registroConfirmacion,
    setInputUser: acceso.setInputUser,
    setInputPass: acceso.setInputPass,
    setRegistroPass: acceso.setRegistroPass,
    setRegistroConfirmacion: acceso.setRegistroConfirmacion,
    setErrorLogin: acceso.setErrorLogin,
    setEnviandoAcceso: acceso.setEnviandoAcceso,
    usuarioActual: acceso.usuarioActual,
    userPassChange: acceso.userPassChange,
    currentPassChange: acceso.currentPassChange,
    nuevoUserChange: acceso.nuevoUserChange,
    newPassChange: acceso.newPassChange,
    setUserPassChange: acceso.setUserPassChange,
    setNuevoUserChange: acceso.setNuevoUserChange,
    setCurrentPassChange: acceso.setCurrentPassChange,
    setNewPassChange: acceso.setNewPassChange,
    setMsgPassChange: acceso.setMsgPassChange,
    setModalPasswordOpen: acceso.setModalPasswordOpen,
    cargarBD
  });

  const acciones = useTableroAcciones({
    cargarBD,
    usuarioActual: acceso.usuarioActual,
    esAdmin,
    materias: datos.materias,
    parciales: datos.parciales,
    notas: datos.notas,
    notasInputs: datos.notasInputs,
    notasTareasInputs: datos.notasTareasInputs,
    materiasDesplegadas: ui.materiasDesplegadas,
    setPestana: ui.setPestana,
    setMateriasDesplegadas: ui.setMateriasDesplegadas,
    setAlumnosDesplegados: ui.setAlumnosDesplegados,
    setNotasDesplegadas: ui.setNotasDesplegadas,
    setNotasInputs: datos.setNotasInputs,
    setNotasTareasInputs: datos.setNotasTareasInputs,
    setTareaFoco: ui.setTareaFoco,
    setTareaFocoVisible: ui.setTareaFocoVisible,
    setProgresoPlanEnEdicion: admin.setProgresoPlanEnEdicion,
    nuevoAlumnoNombre: admin.nuevoAlumnoNombre,
    setNuevoAlumnoNombre: admin.setNuevoAlumnoNombre,
    alumnoEnEdicion: admin.alumnoEnEdicion,
    setAlumnoEnEdicion: admin.setAlumnoEnEdicion,
    nuevaMateriaNombre: admin.nuevaMateriaNombre,
    setNuevaMateriaNombre: admin.setNuevaMateriaNombre,
    nuevoMateriaAnio: admin.nuevoMateriaAnio,
    nuevoMateriaCuatrimestre: admin.nuevoMateriaCuatrimestre,
    materiaCondicionesEnEdicion: admin.materiaCondicionesEnEdicion,
    setMateriaCondicionesEnEdicion: admin.setMateriaCondicionesEnEdicion,
    materiaEnEdicion: admin.materiaEnEdicion,
    setMateriaEnEdicion: admin.setMateriaEnEdicion,
    nombreTarea: admin.nombreTarea,
    materiaSel: admin.materiaSel,
    fechaInicio: admin.fechaInicio,
    fechaFin: admin.fechaFin,
    detallesTarea: admin.detallesTarea,
    unidadTarea: admin.unidadTarea,
    tareaConNota: admin.tareaConNota,
    tareaGrupal: admin.tareaGrupal,
    cupoMaximo: admin.cupoMaximo,
    tipoTarea: admin.tipoTarea,
    setNombreTarea: admin.setNombreTarea,
    setFechaInicio: admin.setFechaInicio,
    setFechaFin: admin.setFechaFin,
    setDetallesTarea: admin.setDetallesTarea,
    setUnidadTarea: admin.setUnidadTarea,
    setTareaConNota: admin.setTareaConNota,
    setTareaGrupal: admin.setTareaGrupal,
    setCupoMaximo: admin.setCupoMaximo,
    setTipoTarea: admin.setTipoTarea,
    tareaEnEdicion: admin.tareaEnEdicion,
    setTareaEnEdicion: admin.setTareaEnEdicion,
    materiaHorarioSel: admin.materiaHorarioSel,
    diaHorario: admin.diaHorario,
    horaInicioHorario: admin.horaInicioHorario,
    horaFinHorario: admin.horaFinHorario,
    aulaHorario: admin.aulaHorario,
    setHoraInicioHorario: admin.setHoraInicioHorario,
    setHoraFinHorario: admin.setHoraFinHorario,
    setAulaHorario: admin.setAulaHorario,
    materiaParcialSel: admin.materiaParcialSel,
    nombreParcial: admin.nombreParcial,
    fechaParcial: admin.fechaParcial,
    detallesParcial: admin.detallesParcial,
    parcialEnEdicion: admin.parcialEnEdicion,
    setNombreParcial: admin.setNombreParcial,
    setFechaParcial: admin.setFechaParcial,
    setDetallesParcial: admin.setDetallesParcial,
    setParcialEnEdicion: admin.setParcialEnEdicion,
    setMateriaParcialSel: admin.setMateriaParcialSel
  });

  const navegarA = useCallback(
    (destino: PortalPestana) => {
      ui.setTareaFoco(null);
      ui.setPestana(destino);
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [ui.setPestana, ui.setTareaFoco]
  );

  const derivados = armarDerivadosTablero({
    usuarioActual: acceso.usuarioActual,
    materias: datos.materias,
    parciales: datos.parciales,
    horarios: datos.horarios,
    cronograma: datos.cronograma,
    inscripciones: datos.inscripciones,
    notas: datos.notas,
    alumnos: datos.alumnos,
    novedades: ui.novedades,
    avisos: datos.avisos,
    mesCalendario: ui.mesCalendario,
    materiasMisCursadas,
    materiaRankingVisible,
    alumnoComparar: ui.alumnoComparar
  });

  const diasPagina = diasDesdeCreacionPortal();

  const marcarNotificacionesVistas = useCallback(
    (ids: string[]) => {
      if (!acceso.usuarioActual) return;
      marcarNotificacionesVistasEnStorage(
        acceso.usuarioActual,
        ui.notificacionesVistas,
        ids,
        ui.setNotificacionesVistas
      );
    },
    [acceso.usuarioActual, ui.notificacionesVistas, ui.setNotificacionesVistas]
  );

  const abrirModalPassword = useCallback(() => {
    if (!acceso.usuarioActual) return;
    acceso.setUserPassChange(acceso.usuarioActual);
    acceso.setNuevoUserChange(acceso.usuarioActual);
    acceso.setModalPasswordOpen(true);
  }, [acceso.usuarioActual, acceso.setModalPasswordOpen, acceso.setNuevoUserChange, acceso.setUserPassChange]);

  const cerrarModalPassword = useCallback(() => {
    acceso.setModalPasswordOpen(false);
    acceso.setMsgPassChange({ tipo: '', texto: '' });
  }, [acceso.setModalPasswordOpen, acceso.setMsgPassChange]);

  const tableroVacio =
    acceso.origenCuenta === 'propio' && datos.materias.length === 0 && !ui.cargando;

  return {
    datos,
    ui,
    acceso,
    admin,
    esAdmin,
    plan,
    cargarBD,
    sync,
    portalAcceso,
    acciones,
    navegarA,
    derivados,
    diasPagina,
    marcarNotificacionesVistas,
    abrirModalPassword,
    cerrarModalPassword,
    materiasMisCursadas,
    materiaRankingVisible,
    tableroVacio
  };
}

export type TableroPortalViewModel = ReturnType<typeof useTableroPortal>;

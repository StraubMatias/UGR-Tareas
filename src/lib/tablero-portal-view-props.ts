import { etiquetaMateria } from '../core/cursada';
import type { TableroPortalViewModel } from '../hooks/useTableroPortal';
import type { PortalVistasCursadaProps } from '../components/portal/PortalVistasCursada';
import type PortalModales from '../components/portal/PortalModales';
import type { ComponentProps } from 'react';

type PortalModalesProps = ComponentProps<typeof PortalModales>;

export function buildPortalVistasCursadaProps(vm: TableroPortalViewModel): PortalVistasCursadaProps {
  const { datos, ui, acceso, admin, esAdmin, plan, cargarBD, acciones, derivados, materiasMisCursadas, materiaRankingVisible, navegarA } = vm;
  const usuario = acceso.usuarioActual;
  if (!usuario) {
    throw new Error('buildPortalVistasCursadaProps requiere sesión activa');
  }

  return {
    pestana: ui.pestana,
    cargando: ui.cargando,
    cargarBD,
    esAdmin,
    usuarioActual: usuario,
    materias: datos.materias,
    parciales: datos.parciales,
    notas: datos.notas,
    alumnos: datos.alumnos,
    registrados: datos.registrados,
    inscripciones: datos.inscripciones,
    materiasMisCursadas,
    materiaRankingVisible,
    setMateriaRanking: ui.setMateriaRanking,
    proximoParcial: derivados.proximoParcial,
    materiaProximoParcial: derivados.materiaProximoParcial,
    horariosProximoParcial: derivados.horariosProximoParcial,
    ranking: derivados.ranking,
    rankingPodio: derivados.rankingPodio,
    restoRanking: derivados.restoRanking,
    datosComparacion: derivados.datosComparacion,
    alumnosDelHistorial: derivados.alumnosDelHistorial,
    alumnosOrdenadosPromocion: derivados.alumnosOrdenadosPromocion,
    parcialesAgrupados: derivados.parcialesAgrupados,
    mesCalendario: ui.mesCalendario,
    setMesCalendario: ui.setMesCalendario,
    diasCalendario: derivados.diasCalendario,
    claveHoy: derivados.claveHoy,
    tareasCalendario: derivados.tareasCalendario,
    eventosDelDiaCalendarioFn: derivados.eventosDelDiaCalendarioFn,
    horariosDeLaCursada: derivados.horariosDeLaCursada,
    parcialesDeLaCursada: derivados.parcialesDeLaCursada,
    cronogramaDeLaCursada: derivados.cronogramaDeLaCursada,
    materiasDeLaCursada: derivados.materiasDeLaCursada,
    diaCalendarioSeleccionado: ui.diaCalendarioSeleccionado,
    setDiaCalendarioSeleccionado: ui.setDiaCalendarioSeleccionado,
    situacionPropiaAbierta: ui.situacionPropiaAbierta,
    setSituacionPropiaAbierta: ui.setSituacionPropiaAbierta,
    historialPropioAbierto: ui.historialPropioAbierto,
    setHistorialPropioAbierto: ui.setHistorialPropioAbierto,
    alumnosDesplegados: ui.alumnosDesplegados,
    setAlumnosDesplegados: ui.setAlumnosDesplegados,
    materiasExpandidas: ui.materiasExpandidas,
    materiasDesplegadas: ui.materiasDesplegadas,
    alumnoComparar: ui.alumnoComparar,
    setAlumnoComparar: ui.setAlumnoComparar,
    notasTareasInputs: datos.notasTareasInputs,
    notasDesplegadas: ui.notasDesplegadas,
    notasInputs: datos.notasInputs,
    tareaFoco: ui.tareaFoco,
    tareaFocoVisible: ui.tareaFocoVisible,
    plan,
    planModalAbierto: ui.planModalAbierto,
    setPlanModalAbierto: ui.setPlanModalAbierto,
    progresoPlanEnEdicion: admin.progresoPlanEnEdicion,
    setProgresoPlanEnEdicion: admin.setProgresoPlanEnEdicion,
    materiasSimuladas: ui.materiasSimuladas,
    setMateriasSimuladas: ui.setMateriasSimuladas,
    setCuatrimestreSimulado: ui.setCuatrimestreSimulado,
    setMateriaCondicionesEnEdicion: admin.setMateriaCondicionesEnEdicion,
    setMateriaEnEdicion: admin.setMateriaEnEdicion,
    setTareaEnEdicion: admin.setTareaEnEdicion,
    acciones,
    adminForms: admin.adminForms,
    navegarA
  };
}

export function buildPortalModalesProps(vm: TableroPortalViewModel): PortalModalesProps {
  const { datos, acceso, admin, portalAcceso, acciones, cerrarModalPassword } = vm;

  return {
    materias: datos.materias,
    etiquetaMateria,
    parcialEnEdicion: admin.parcialEnEdicion,
    materiaParcialSel: admin.materiaParcialSel,
    nombreParcial: admin.nombreParcial,
    fechaParcial: admin.fechaParcial,
    detallesParcial: admin.detallesParcial,
    setMateriaParcialSel: admin.setMateriaParcialSel,
    setNombreParcial: admin.setNombreParcial,
    setFechaParcial: admin.setFechaParcial,
    setDetallesParcial: admin.setDetallesParcial,
    onSubmitParcial: acciones.handleCrearParcial,
    onCerrarParcial: admin.cerrarParcialEdicion,
    modalPasswordOpen: acceso.modalPasswordOpen,
    usuarioActual: acceso.usuarioActual,
    userPassChange: acceso.userPassChange,
    nuevoUserChange: acceso.nuevoUserChange,
    currentPassChange: acceso.currentPassChange,
    newPassChange: acceso.newPassChange,
    msgPassChange: acceso.msgPassChange,
    onUserPassChange: acceso.setUserPassChange,
    onNuevoUserChange: acceso.setNuevoUserChange,
    onCurrentPassChange: acceso.setCurrentPassChange,
    onNewPassChange: acceso.setNewPassChange,
    onSubmitPassword: portalAcceso.handleCambiarPassword,
    onCerrarPassword: cerrarModalPassword,
    alumnoEnEdicion: admin.alumnoEnEdicion,
    setAlumnoEnEdicion: admin.setAlumnoEnEdicion,
    onGuardarAlumno: acciones.handleGuardarEdicionAlumno,
    materiaEnEdicion: admin.materiaEnEdicion,
    setMateriaEnEdicion: admin.setMateriaEnEdicion,
    onGuardarMateria: acciones.handleGuardarRenombrarMateria,
    tareaEnEdicion: admin.tareaEnEdicion,
    setTareaEnEdicion: admin.setTareaEnEdicion,
    onGuardarTarea: acciones.handleGuardarEdicionTarea,
    materiaCondicionesEnEdicion: admin.materiaCondicionesEnEdicion,
    setMateriaCondicionesEnEdicion: admin.setMateriaCondicionesEnEdicion,
    onGuardarCondiciones: acciones.handleGuardarCondicionesMateria
  };
}

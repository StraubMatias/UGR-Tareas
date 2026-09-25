import type { PortalPestana } from './types';
import type { calcularDerivadosPlanEstudio } from '../../lib/plan-estudio-derivados';
import type { useTableroAcciones } from '../../hooks/useTableroAcciones';
import ProximoParcialAside from './ProximoParcialAside';
import {
  VistaAlumnos,
  VistaMaterias,
  VistaPromocion,
  VistaHistorial,
  VistaPlan,
  VistaParciales,
  VistaRanking,
  VistaHorarios,
  VistaAdminPanel
} from './portal-vistas-dynamic';
import { NOMBRES_MESES as nombresMeses } from '../../lib/calendario-tablero';
import { obtenerDiaSemanaHorario } from '../../lib/calendario-tablero';
import type { EntradaRankingTablero } from '../../lib/ranking-tablero';
import type { Materia, Nota, Parcial } from '../../core/cursada';
import { etiquetaMateria } from '../../core/cursada';
import type { Dispatch, SetStateAction } from 'react';
import type { MateriaCondicionesEdicion, ProgresoPlanEdicion, TableroAdminForms } from '../../hooks/tablero-estado/types';

type PlanDerivados = ReturnType<typeof calcularDerivadosPlanEstudio>;
type Acciones = ReturnType<typeof useTableroAcciones>;

export interface PortalVistasCursadaProps {
  pestana: PortalPestana;
  cargando: boolean;
  cargarBD: (mostrarCarga?: boolean) => Promise<boolean>;
  esAdmin: boolean;
  usuarioActual: string;
  materias: Materia[];
  parciales: Parcial[];
  notas: Nota[];
  alumnos: string[];
  registrados: string[];
  inscripciones: { alumno: string; materiaId: string }[];
  materiasMisCursadas: Materia[];
  materiaRankingVisible: string;
  setMateriaRanking: Dispatch<SetStateAction<string>>;
  proximoParcial?: Parcial;
  materiaProximoParcial?: Materia | null;
  horariosProximoParcial: import('../../core/cursada').Horario[];
  ranking: EntradaRankingTablero[];
  rankingPodio: EntradaRankingTablero[];
  restoRanking: EntradaRankingTablero[];
  datosComparacion: ReturnType<typeof import('../../lib/ranking-tablero').calcularDatosComparacionRanking>;
  alumnosDelHistorial: string[];
  alumnosOrdenadosPromocion: string[];
  parcialesAgrupados: { id: string; nombre: string; parciales: Parcial[] }[];
  mesCalendario: Date;
  setMesCalendario: Dispatch<SetStateAction<Date>>;
  diasCalendario: (Date | null)[];
  claveHoy: string;
  tareasCalendario: Array<{ tarea: Materia['tareas'][number]; materia: Materia }>;
  eventosDelDiaCalendarioFn: (fecha: Date | null) => ReturnType<typeof import('../../lib/calendario-tablero').eventosDelDiaCalendario>;
  horariosDeLaCursada: import('../../core/cursada').Horario[];
  parcialesDeLaCursada: Parcial[];
  cronogramaDeLaCursada: import('../../core/cursada').EventoCronograma[];
  materiasDeLaCursada: Materia[];
  diaCalendarioSeleccionado: Date | null;
  setDiaCalendarioSeleccionado: Dispatch<SetStateAction<Date | null>>;
  situacionPropiaAbierta: boolean;
  setSituacionPropiaAbierta: Dispatch<SetStateAction<boolean>>;
  historialPropioAbierto: boolean;
  setHistorialPropioAbierto: Dispatch<SetStateAction<boolean>>;
  alumnosDesplegados: Record<string, boolean>;
  setAlumnosDesplegados: Dispatch<SetStateAction<Record<string, boolean>>>;
  materiasDesplegadas: Record<string, boolean>;
  alumnoComparar: string;
  setAlumnoComparar: Dispatch<SetStateAction<string>>;
  notasTareasInputs: Record<string, string>;
  notasDesplegadas: Record<string, boolean>;
  notasInputs: Record<string, string>;
  tareaFoco: { materiaId: string; tareaId: string } | null;
  tareaFocoVisible: boolean;
  plan: PlanDerivados;
  planModalAbierto: boolean;
  setPlanModalAbierto: Dispatch<SetStateAction<boolean>>;
  progresoPlanEnEdicion: ProgresoPlanEdicion;
  setProgresoPlanEnEdicion: Dispatch<SetStateAction<ProgresoPlanEdicion>>;
  materiasSimuladas: string[];
  setMateriasSimuladas: Dispatch<SetStateAction<string[]>>;
  setCuatrimestreSimulado: Dispatch<SetStateAction<string>>;
  setMateriaCondicionesEnEdicion: Dispatch<SetStateAction<MateriaCondicionesEdicion | null>>;
  setMateriaEnEdicion: Dispatch<SetStateAction<{ id: string; nombre: string } | null>>;
  setTareaEnEdicion: Dispatch<SetStateAction<{ materiaId: string; tarea: Materia['tareas'][number] } | null>>;
  acciones: Acciones;
  adminForms: TableroAdminForms;
}

export default function PortalVistasCursada({
  pestana,
  cargando,
  cargarBD,
  esAdmin,
  usuarioActual,
  materias,
  parciales,
  notas,
  alumnos,
  registrados,
  inscripciones,
  materiasMisCursadas,
  materiaRankingVisible,
  setMateriaRanking,
  proximoParcial,
  materiaProximoParcial,
  horariosProximoParcial,
  ranking,
  rankingPodio,
  restoRanking,
  datosComparacion,
  alumnosDelHistorial,
  alumnosOrdenadosPromocion,
  parcialesAgrupados,
  mesCalendario,
  setMesCalendario,
  diasCalendario,
  claveHoy,
  tareasCalendario,
  eventosDelDiaCalendarioFn,
  horariosDeLaCursada,
  parcialesDeLaCursada,
  cronogramaDeLaCursada,
  materiasDeLaCursada,
  diaCalendarioSeleccionado,
  setDiaCalendarioSeleccionado,
  situacionPropiaAbierta,
  setSituacionPropiaAbierta,
  historialPropioAbierto,
  setHistorialPropioAbierto,
  alumnosDesplegados,
  setAlumnosDesplegados,
  materiasDesplegadas,
  alumnoComparar,
  setAlumnoComparar,
  notasTareasInputs,
  notasDesplegadas,
  notasInputs,
  tareaFoco,
  tareaFocoVisible,
  plan,
  planModalAbierto,
  setPlanModalAbierto,
  progresoPlanEnEdicion,
  setProgresoPlanEnEdicion,
  materiasSimuladas,
  setMateriasSimuladas,
  setCuatrimestreSimulado,
  setMateriaCondicionesEnEdicion,
  setMateriaEnEdicion,
  setTareaEnEdicion,
  acciones,
  adminForms
}: PortalVistasCursadaProps) {
  if (cargando) {
    return (
      <div className="text-center py-20 text-slate-400 text-sm font-medium flex flex-col items-center gap-3">
        <span className="text-3xl animate-spin">⌛</span>
        Cargando datos de la cursada...
      </div>
    );
  }

  const vistaAlumnosComun = (
    <VistaAlumnos
      materias={materias}
      inscripciones={inscripciones}
      alumnos={alumnos}
      registrados={registrados}
      esAdmin={esAdmin}
      usuarioActual={usuarioActual}
      situacionPropiaAbierta={situacionPropiaAbierta}
      setSituacionPropiaAbierta={setSituacionPropiaAbierta}
      alumnosDesplegados={alumnosDesplegados}
      toggleDesplegarAlumno={acciones.toggleDesplegarAlumno}
      toggleTareaDesdeCliente={acciones.toggleTareaDesdeCliente}
      irATareaEnMaterias={acciones.irATareaEnMaterias}
      notasTareasInputs={notasTareasInputs}
      handleNotaTareaChangeLocal={acciones.handleNotaTareaChangeLocal}
      handleGuardarNotaTareaOnBlur={acciones.handleGuardarNotaTareaOnBlur}
    />
  );

  return (
    <>
      {pestana === 'alumnos' && (
        <div className={`grid grid-cols-1 ${proximoParcial ? 'xl:grid-cols-[280px_minmax(0,1fr)]' : ''} gap-6 items-start`}>
          {proximoParcial && (
            <ProximoParcialAside
              proximoParcial={proximoParcial}
              materiaNombre={materiaProximoParcial?.nombre}
              horariosProximoParcial={horariosProximoParcial}
            />
          )}
          {vistaAlumnosComun}
        </div>
      )}

      {pestana === 'materias' && (
        <VistaMaterias
          recargar={cargarBD}
          materias={materias}
          inscripciones={inscripciones}
          alumnos={alumnos}
          usuarioActual={usuarioActual}
          esAdmin={esAdmin}
          materiasDesplegadas={materiasDesplegadas}
          toggleDesplegarMateria={acciones.toggleDesplegarMateria}
          setMateriaCondicionesEnEdicion={setMateriaCondicionesEnEdicion}
          setMateriaEnEdicion={setMateriaEnEdicion}
          handleEliminarMateria={acciones.handleEliminarMateria}
          setTareaEnEdicion={setTareaEnEdicion}
          handleEliminarTarea={acciones.handleEliminarTarea}
          toggleTareaDesdeCliente={acciones.toggleTareaDesdeCliente}
          handleToggleTarea={acciones.handleToggleTarea}
          notasTareasInputs={notasTareasInputs}
          handleNotaTareaChangeLocal={acciones.handleNotaTareaChangeLocal}
          handleGuardarNotaTareaOnBlur={acciones.handleGuardarNotaTareaOnBlur}
          tareaFoco={tareaFoco}
          tareaFocoVisible={tareaFocoVisible}
        />
      )}

      {pestana === 'promocion' && (
        <VistaPromocion
          materias={materias}
          inscripciones={inscripciones}
          esAdmin={esAdmin}
          usuarioActual={usuarioActual}
          alumnosOrdenadosPromocion={alumnosOrdenadosPromocion}
          obtenerEstadoMateria={acciones.obtenerEstadoMateria}
          setMateriaCondicionesEnEdicion={setMateriaCondicionesEnEdicion}
        />
      )}

      {pestana === 'historial' && (
        <VistaHistorial
          materias={materias}
          notas={notas}
          parciales={parciales}
          usuarioActual={usuarioActual}
          alumnoComparar={alumnoComparar}
          setAlumnoComparar={setAlumnoComparar}
          datosComparacion={datosComparacion}
          alumnosDelHistorial={alumnosDelHistorial}
          historialPropioAbierto={historialPropioAbierto}
          setHistorialPropioAbierto={setHistorialPropioAbierto}
          alumnosDesplegados={alumnosDesplegados}
          setAlumnosDesplegados={setAlumnosDesplegados}
        />
      )}

      {pestana === 'plan' && (
        <VistaPlan
          planDeEstudio={plan.planDeEstudio}
          cuatrimestresPlan={plan.cuatrimestresPlan}
          alumnos={alumnos}
          usuarioActual={usuarioActual}
          esAdmin={esAdmin}
          planModalAbierto={planModalAbierto}
          setPlanModalAbierto={setPlanModalAbierto}
          obtenerCorrelativasPendientes={plan.obtenerCorrelativasPendientes}
          obtenerMateriaPlan={plan.obtenerMateriaPlan}
          obtenerCorrelativasPendientesSimuladas={plan.obtenerCorrelativasPendientesSimuladas}
          obtenerProgresoMateria={plan.obtenerProgresoMateria}
          progresoPlanEnEdicion={progresoPlanEnEdicion}
          setProgresoPlanEnEdicion={setProgresoPlanEnEdicion}
          handleGuardarProgresoPlan={acciones.handleGuardarProgresoPlan}
          materiasAprobadasUsuario={plan.materiasAprobadasUsuario}
          materiasPendientesUsuario={plan.materiasPendientesUsuario}
          materiasSimuladas={materiasSimuladas}
          setMateriasSimuladas={setMateriasSimuladas}
          cuatrimestreActivo={plan.cuatrimestreActivo}
          setCuatrimestreSimulado={setCuatrimestreSimulado}
          cuatrimestreSugerido={plan.cuatrimestreSugerido}
          materiasDelSimulador={plan.materiasDelSimulador}
          materiasRecomendadas={plan.materiasRecomendadas}
          materiasExtraDisponibles={plan.materiasExtraDisponibles}
          materiasPriorizadas={plan.materiasPriorizadas}
        />
      )}

      {pestana === 'parciales' && (
        <VistaParciales
          parciales={parciales}
          parcialesAgrupados={parcialesAgrupados}
          esAdmin={esAdmin}
          usuarioActual={usuarioActual}
          alumnos={alumnos}
          iniciarEdicionParcial={acciones.iniciarEdicionParcial}
          handleEliminarParcial={acciones.handleEliminarParcial}
          toggleNotasParcial={acciones.toggleNotasParcial}
          notasDesplegadas={notasDesplegadas}
          notasInputs={notasInputs}
          handleNotaChangeLocal={acciones.handleNotaChangeLocal}
          handleGuardarNotaOnBlur={acciones.handleGuardarNotaOnBlur}
        />
      )}

      {pestana === 'ranking' && (
        <VistaRanking
          materias={materiasMisCursadas}
          usuarioActual={usuarioActual}
          materiaRanking={materiaRankingVisible}
          setMateriaRanking={setMateriaRanking}
          ranking={ranking}
          rankingPodio={rankingPodio}
          restoRanking={restoRanking}
        />
      )}

      {pestana === 'horarios' && (
        <VistaHorarios
          mesCalendario={mesCalendario}
          setMesCalendario={setMesCalendario}
          nombresMeses={nombresMeses}
          horarios={horariosDeLaCursada}
          parciales={parcialesDeLaCursada}
          tareasCalendario={tareasCalendario}
          cronograma={cronogramaDeLaCursada}
          materias={materiasDeLaCursada}
          diasCalendario={diasCalendario}
          claveHoyCalendario={claveHoy}
          eventosDelDiaCalendario={eventosDelDiaCalendarioFn}
          obtenerDiaSemanaHorario={obtenerDiaSemanaHorario}
          diaCalendarioSeleccionado={diaCalendarioSeleccionado}
          setDiaCalendarioSeleccionado={setDiaCalendarioSeleccionado}
        />
      )}

      {pestana === 'admin' && esAdmin && (
        <VistaAdminPanel
          alumnos={alumnos}
          materias={materias}
          etiquetaMateria={etiquetaMateria}
          nuevoAlumnoNombre={adminForms.nuevoAlumnoNombre}
          onNuevoAlumnoNombre={adminForms.setNuevoAlumnoNombre}
          nuevoMateriaAnio={adminForms.nuevoMateriaAnio}
          onNuevoMateriaAnio={adminForms.setNuevoMateriaAnio}
          nuevoMateriaCuatrimestre={adminForms.nuevoMateriaCuatrimestre}
          onNuevoMateriaCuatrimestre={adminForms.setNuevoMateriaCuatrimestre}
          nuevaMateriaNombre={adminForms.nuevaMateriaNombre}
          onNuevaMateriaNombre={adminForms.setNuevaMateriaNombre}
          materiaSel={adminForms.materiaSel}
          onMateriaSel={adminForms.setMateriaSel}
          nombreTarea={adminForms.nombreTarea}
          onNombreTarea={adminForms.setNombreTarea}
          unidadTarea={adminForms.unidadTarea}
          onUnidadTarea={adminForms.setUnidadTarea}
          tipoTarea={adminForms.tipoTarea}
          onTipoTarea={adminForms.setTipoTarea}
          tareaConNota={adminForms.tareaConNota}
          onTareaConNota={adminForms.setTareaConNota}
          tareaGrupal={adminForms.tareaGrupal}
          onTareaGrupal={adminForms.setTareaGrupal}
          cupoMaximo={adminForms.cupoMaximo}
          onCupoMaximo={adminForms.setCupoMaximo}
          fechaInicio={adminForms.fechaInicio}
          onFechaInicio={adminForms.setFechaInicio}
          fechaFin={adminForms.fechaFin}
          onFechaFin={adminForms.setFechaFin}
          detallesTarea={adminForms.detallesTarea}
          onDetallesTarea={adminForms.setDetallesTarea}
          materiaParcialSel={adminForms.materiaParcialSel}
          onMateriaParcialSel={adminForms.setMateriaParcialSel}
          nombreParcial={adminForms.nombreParcial}
          onNombreParcial={adminForms.setNombreParcial}
          fechaParcial={adminForms.fechaParcial}
          onFechaParcial={adminForms.setFechaParcial}
          detallesParcial={adminForms.detallesParcial}
          onDetallesParcial={adminForms.setDetallesParcial}
          materiaHorarioSel={adminForms.materiaHorarioSel}
          onMateriaHorarioSel={adminForms.setMateriaHorarioSel}
          diaHorario={adminForms.diaHorario}
          onDiaHorario={adminForms.setDiaHorario}
          horaInicioHorario={adminForms.horaInicioHorario}
          onHoraInicioHorario={adminForms.setHoraInicioHorario}
          horaFinHorario={adminForms.horaFinHorario}
          onHoraFinHorario={adminForms.setHoraFinHorario}
          aulaHorario={adminForms.aulaHorario}
          onAulaHorario={adminForms.setAulaHorario}
          onCrearAlumno={acciones.handleCrearAlumno}
          onEliminarAlumno={acciones.handleEliminarAlumno}
          onEditarAlumno={(nombre) => adminForms.setAlumnoEnEdicion({ antiguoNombre: nombre, nuevoNombre: nombre })}
          onCrearMateria={acciones.handleCrearMateria}
          onCrearTarea={acciones.handleCrearTarea}
          onCrearParcial={acciones.handleCrearParcial}
          onCrearHorario={acciones.handleCrearHorario}
        />
      )}
    </>
  );
}

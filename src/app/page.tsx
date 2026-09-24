'use client';

import { useEffect, useRef, useState } from 'react';
import { materiasQueCursa } from '../lib/companeros';
import { armarDerivadosTablero, diasDesdeCreacionPortal, resolverMateriaRankingVisible } from '../lib/tablero-cursada';
import { useNovedadesConocidas } from '../hooks/useNovedadesConocidas';
import { useTableroCarga } from '../hooks/useTableroCarga';
import { usePlanEstudioDerivados } from '../hooks/usePlanEstudioDerivados';
import { usePortalAcceso } from '../hooks/usePortalAcceso';
import { useTableroAcciones } from '../hooks/useTableroAcciones';
import { marcarNotificacionesVistasEnStorage, useNotificacionesPortal } from '../hooks/useNotificacionesPortal';
import PortalHeader from '../components/portal/PortalHeader';
import PortalNav from '../components/portal/PortalNav';
import PortalVistasCursada from '../components/portal/PortalVistasCursada';
import PortalModales from '../components/portal/PortalModales';
import type { AvisoCampusMoodle, NovedadTablero, Periodo, PortalPestana } from '../components/portal/types';
import { type Materia, type Tarea, type Parcial, type Nota, type Horario, type EventoCronograma, etiquetaMateria } from '../core/cursada';
import VistaAlumnos from '../components/VistaAlumnos';
import CuentaPropia from '../components/CuentaPropia';
import BarraSesionPortal from '../components/portal/BarraSesionPortal';
import PantallaAcceso from '../components/portal/PantallaAcceso';
import ModalCuentaSync from '../components/portal/ModalCuentaSync';
import { useSyncAdmin } from '../hooks/useSyncAdmin';

export default function Home() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [alumnos, setAlumnos] = useState<string[]>([]);
  const [registrados, setRegistrados] = useState<string[]>([]);
  const [inscripciones, setInscripciones] = useState<{ alumno: string; materiaId: string }[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>('');
  const [usuarioActual, setUsuarioActual] = useState<string | null>(null);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [origenCuenta, setOrigenCuenta] = useState<string | null>(null);
  const [ugrUsuarioCuenta, setUgrUsuarioCuenta] = useState<string | null>(null);
  const [modoAcceso, setModoAcceso] = useState<'login' | 'registro'>('login');
  const [registroPass, setRegistroPass] = useState('');
  const [registroConfirmacion, setRegistroConfirmacion] = useState('');
  const [enviandoAcceso, setEnviandoAcceso] = useState(false);
  const [pestana, setPestana] = useState<PortalPestana>('alumnos');
  const [cargando, setCargando] = useState<boolean>(true);
  const [iniciado, setIniciado] = useState<boolean>(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState<boolean>(false);
  const [notificacionesVistas, setNotificacionesVistas] = useState<string[]>([]);
  const notificacionesRef = useRef<HTMLDivElement | null>(null);
  const refrescandoRef = useRef<boolean>(false);
  const periodoEspejoRef = useRef(false);
  const pausarRefrescoRef = useRef(false);
  const [mostrarAvisoInicio, setMostrarAvisoInicio] = useState<boolean>(false);
  const [novedades, setNovedades] = useState<NovedadTablero[]>([]);

  const [syncCuentaFuente, setSyncCuentaFuente] = useState<'ugr' | 'siu' | null>(null);

  // Estado para Parciales y Notas
  const [parciales, setParciales] = useState<Parcial[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [notasInputs, setNotasInputs] = useState<Record<string, string>>({});
  const [notasTareasInputs, setNotasTareasInputs] = useState<Record<string, string>>({});
  const [notasDesplegadas, setNotasDesplegadas] = useState<Record<string, boolean>>({});
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cronograma, setCronograma] = useState<EventoCronograma[]>([]);
  const [progresoPlan, setProgresoPlan] = useState<{ alumno: string | null; materia_codigo: string; estado: string; nota: number | null; actualizado_en: string }[]>([]);
  const [avisos, setAvisos] = useState<AvisoCampusMoodle[]>([]);
  const [mesCalendario, setMesCalendario] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [diaCalendarioSeleccionado, setDiaCalendarioSeleccionado] = useState<Date | null>(null);

  // Acordeón para compañeros
  const [alumnosDesplegados, setAlumnosDesplegados] = useState<Record<string, boolean>>({});
  const [materiasDesplegadas, setMateriasDesplegadas] = useState<Record<string, boolean>>({});
  const [situacionPropiaAbierta, setSituacionPropiaAbierta] = useState(true);
  const [historialPropioAbierto, setHistorialPropioAbierto] = useState(true);
  const [alumnoComparar, setAlumnoComparar] = useState('');
  const [materiaRanking, setMateriaRanking] = useState('');
  // Foco de tarea al llegar desde "Estado por Alumno" hacia Materias (scroll + resaltado)
  const [tareaFoco, setTareaFoco] = useState<{ materiaId: string; tareaId: string } | null>(null);
  const [tareaFocoVisible, setTareaFocoVisible] = useState(false);

  // Form Login
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Form Cambiar Password
  const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
  const [userPassChange, setUserPassChange] = useState('');
  const [currentPassChange, setCurrentPassChange] = useState('');
  const [newPassChange, setNewPassChange] = useState('');
  const [nuevoUserChange, setNuevoUserChange] = useState('');
  const [msgPassChange, setMsgPassChange] = useState({ tipo: '', texto: '' });

  // Forms Admin (Tareas/Materias/Alumnos)
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = useState('');
  const [nuevaMateriaNombre, setNuevaMateriaNombre] = useState('');
  const [nuevoMateriaAnio, setNuevoMateriaAnio] = useState('2026');
  const [nuevoMateriaCuatrimestre, setNuevoMateriaCuatrimestre] = useState('2');
  const [materiaSel, setMateriaSel] = useState('');
  const [nombreTarea, setNombreTarea] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [detallesTarea, setDetallesTarea] = useState('');
  const [unidadTarea, setUnidadTarea] = useState('');
  const [tareaConNota, setTareaConNota] = useState(false);
  const [tareaGrupal, setTareaGrupal] = useState(false);
  const [cupoMaximo, setCupoMaximo] = useState(0);
  const [tipoTarea, setTipoTarea] = useState('actividad');
  const [materiaCondicionesEnEdicion, setMateriaCondicionesEnEdicion] = useState<{
    id: string;
    condiciones: string;
    notaMinimaRegularizar: number | string;
    notaMinimaPromocionar: number | string;
    reglaPromocion: string;
  } | null>(null);

  // Form Admin (Parciales)
  const [materiaParcialSel, setMateriaParcialSel] = useState('');
  const [nombreParcial, setNombreParcial] = useState('');
  const [fechaParcial, setFechaParcial] = useState('');
  const [detallesParcial, setDetallesParcial] = useState('');
  const [parcialEnEdicion, setParcialEnEdicion] = useState<Parcial | null>(null);
  const [materiaHorarioSel, setMateriaHorarioSel] = useState('');
  const [diaHorario, setDiaHorario] = useState('1');
  const [horaInicioHorario, setHoraInicioHorario] = useState('');
  const [horaFinHorario, setHoraFinHorario] = useState('');
  const [aulaHorario, setAulaHorario] = useState('');

  // Modales edición
  const [tareaEnEdicion, setTareaEnEdicion] = useState<{ materiaId: string; tarea: Tarea } | null>(null);
  const [materiaEnEdicion, setMateriaEnEdicion] = useState<{ id: string; nombre: string } | null>(null);
  const [alumnoEnEdicion, setAlumnoEnEdicion] = useState<{ antiguoNombre: string; nuevoNombre: string } | null>(null);
  const [progresoPlanEnEdicion, setProgresoPlanEnEdicion] = useState<Record<string, { estado: string; nota: string }>>({});
  const [planModalAbierto, setPlanModalAbierto] = useState(false);
  const [cuatrimestreSimulado, setCuatrimestreSimulado] = useState('');
  const [materiasSimuladas, setMateriasSimuladas] = useState<string[]>([]);

  const esAdmin = rolUsuario === 'admin';
  const plan = usePlanEstudioDerivados(progresoPlan, usuarioActual, materiasSimuladas, cuatrimestreSimulado);

  useEffect(() => {
    document.title = "UGR - Tareas";
  }, []);

  useNotificacionesPortal(
    usuarioActual,
    notificacionesAbiertas,
    notificacionesRef,
    setNotificacionesVistas,
    (v) => setNotificacionesAbiertas(v)
  );

  useEffect(() => {
    if (!tareaFoco || !tareaFocoVisible) return undefined;

    const temporizadorScroll = setTimeout(() => {
      const elemento = document.getElementById(`tarea-${tareaFoco.tareaId}`);
      if (elemento) {
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    const apagarFoco = setTimeout(() => {
      setTareaFocoVisible(false);
    }, 2500);

    return () => {
      clearTimeout(temporizadorScroll);
      clearTimeout(apagarFoco);
    };
  }, [tareaFoco, tareaFocoVisible]);

  useNovedadesConocidas(usuarioActual, cargando, materias, parciales, inscripciones, setNovedades);

  // Filtrar solo materias que el usuario actual cursa, para el selector del ranking
  const idsMisMateriasCursadas = materiasQueCursa(inscripciones, usuarioActual ?? '');
  const materiasMisCursadas = materias.filter((materia) => idsMisMateriasCursadas.has(materia.id));
  const materiaRankingVisible = resolverMateriaRankingVisible(materiaRanking, materiasMisCursadas);

  const { cargarBD } = useTableroCarga({
    periodoSeleccionado,
    setPeriodoSeleccionado,
    periodoEspejoRef,
    usuarioActual,
    setCargando,
    setUsuarioActual,
    pausarRefrescoRef,
    refrescandoRef,
    setRolUsuario,
    setOrigenCuenta,
    setUgrUsuarioCuenta,
    setPeriodos,
    setMaterias,
    setAlumnos,
    setRegistrados,
    setInscripciones,
    setParciales,
    setNotas,
    setHorarios,
    setCronograma,
    setProgresoPlan,
    setAvisos,
    setNotasInputs,
    setNotasTareasInputs,
    setMateriaSel,
    setMateriaParcialSel,
    setMateriaHorarioSel,
    setMateriaRanking
  });

  const {
    syncAbierto,
    syncEstado,
    syncTipo,
    syncSiuDetalle,
    syncDatos,
    syncMensaje,
    syncSeleccionados,
    syncAvisosSeleccionados,
    syncEventosSeleccionados,
    cerrarSync,
    abrirSyncUGR,
    abrirSyncSIU,
    ejecutarSyncUGR,
    toggleSyncTarea,
    marcarTodasSync,
    toggleSyncAviso,
    toggleSyncEvento,
    marcarTodasAvisosSync,
    aplicarCambiosSync
  } = useSyncAdmin(async (mostrarCarga) => {
    await cargarBD(mostrarCarga ?? true);
  });

  pausarRefrescoRef.current = Boolean(
    modalPasswordOpen || syncAbierto || materiaCondicionesEnEdicion || parcialEnEdicion
    || tareaEnEdicion || materiaEnEdicion || alumnoEnEdicion
    || Object.keys(progresoPlanEnEdicion).length > 0
    || syncCuentaFuente !== null
  );

  const { cerrarSesionLocal, handleRegistro, handleLogin, handleCambiarPassword } = usePortalAcceso({
    setIniciado,
    setUsuarioActual,
    setRolUsuario,
    setOrigenCuenta,
    setUgrUsuarioCuenta,
    setMostrarAvisoInicio,
    inputUser,
    inputPass,
    registroPass,
    registroConfirmacion,
    setInputUser,
    setInputPass,
    setRegistroPass,
    setRegistroConfirmacion,
    setErrorLogin,
    setEnviandoAcceso,
    usuarioActual,
    userPassChange,
    currentPassChange,
    nuevoUserChange,
    newPassChange,
    setUserPassChange,
    setNuevoUserChange,
    setCurrentPassChange,
    setNewPassChange,
    setMsgPassChange,
    setModalPasswordOpen,
    cargarBD
  });

  const acciones = useTableroAcciones({
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
  });

  const navegarA = (destino: PortalPestana) => {
    setTareaFoco(null);
    setPestana(destino);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };


  if (!iniciado) {
    return (
      <main className="min-h-screen bg-[#0f141c] text-slate-200 flex items-center justify-center">
        <div className="text-center font-medium text-slate-400">
          <span className="text-3xl animate-spin block mb-2">⌛</span>
          Iniciando portal UGR...
        </div>
      </main>
    );
  }

  const {
    materiasDeLaCursada,
    parcialesDeLaCursada,
    cronogramaDeLaCursada,
    horariosDeLaCursada,
    proximoParcial,
    materiaProximoParcial,
    notificaciones,
    horariosProximoParcial,
    diasCalendario,
    claveHoy,
    tareasCalendario,
    eventosDelDiaCalendarioFn,
    ranking,
    rankingPodio,
    restoRanking,
    alumnosDelHistorial,
    parcialesAgrupados,
    alumnosOrdenadosPromocion,
    datosComparacion
  } = armarDerivadosTablero({
    usuarioActual,
    materias,
    parciales,
    horarios,
    cronograma,
    inscripciones,
    notas,
    alumnos,
    novedades,
    avisos,
    mesCalendario,
    materiasMisCursadas,
    materiaRankingVisible,
    alumnoComparar
  });
  const diasPagina = diasDesdeCreacionPortal();
  const marcarNotificacionesVistas = (ids: string[]) => {
    if (!usuarioActual) return;
    marcarNotificacionesVistasEnStorage(usuarioActual, notificacionesVistas, ids, setNotificacionesVistas);
  };
  return (
    <main className="portal-shell min-h-screen bg-[#0f141c]/70 text-slate-200 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:px-6 md:px-10 font-sans selection:bg-cyan-400 selection:text-slate-950">
      <PortalHeader
        usuarioActual={usuarioActual}
        diasPagina={diasPagina}
        periodos={periodos}
        periodoSeleccionado={periodoSeleccionado}
        onPeriodoChange={setPeriodoSeleccionado}
        notificaciones={notificaciones}
        notificacionesVistas={notificacionesVistas}
        notificacionesAbiertas={notificacionesAbiertas}
        onToggleNotificaciones={() => setNotificacionesAbiertas((abiertas) => !abiertas)}
        onMarcarNotificacionesVistas={marcarNotificacionesVistas}
        onNavegarDesdeCampana={(pestanaDestino) => {
          navegarA(pestanaDestino);
          setNotificacionesAbiertas(false);
        }}
        notificacionesRef={notificacionesRef}
        etiquetaMateria={etiquetaMateria}
        accionesSesion={usuarioActual ? (
          <>
            <BarraSesionPortal
              esAdmin={esAdmin}
              onAbrirSyncCuentaUgr={() => setSyncCuentaFuente('ugr')}
              onAbrirSyncCuentaSiu={() => setSyncCuentaFuente('siu')}
              onAbrirPassword={() => {
                setUserPassChange(usuarioActual);
                setNuevoUserChange(usuarioActual);
                setModalPasswordOpen(true);
              }}
              onAbrirSyncUgrAdmin={abrirSyncUGR}
              onAbrirSyncSiuAdmin={abrirSyncSIU}
              onAbrirAdmin={() => navegarA('admin')}
              onSalir={cerrarSesionLocal}
            />
            {syncCuentaFuente && (
              <ModalCuentaSync
                usuario={usuarioActual}
                fuente={syncCuentaFuente}
                onCerrar={() => setSyncCuentaFuente(null)}
                onCompletado={() => { void cargarBD(false); }}
                onInterrumpida={() => { void cargarBD(false); }}
              />
            )}
          </>
        ) : null}
      />

      {usuarioActual && !esAdmin && mostrarAvisoInicio && notificaciones.length > 0 && (
        <div className="max-w-9xl mx-auto mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="text-lg" aria-hidden="true">🔔</span>
          <p className="flex-1">
            {novedades.length > 0
              ? `Hay ${novedades.length} ${novedades.length === 1 ? 'novedad nueva' : 'novedades nuevas'}: se cargaron tareas o parciales.`
              : `Tenés ${notificaciones.length} ${notificaciones.length === 1 ? 'tarea próxima' : 'tareas próximas'} a vencer. Revisá tus recordatorios.`}
          </p>
          <button
            type="button"
            aria-label="Cerrar aviso de tareas próximas a vencer"
            onClick={() => setMostrarAvisoInicio(false)}
            className="text-amber-200 hover:text-white text-lg leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {!usuarioActual ? (
        <PantallaAcceso
          modoAcceso={modoAcceso}
          inputUser={inputUser}
          inputPass={inputPass}
          registroPass={registroPass}
          registroConfirmacion={registroConfirmacion}
          errorLogin={errorLogin}
          enviandoAcceso={enviandoAcceso}
          onCambiarModo={(modo) => {
            setModoAcceso(modo);
            setErrorLogin('');
          }}
          onInputUser={setInputUser}
          onInputPass={setInputPass}
          onRegistroPass={setRegistroPass}
          onRegistroConfirmacion={setRegistroConfirmacion}
          onLogin={handleLogin}
          onRegistro={handleRegistro}
          onAbrirCambioPassword={() => setModalPasswordOpen(true)}
        />
      ) : origenCuenta === 'propio' && materias.length === 0 && !cargando ? (
        <div className="mx-auto mt-6 max-w-9xl space-y-4">
          <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-[#121821] p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Tablero vacío</p>
            <h2 className="mt-2 text-2xl font-black text-white">Todavía no hay cursada</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              La cuenta ya está creada. Materias, tareas, grupos y cronograma aparecen cuando sincronizás con UGR Virtual. Si pasan 7 días sin esa sincronización, la cuenta se borra.
            </p>
          </section>
          <CuentaPropia
            usuario={usuarioActual}
            onCompletado={() => { void cargarBD(true); }}
            onInterrumpida={() => { void cargarBD(true); }}
          />
          <VistaAlumnos
            materias={materias}
            inscripciones={inscripciones}
            alumnos={alumnos}
            registrados={registrados}
            esAdmin={false}
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
        </div>
      ) : (
        <div className="max-w-9xl mx-auto">
          <PortalNav pestana={pestana} onNavegar={navegarA} />

          <PortalVistasCursada
            pestana={pestana}
            cargando={cargando}
            cargarBD={cargarBD}
            esAdmin={esAdmin}
            usuarioActual={usuarioActual}
            materias={materias}
            parciales={parciales}
            notas={notas}
            alumnos={alumnos}
            registrados={registrados}
            inscripciones={inscripciones}
            materiasMisCursadas={materiasMisCursadas}
            materiaRankingVisible={materiaRankingVisible}
            setMateriaRanking={setMateriaRanking}
            proximoParcial={proximoParcial}
            materiaProximoParcial={materiaProximoParcial}
            horariosProximoParcial={horariosProximoParcial}
            ranking={ranking}
            rankingPodio={rankingPodio}
            restoRanking={restoRanking}
            datosComparacion={datosComparacion}
            alumnosDelHistorial={alumnosDelHistorial}
            alumnosOrdenadosPromocion={alumnosOrdenadosPromocion}
            parcialesAgrupados={parcialesAgrupados}
            mesCalendario={mesCalendario}
            setMesCalendario={setMesCalendario}
            diasCalendario={diasCalendario}
            claveHoy={claveHoy}
            tareasCalendario={tareasCalendario}
            eventosDelDiaCalendarioFn={eventosDelDiaCalendarioFn}
            horariosDeLaCursada={horariosDeLaCursada}
            parcialesDeLaCursada={parcialesDeLaCursada}
            cronogramaDeLaCursada={cronogramaDeLaCursada}
            materiasDeLaCursada={materiasDeLaCursada}
            diaCalendarioSeleccionado={diaCalendarioSeleccionado}
            setDiaCalendarioSeleccionado={setDiaCalendarioSeleccionado}
            situacionPropiaAbierta={situacionPropiaAbierta}
            setSituacionPropiaAbierta={setSituacionPropiaAbierta}
            historialPropioAbierto={historialPropioAbierto}
            setHistorialPropioAbierto={setHistorialPropioAbierto}
            alumnosDesplegados={alumnosDesplegados}
            setAlumnosDesplegados={setAlumnosDesplegados}
            materiasDesplegadas={materiasDesplegadas}
            alumnoComparar={alumnoComparar}
            setAlumnoComparar={setAlumnoComparar}
            notasTareasInputs={notasTareasInputs}
            notasDesplegadas={notasDesplegadas}
            notasInputs={notasInputs}
            tareaFoco={tareaFoco}
            tareaFocoVisible={tareaFocoVisible}
            plan={plan}
            planModalAbierto={planModalAbierto}
            setPlanModalAbierto={setPlanModalAbierto}
            progresoPlanEnEdicion={progresoPlanEnEdicion}
            setProgresoPlanEnEdicion={setProgresoPlanEnEdicion}
            materiasSimuladas={materiasSimuladas}
            setMateriasSimuladas={setMateriasSimuladas}
            setCuatrimestreSimulado={setCuatrimestreSimulado}
            setMateriaCondicionesEnEdicion={setMateriaCondicionesEnEdicion}
            setMateriaEnEdicion={setMateriaEnEdicion}
            setTareaEnEdicion={setTareaEnEdicion}
            acciones={acciones}
            adminForms={{
              nuevoAlumnoNombre,
              setNuevoAlumnoNombre,
              nuevoMateriaAnio,
              setNuevoMateriaAnio,
              nuevoMateriaCuatrimestre,
              setNuevoMateriaCuatrimestre,
              nuevaMateriaNombre,
              setNuevaMateriaNombre,
              materiaSel,
              setMateriaSel,
              nombreTarea,
              setNombreTarea,
              unidadTarea,
              setUnidadTarea,
              tipoTarea,
              setTipoTarea,
              tareaConNota,
              setTareaConNota,
              tareaGrupal,
              setTareaGrupal,
              cupoMaximo,
              setCupoMaximo,
              fechaInicio,
              setFechaInicio,
              fechaFin,
              setFechaFin,
              detallesTarea,
              setDetallesTarea,
              materiaParcialSel,
              setMateriaParcialSel,
              nombreParcial,
              setNombreParcial,
              fechaParcial,
              setFechaParcial,
              detallesParcial,
              setDetallesParcial,
              materiaHorarioSel,
              setMateriaHorarioSel,
              diaHorario,
              setDiaHorario,
              horaInicioHorario,
              setHoraInicioHorario,
              horaFinHorario,
              setHoraFinHorario,
              aulaHorario,
              setAulaHorario,
              setAlumnoEnEdicion
            }}
          />
        </div>
      )}

      <PortalModales
        materias={materias}
        etiquetaMateria={etiquetaMateria}
        parcialEnEdicion={parcialEnEdicion}
        materiaParcialSel={materiaParcialSel}
        nombreParcial={nombreParcial}
        fechaParcial={fechaParcial}
        detallesParcial={detallesParcial}
        setMateriaParcialSel={setMateriaParcialSel}
        setNombreParcial={setNombreParcial}
        setFechaParcial={setFechaParcial}
        setDetallesParcial={setDetallesParcial}
        onSubmitParcial={acciones.handleCrearParcial}
        onCerrarParcial={() => {
          setParcialEnEdicion(null);
          setNombreParcial('');
          setFechaParcial('');
          setDetallesParcial('');
        }}
        modalPasswordOpen={modalPasswordOpen}
        usuarioActual={usuarioActual}
        userPassChange={userPassChange}
        nuevoUserChange={nuevoUserChange}
        currentPassChange={currentPassChange}
        newPassChange={newPassChange}
        msgPassChange={msgPassChange}
        onUserPassChange={setUserPassChange}
        onNuevoUserChange={setNuevoUserChange}
        onCurrentPassChange={setCurrentPassChange}
        onNewPassChange={setNewPassChange}
        onSubmitPassword={handleCambiarPassword}
        onCerrarPassword={() => {
          setModalPasswordOpen(false);
          setMsgPassChange({ tipo: '', texto: '' });
        }}
        alumnoEnEdicion={alumnoEnEdicion}
        setAlumnoEnEdicion={setAlumnoEnEdicion}
        onGuardarAlumno={acciones.handleGuardarEdicionAlumno}
        materiaEnEdicion={materiaEnEdicion}
        setMateriaEnEdicion={setMateriaEnEdicion}
        onGuardarMateria={acciones.handleGuardarRenombrarMateria}
        tareaEnEdicion={tareaEnEdicion}
        setTareaEnEdicion={setTareaEnEdicion}
        onGuardarTarea={acciones.handleGuardarEdicionTarea}
        materiaCondicionesEnEdicion={materiaCondicionesEnEdicion}
        setMateriaCondicionesEnEdicion={setMateriaCondicionesEnEdicion}
        onGuardarCondiciones={acciones.handleGuardarCondicionesMateria}
        syncAbierto={syncAbierto}
        syncTipo={syncTipo}
        syncEstado={syncEstado}
        syncMensaje={syncMensaje}
        syncDatos={syncDatos}
        syncSiuDetalle={syncSiuDetalle}
        syncSeleccionados={syncSeleccionados}
        syncAvisosSeleccionados={syncAvisosSeleccionados}
        syncEventosSeleccionados={syncEventosSeleccionados}
        onCerrarSync={cerrarSync}
        onBuscarDeNuevoSync={() => ejecutarSyncUGR(false)}
        onMarcarTodasSync={marcarTodasSync}
        onToggleSyncTarea={toggleSyncTarea}
        onMarcarTodasAvisosSync={marcarTodasAvisosSync}
        onToggleSyncAviso={toggleSyncAviso}
        onToggleSyncEvento={toggleSyncEvento}
        onAplicarCambiosSync={aplicarCambiosSync}
      />
    </main>
  );
}
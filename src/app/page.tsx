'use client';

import { startTransition, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { nombreNotificacionAviso } from '../lib/avisos';
import { alumnosDeLaMateria, materiasQueCursa } from '../lib/companeros';
import {
  validarLoginAction,
  registrarCuentaAction,
  cerrarSesionAction,
  obtenerSesionAction,
  obtenerEstadoCompleto,
  guardarProgresoPlanAction,
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
  cambiarPasswordAction,
  crearParcialAction,
  editarParcialAction,
  eliminarParcialAction,
  guardarNotaParcialAction,
  crearHorarioAction,
  eliminarHorarioAction,
  syncUgrAction,
  type ResumenMateriaSync
} from './actions';
import {
  parcialHabilitado as parcialEstaHabilitado,
  tareaHabilitada as tareaEstaHabilitada
} from './validators';
import {
  type MateriaPlan,
  CUATRIMESTRES_PLAN,
  PLAN_DE_ESTUDIO,
  crearIndicePlan,
  obtenerCorrelativasPendientesSimuladas as obtenerCorrelativasPendientesDelPlan,
  calcularMateriasPriorizadas
} from './plan-utils';

interface TareaDetectada {
  idMoodle: string;
  nombre?: string;
  materiaNombre?: string;
  url?: string;
  unidad?: string | number | null;
  inicio?: string | null;
  fin?: string | null;
  tipo?: string;
}

interface AvisoSync {
  id: string;
  titulo?: string;
  materiaNombre?: string;
  cursoNombre?: string;
  foroNombre?: string;
  fecha?: string;
  contenido?: string;
  url?: string;
}

interface EventoSync {
  avisoId: string;
  titulo?: string;
  fecha?: string;
  tipo?: string;
}

interface SyncResult {
  exito: boolean;
  confirmar?: boolean;
  previaId?: string;
  materiasLocales?: number;
  cursos?: number;
  mapeos?: { id?: string | number; curso?: string; materia?: string }[];
  detectadas: TareaDetectada[];
  avisos: AvisoSync[];
  eventosSugeridos: EventoSync[];
  insertadas: number;
  urlsActualizadas: number;
  avisosAceptados: number;
  eventosInsertados: number;
  eventosCalendarioInsertados?: number;
  horariosInsertados?: number;
  fechasActualizadas?: number;
  parcialesInsertados?: number;
}

interface Periodo {
  id: string;
  anio: number;
  cuatrimestre: number;
  nombre: string;
  activo: number; // 0 o 1
}

interface NotificacionBase {
  id: string;
  tipo: string;
  nombre: string;
  materia: string;
  dias?: number | null;
  url?: string;
}

interface Novedad extends NotificacionBase { }
interface AvisoNovedad extends NotificacionBase { }
interface VencimientoNovedad extends NotificacionBase { }
interface ParcialNovedad extends NotificacionBase { }
interface AperturaNovedad extends NotificacionBase { }
import {
  type Materia,
  type Tarea,
  type Parcial,
  type Nota,
  type Horario,
  type EventoCronograma,
  tareaCompletadaPor,
  fechaEntregaTarea,
  tareaFaltaNota,
  tareaPendienteAlumno,
  formatearFechaDDMMAAAA,
  formatearFechaHora,
  obtenerTimestamp,
  multiplicadorPuntosTarea,
  puntosBaseTarea,
  obtenerFechaParcialEnMs,
  obtenerDiasHastaParcial,
  obtenerDiasHastaFecha,
  obtenerDiasHastaApertura,
  obtenerTextoApertura,
  obtenerIconoMateria,
  etiquetaMateria,
  obtenerDiasHastaTarea,
  ordenarParciales,
  ordenarTareas,
  agruparTareasPorUnidad,
  formatearUnidad,
  esForo,
  calcularEstadoSemaforo,
  tareaPuedeGestionarse,
  obtenerResumenTareasAlumno,
  historialPorAlumno,
  agruparHistorial
} from '../core/cursada';
import VistaPromocion from '../components/VistaPromocion';
import VistaRanking from '../components/VistaRanking';
import VistaParciales from '../components/VistaParciales';
import VistaMaterias from '../components/VistaMaterias';
import VistaAlumnos from '../components/VistaAlumnos';
import VistaPlan from '../components/VistaPlan';
import VistaHorarios from '../components/VistaHorarios';
import VistaHistorial from '../components/VistaHistorial';
import CuentaPropia, { ResumenCursada } from '../components/CuentaPropia';

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
  const [resumenSync, setResumenSync] = useState<ResumenMateriaSync[]>([]);
  const [pestana, setPestana] = useState<'alumnos' | 'materias' | 'plan' | 'parciales' | 'horarios' | 'ranking' | 'promocion' | 'historial' | 'admin'>('alumnos');
  const [cargando, setCargando] = useState<boolean>(true);
  const [iniciado, setIniciado] = useState<boolean>(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState<boolean>(false);
  const [notificacionesVistas, setNotificacionesVistas] = useState<string[]>([]);
  const notificacionesRef = useRef<HTMLDivElement | null>(null);
  const refrescandoRef = useRef<boolean>(false);
  const periodoEspejoRef = useRef(false);
  const pausarRefrescoRef = useRef(false);
  const [mostrarAvisoInicio, setMostrarAvisoInicio] = useState<boolean>(false);
  const [novedades, setNovedades] = useState<Novedad[]>([]);

  // Estado del modal de sincronización con UGR Virtual (solo admin)
  const [syncAbierto, setSyncAbierto] = useState<boolean>(false);
  const [syncEstado, setSyncEstado] = useState<'idle' | 'cargando' | 'listo' | 'error'>('idle');
  const [syncDatos, setSyncDatos] = useState<SyncResult | null>(null);
  const syncEnCurso = useRef<boolean>(false);
  const [syncMensaje, setSyncMensaje] = useState<string>('');
  const [syncCuentaAbierta, setSyncCuentaAbierta] = useState(false);
  const [mensajeSyncCuenta, setMensajeSyncCuenta] = useState('');
  const [syncSeleccionados, setSyncSeleccionados] = useState<Set<string>>(() => new Set());
  const [syncAvisosSeleccionados, setSyncAvisosSeleccionados] = useState<Set<string>>(() => new Set());
  const [syncEventosSeleccionados, setSyncEventosSeleccionados] = useState<Set<string>>(() => new Set());

  // Estado para Parciales y Notas
  const [parciales, setParciales] = useState<Parcial[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [notasInputs, setNotasInputs] = useState<Record<string, string>>({});
  const [notasTareasInputs, setNotasTareasInputs] = useState<Record<string, string>>({});
  const [notasDesplegadas, setNotasDesplegadas] = useState<Record<string, boolean>>({});
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cronograma, setCronograma] = useState<EventoCronograma[]>([]);
  const [progresoPlan, setProgresoPlan] = useState<{ alumno: string | null; materia_codigo: string; estado: string; nota: number | null; actualizado_en: string }[]>([]);
  interface Aviso {
    id: string;
    curso_id: string;
    curso_nombre: string;
    materia_nombre: string;
    foro_nombre: string;
    titulo: string;
    autor: string;
    fecha: string;
    contenido: string;
    url: string;
    estado: string;
  }
  const [avisos, setAvisos] = useState<Aviso[]>([]);
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
  const planDeEstudio = PLAN_DE_ESTUDIO;
  const cuatrimestresPlan = CUATRIMESTRES_PLAN;
  const materiaPlanPorCodigo = crearIndicePlan(planDeEstudio);
  const progresoPlanPorClave = Object.fromEntries(
    progresoPlan.map((registro) => [`${registro.alumno}_${registro.materia_codigo}`, registro])
  );

  const obtenerMateriaPlan = (codigo: string) => materiaPlanPorCodigo[codigo];
  const obtenerProgresoMateria = (alumno: string | null, codigo: string) => progresoPlanPorClave[`${alumno}_${codigo}`];
  const obtenerCorrelativasPendientes = (materia: MateriaPlan, alumno: string | null) => materia.correlativas.filter((correlativa) => {
    const materiaCorrelativa = obtenerMateriaPlan(correlativa);
    if (!materiaCorrelativa) return true;
    const estado = obtenerProgresoMateria(alumno, materiaCorrelativa.codigo)?.estado;
    return !['aprobada', 'promocionada'].includes(estado);
  });

  const materiasAprobadasUsuario = planDeEstudio.filter((materia) => ['aprobada', 'promocionada'].includes(obtenerProgresoMateria(usuarioActual, materia.codigo)?.estado));
  const materiasPendientesUsuario = planDeEstudio.filter((materia) => !materiasAprobadasUsuario.some((aprobada) => aprobada.codigo === materia.codigo));
  const codigosAprobadosSimulados = new Set([...materiasAprobadasUsuario.map((materia) => materia.codigo), ...materiasSimuladas]);
  const cuatrimestreSugerido = cuatrimestresPlan.find((cuatrimestre) => planDeEstudio.some((materia) => (
    materia.cuatrimestre === cuatrimestre && !codigosAprobadosSimulados.has(materia.codigo)
  ))) || cuatrimestresPlan[0];
  const cuatrimestreActivo = cuatrimestreSimulado || cuatrimestreSugerido;
  const materiasDelSimulador = planDeEstudio.filter((materia) => materia.cuatrimestre === cuatrimestreActivo && !codigosAprobadosSimulados.has(materia.codigo));
  const obtenerCorrelativasPendientesSimuladas = (materia: MateriaPlan) => obtenerCorrelativasPendientesDelPlan(materia, codigosAprobadosSimulados, materiaPlanPorCodigo);
  const materiasRecomendadas = materiasDelSimulador.filter((materia) => obtenerCorrelativasPendientesSimuladas(materia).length === 0);
  const materiasExtraDisponibles = materiasPendientesUsuario
    .filter((materia) => materia.cuatrimestre !== cuatrimestreActivo && !codigosAprobadosSimulados.has(materia.codigo))
    .map((materia) => ({
      materia,
      habilita: materiasPendientesUsuario.filter((otra) => otra.codigo !== materia.codigo && otra.correlativas.includes(materia.codigo)).length,
      pendientes: obtenerCorrelativasPendientesSimuladas(materia).length
    }))
    .filter(({ pendientes }) => pendientes === 0)
    .sort((a, b) => b.habilita - a.habilita);
  const materiasPriorizadas = calcularMateriasPriorizadas(planDeEstudio, codigosAprobadosSimulados);


  useEffect(() => {
    document.title = "UGR - Tareas";
  }, []);

  useEffect(() => {
    if (!usuarioActual) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotificacionesVistas([]);
      return;
    }

    const claveVistas = `ugr_novedades_vistas_${encodeURIComponent(usuarioActual)}`;
    try {
      const guardadas = JSON.parse(localStorage.getItem(claveVistas) || '[]');
      setNotificacionesVistas(Array.isArray(guardadas) ? guardadas : []);
    } catch (error) {
      setNotificacionesVistas([]);
    }
  }, [usuarioActual]);

  useEffect(() => {
    if (!notificacionesAbiertas) return undefined;

    const cerrarAlHacerClickAfuera = (evento: PointerEvent) => {
      if (!(evento.target instanceof Node) || !notificacionesRef.current?.contains(evento.target)) {
        setNotificacionesAbiertas(false);
      }
    };

    document.addEventListener('pointerdown', cerrarAlHacerClickAfuera);
    return () => document.removeEventListener('pointerdown', cerrarAlHacerClickAfuera);
  }, [notificacionesAbiertas]);

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

  useEffect(() => {
    if (!usuarioActual || cargando) return;

    const ids = materiasQueCursa(inscripciones, usuarioActual);
    const materiasAvisos = ids.size > 0 ? materias.filter((materia) => ids.has(materia.id)) : materias;
    const parcialesAvisos = ids.size > 0 ? parciales.filter((parcial) => ids.has(parcial.materia_id)) : parciales;
    const tareasActuales = materiasAvisos.flatMap((materia) => materia.tareas.map((tarea) => ({
      id: `tarea-${tarea.id}`,
      tipo: 'nueva-tarea',
      nombre: tarea.nombre,
      materia: materia.nombre
    })));
    const parcialesActuales = parcialesAvisos.map((parcial) => ({
      id: `nuevo-parcial-${parcial.id}`,
      tipo: 'nuevo-parcial',
      nombre: parcial.nombre,
      materia: materiasAvisos.find((materia) => materia.id === parcial.materia_id)?.nombre || 'Materia'
    }));
    const elementosActuales = [...tareasActuales, ...parcialesActuales];
    const claveNovedades = `ugr_novedades_conocidas_${encodeURIComponent(usuarioActual)}`;
    const novedadesGuardadas = localStorage.getItem(claveNovedades);

    if (!novedadesGuardadas) {
      localStorage.setItem(claveNovedades, JSON.stringify(elementosActuales.map((elemento) => elemento.id)));
      return;
    }

    let idsConocidos;
    try {
      idsConocidos = JSON.parse(novedadesGuardadas);
    } catch (error) {
      idsConocidos = [];
    }

    const nuevas = elementosActuales.filter((elemento) => !idsConocidos.includes(elemento.id));
    startTransition(() => {
      setNovedades(nuevas);
    });
    localStorage.setItem(claveNovedades, JSON.stringify(elementosActuales.map((elemento) => elemento.id)));
  }, [usuarioActual, cargando, materias, parciales, inscripciones]);

  // PERSISTENCIA DE SESIÓN
  useEffect(() => {
    let cancelado = false;

    const restaurarSesion = async () => {
      try {
        const sesion = await obtenerSesionAction();
        if (!cancelado && sesion?.usuario) {
          startTransition(() => {
            setUsuarioActual(sesion.usuario);
            setRolUsuario(sesion.rol);
            setOrigenCuenta(sesion.origen || 'comision');
            setUgrUsuarioCuenta(sesion.ugrUsuario || null);
            setMostrarAvisoInicio(true);
          });
        }
      } catch (error) {
        console.error('No se pudo restaurar la sesión:', error);
      } finally {
        if (!cancelado) {
          startTransition(() => {
            setIniciado(true);
          });
        }
      }
    };

    restaurarSesion();
    return () => {
      cancelado = true;
    };
  }, []);

  const iniciarSesionLocal = (usuario: string, rol: string, origen = 'comision', ugrUsuario: string | null = null) => {
    setUsuarioActual(usuario);
    setRolUsuario(rol);
    setOrigenCuenta(origen);
    setUgrUsuarioCuenta(ugrUsuario);
  };

  const cerrarSesionLocal = async () => {
    await cerrarSesionAction();
    setUsuarioActual(null);
    setRolUsuario(null);
    setOrigenCuenta(null);
    setUgrUsuarioCuenta(null);
  };




  // Aplica un estado completo al componente (materias, notas inputs, selections, etc.).
  const aplicarEstado = useCallback((estado: any) => {
    if (!estado) return;

    setPeriodos(estado.periodos || []);
    setMaterias(estado.materias || []);
    setAlumnos(estado.alumnos || []);
    setRegistrados(estado.registrados || estado.alumnos || []);
    setInscripciones(estado.inscripciones || []);
    setParciales(estado.parciales || []);
    setNotas(estado.notas || []);
    setHorarios(estado.horarios || []);
    setCronograma(estado.cronograma || []);
    setProgresoPlan(estado.progresoPlan || []);
    setAvisos(estado.avisos || []);
    if (estado.rol) setRolUsuario(estado.rol);
    if (estado.origen) setOrigenCuenta(estado.origen);
    if ('ugrUsuario' in estado) setUgrUsuarioCuenta(estado.ugrUsuario || null);

    // Inicializar inputs de notas locales
    const mapaNotas: Record<string, string> = {};
    (estado.notas || []).forEach((n: any) => {
      mapaNotas[`${n.parcial_id}_${n.alumno}`] = n.nota;
    });
    setNotasInputs(mapaNotas);

    const mapaNotasTareas: Record<string, string> = {};
    (estado.materias || []).forEach((materia: any) => {
      materia.tareas.forEach((tarea: any) => {
        Object.entries(tarea.notas || {}).forEach(([alumno, nota]) => {
          mapaNotasTareas[`${tarea.id}_${alumno}`] = String(nota);
        });
      });
    });
    setNotasTareasInputs(mapaNotasTareas);

    if (estado.materias && estado.materias.length > 0) {
      setMateriaSel((valorActual) => valorActual || estado.materias[0].id);
      setMateriaParcialSel((valorActual) => valorActual || estado.materias[0].id);
      setMateriaHorarioSel((valorActual) => valorActual || estado.materias[0].id);
      setMateriaRanking((valorActual) => (
        valorActual && estado.materias.some((materia: { id: string }) => materia.id === valorActual)
          ? valorActual
          : estado.materias[0].id
      ));
    }
  }, []);

  const cargarBD = useCallback(async (mostrarCarga = true): Promise<boolean> => {
    if (mostrarCarga) setCargando(true);
    try {
      const estado = await obtenerEstadoCompleto(periodoSeleccionado || undefined);
      if (!estado) return false;

      if (!periodoSeleccionado && estado.periodoActivo) {
        periodoEspejoRef.current = true;
        setPeriodoSeleccionado(estado.periodoActivo);
      }
      aplicarEstado(estado);
      return true;
    } finally {
      if (mostrarCarga) setCargando(false);
    }
  }, [periodoSeleccionado, aplicarEstado]);

  pausarRefrescoRef.current = Boolean(
    modalPasswordOpen || syncAbierto || materiaCondicionesEnEdicion || parcialEnEdicion
    || tareaEnEdicion || materiaEnEdicion || alumnoEnEdicion
    || Object.keys(progresoPlanEnEdicion).length > 0
    || syncCuentaAbierta
  );

  useEffect(() => {
    if (!usuarioActual) {
      periodoEspejoRef.current = false;
      return;
    }
    if (periodoEspejoRef.current) {
      periodoEspejoRef.current = false;
      return;
    }
    // La carga empieza después de autenticar o restaurar una sesión válida.
    cargarBD();
  }, [usuarioActual, cargarBD]);

  useEffect(() => {
    if (!usuarioActual) return undefined;

    let cancelado = false;
    let ultimoRefresco = 0;
    const refrescarSiVisible = async () => {
      const escribiendo = document.activeElement instanceof HTMLInputElement
        || document.activeElement instanceof HTMLTextAreaElement
        || document.activeElement instanceof HTMLSelectElement;
      if (
        cancelado
        || document.visibilityState !== 'visible'
        || refrescandoRef.current
        || pausarRefrescoRef.current
        || escribiendo
        || Date.now() - ultimoRefresco < 15_000
      ) return;

      ultimoRefresco = Date.now();
      refrescandoRef.current = true;
      try {
        const sesionValida = await cargarBD(false);
        if (!cancelado && !sesionValida) {
          setUsuarioActual(null);
          setRolUsuario(null);
          setOrigenCuenta(null);
          setUgrUsuarioCuenta(null);
          setCargando(false);
        }
      } finally {
        refrescandoRef.current = false;
      }
    };

    const intervalo = window.setInterval(refrescarSiVisible, 120_000);
    const alVolverALaPestana = () => {
      if (document.visibilityState === 'visible') refrescarSiVisible();
    };
    document.addEventListener('visibilitychange', alVolverALaPestana);
    window.addEventListener('focus', alVolverALaPestana);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolverALaPestana);
      window.removeEventListener('focus', alVolverALaPestana);
    };
  }, [usuarioActual, cargarBD]);

  const handleRegistro = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorLogin('');
    setEnviandoAcceso(true);
    try {
      const res = await registrarCuentaAction(inputUser, registroPass, registroConfirmacion);
      if (res.exito && res.usuario) {
        iniciarSesionLocal(res.usuario, res.rol || 'alumno', res.origen || 'propio', null);
        setMensajeSyncCuenta(res.mensaje || '');
        setResumenSync(res.resumen || []);
        setInputUser('');
        setRegistroPass('');
        setRegistroConfirmacion('');
        return;
      }
      setErrorLogin(res.mensaje || 'No se pudo crear la cuenta.');
    } finally {
      setEnviandoAcceso(false);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputUser.trim() || !inputPass.trim()) return;
    setEnviandoAcceso(true);
    try {
      const res = await validarLoginAction(inputUser, inputPass);

      if (res.exito && res.usuario) {
        iniciarSesionLocal(res.usuario, res.rol || 'alumno', res.origen || 'comision', res.ugrUsuario || null);
        setMostrarAvisoInicio(true);
        setErrorLogin('');
        setInputUser('');
        setInputPass('');
      } else {
        setErrorLogin(res.mensaje || 'No se pudo iniciar sesión.');
      }
    } finally {
      setEnviandoAcceso(false);
    }
  };

  const handleCambiarPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsgPassChange({ tipo: '', texto: '' });

    const res = await cambiarPasswordAction(userPassChange, currentPassChange, newPassChange);

    if (res.exito) {
      setMsgPassChange({ tipo: 'exito', texto: res.mensaje || 'Contraseña actualizada.' });
      setTimeout(() => {
        setModalPasswordOpen(false);
        setUserPassChange('');
        setCurrentPassChange('');
        setNewPassChange('');
        setMsgPassChange({ tipo: '', texto: '' });
      }, 1500);
    } else {
      setMsgPassChange({ tipo: 'error', texto: res.mensaje || 'No se pudo cambiar la contraseña.' });
    }
  };

  const handleGuardarProgresoPlan = async (alumno: string, materiaCodigo: string, estado: string, nota: string | number = '') => {
    const resultado = await guardarProgresoPlanAction({
      alumno,
      materiaCodigo,
      estado,
      nota
    });
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar el progreso.');
      return;
    }
    setProgresoPlanEnEdicion((actual) => {
      const siguiente = { ...actual };
      delete siguiente[`${alumno}_${materiaCodigo}`];
      return siguiente;
    });
    await cargarBD(false);
  };

  const toggleDesplegarAlumno = (nombreAlumno: string) => {
    setAlumnosDesplegados((prev) => ({
      ...prev,
      [nombreAlumno]: !prev[nombreAlumno]
    }));
  };

  const toggleDesplegarMateria = (materiaId: string) => {
    setMateriasDesplegadas((prev) => ({
      ...prev,
      [materiaId]: !prev[materiaId]
    }));
  };

  // Navega desde "Estado por Alumno" hasta la tarea en "Materias" (scroll + resaltado)
  const irATareaEnMaterias = (tareaId: string) => {
    if (!usuarioActual) return;
    const materia = materias.find((m) => m.tareas.some((t) => t.id === tareaId));
    if (!materia) return;

    const tarea = materia.tareas.find((t) => t.id === tareaId);
    // Si la tarea no es "pendiente" para el usuario actual, en Materias está oculta
    // tras el filtro de completadas: la expandimos para que quede visible.
    if (tarea && !tareaPendienteAlumno(tarea, usuarioActual) && !materiasDesplegadas[materia.id]) {
      setMateriasDesplegadas((prev) => ({ ...prev, [materia.id]: true }));
    }

    setTareaFoco({ materiaId: materia.id, tareaId });
    setTareaFocoVisible(true);
    setPestana('materias');
  };

  // Cambia de sección dejando el scroll arriba del todo (para que al entrar
  // a "Estado por Alumno" siempre se vea la propia situación desde arriba).
  const navegarA = (destino: typeof pestana) => {
    setTareaFoco(null);
    setPestana(destino);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleCrearAlumno = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nuevoAlumnoNombre.trim()) return;
    await crearAlumnoAction(nuevoAlumnoNombre);
    setNuevoAlumnoNombre('');
    await cargarBD();
  };

  const handleGuardarEdicionAlumno = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumnoEnEdicion || !alumnoEnEdicion.nuevoNombre.trim()) return;
    await editarAlumnoAction(alumnoEnEdicion.antiguoNombre, alumnoEnEdicion.nuevoNombre);
    setAlumnoEnEdicion(null);
    await cargarBD();
  };

  const handleEliminarAlumno = async (nombre: string) => {
    if (confirm(`¿Seguro que querés eliminar a "${nombre}" de la lista?`)) {
      const resultado = await eliminarAlumnoAction(nombre);
      if (resultado && "exito" in resultado && !resultado.exito) {
        alert(resultado?.mensaje || 'No se pudo eliminar el alumno.');
        return;
      }
      await cargarBD();
    }
  };

  const handleToggleTarea = async (tareaId: string, alumno: string) => {
    const resultado = await toggleTareaAction(tareaId, alumno);
    if (resultado && "exito" in resultado && !resultado.exito) alert(resultado?.mensaje || 'No se pudo actualizar la entrega.');
    await cargarBD();
  };

  const handleCrearMateria = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nuevaMateriaNombre.trim()) return;
    const resultado = await crearMateriaAction({
      nombre: nuevaMateriaNombre,
      anio: nuevoMateriaAnio,
      cuatrimestre: nuevoMateriaCuatrimestre
    });
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo crear la materia.');
      return;
    }
    setNuevaMateriaNombre('');
    await cargarBD();
  };

  const handleGuardarCondicionesMateria = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!materiaCondicionesEnEdicion) return;
    const resultado = await editarCondicionesMateriaAction({
      ...materiaCondicionesEnEdicion,
      reglaPromocion: materiaCondicionesEnEdicion.reglaPromocion || 'tp_nota',
      usuario: usuarioActual
    });
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudieron guardar las condiciones.');
      return;
    }
    setMateriaCondicionesEnEdicion(null);
    await cargarBD();
  };

  const handleGuardarRenombrarMateria = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!materiaEnEdicion) return;
    await renombrarMateriaAction(materiaEnEdicion.id, materiaEnEdicion.nombre);
    setMateriaEnEdicion(null);
    await cargarBD();
  };

  const handleEliminarMateria = async (id: string, nombre: string) => {
    if (confirm(`¿Seguro que querés eliminar la materia "${nombre}" y sus tareas?`)) {
      const resultado = await eliminarMateriaAction(id);
      if (resultado && "exito" in resultado && !resultado.exito) {
        alert(resultado?.mensaje || 'No se pudo eliminar la materia.');
        return;
      }
      await cargarBD();
    }
  };

  const handleCrearTarea = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nombreTarea.trim() || !materiaSel) return;
    const resultado = await crearTareaAction({
      materiaId: materiaSel,
      nombre: nombreTarea,
      inicio: fechaInicio,
      fin: fechaFin,
      detalles: detallesTarea,
      unidad: unidadTarea,
      conNota: tareaConNota || tipoTarea === 'trabajo_practico',
      grupal: tareaGrupal,
      cupoMaximo: cupoMaximo,
      tipo: tipoTarea
    });
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo crear la tarea.');
      return;
    }
    setNombreTarea('');
    setFechaInicio('');
    setFechaFin('');
    setDetallesTarea('');
    setUnidadTarea('');
    setTareaConNota(false);
    setTareaGrupal(false);
    setCupoMaximo(0);
    setTipoTarea('actividad');
    await cargarBD();
    setPestana('materias');
  };

  const handleGuardarEdicionTarea = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tareaEnEdicion) return;
    const resultado = await editarTareaAction({
      ...tareaEnEdicion.tarea,
      materiaId: tareaEnEdicion.materiaId,
      unidad: tareaEnEdicion.tarea.unidad ?? '',
      detalles: tareaEnEdicion.tarea.detalles ?? '',
      tipo: tareaEnEdicion.tarea.tipo ?? 'actividad',
      grupal: Boolean(tareaEnEdicion.tarea.grupal),
      cupoMaximo: Number(tareaEnEdicion.tarea.cupo_maximo) || 0
    });
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo editar la tarea.');
      return;
    }
    setTareaEnEdicion(null);
    await cargarBD();
  };

  const obtenerEstadoMateria = (materia: Materia, alumno: string): ({ texto: string; estilo: string } | null) => {
    const tareasAbiertas = materia.tareas.filter((tarea) => tareaEstaHabilitada(tarea.inicio));
    const trabajosPracticos = tareasAbiertas.filter((tarea) => tarea.tipo === 'trabajo_practico');
    if (!materia.condiciones && trabajosPracticos.length === 0) return null;
    const estado = (texto: string, estilo: string) => ({ texto, estilo });
    const enCurso = estado('En curso', 'text-amber-300 bg-amber-500/10 border-amber-500/30');
    if (materia.reglaPromocion === 'metodologia') return enCurso;
    const desaprueba = estado('Desaprueba', 'text-red-300 bg-red-500/10 border-red-500/30');
    const regulariza = estado('Regulariza', 'text-blue-300 bg-blue-500/10 border-blue-500/30');
    const promociona = estado('Promociona', 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30');
    const notaDe = (registro: string | number | null | undefined) => Number.parseFloat(String(registro ?? '').replace(',', '.'));
    const notaDeTarea = (tarea: Tarea) => notaDe(tarea.notas?.[alumno]);
    const tareaAprobada = (tarea: Tarea) => {
      if (tarea.conNota || tarea.tipo === 'trabajo_practico') {
        const nota = notaDeTarea(tarea);
        return Number.isFinite(nota) && nota >= 6;
      }
      return tareaCompletadaPor(tarea, alumno);
    };
    const tareaCerrada = (tarea: Tarea) => {
      const dias = obtenerDiasHastaTarea(tarea.fin);
      return Boolean(tarea.fin && tarea.fin !== 'Sin fecha' && dias !== null && dias < 0);
    };
    const todasCerradas = (tareas: Tarea[]) => tareas.length > 0 && tareas.every(tareaCerrada);

    if (materia.reglaPromocion === 'ciberdelitos_parciales') {
      const parcialesMateria = parciales.filter((parcial) => {
        const dias = obtenerDiasHastaFecha(parcial.fecha);
        return parcial.materia_id === materia.id
          && parcial.fecha !== 'Sin fecha'
          && dias !== null
          && dias <= 0;
      });
      const notasParciales = parcialesMateria.map((parcial) => {
        const registro = notas.find((nota) => nota.parcial_id === parcial.id && nota.alumno === alumno);
        return registro ? notaDe(registro.nota) : null;
      });
      const notasValidasParciales = notasParciales.filter((nota): nota is number => nota !== null && Number.isFinite(nota));
      if (notasParciales.length < 2 || notasValidasParciales.length !== notasParciales.length) {
        return notasParciales.length === 2 && parcialesMateria.every((parcial) => {
          const dias = obtenerDiasHastaFecha(parcial.fecha);
          return dias !== null && dias < 0;
        })
          ? desaprueba
          : enCurso;
      }
      if (notasValidasParciales.some((nota) => nota < materia.notaMinimaRegularizar)) return desaprueba;
      return notasValidasParciales.every((nota) => nota >= materia.notaMinimaPromocionar) ? promociona : regulariza;
    }

    if (materia.reglaPromocion === 'activos_porcentaje') {
      const total = tareasAbiertas.length;
      if (total === 0) return estado('Sin actividades', 'text-slate-400 bg-slate-800/60 border-slate-700');
      const completadas = tareasAbiertas.filter(tareaAprobada).length;
      const porcentaje = (completadas / total) * 100;
      if (porcentaje >= materia.notaMinimaPromocionar) return promociona;
      if (porcentaje >= materia.notaMinimaRegularizar) return regulariza;
      return tareasAbiertas.every(tareaCerrada) ? desaprueba : enCurso;
    }

    if (materia.reglaPromocion === 'tp_porcentaje_nota') {
      const total = trabajosPracticos.length;
      if (total === 0) return estado('Sin TPs abiertos', 'text-slate-400 bg-slate-800/60 border-slate-700');
      const completados = trabajosPracticos.filter(tareaAprobada).length;
      const porcentaje = (completados / total) * 100;
      const notasValidas = trabajosPracticos.map(notaDeTarea).filter((nota) => Number.isFinite(nota));
      if (porcentaje >= materia.notaMinimaPromocionar && notasValidas.length === total && notasValidas.every((nota) => nota >= materia.notaMinimaPromocionar)) {
        return promociona;
      }
      if (porcentaje >= materia.notaMinimaRegularizar) return regulariza;
      return trabajosPracticos.every(tareaCerrada) ? desaprueba : enCurso;
    }

    if (trabajosPracticos.length === 0) return tareasAbiertas.length === 0
      ? estado('Sin TPs abiertos', 'text-slate-400 bg-slate-800/60 border-slate-700')
      : estado('Sin TPs cargados', 'text-slate-400 bg-slate-800/60 border-slate-700');
    const notasTp = trabajosPracticos.map((tarea) => {
      const valor = tarea.notas?.[alumno];
      return valor === undefined ? null : notaDe(valor);
    });
    const notasCargadas = notasTp.filter((nota): nota is number => nota !== null && Number.isFinite(nota));
    if (materia.reglaPromocion === 'riesgos_tps') {
      const completados = trabajosPracticos.filter(tareaAprobada).length;
      if (completados < 3) return todasCerradas(trabajosPracticos) ? desaprueba : enCurso;
      if (notasCargadas.length === trabajosPracticos.length && notasCargadas.every((nota) => nota >= materia.notaMinimaPromocionar)) return promociona;
      return regulariza;
    }
    if (notasTp.length !== notasCargadas.length) return todasCerradas(trabajosPracticos) ? desaprueba : enCurso;
    const promedio = notasCargadas.reduce((total, nota) => total + nota, 0) / notasCargadas.length;
    if (notasCargadas.some((nota) => nota < materia.notaMinimaRegularizar) || promedio < materia.notaMinimaRegularizar) return desaprueba;
    return notasCargadas.every((nota) => nota >= materia.notaMinimaPromocionar) && promedio >= materia.notaMinimaPromocionar ? promociona : regulariza;
  };

  const handleEliminarTarea = async (id: string): Promise<void> => {
    if (confirm('¿Seguro que querés borrar esta tarea?')) {
      const resultado = await eliminarTareaAction(id);
      if (resultado && "exito" in resultado && !resultado.exito) {
        alert(resultado?.mensaje || 'No se pudo borrar la tarea.');
        return;
      }
      await cargarBD();
    }
  };

  const ejecutarSyncUGR = async (confirmar = false, ids: string[] = [], idsAvisos: string[] = [], idsEventos: string[] = []): Promise<void> => {
    if (syncEnCurso.current) return;
    syncEnCurso.current = true;
    setSyncEstado('cargando');
    setSyncMensaje('');
    try {
      const res = await syncUgrAction({ confirmar, previaId: syncDatos?.previaId, ids, idsAvisos, idsEventos });
      if (!res || !res.exito || !('detectadas' in res)) {
        setSyncEstado('error');
        setSyncMensaje(res && 'mensaje' in res ? res.mensaje || 'No se pudo sincronizar.' : 'No se pudo sincronizar.');
        return;
      }
      const datos: SyncResult = {
        exito: true,
        confirmar: Boolean(res.confirmar),
        previaId: res.previaId,
        materiasLocales: res.materiasLocales,
        cursos: res.cursos,
        mapeos: res.mapeos,
        detectadas: Array.isArray(res.detectadas) ? res.detectadas as TareaDetectada[] : [],
        avisos: Array.isArray(res.avisos) ? res.avisos as AvisoSync[] : [],
        eventosSugeridos: Array.isArray(res.eventosSugeridos) ? res.eventosSugeridos as EventoSync[] : [],
        insertadas: res.insertadas ?? 0,
        urlsActualizadas: res.urlsActualizadas ?? 0,
        eventosCalendarioInsertados: res.eventosCalendarioInsertados ?? 0,
        horariosInsertados: res.horariosInsertados ?? 0,
        fechasActualizadas: res.fechasActualizadas ?? 0,
        avisosAceptados: res.avisosAceptados ?? 0,
        eventosInsertados: res.eventosInsertados ?? 0
      };
      setSyncDatos(datos);
      setSyncEstado('listo');
      if (!confirmar) {
        // Vista previa: arrancamos con todas las tareas y avisos tildados; los
        // eventos sugeridos asociados a avisos aprobados también vienen tildados.
        setSyncSeleccionados(new Set(datos.detectadas.map((t) => t.idMoodle)));
        setSyncAvisosSeleccionados(new Set(datos.avisos.map((a) => a.id)));
        setSyncEventosSeleccionados(new Set(datos.eventosSugeridos.map((e) => e.avisoId)));
      }
      if (confirmar && (datos.insertadas > 0 || datos.avisosAceptados > 0 || datos.eventosInsertados > 0)) {
        await cargarBD(false);
      }
    } catch (error) {
      setSyncEstado('error');
      setSyncMensaje(error?.message || 'Error inesperado al sincronizar con UGR.');
    } finally {
      syncEnCurso.current = false;
    }
  };

  const toggleSyncTarea = (id: string) => {
    setSyncSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const marcarTodasSync = (marcadas: boolean) => {
    if (!syncDatos) return;
    setSyncSeleccionados(marcadas ? new Set(syncDatos.detectadas.map((t) => t.idMoodle)) : new Set());
  };

  const toggleSyncAviso = (id: string) => {
    setSyncAvisosSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
        // Si destildamos el aviso, su evento sugerido no se agrega al cronograma.
        setSyncEventosSeleccionados((prevEventos) => {
          const nuevosEventos = new Set(prevEventos);
          nuevosEventos.delete(id);
          return nuevosEventos;
        });
      } else {
        nuevo.add(id);
      }
      return nuevo;
    });
  };

  const toggleSyncEvento = (avisoId: string) => {
    setSyncEventosSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(avisoId)) nuevo.delete(avisoId);
      else nuevo.add(avisoId);
      return nuevo;
    });
  };

  const marcarTodasAvisosSync = (marcadas: boolean) => {
    if (!syncDatos) return;
    setSyncAvisosSeleccionados(marcadas ? new Set(syncDatos.avisos.map((a) => a.id)) : new Set());
    if (!marcadas) setSyncEventosSeleccionados(new Set());
  };

  const abrirSyncUGR = () => {
    setSyncAbierto(true);
    if (!syncDatos && !syncEnCurso.current) ejecutarSyncUGR(false);
  };

  const handleNotaTareaChangeLocal = (tareaId: string, alumno: string, valor: string) => {
    setNotasTareasInputs((prev) => ({
      ...prev,
      [`${tareaId}_${alumno}`]: valor
    }));
  };

  const handleGuardarNotaTareaOnBlur = async (tareaId: string, alumno: string): Promise<void> => {
    if (!usuarioActual) return;
    const clave = `${tareaId}_${alumno}`;
    const resultado = await guardarNotaTareaAction(tareaId, alumno, notasTareasInputs[clave] || '', usuarioActual);
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar la nota de la tarea.');
      await cargarBD();
      return;
    }
    await cargarBD();
  };

  const handleCrearHorario = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!materiaHorarioSel || !horaInicioHorario || !horaFinHorario) return;
    if (horaInicioHorario >= horaFinHorario) {
      alert('La hora de inicio debe ser anterior a la hora de finalización.');
      return;
    }

    const resultado = await crearHorarioAction({
      materiaId: materiaHorarioSel,
      dia: diaHorario,
      horaInicio: horaInicioHorario,
      horaFin: horaFinHorario,
      aula: aulaHorario,
      usuario: usuarioActual ?? undefined
    });
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar el horario.');
      return;
    }

    setHoraInicioHorario('');
    setHoraFinHorario('');
    setAulaHorario('');
    await cargarBD();
    setPestana('horarios');
  };

  const handleEliminarHorario = async (id: string): Promise<void> => {
    if (!confirm('¿Seguro que querés borrar este horario?')) return;
    if (!usuarioActual) return;
    const resultado = await eliminarHorarioAction(id, usuarioActual);
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo borrar el horario.');
      return;
    }
    await cargarBD();
  };

  // HANDLERS PARCIALES Y NOTAS
  const handleCrearParcial = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!nombreParcial.trim() || !materiaParcialSel) return;
    if (!usuarioActual) return;
    const datosParcial = {
      materiaId: materiaParcialSel,
      nombre: nombreParcial,
      fecha: fechaParcial,
      detalles: detallesParcial,
      usuario: usuarioActual
    };
    const resultado = parcialEnEdicion
      ? await editarParcialAction({ id: parcialEnEdicion.id, ...datosParcial })
      : await crearParcialAction(datosParcial);

    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar el parcial.');
      return;
    }

    setNombreParcial('');
    setFechaParcial('');
    setDetallesParcial('');
    setParcialEnEdicion(null);
    await cargarBD();
    setPestana('parciales');
  };

  const iniciarEdicionParcial = (parcial: Parcial) => {
    setParcialEnEdicion(parcial);
    setMateriaParcialSel(parcial.materia_id);
    setNombreParcial(parcial.nombre);
    setFechaParcial(parcial.fecha === 'Sin fecha' ? '' : parcial.fecha);
    setDetallesParcial(parcial.detalles === 'Sin observaciones' ? '' : parcial.detalles || '');
    setPestana('admin');
  };

  const handleEliminarParcial = async (id: string): Promise<void> => {
    if (confirm('¿Seguro que querés borrar este parcial y sus notas cargadas?')) {
      if (!usuarioActual) return;
      const resultado = await eliminarParcialAction(id, usuarioActual);
      if (resultado && "exito" in resultado && !resultado.exito) {
        alert(resultado?.mensaje || 'No se pudo borrar el parcial.');
        return;
      }
      await cargarBD();
    }
  };

  const handleNotaChangeLocal = (parcialId: string, alumno: string, valor: string) => {
    setNotasInputs((prev) => ({
      ...prev,
      [`${parcialId}_${alumno}`]: valor
    }));
  };

  const handleGuardarNotaOnBlur = async (parcialId: string, alumno: string): Promise<void> => {
    if (!usuarioActual || (!esAdmin && alumno !== usuarioActual)) return;
    const clave = `${parcialId}_${alumno}`;
    const valor = notasInputs[clave] || '';
    const resultado = await guardarNotaParcialAction(parcialId, alumno, valor, usuarioActual);
    if (resultado && "exito" in resultado && !resultado.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar la nota.');
      await cargarBD();
    }
  };


  const toggleNotasParcial = (parcialId: string) => {
    setNotasDesplegadas((prev) => ({
      ...prev,
      [parcialId]: !prev[parcialId]
    }));
  };

  const toggleTareaDesdeCliente = async (tareaId: string, alumno: string, tarea: Tarea) => {
    if (!tareaEstaHabilitada(tarea.inicio)) {
      alert('La tarea todavía no está habilitada.');
      return;
    }
    await handleToggleTarea(tareaId, alumno);
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

  const restoDeAlumnos = alumnos.filter((a) => a !== usuarioActual);
  const idsCursada = materiasQueCursa(inscripciones, usuarioActual || '');
  const materiasDeLaCursada = idsCursada.size > 0 ? materias.filter((materia) => idsCursada.has(materia.id)) : materias;
  const parcialesDeLaCursada = idsCursada.size > 0 ? parciales.filter((parcial) => idsCursada.has(parcial.materia_id)) : parciales;
  const nombresDeLaCursada = new Set(materiasDeLaCursada.map((materia) => materia.nombre));
  const parcialesOrdenados = ordenarParciales(parcialesDeLaCursada);
  const proximoParcial = parcialesOrdenados.find(
    (parcial) => {
      const ms = obtenerFechaParcialEnMs(parcial.fecha);
      return ms !== null && ms >= new Date().setHours(0, 0, 0, 0);
    }
  );
  const materiaProximoParcial = proximoParcial
    ? materias.find((materia) => materia.id === proximoParcial.materia_id)
    : null;
  const notificaciones: Novedad[] = usuarioActual
    ? ([
      ...novedades,
      // Avisos aprobados de los foros del campus (solo los que el admin publicó).
      ...avisos.filter((aviso) => idsCursada.size === 0 || nombresDeLaCursada.has(aviso.materia_nombre)).map((aviso) => ({
        id: `aviso-${aviso.id}`,
        tipo: 'aviso-nuevo',
        nombre: nombreNotificacionAviso(aviso, cronograma),
        materia: aviso.materia_nombre || aviso.curso_nombre || 'Materia',
        url: aviso.url || ''
      })),
      ...materiasDeLaCursada.flatMap((materia) => materia.tareas
        .map((tarea) => ({ tarea, materia }))
        .filter(({ tarea }) => {
          const dias = obtenerDiasHastaTarea(tarea.fin);
          return dias !== null && dias >= 0 && dias <= 7 && !tareaCompletadaPor(tarea, usuarioActual);
        })
        .map(({ tarea, materia }) => ({
          id: `vencimiento-${tarea.id}`,
          tipo: 'vencimiento',
          nombre: tarea.nombre,
          materia: materia.nombre,
          dias: obtenerDiasHastaTarea(tarea.fin)
        }))),
      ...parcialesDeLaCursada
        .map((parcial) => ({
          id: `parcial-${parcial.id}`,
          tipo: 'parcial',
          nombre: parcial.nombre,
          materia: materiasDeLaCursada.find((materia) => materia.id === parcial.materia_id)?.nombre || 'Materia',
          dias: obtenerDiasHastaFecha(parcial.fecha)
        }))
        .filter(({ dias }) => dias === 1),
      ...materiasDeLaCursada.flatMap((materia) => materia.tareas
        .map((tarea) => ({
          id: `apertura-${tarea.id}`,
          tipo: 'apertura',
          nombre: tarea.nombre,
          materia: materia.nombre,
          dias: obtenerDiasHastaFecha(tarea.inicio)
        }))
        .filter(({ dias }) => dias === 1))
    ] as Novedad[]).sort((a, b) => (a.dias ?? -1) - (b.dias ?? -1) || a.nombre.localeCompare(b.nombre))
    : [];
  const notificacionesNoVistas = notificaciones.filter(
    (notificacion) => !notificacionesVistas.includes(notificacion.id)
  );
  const marcarNotificacionesVistas = (ids: string[]) => {
    if (!usuarioActual || ids.length === 0) return;

    const idsActualizados = [...new Set([...notificacionesVistas, ...ids])];
    setNotificacionesVistas(idsActualizados);
    localStorage.setItem(
      `ugr_novedades_vistas_${encodeURIComponent(usuarioActual)}`,
      JSON.stringify(idsActualizados)
    );
  };
  const horariosProximoParcial = proximoParcial
    ? horarios
      .filter((horario) => horario.materia_id === proximoParcial.materia_id)
      .sort((a, b) => String(a.dia).localeCompare(String(b.dia)) || a.hora_inicio.localeCompare(b.hora_inicio))
    : [];
  const nombresDias: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes'
  };
  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const formatearFechaCalendario = (fecha: string | null | undefined) => {
    if (!fecha || fecha === 'Sin fecha') return null;
    const partes = String(fecha).slice(0, 10).split('-').map(Number);
    if (partes.length !== 3 || partes.some((parte) => !Number.isFinite(parte))) return null;
    return `${partes[0]}-${String(partes[1]).padStart(2, '0')}-${String(partes[2]).padStart(2, '0')}`;
  };
  const obtenerClaveDiaCalendario = (fecha: string | null | undefined) => {
    const fechaNormalizada = formatearFechaCalendario(fecha);
    if (!fechaNormalizada) return null;
    return fechaNormalizada;
  };
  const obtenerDiaSemanaHorario = (fecha: Date) => {
    const diaSemana = fecha.getDay();
    return diaSemana === 0 ? 7 : diaSemana;
  };
  const inicioCursada = new Date(2026, 7, 18);
  const finCursada = new Date(2027, 2, 1);
  const fechaDentroDelCronograma = (fecha: Date) => {
    const fechaNormalizada = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const esRecesoDeEnero = fechaNormalizada.getMonth() === 0;
    return fechaNormalizada >= inicioCursada && fechaNormalizada < finCursada && !esRecesoDeEnero;
  };
  const hoyCalendario = new Date();
  const claveHoyCalendario = `${hoyCalendario.getFullYear()}-${String(hoyCalendario.getMonth() + 1).padStart(2, '0')}-${String(hoyCalendario.getDate()).padStart(2, '0')}`;
  const primerDiaMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1);
  const diasEnMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0).getDate();
  const desplazamientoMes = (primerDiaMes.getDay() + 6) % 7;
  const diasCalendario = Array.from({ length: desplazamientoMes + diasEnMes }, (_, indice) => {
    if (indice < desplazamientoMes) return null;
    return new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), indice - desplazamientoMes + 1);
  });
  const tareasCalendario = materias.flatMap((materia) => materia.tareas.map((tarea) => ({ tarea, materia })));
  const eventosDelDiaCalendario = (fecha: Date | null) => {
    if (!fecha || !fechaDentroDelCronograma(fecha)) return { parciales: [], tareas: [], horarios: [], cronograma: [] };

    const claveDia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    const diaSemana = obtenerDiaSemanaHorario(fecha);

    const eventosCronogramaDia = cronograma.filter((evento) => obtenerClaveDiaCalendario(evento.fecha) === claveDia);
    const materiasSinCursadaDia = new Set(
      eventosCronogramaDia
        // Un evento «sin clases» del cronograma cancela la cursada fija de esa
        // materia ese día (el plan oficial de la materia manda). Las actividades
        // asincrónicas también reemplazan la cursada fija.
        .filter((evento) => evento.modalidad !== 'sincrónico' || evento.tipo === 'sin_clases')
        .map((evento) => evento.materia_id)
    );

    const horariosDelDia = horarios
      .filter((horario) => Number(horario.dia) === diaSemana)
      .filter((horario) => !materiasSinCursadaDia.has(horario.materia_id));
    const porMateria = new Map<string, typeof horariosDelDia>();
    for (const horario of horariosDelDia) {
      const grupo = porMateria.get(horario.materia_id) || [];
      grupo.push(horario);
      porMateria.set(horario.materia_id, grupo);
    }
    const horariosReales = [...porMateria.values()].flatMap((grupo) => {
      const deHoraYMedia = grupo.filter((horario) => {
        const [ha, ma] = String(horario.hora_inicio).split(':').map(Number);
        const [hb, mb] = String(horario.hora_fin).split(':').map(Number);
        return [ha, ma, hb, mb].every(Number.isFinite) && (hb * 60 + mb) - (ha * 60 + ma) === 90;
      });
      return deHoraYMedia.length > 0 ? deHoraYMedia : grupo;
    }).sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)) || String(a.materia_id).localeCompare(String(b.materia_id)));

    return {
      parciales: parciales.filter((parcial) => obtenerClaveDiaCalendario(parcial.fecha) === claveDia),
      tareas: tareasCalendario.filter(({ tarea }) => obtenerClaveDiaCalendario(tarea.fin) === claveDia),
      horarios: horariosReales,
      cronograma: eventosCronogramaDia
    };
  };
  const materiasDelRanking = materias.filter((materia) => materia.id === materiaRanking);
  const alumnosDelRanking = materiaRanking
    ? alumnosDeLaMateria(inscripciones, materiaRanking)
    : [];
  const ranking = (alumnosDelRanking.length > 0 ? alumnosDelRanking : alumnos)
    .map((alumno) => {
      const tareasCompletadas = materiasDelRanking.flatMap((materia) => materia.tareas)
        .filter((tarea) => tareaCompletadaPor(tarea, alumno));
      const foros = tareasCompletadas.filter((tarea) => !tarea.conNota && esForo(tarea.nombre)).length;
      const actividades = tareasCompletadas.filter((tarea) => !tarea.conNota && !esForo(tarea.nombre)).length;
      const notasTareasAlumno = tareasCompletadas
        .filter((tarea) => tarea.conNota)
        .filter((tarea) => {
          const nota = puntosBaseTarea(tarea, alumno);
          return Number.isFinite(nota) && nota >= 1 && nota <= 10;
        })
        .map((tarea) => puntosBaseTarea(tarea, alumno) * multiplicadorPuntosTarea(tarea, alumno));
      const puntosActividades = tareasCompletadas
        .filter((tarea) => !tarea.conNota)
        .reduce((total, tarea) => total + puntosBaseTarea(tarea, alumno) * multiplicadorPuntosTarea(tarea, alumno), 0);
      const notasAlumno = notas
        .filter((nota) => nota.alumno === alumno)
        .filter((nota) => {
          const parcial = parciales.find((item) => item.id === nota.parcial_id);
          return materiasDelRanking.some((materia) => materia.id === parcial?.materia_id);
        })
        .map((nota) => Number.parseFloat(String(nota.nota).replace(',', '.')))
        .filter((nota) => Number.isFinite(nota) && nota >= 0 && nota <= 10);
      const tareasConPuntaje = materiasDelRanking.flatMap((materia) => materia.tareas
        .filter((tarea) => tareaCompletadaPor(tarea, alumno))
        .map((tarea) => ({
          alumno,
          materia: materia.nombre,
          nombre: tarea.nombre,
          fechaCarga: fechaEntregaTarea(tarea, alumno),
          puntos: puntosBaseTarea(tarea, alumno) * multiplicadorPuntosTarea(tarea, alumno),
          puntosBase: puntosBaseTarea(tarea, alumno),
          tipo: tarea.conNota ? 'Nota de tarea' : esForo(tarea.nombre) ? 'Foro' : 'Actividad'
        }))
        .filter((tarea) => tarea.puntosBase >= (tarea.tipo === 'Nota de tarea' ? 1 : 0) && tarea.puntosBase <= (tarea.tipo === 'Nota de tarea' ? 10 : 2)));
      const parcialesConPuntaje = notas
        .filter((nota) => nota.alumno === alumno)
        .map((nota) => {
          const parcial = parciales.find((item) => item.id === nota.parcial_id);
          const valor = Number.parseFloat(String(nota.nota).replace(',', '.'));
          return {
            nombre: parcial?.nombre || 'Parcial',
            materia: materias.find((materia) => materia.id === parcial?.materia_id)?.nombre || 'Materia',
            puntos: valor / 10,
            nota: valor
          };
        })
        .filter((parcial) => materiasDelRanking.some((materia) => materia.nombre === parcial.materia))
        .filter((parcial) => Number.isFinite(parcial.nota) && parcial.nota >= 0 && parcial.nota <= 10);
      const ultimaCompletadaEn = tareasCompletadas
        .map((tarea) => fechaEntregaTarea(tarea, alumno))
        .map(obtenerTimestamp)
        .filter((fecha) => fecha !== null)
        .sort((a, b) => b - a)[0] || Number.MAX_SAFE_INTEGER;

      return {
        alumno,
        puntos: puntosActividades + notasAlumno.reduce((total, nota) => total + nota / 10, 0) + notasTareasAlumno.reduce((total, nota) => total + nota, 0),
        foros,
        actividades,
        tareasConPuntaje,
        parcialesConPuntaje,
        ultimaCompletadaEn
      };
    })
    .sort((a, b) => b.puntos - a.puntos || a.ultimaCompletadaEn - b.ultimaCompletadaEn || b.actividades - a.actividades || a.alumno.localeCompare(b.alumno));
  const rankingPodio = ranking.slice(0, 3);
  const restoRanking = ranking.slice(3);
  const puntosUsuarioHistorial = ranking.find((item) => item.alumno === usuarioActual)?.puntos ?? 0;
  const alumnosDelHistorial = usuarioActual
    ? [
      usuarioActual,
      ...restoDeAlumnos.sort((alumnoA, alumnoB) => {
        const puntosA = ranking.find((item) => item.alumno === alumnoA)?.puntos ?? 0;
        const puntosB = ranking.find((item) => item.alumno === alumnoB)?.puntos ?? 0;
        const empateA = Math.abs(puntosA - puntosUsuarioHistorial) < 0.0001;
        const empateB = Math.abs(puntosB - puntosUsuarioHistorial) < 0.0001;
        return Number(empateB) - Number(empateA)
          || Math.abs(puntosA - puntosUsuarioHistorial) - Math.abs(puntosB - puntosUsuarioHistorial)
          || puntosB - puntosA
          || alumnoA.localeCompare(alumnoB);
      })
    ]
    : alumnos;
  const datosComparacion = alumnoComparar && usuarioActual
    ? (() => {
      const usuarioRanking = ranking.find((item) => item.alumno === usuarioActual);
      const comparadoRanking = ranking.find((item) => item.alumno === alumnoComparar);
      if (!usuarioRanking || !comparadoRanking) return null;

      const historialUsuario = historialPorAlumno(usuarioActual, materias, notas, parciales);
      const historialComparado = historialPorAlumno(alumnoComparar, materias, notas, parciales);
      const diferenciaPuntos = usuarioRanking.puntos - comparadoRanking.puntos;
      const puntosEmpatados = Math.abs(diferenciaPuntos) < 0.0001;
      const ultimaTareaUsuario = historialUsuario.find((registro) => obtenerTimestamp(registro.fecha) !== null);
      const ultimaTareaComparado = historialComparado.find((registro) => obtenerTimestamp(registro.fecha) !== null);
      const razonesPuntos: { id: string; texto: string; diferencia: number }[] = [];
      const registrosPorClave = new Map<string, Record<string, { alumno?: string; materia: string; nombre: string; puntos?: number }>>();

      [...usuarioRanking.tareasConPuntaje, ...comparadoRanking.tareasConPuntaje].forEach((registro) => {
        const clave = `tarea-${registro.materia}-${registro.nombre}`;
        const registros = registrosPorClave.get(clave) || {};
        registros[registro.alumno || ''] = registro;
        registrosPorClave.set(clave, registros);
      });

      usuarioRanking.parcialesConPuntaje.forEach((registro) => {
        const clave = `parcial-${registro.materia}-${registro.nombre}`;
        const registros = registrosPorClave.get(clave) || {};
        registros[usuarioActual] = registro;
        registrosPorClave.set(clave, registros);
      });
      comparadoRanking.parcialesConPuntaje.forEach((registro) => {
        const clave = `parcial-${registro.materia}-${registro.nombre}`;
        const registros = registrosPorClave.get(clave) || {};
        registros[alumnoComparar] = registro;
        registrosPorClave.set(clave, registros);
      });

      registrosPorClave.forEach((registros) => {
        const registroUsuario = registros[usuarioActual];
        const registroComparado = registros[alumnoComparar];
        const puntosUsuario = registroUsuario?.puntos || 0;
        const puntosComparado = registroComparado?.puntos || 0;
        const diferencia = puntosUsuario - puntosComparado;
        if (Math.abs(diferencia) < 0.0001) return;

        const registro = registroUsuario || registroComparado;
        razonesPuntos.push({
          id: `${registro.materia}-${registro.nombre}`,
          texto: registroUsuario && registroComparado
            ? `${registro.materia}: ${registro.nombre} aporta ${puntosUsuario.toFixed(1)} vs. ${puntosComparado.toFixed(1)} puntos.`
            : `${registro.materia}: ${registro.nombre} aporta ${registroUsuario ? puntosUsuario.toFixed(1) : '0.0'} vs. ${registroComparado ? puntosComparado.toFixed(1) : '0.0'} puntos porque solo lo tiene registrado ${registroUsuario ? usuarioActual : alumnoComparar}.`,
          diferencia
        });
      });

      razonesPuntos.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
      let motivo;

      if (!puntosEmpatados) {
        const ganador = diferenciaPuntos > 0 ? usuarioActual : alumnoComparar;
        motivo = `${ganador} está arriba por ${Math.abs(diferenciaPuntos).toFixed(1)} puntos.`;
      } else if (usuarioRanking.ultimaCompletadaEn !== comparadoRanking.ultimaCompletadaEn) {
        const ganador = usuarioRanking.ultimaCompletadaEn < comparadoRanking.ultimaCompletadaEn
          ? usuarioActual
          : alumnoComparar;
        const fechaGanador = ganador === usuarioActual
          ? usuarioRanking.ultimaCompletadaEn
          : comparadoRanking.ultimaCompletadaEn;
        motivo = `${ganador} queda primero porque su última tarea registrada fue realizada antes: ${formatearFechaHora(new Date(fechaGanador).toISOString())}.`;
      } else if (usuarioRanking.actividades !== comparadoRanking.actividades) {
        const ganador = usuarioRanking.actividades > comparadoRanking.actividades ? usuarioActual : alumnoComparar;
        motivo = `${ganador} queda primero porque tiene más actividades completas (${Math.max(usuarioRanking.actividades, comparadoRanking.actividades)} contra ${Math.min(usuarioRanking.actividades, comparadoRanking.actividades)}).`;
      } else {
        motivo = `Empatan también en el desempate por fecha y cantidad de actividades; el orden actual se define por nombre.`;
      }

      return {
        usuarioRanking,
        comparadoRanking,
        historialUsuario,
        historialComparado,
        ultimaTareaUsuario,
        ultimaTareaComparado,
        puntosEmpatados,
        motivo,
        diferenciaPuntos,
        razonesPuntos
      };
    })()
    : null;
  const parcialesAgrupados = parcialesOrdenados.reduce<{ id: string; nombre: string; parciales: Parcial[] }[]>((grupos, parcial) => {
    const materia = materias.find((item) => item.id === parcial.materia_id);
    const claveMateria = parcial.materia_id || 'sin-materia';
    const grupoExistente = grupos.find((grupo) => grupo.id === claveMateria);

    if (grupoExistente) {
      grupoExistente.parciales.push(parcial);
    } else {
      grupos.push({
        id: claveMateria,
        nombre: materia ? materia.nombre : 'MATERIA NO DISPONIBLE',
        parciales: [parcial]
      });
    }

    return grupos;
  }, []);
  const alumnosOrdenadosPromocion = usuarioActual
    ? [usuarioActual, ...alumnos.filter((alumno) => alumno !== usuarioActual)]
    : alumnos;
  const fechaCreacionPagina = new Date(2026, 7, 24);
  const diasPagina = Math.max(0, Math.floor((Date.now() - fechaCreacionPagina.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <main className="portal-shell min-h-screen bg-[#0f141c]/70 text-slate-200 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:px-6 md:px-10 font-sans selection:bg-cyan-400 selection:text-slate-950">
      <header className="portal-header max-w-9xl mx-auto mb-4 border border-t-0 p-4 sm:p-5 rounded-b-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="min-w-0 w-full">
          <p className="portal-kicker mb-3">Portal de cursada · UGR</p>
          <div className="flex items-start sm:items-center gap-3 mb-1">
            <span className="text-2xl shrink-0" aria-hidden="true">✦</span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              UGR - Tareas y Parciales
            </h1>
            <span className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
              {diasPagina} {diasPagina === 1 ? 'día' : 'días'}
            </span>
          </div>
          <p className="text-sm sm:text-base text-slate-400 flex items-center gap-2 mt-1">
            {usuarioActual ? (
              <>
                <span>Alumno activo:</span>
                <strong className="text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-lg text-sm sm:text-base">
                  {usuarioActual}
                </strong>
              </>
            ) : (
              ''
            )}
          </p>
          {usuarioActual && periodos.length > 0 && (
            <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Período
              <select
                value={periodoSeleccionado}
                onChange={(evento) => setPeriodoSeleccionado(evento.target.value)}
                className="rounded-lg border border-cyan-500/30 bg-[#0f141c] px-3 py-2 text-xs font-semibold normal-case tracking-normal text-cyan-200 outline-none focus:border-cyan-400"
              >
                {periodos.map((periodo) => (
                  <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {usuarioActual && (
          <div className="portal-header-actions flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            <div ref={notificacionesRef} className="relative">
              <button
                type="button"
                aria-label={`Notificaciones${notificacionesNoVistas.length ? ` (${notificacionesNoVistas.length} sin ver)` : ''}`}
                aria-expanded={notificacionesAbiertas}
                onClick={() => setNotificacionesAbiertas((abiertas) => !abiertas)}
                className="relative bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-2.5 rounded-xl text-lg transition-all cursor-pointer"
              >
                🔔
                {notificacionesNoVistas.length > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#161c26]">
                    {notificacionesNoVistas.length > 9 ? '9+' : notificacionesNoVistas.length}
                  </span>
                )}
              </button>
              {notificacionesAbiertas && (
                <div className="absolute right-0 top-14 z-50 w-[calc(100vw-2rem)] max-w-80 bg-[#161c26] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <p className="text-sm font-bold text-white">Recordatorios</p>
                    <button
                      type="button"
                      disabled={notificacionesNoVistas.length === 0}
                      onClick={() => marcarNotificacionesVistas(notificaciones.map((notificacion) => notificacion.id))}
                      className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-100 disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Marcar vistas
                    </button>
                  </div>
                  {notificaciones.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-slate-400">No tenés recordatorios pendientes.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                      {notificaciones.map((notificacion) => {
                        const texto = notificacion.tipo === 'parcial'
                          ? 'Rendís mañana'
                          : notificacion.tipo === 'nuevo-parcial'
                            ? 'Nuevo parcial cargado'
                            : notificacion.tipo === 'nueva-tarea'
                              ? 'Nueva tarea cargada'
                              : notificacion.tipo === 'aviso-nuevo'
                                ? 'Aviso en el campus'
                          : notificacion.tipo === 'apertura'
                            ? 'Se habilita mañana'
                            : notificacion.dias === 0
                              ? 'Vence hoy'
                              : `Vence en ${notificacion.dias} ${notificacion.dias === 1 ? 'día' : 'días'}`;
                        return (
                          <div key={notificacion.id} className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                marcarNotificacionesVistas([notificacion.id]);
                                navegarA(['parcial', 'nuevo-parcial'].includes(notificacion.tipo) ? 'parciales' : notificacion.tipo === 'aviso-nuevo' ? 'horarios' : 'materias');
                                setNotificacionesAbiertas(false);
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-800/70 transition-colors cursor-pointer ${notificacionesVistas.includes(notificacion.id) ? 'opacity-60' : ''}`}
                            >
                              <p className="text-sm font-semibold text-slate-100 truncate">{notificacion.nombre}</p>
                              <p className="text-xs text-slate-400 mt-1">{etiquetaMateria(notificacion.materia)}</p>
                              <p className={`text-xs font-bold mt-2 ${notificacion.tipo === 'vencimiento' && (notificacion.dias ?? 99) <= 2 ? 'text-red-300' : 'text-amber-300'}`}>
                                {texto}
                              </p>
                            </button>
                            {notificacion.url && (
                              <a
                                href={notificacion.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir el anuncio en UGR Virtual"
                                className="absolute top-2 right-2 text-[11px] font-semibold text-blue-300 hover:text-blue-100 hover:underline"
                              >
                                UGR ↗
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setUserPassChange(usuarioActual);
                setModalPasswordOpen(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              🔑 Cambiar Clave
            </button>
            {usuarioActual && !esAdmin && (
              <button
                type="button"
                onClick={() => setSyncCuentaAbierta(true)}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Sincronizar UGR
              </button>
            )}
            {mensajeSyncCuenta && (
              <span className="self-center text-xs text-slate-400 max-w-[16rem] truncate" title={mensajeSyncCuenta}>{mensajeSyncCuenta}</span>
            )}
            {syncCuentaAbierta && (
              <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <CuentaPropia
                  usuario={usuarioActual}
                  onCerrar={() => setSyncCuentaAbierta(false)}
                  onSincronizada={(mensaje, resumen) => {
                    setMensajeSyncCuenta(mensaje);
                    setResumenSync(resumen || []);
                    void cargarBD(false);
                  }}
                />
              </div>
            )}
            {esAdmin && (
              <button
                onClick={abrirSyncUGR}
                title="Busca tareas nuevas en UGR Virtual y las carga en la página"
                className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                🔄 Sincronizar UGR
              </button>
            )}
            {esAdmin && (
              <button
                onClick={() => navegarA('admin')}
                className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                ⚙️ Panel de Carga
              </button>
            )}
            <button
              onClick={cerrarSesionLocal}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>🚪</span> Salir
            </button>
          </div>
        )}
      </header>

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
        /* CARD LOGIN */
        <div className="portal-login max-w-md mx-auto mt-8 border rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="portal-login-mark inline-block p-4 rounded-2xl mb-6 text-4xl bg-gradient-to-br from-cyan-500/20 to-amber-500/10 border border-cyan-400/30">
              <svg className="h-10 w-10 text-cyan-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="portal-kicker mb-2">Acceso personal</p>
            <h2 className="text-3xl font-black text-white mb-2 bg-gradient-to-r from-cyan-300 via-white to-amber-300 bg-clip-text text-transparent">{modoAcceso === 'registro' ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
            <p className="text-sm text-slate-400 mt-3 max-w-xs mx-auto leading-relaxed">
              {modoAcceso === 'registro'
                ? 'Elegí un usuario que no esté usado y tu clave. El tablero queda vacío hasta que sincronices con UGR Virtual. Si pasan 7 días sin sincronizar, la cuenta se borra. El DNI y la clave del campus se piden en ese momento y no se guardan.'
                : 'Tu tablero para seguir la cursada sin perder el hilo.'}
            </p>
            <div className="portal-login-meta mt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span>2° cuatrimestre</span>
              <span aria-hidden="true">·</span>
              <span>2026</span>
            </div>
          </div>
          
          <form onSubmit={modoAcceso === 'registro' ? handleRegistro : handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Usuario</label>
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={inputUser}
                onChange={(e) => setInputUser(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={modoAcceso === 'registro' ? registroPass : inputPass}
                onChange={(e) => (modoAcceso === 'registro' ? setRegistroPass(e.target.value) : setInputPass(e.target.value))}
                className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
              />
            </div>
            {modoAcceso === 'registro' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Repetir contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={registroConfirmacion}
                  onChange={(e) => setRegistroConfirmacion(e.target.value)}
                  className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
                />
              </div>
            )}
            {errorLogin && (
              <p className="text-sm text-red-400 text-center bg-red-950/30 border border-red-900/30 p-3 rounded-lg">
                ⚠️ {errorLogin}
              </p>
            )}
            
            <button
              type="submit"
              disabled={enviandoAcceso}
              className="portal-login-button w-full font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {enviandoAcceso
                ? (modoAcceso === 'registro' ? 'Creando cuenta…' : 'Entrando…')
                : (modoAcceso === 'registro' ? 'Crear cuenta' : 'Entrar')}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-800/80 pt-4 space-y-3">
            <button
              type="button"
              onClick={() => {
                setModoAcceso(modoAcceso === 'registro' ? 'login' : 'registro');
                setErrorLogin('');
              }}
              className="block w-full text-xs text-cyan-300 hover:text-cyan-200 underline font-medium cursor-pointer"
            >
              {modoAcceso === 'registro' ? 'Ya tengo cuenta' : 'Crear una cuenta propia'}
            </button>
            <button
              type="button"
              onClick={() => setModalPasswordOpen(true)}
              className="text-xs text-cyan-300 hover:text-cyan-200 underline font-medium cursor-pointer"
            >
              🔐 Modificar o cambiar mi contraseña
            </button>
          </div>
        </div>
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
            onSincronizada={(mensaje, resumen) => {
              setMensajeSyncCuenta(mensaje);
              setResumenSync(resumen || []);
              void cargarBD(true);
            }}
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
            toggleDesplegarAlumno={toggleDesplegarAlumno}
            toggleTareaDesdeCliente={toggleTareaDesdeCliente}
            irATareaEnMaterias={irATareaEnMaterias}
            notasTareasInputs={notasTareasInputs}
            handleNotaTareaChangeLocal={handleNotaTareaChangeLocal}
            handleGuardarNotaTareaOnBlur={handleGuardarNotaTareaOnBlur}
          />
        </div>
      ) : (
        <div className="max-w-9xl mx-auto">
          {resumenSync.length > 0 && (
            <section className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-cyan-200">Resultado de la sincronización</p>
                  {mensajeSyncCuenta && <p className="mt-1 text-sm text-slate-300">{mensajeSyncCuenta}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setResumenSync([])}
                  className="text-slate-400 hover:text-white text-lg leading-none cursor-pointer"
                  aria-label="Cerrar resumen de sincronización"
                >
                  ×
                </button>
              </div>
              <ResumenCursada resumen={resumenSync} />
            </section>
          )}
          {/* NAVEGACIÓN */}
          <div className="portal-nav sticky top-0 z-40 -mx-3 px-3 py-3 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 mb-6 sm:mb-8 border-b shadow-lg backdrop-blur-sm flex flex-nowrap gap-2 sm:gap-3 overflow-x-auto">
            <button
              onClick={() => navegarA('alumnos')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'alumnos'
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>👥</span> <span className="sm:hidden">Estado</span><span className="hidden sm:inline">Estado por Alumno</span>
            </button>
            <button
              onClick={() => navegarA('materias')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'materias'
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>📚</span> Materias
            </button>
            <button
              onClick={() => navegarA('horarios')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'horarios'
                  ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🗓️</span> Cronograma
            </button>
            <button
              onClick={() => navegarA('plan')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'plan'
                  ? 'bg-amber-600/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🧭</span> <span className="sm:hidden">Plan</span><span className="hidden sm:inline">Plan de estudio</span>
            </button>
            <button
              onClick={() => navegarA('promocion')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'promocion'
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🎯</span> Promoción
            </button>

            <button
              onClick={() => navegarA('historial')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'historial'
                  ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🕘</span> Historial
            </button>

            <button
              onClick={() => navegarA('parciales')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'parciales'
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>📋</span> Parciales
            </button>

            <button
              onClick={() => navegarA('ranking')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'ranking'
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🏆</span> Ranking
            </button>

            <a
              href="https://drive.google.com/drive/folders/1DdVDpLcRHGLk19XnbICzCtVxw8xbo9Vg?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-slate-800 bg-[#161c26] text-slate-400 hover:bg-slate-800/60 hover:text-white"
            >
              <span>📁</span> Drive
            </a>

          </div>

          {cargando ? (
            <div className="text-center py-20 text-slate-400 text-sm font-medium flex flex-col items-center gap-3">
              <span className="text-3xl animate-spin">⌛</span>
              Cargando datos de la cursada...
            </div>
          ) : (
            <>
              {pestana === 'alumnos' && (
                <div className={`grid grid-cols-1 ${proximoParcial ? 'xl:grid-cols-[280px_minmax(0,1fr)]' : ''} gap-6 items-start`}>
                  {proximoParcial && (
                    <aside className="xl:sticky xl:top-6 bg-purple-950/20 border border-purple-500/30 rounded-2xl p-5 shadow-sm">
                      <p className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-4">Próximo examen</p>
                      <div className="space-y-2">
                        <h2 className="text-lg font-bold text-white leading-snug">{proximoParcial.nombre}</h2>
                        <p className="text-sm text-purple-200 leading-relaxed">
                          {etiquetaMateria(materiaProximoParcial?.nombre || 'Materia')}
                        </p>
                        <p className="text-xs font-semibold text-purple-300 border-t border-purple-500/20 pt-3">
                          Fecha: {formatearFechaDDMMAAAA(proximoParcial.fecha)}
                        </p>
                        {proximoParcial.url && (
                          <a
                            href={proximoParcial.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir el parcial en UGR Virtual"
                            className="text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline mt-2 inline-block"
                          >
                            Ver en UGR ↗
                          </a>
                        )}
                        <div className="border-t border-purple-500/20 pt-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">Cursada</p>
                          {horariosProximoParcial.length === 0 ? (
                            <p className="text-xs text-purple-200/70">Horario no cargado</p>
                          ) : (
                            <div className="space-y-2">
                              {horariosProximoParcial.map((horario) => (
                                <div key={horario.id} className="text-xs text-purple-100">
                                  <p className="font-bold">{nombresDias[Number(horario.dia)] || `Día ${horario.dia}`}</p>
                                  <p className="text-purple-200">
                                    {horario.hora_inicio} - {horario.hora_fin}
                                    {horario.aula ? ` · Aula ${horario.aula}` : ''}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {(() => {
                          const diasHastaParcial = obtenerDiasHastaParcial(proximoParcial.fecha);
                          return diasHastaParcial === null ? null : (
                            <p className="text-sm font-bold text-amber-300 pt-2">
                              {diasHastaParcial === 0 ? 'Es hoy' : `Faltan ${diasHastaParcial} días`}
                            </p>
                          );
                        })()}
                      </div>
                    </aside>
                  )}

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
                    toggleDesplegarAlumno={toggleDesplegarAlumno}
                    toggleTareaDesdeCliente={toggleTareaDesdeCliente}
                    irATareaEnMaterias={irATareaEnMaterias}
                    notasTareasInputs={notasTareasInputs}
                    handleNotaTareaChangeLocal={handleNotaTareaChangeLocal}
                    handleGuardarNotaTareaOnBlur={handleGuardarNotaTareaOnBlur}
                  />

                </div>
              )}

              {/* VISTA 2: MATERIAS */}
              {pestana === 'materias' && (
                <VistaMaterias
                  recargar={cargarBD}
                  materias={materias}
                  inscripciones={inscripciones}
                  alumnos={alumnos}
                  usuarioActual={usuarioActual}
                  esAdmin={esAdmin}
                  materiasDesplegadas={materiasDesplegadas}
                  toggleDesplegarMateria={toggleDesplegarMateria}
                  setMateriaCondicionesEnEdicion={setMateriaCondicionesEnEdicion}
                  setMateriaEnEdicion={setMateriaEnEdicion}
                  handleEliminarMateria={handleEliminarMateria}
                  setTareaEnEdicion={setTareaEnEdicion}
                  handleEliminarTarea={handleEliminarTarea}
                  toggleTareaDesdeCliente={toggleTareaDesdeCliente}
                  handleToggleTarea={handleToggleTarea}
                  notasTareasInputs={notasTareasInputs}
                  handleNotaTareaChangeLocal={handleNotaTareaChangeLocal}
                  handleGuardarNotaTareaOnBlur={handleGuardarNotaTareaOnBlur}
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
                  obtenerEstadoMateria={obtenerEstadoMateria}
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
                  planDeEstudio={planDeEstudio}
                  cuatrimestresPlan={cuatrimestresPlan}
                  alumnos={alumnos}
                  usuarioActual={usuarioActual}
                  esAdmin={esAdmin}
                  planModalAbierto={planModalAbierto}
                  setPlanModalAbierto={setPlanModalAbierto}
                  obtenerCorrelativasPendientes={obtenerCorrelativasPendientes}
                  obtenerMateriaPlan={obtenerMateriaPlan}
                  obtenerCorrelativasPendientesSimuladas={obtenerCorrelativasPendientesSimuladas}
                  obtenerProgresoMateria={obtenerProgresoMateria}
                  progresoPlanEnEdicion={progresoPlanEnEdicion}
                  setProgresoPlanEnEdicion={setProgresoPlanEnEdicion}
                  handleGuardarProgresoPlan={handleGuardarProgresoPlan}
                  materiasAprobadasUsuario={materiasAprobadasUsuario}
                  materiasPendientesUsuario={materiasPendientesUsuario}
                  materiasSimuladas={materiasSimuladas}
                  setMateriasSimuladas={setMateriasSimuladas}
                  cuatrimestreActivo={cuatrimestreActivo}
                  setCuatrimestreSimulado={setCuatrimestreSimulado}
                  cuatrimestreSugerido={cuatrimestreSugerido}
                  materiasDelSimulador={materiasDelSimulador}
                  materiasRecomendadas={materiasRecomendadas}
                  materiasExtraDisponibles={materiasExtraDisponibles}
                  materiasPriorizadas={materiasPriorizadas}
                />
              )}

              {/* VISTA NUEVA: PARCIALES Y NOTAS */}
              {pestana === 'parciales' && (
                <VistaParciales
                  parciales={parciales}
                  parcialesAgrupados={parcialesAgrupados}
                  esAdmin={esAdmin}
                  usuarioActual={usuarioActual}
                  alumnos={alumnos}
                  iniciarEdicionParcial={iniciarEdicionParcial}
                  handleEliminarParcial={handleEliminarParcial}
                  toggleNotasParcial={toggleNotasParcial}
                  notasDesplegadas={notasDesplegadas}
                  notasInputs={notasInputs}
                  handleNotaChangeLocal={handleNotaChangeLocal}
                  handleGuardarNotaOnBlur={handleGuardarNotaOnBlur}
                />
              )}

              {pestana === 'ranking' && (
                <VistaRanking
                  materias={materias}
                  usuarioActual={usuarioActual}
                  materiaRanking={materiaRanking}
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
                  horarios={horarios}
                  parciales={parciales}
                  tareasCalendario={tareasCalendario}
                  cronograma={cronograma}
                  materias={materias}
                  diasCalendario={diasCalendario}
                  claveHoyCalendario={claveHoyCalendario}
                  eventosDelDiaCalendario={eventosDelDiaCalendario}
                  obtenerDiaSemanaHorario={obtenerDiaSemanaHorario}
                  diaCalendarioSeleccionado={diaCalendarioSeleccionado}
                  setDiaCalendarioSeleccionado={setDiaCalendarioSeleccionado}
                />
              )}


              {/* VISTA 4: ADMIN PANEL */}
              {pestana === 'admin' && esAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* ALUMNOS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>👤</span> Agregar Alumnos
                    </h2>
                    <form onSubmit={handleCrearAlumno} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Carlos"
                          value={nuevoAlumnoNombre}
                          onChange={(e) => setNuevoAlumnoNombre(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Año</label>
                          <input
                            type="number"
                            min="2000"
                            step="1"
                            required
                            value={nuevoMateriaAnio}
                            onChange={(e) => setNuevoMateriaAnio(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Cuatrimestre</label>
                          <select
                            value={nuevoMateriaCuatrimestre}
                            onChange={(e) => setNuevoMateriaCuatrimestre(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
                          >
                            <option value="1">1°</option>
                            <option value="2">2°</option>
                          </select>
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Guardar Alumno
                      </button>
                    </form>

                    <div className="mt-6 border-t border-slate-800 pt-4">
                      <span className="text-xs font-bold text-slate-400 block mb-2">Registrados ({alumnos.length}):</span>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {alumnos.map((a) => (
                          <div key={a} className="bg-[#0f141c] p-2.5 rounded-lg border border-slate-800 flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-slate-200 font-medium">{a}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setAlumnoEnEdicion({ antiguoNombre: a, nuevoNombre: a })}
                                className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleEliminarAlumno(a)}
                                className="text-red-400 hover:text-red-300 font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* MATERIAS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>📚</span> Nueva Materia
                    </h2>
                    <form onSubmit={handleCrearMateria} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: SEGURIDAD EN REDES"
                          value={nuevaMateriaNombre}
                          onChange={(e) => setNuevaMateriaNombre(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none transition-all"
                        />
                      </div>
                      <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Guardar Materia
                      </button>
                    </form>
                  </div>

                  {/* TAREAS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>➕</span> Nueva Tarea
                    </h2>
                    <form onSubmit={handleCrearTarea} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Materia</label>
                        <select
                          value={materiaSel}
                          onChange={(e) => setMateriaSel(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none font-medium cursor-pointer"
                        >
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Título de la Tarea</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: TP N°1 - Análisis de Logs"
                          value={nombreTarea}
                          onChange={(e) => setNombreTarea(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Unidad (opcional)</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Ej: 1"
                          value={unidadTarea}
                          onChange={(e) => setUnidadTarea(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de tarea</label>
                        <select
                          value={tipoTarea}
                          onChange={(e) => {
                            setTipoTarea(e.target.value);
                            if (e.target.value === 'trabajo_practico') setTareaConNota(true);
                          }}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
                        >
                          <option value="actividad">Actividad</option>
                          <option value="foro">Foro</option>
                          <option value="trabajo_practico">Trabajo práctico</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-3 text-sm font-semibold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tareaConNota || tipoTarea === 'trabajo_practico'}
                          disabled={tipoTarea === 'trabajo_practico'}
                          onChange={(e) => setTareaConNota(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                        />
                        Esta tarea se califica con nota
                      </label>
                      <label className="flex items-center gap-3 text-sm font-semibold text-cyan-200">
                        <input type="checkbox" checked={tareaGrupal} onChange={(e) => setTareaGrupal(e.target.checked)} />
                        Trabajo grupal (comparte entrega y nota)
                      </label>
                      {tareaGrupal && (
                        <div className="flex flex-col gap-1">
                          <label className="block text-xs font-semibold text-slate-300">Cupo máximo por grupo (0 = sin límite)</label>
                          <input
                            type="number"
                            min="0"
                            value={cupoMaximo}
                            onChange={(e) => setCupoMaximo(parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Abre</label>
                          <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Vence</label>
                          <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Consigna / Detalles</label>
                        <textarea
                          rows={3}
                          placeholder="Texto o pautas para el trabajo..."
                          value={detallesTarea}
                          onChange={(e) => setDetallesTarea(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        ></textarea>
                      </div>

                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Publicar Tarea
                      </button>
                    </form>
                  </div>

                  {/* NUEVO: CARGAR PARCIAL */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>📋</span> {parcialEnEdicion ? 'Editar Parcial' : 'Nuevo Parcial'}
                    </h2>
                    <form onSubmit={handleCrearParcial} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Materia</label>
                        <select
                          value={materiaParcialSel}
                          onChange={(e) => setMateriaParcialSel(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none font-medium cursor-pointer"
                        >
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Título / Instancia</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Primer Parcial"
                          value={nombreParcial}
                          onChange={(e) => setNombreParcial(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha del Examen</label>
                        <input
                          type="date"
                          value={fechaParcial}
                          onChange={(e) => setFechaParcial(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Temas / Aclaraciones</label>
                        <textarea
                          rows={3}
                          placeholder="Unidades que entran, aula, etc..."
                          value={detallesParcial}
                          onChange={(e) => setDetallesParcial(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        ></textarea>
                      </div>

                      <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        {parcialEnEdicion ? 'Guardar Cambios' : 'Publicar Parcial'}
                      </button>
                      {parcialEnEdicion && (
                        <button
                          type="button"
                          onClick={() => {
                            setParcialEnEdicion(null);
                            setNombreParcial('');
                            setFechaParcial('');
                            setDetallesParcial('');
                          }}
                          className="w-full text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Cancelar edición
                        </button>
                      )}
                    </form>
                  </div>

                  {/* HORARIOS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>🗓️</span> Nuevo Horario
                    </h2>
                    <form onSubmit={handleCrearHorario} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Materia</label>
                        <select
                          value={materiaHorarioSel}
                          onChange={(e) => setMateriaHorarioSel(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-white focus:outline-none font-medium cursor-pointer"
                        >
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Día</label>
                        <select
                          value={diaHorario}
                          onChange={(e) => setDiaHorario(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
                        >
                          <option value="1">Lunes</option>
                          <option value="2">Martes</option>
                          <option value="3">Miércoles</option>
                          <option value="4">Jueves</option>
                          <option value="5">Viernes</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Desde</label>
                          <input
                            type="time"
                            required
                            value={horaInicioHorario}
                            onChange={(e) => setHoraInicioHorario(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Hasta</label>
                          <input
                            type="time"
                            required
                            value={horaFinHorario}
                            onChange={(e) => setHoraFinHorario(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Aula (opcional)</label>
                        <input
                          type="text"
                          placeholder="Ej: Aula 12"
                          value={aulaHorario}
                          onChange={(e) => setAulaHorario(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Publicar Horario
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MODAL CAMBIAR CONTRASEÑA */}
      {modalPasswordOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <span>🔐</span> Modificar Contraseña
            </h3>
            <p className="text-xs text-slate-400 mb-5">Ingresá tu clave actual para autorizar el cambio.</p>

            <form onSubmit={handleCambiarPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Usuario</label>
                <input
                  type="text"
                  required
                  placeholder="Tu nombre de usuario"
                  value={userPassChange}
                  onChange={(e) => setUserPassChange(e.target.value)}
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña Actual</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={currentPassChange}
                  onChange={(e) => setCurrentPassChange(e.target.value)}
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={newPassChange}
                  onChange={(e) => setNewPassChange(e.target.value)}
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              {msgPassChange.texto && (
                <p
                  className={`text-xs text-center p-3 rounded-lg border ${
                    msgPassChange.tipo === 'exito'
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50'
                      : 'bg-red-950/40 text-red-300 border-red-900/50'
                  }`}
                >
                  {msgPassChange.texto}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalPasswordOpen(false);
                    setMsgPassChange({ tipo: '', texto: '' });
                  }}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Guardar Nueva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OTROS MODALES */}
      {alumnoEnEdicion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Editar Alumno</h3>
            <form onSubmit={handleGuardarEdicionAlumno} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={alumnoEnEdicion.nuevoNombre}
                  onChange={(e) =>
                    setAlumnoEnEdicion({
                      ...alumnoEnEdicion,
                      nuevoNombre: e.target.value
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAlumnoEnEdicion(null)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {materiaEnEdicion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Editar Materia</h3>
            <form onSubmit={handleGuardarRenombrarMateria} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={materiaEnEdicion.nombre}
                  onChange={(e) =>
                    setMateriaEnEdicion({
                      ...materiaEnEdicion,
                      nombre: e.target.value
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMateriaEnEdicion(null)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tareaEnEdicion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Editar Tarea</h3>
            <form onSubmit={handleGuardarEdicionTarea} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={tareaEnEdicion.tarea.nombre}
                  onChange={(e) =>
                    setTareaEnEdicion({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, nombre: e.target.value }
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Unidad (opcional)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ej: 1"
                  value={tareaEnEdicion.tarea.unidad || ''}
                  onChange={(e) =>
                    setTareaEnEdicion({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, unidad: e.target.value }
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de tarea</label>
                <select
                  value={tareaEnEdicion.tarea.tipo || 'actividad'}
                  onChange={(e) =>
                    setTareaEnEdicion({
                      ...tareaEnEdicion,
                      tarea: {
                        ...tareaEnEdicion.tarea,
                        tipo: e.target.value,
                        conNota: e.target.value === 'trabajo_practico' || tareaEnEdicion.tarea.conNota
                      }
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
                >
                  <option value="actividad">Actividad</option>
                  <option value="foro">Foro</option>
                  <option value="trabajo_practico">Trabajo práctico</option>
                </select>
              </div>

              <label className="flex items-center gap-3 text-sm font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(tareaEnEdicion.tarea.conNota) || tareaEnEdicion.tarea.tipo === 'trabajo_practico'}
                  disabled={tareaEnEdicion.tarea.tipo === 'trabajo_practico'}
                  onChange={(e) =>
                    setTareaEnEdicion({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, conNota: e.target.checked }
                    })
                  }
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                />
                Esta tarea se califica con nota
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold text-cyan-200">
                <input type="checkbox" checked={Boolean(tareaEnEdicion.tarea.grupal)} onChange={(e) => setTareaEnEdicion({ ...tareaEnEdicion, tarea: { ...tareaEnEdicion.tarea, grupal: e.target.checked } })} />
                Trabajo grupal (comparte entrega y nota)
              </label>
              {Boolean(tareaEnEdicion.tarea.grupal) && (
                <div className="flex flex-col gap-1 mt-2">
                  <label className="block text-xs font-semibold text-slate-300">Cupo máximo por grupo (0 = sin límite)</label>
                  <input
                    type="number"
                    min="0"
                    value={tareaEnEdicion.tarea.cupo_maximo ?? 0}
                    onChange={(e) => setTareaEnEdicion({ ...tareaEnEdicion, tarea: { ...tareaEnEdicion.tarea, cupo_maximo: parseInt(e.target.value, 10) || 0 } })}
                    className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Abre</label>
                  <input
                    type="date"
                    value={tareaEnEdicion.tarea.inicio ?? ''}
                    onChange={(e) =>
                      setTareaEnEdicion({
                        ...tareaEnEdicion,
                        tarea: { ...tareaEnEdicion.tarea, inicio: e.target.value }
                      })
                    }
                    className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Vence</label>
                  <input
                    type="date"
                    value={tareaEnEdicion.tarea.fin ?? ''}
                    onChange={(e) =>
                      setTareaEnEdicion({
                        ...tareaEnEdicion,
                        tarea: { ...tareaEnEdicion.tarea, fin: e.target.value }
                      })
                    }
                    className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Consigna / Detalles</label>
                <textarea
                  rows={4}
                  value={tareaEnEdicion.tarea.detalles}
                  onChange={(e) =>
                    setTareaEnEdicion({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, detalles: e.target.value }
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTareaEnEdicion(null)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {materiaCondicionesEnEdicion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Condiciones de promoción</h3>
            <p className="text-xs text-slate-400 mb-5">Las notas se calculan sobre los trabajos prácticos cargados.</p>
            <form onSubmit={handleGuardarCondicionesMateria} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Condiciones de la materia</label>
                <textarea
                  rows={5}
                  value={materiaCondicionesEnEdicion.condiciones}
                  onChange={(e) => setMateriaCondicionesEnEdicion({ ...materiaCondicionesEnEdicion, condiciones: e.target.value })}
                  placeholder="Ej: Para regularizar hay que completar todos los trabajos prácticos..."
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{['activos_porcentaje', 'tp_porcentaje_nota'].includes(materiaCondicionesEnEdicion.reglaPromocion) ? 'Porcentaje para regularizar' : 'Mínima para regularizar'}</label>
                  <input
                    type="number"
                    min="1"
                    max={['activos_porcentaje', 'tp_porcentaje_nota'].includes(materiaCondicionesEnEdicion.reglaPromocion) ? '100' : '10'}
                    step="0.01"
                    value={materiaCondicionesEnEdicion.notaMinimaRegularizar}
                    onChange={(e) => setMateriaCondicionesEnEdicion({ ...materiaCondicionesEnEdicion, notaMinimaRegularizar: e.target.value })}
                    className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{materiaCondicionesEnEdicion.reglaPromocion === 'activos_porcentaje' ? 'Porcentaje para promocionar' : 'Mínima para promocionar'}</label>
                  <input
                    type="number"
                    min="1"
                    max={materiaCondicionesEnEdicion.reglaPromocion === 'activos_porcentaje' ? '100' : '10'}
                    step="0.01"
                    value={materiaCondicionesEnEdicion.notaMinimaPromocionar}
                    onChange={(e) => setMateriaCondicionesEnEdicion({ ...materiaCondicionesEnEdicion, notaMinimaPromocionar: e.target.value })}
                    className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMateriaCondicionesEnEdicion(null)} className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancelar</button>
                <button type="submit" className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">Guardar condiciones</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sincronización con UGR Virtual (solo admin) */}
      {syncAbierto && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="float-right flex gap-3">
              <button type="button" onClick={() => ejecutarSyncUGR(false)} disabled={syncEstado === 'cargando'} className="text-xs text-cyan-300 disabled:opacity-50">Buscar de nuevo</button>
              <button type="button" onClick={() => setSyncAbierto(false)} className="text-xs text-slate-300">Cerrar</button>
            </div>
            <h3 className="text-base font-bold text-white mb-1">🔄 Sincronizar con UGR Virtual</h3>
            <p className="text-xs text-slate-400 mb-4">Busca las tareas nuevas del campus y te las muestra antes de cargarlas.</p>

            {syncEstado === 'cargando' && (
              <div className="text-center py-8">
                <span className="text-3xl animate-spin inline-block">⏳</span>
                <p className="mt-3 text-sm text-slate-300">Consultando UGR Virtual...</p>
              </div>
            )}

            {syncEstado === 'error' && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{syncMensaje}</div>
            )}

            {syncEstado === 'listo' && syncDatos && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-slate-300">{syncDatos.cursos} curso(s)</span>
                  <span className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 text-cyan-300">{(syncDatos.mapeos ?? []).length} materia(s) de la cursada</span>
                </div>
                {(syncDatos.mapeos ?? []).length > 0 && (
                  <ul className="text-sm text-slate-200 space-y-1">
                    {(syncDatos.mapeos ?? []).map((mapeo) => (
                      <li key={`${mapeo.id}-${mapeo.materia}`}>{mapeo.materia}</li>
                    ))}
                  </ul>
                )}

                {syncDatos.detectadas.length === 0 ? (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    ✅ No hay tareas nuevas para importar.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300">
                        {syncSeleccionados.size} de {syncDatos.detectadas.length} seleccionada(s)
                      </span>
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => marcarTodasSync(true)}
                          className="text-slate-400 hover:text-emerald-300 cursor-pointer underline"
                        >
                          Tildar todas
                        </button>
                        <span className="text-slate-600">·</span>
                        <button
                          type="button"
                          onClick={() => marcarTodasSync(false)}
                          className="text-slate-400 hover:text-red-300 cursor-pointer underline"
                        >
                          Destildar todas
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {syncDatos.detectadas.map((tarea, i) => {
                        const tildada = syncSeleccionados.has(tarea.idMoodle);
                        return (
                          <div
                            key={`${tarea.idMoodle || tarea.nombre}-${i}`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).tagName === 'INPUT') return;
                              toggleSyncTarea(tarea.idMoodle);
                            }}
                            aria-hidden="true"
                            className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                              tildada
                                ? 'border-emerald-500/50 bg-emerald-500/5'
                                : 'border-slate-700 bg-[#0f141c] opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={tildada}
                                onChange={() => toggleSyncTarea(tarea.idMoodle)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white">{tarea.nombre}</p>
                                <p className="text-xs text-cyan-300 mt-0.5">{tarea.materiaNombre}</p>
                                {tarea.url && (
                                  <a
                                    href={tarea.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline mt-1"
                                  >
                                    Abrir página en UGR ↗
                                  </a>
                                )}
                                <p className="text-xs text-slate-400 mt-1">
                                  Unidad: {tarea.unidad || '—'} · Inicio: {tarea.inicio} · Fin: {tarea.fin} · Tipo: {tarea.tipo}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400">
                      Tildá con el check cuáles querés importar y dale a «Importar seleccionadas». Nada se carga solo.
                    </p>
                  </>
                )}

{/* Avisos de foros y eventos sugeridos (solo los aprueba el admin) */}
                {(syncDatos.avisos?.length || 0) > 0 ? (
                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">
                        📢 {syncAvisosSeleccionados.size} de {syncDatos.avisos.length} aviso(s) para publicar en la campana
                      </span>
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => marcarTodasAvisosSync(true)}
                          className="text-slate-400 hover:text-purple-300 cursor-pointer underline"
                        >
                          Tildar todos
                        </button>
                        <span className="text-slate-600">·</span>
                        <button
                          type="button"
                          onClick={() => marcarTodasAvisosSync(false)}
                          className="text-slate-400 hover:text-red-300 cursor-pointer underline"
                        >
                          Destildar todos
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
                      {syncDatos.avisos.map((aviso) => {
                        const tildado = syncAvisosSeleccionados.has(aviso.id);
                        const eventoDe = (syncDatos.eventosSugeridos || []).find((e) => e.avisoId === aviso.id);
                        const eventoElecto = syncEventosSeleccionados.has(aviso.id) && tildado;
                        return (
                          <div
                            key={aviso.id}
                            className={`rounded-xl border p-3 transition-colors ${
                              tildado
                                ? 'border-purple-500/50 bg-purple-500/5'
                                : 'border-slate-700 bg-[#0f141c] opacity-60'
                            }`}
                          >
                          <button
                            type="button"
                            onClick={(e) => {
                              // Sin la guarda, un click en el checkbox dispara
                              // DOS veces (el input y el botón que lo envuelve)
                              // y el aviso vuelve a quedar tildado: por eso no
                              // se podía destildar uno por uno y solo servía
                              // «Destildar todo».
                              if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'A') return;
                              toggleSyncAviso(aviso.id);
                            }}
                            className="w-full text-left cursor-pointer"
                          >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={tildado}
                                  onChange={() => toggleSyncAviso(aviso.id)}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-purple-500 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-white">{aviso.titulo}</p>
                                  <p className="text-xs text-purple-300 mt-0.5">
                                    {etiquetaMateria(aviso.materiaNombre || aviso.cursoNombre || 'Materia')} · {aviso.foroNombre} · publicado el {aviso.fecha}
                                  </p>
                                  {aviso.contenido && (
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{aviso.contenido}</p>
                                  )}
                                  {aviso.url && (
                                    <a
                                      href={aviso.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline mt-1"
                                    >
                                      Abrir anuncio en UGR ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            </button>
                            {eventoDe && (
                              <label className={`mt-2 flex items-start gap-2 rounded-lg bg-slate-800/60 px-2.5 py-2 ${tildado ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={eventoElecto}
                                  onChange={() => toggleSyncEvento(aviso.id)}
                                  disabled={!tildado}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-purple-400 cursor-pointer"
                                />
                                <span className="text-xs text-slate-300">
                                  <strong className="text-purple-200">Agregar al cronograma:</strong>{' '}
                                  {eventoDe.titulo} · {eventoDe.fecha} · {eventoDe.tipo}
                                </span>
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Avisos publicados desde hoy. Los que no tildes quedan sin publicar (no se vuelven a sugerir).
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 pt-2">📭 No hay avisos nuevos en los foros del campus.</p>
                )}
                {(syncDatos.parcialesInsertados ?? 0) > 0 && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                    Se pasaron {syncDatos.parcialesInsertados} examen(es) al apartado de parciales.
                  </div>
                )}
                {syncDatos.insertadas > 0 && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    ✅ Se cargaron {syncDatos.insertadas} tarea(s) en la página.
                  </div>
                )}

                {(syncDatos.eventosCalendarioInsertados ?? 0) > 0 && (
                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                    📅 Se agregaron {syncDatos.eventosCalendarioInsertados} evento(s) del calendario del campus.
                  </div>
                )}
                {(syncDatos.horariosInsertados ?? 0) > 0 && (
                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                    🕒 Se cargaron {syncDatos.horariosInsertados} horario(s) semanal(es).
                  </div>
                )}
                {syncDatos.urlsActualizadas > 0 && (
                  <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 text-sm text-blue-200">
                    🔗 Se actualizó el enlace de {syncDatos.urlsActualizadas} tarea(s) ya existente(s).
                  </div>
                )}

                {syncDatos.avisosAceptados > 0 && (
                  <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-4 text-sm text-purple-200">
                    ✅ Se publicaron {syncDatos.avisosAceptados} aviso(s) en la campana.
                  </div>
                )}

                {syncDatos.eventosInsertados > 0 && (
                  <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-4 text-sm text-purple-200">
                    📅 Se agregaron {syncDatos.eventosInsertados} evento(s) sugerido(s) al cronograma.
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSyncAbierto(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    Cerrar
                  </button>
                  {(syncDatos.detectadas.length > 0 || syncDatos.avisos.length > 0) && !syncDatos.confirmar && (
                    <button
                      type="button"
                      onClick={() => ejecutarSyncUGR(true, [...syncSeleccionados], [...syncAvisosSeleccionados], [...syncEventosSeleccionados])}
                      disabled={(syncEstado as string) === 'cargando' || (syncEstado as string) === 'error' || (syncSeleccionados.size === 0 && syncAvisosSeleccionados.size === 0)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {syncSeleccionados.size + syncAvisosSeleccionados.size > 0
                        ? `Aplicar cambios (${syncSeleccionados.size + syncAvisosSeleccionados.size})`
                        : 'Sin cambios seleccionados'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
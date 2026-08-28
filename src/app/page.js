'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import {
  validarLoginAction,
  obtenerDatos,
  obtenerAlumnosAction,
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
  obtenerParcialesAction,
  crearParcialAction,
  editarParcialAction,
  eliminarParcialAction,
  guardarNotaParcialAction,
  obtenerHorariosAction,
  crearHorarioAction,
  eliminarHorarioAction
} from './actions';

export default function Home() {
  const [materias, setMaterias] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [pestana, setPestana] = useState('alumnos');
  const [cargando, setCargando] = useState(true);
  const [iniciado, setIniciado] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const [mostrarAvisoInicio, setMostrarAvisoInicio] = useState(false);

  // Estado para Parciales y Notas
  const [parciales, setParciales] = useState([]);
  const [notas, setNotas] = useState([]);
  const [notasInputs, setNotasInputs] = useState({});
  const [notasTareasInputs, setNotasTareasInputs] = useState({});
  const [notasDesplegadas, setNotasDesplegadas] = useState({});
  const [horarios, setHorarios] = useState([]);

  // Acordeón para compañeros
  const [alumnosDesplegados, setAlumnosDesplegados] = useState({});
  const [materiasDesplegadas, setMateriasDesplegadas] = useState({});
  const [alumnoComparar, setAlumnoComparar] = useState('');

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
  const [tipoTarea, setTipoTarea] = useState('actividad');
  const [materiaCondicionesEnEdicion, setMateriaCondicionesEnEdicion] = useState(null);

  // Form Admin (Parciales)
  const [materiaParcialSel, setMateriaParcialSel] = useState('');
  const [nombreParcial, setNombreParcial] = useState('');
  const [fechaParcial, setFechaParcial] = useState('');
  const [detallesParcial, setDetallesParcial] = useState('');
  const [parcialEnEdicion, setParcialEnEdicion] = useState(null);
  const [materiaHorarioSel, setMateriaHorarioSel] = useState('');
  const [diaHorario, setDiaHorario] = useState('1');
  const [horaInicioHorario, setHoraInicioHorario] = useState('');
  const [horaFinHorario, setHoraFinHorario] = useState('');
  const [aulaHorario, setAulaHorario] = useState('');

  // Modales edición
  const [tareaEnEdicion, setTareaEnEdicion] = useState(null);
  const [materiaEnEdicion, setMateriaEnEdicion] = useState(null);
  const [alumnoEnEdicion, setAlumnoEnEdicion] = useState(null);

  const esAdmin = usuarioActual === "Matute";

  const tareaCompletadaPor = (tarea, alumno) => (
    tarea.conNota ? Object.prototype.hasOwnProperty.call(tarea.notas || {}, alumno) : tarea.completadoPor.includes(alumno)
  );

  useEffect(() => {
    document.title = "UGR - Tareas";
  }, []);

  // PERSISTENCIA DE SESIÓN
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('sesion_ugr');
    if (sesionGuardada) {
      try {
        const { usuario, timestamp } = JSON.parse(sesionGuardada);
        const diezMinutosMs = 10 * 60 * 1000;
        const ahora = Date.now();

        if (ahora - timestamp < diezMinutosMs) {
          startTransition(() => {
            setUsuarioActual(usuario);
            setMostrarAvisoInicio(true);
          });
          localStorage.setItem('sesion_ugr', JSON.stringify({ usuario, timestamp: ahora }));
        } else {
          localStorage.removeItem('sesion_ugr');
        }
      } catch (e) {
        localStorage.removeItem('sesion_ugr');
      }
    }
    startTransition(() => {
      setIniciado(true);
    });
  }, []);

  const iniciarSesionLocal = (usuario) => {
    setUsuarioActual(usuario);
    localStorage.setItem(
      'sesion_ugr',
      JSON.stringify({ usuario, timestamp: Date.now() })
    );
  };

  const cerrarSesionLocal = () => {
    setUsuarioActual(null);
    localStorage.removeItem('sesion_ugr');
  };

  const formatearFechaDDMMAAAA = (fechaStr) => {
    if (!fechaStr || fechaStr === 'Sin fecha') return 'Sin fecha';
    if (fechaStr.includes('-')) {
      const partes = fechaStr.split('-');
      if (partes.length === 3 && partes[0].length === 4) {
        return `${partes[2]}-${partes[1]}-${partes[0]}`;
      }
    }
    return fechaStr;
  };

  const formatearFechaHora = (fechaStr) => {
    if (!fechaStr) return 'Fecha no disponible';
    const fecha = new Date(String(fechaStr).endsWith('Z') ? fechaStr : `${String(fechaStr).replace(' ', 'T')}Z`);
    if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible';
    return fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const obtenerTimestamp = (fechaStr) => {
    if (!fechaStr) return null;
    const fecha = new Date(String(fechaStr).endsWith('Z') ? fechaStr : `${String(fechaStr).replace(' ', 'T')}Z`);
    const timestamp = fecha.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  const obtenerFechaParcialEnMs = (fechaStr) => {
    if (!fechaStr || fechaStr === 'Sin fecha') return null;
    const partes = fechaStr.split('-').map(Number);
    if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) return null;

    const [year, month, day] = partes;
    const fecha = new Date(year, month - 1, day);
    return Number.isNaN(fecha.getTime()) ? null : fecha.getTime();
  };

  const obtenerDiasHastaParcial = (fechaStr) => {
    const fechaParcialEnMs = obtenerFechaParcialEnMs(fechaStr);
    if (fechaParcialEnMs === null) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((fechaParcialEnMs - hoy.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const obtenerDiasHastaFecha = (fechaStr) => {
    if (!fechaStr || fechaStr === 'Sin fecha') return null;
    const partes = String(fechaStr).split('-').map(Number);
    if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) return null;

    const [year, month, day] = partes[0] > 31
      ? partes
      : [partes[2], partes[1], partes[0]];
    const fechaLimite = new Date(year, month - 1, day);
    fechaLimite.setHours(0, 0, 0, 0);
    if (Number.isNaN(fechaLimite.getTime())) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  };

  const obtenerDiasHastaTarea = (fechaStr) => {
    const diasHastaCierre = obtenerDiasHastaFecha(fechaStr);
    return diasHastaCierre === null ? null : diasHastaCierre - 1;
  };

  const ordenarParciales = (listaParciales) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyEnMs = hoy.getTime();

    return [...listaParciales].sort((a, b) => {
      const fechaA = obtenerFechaParcialEnMs(a.fecha);
      const fechaB = obtenerFechaParcialEnMs(b.fecha);

      if (fechaA === null) return fechaB === null ? a.nombre.localeCompare(b.nombre) : 1;
      if (fechaB === null) return -1;

      const futuroA = fechaA >= hoyEnMs;
      const futuroB = fechaB >= hoyEnMs;
      if (futuroA !== futuroB) return futuroA ? -1 : 1;
      return futuroA ? fechaA - fechaB : fechaB - fechaA;
    });
  };

  const ordenarTareas = (listaTareas) => {
    return [...listaTareas].sort((a, b) => {
      const tieneFinA = a.fin && a.fin !== 'Sin fecha';
      const tieneFinB = b.fin && b.fin !== 'Sin fecha';

      if (tieneFinA && tieneFinB) return a.fin.localeCompare(b.fin);
      if (tieneFinA) return -1;
      if (tieneFinB) return 1;

      const tieneInicioA = a.inicio && a.inicio !== 'Sin fecha';
      const tieneInicioB = b.inicio && b.inicio !== 'Sin fecha';

      if (tieneInicioA && tieneInicioB) return a.inicio.localeCompare(b.inicio);
      if (tieneInicioA) return -1;
      if (tieneInicioB) return 1;

      return a.nombre.localeCompare(b.nombre);
    });
  };

  const agruparTareasPorUnidad = (listaTareas) => {
    const grupos = new Map();
    listaTareas.forEach((tarea) => {
      const unidad = tarea.unidad?.trim() || '';
      const grupo = grupos.get(unidad) || [];
      grupo.push(tarea);
      grupos.set(unidad, grupo);
    });

    return [...grupos.entries()]
      .sort(([unidadA], [unidadB]) => {
        if (!unidadA) return -1;
        if (!unidadB) return 1;
        return unidadA.localeCompare(unidadB, 'es', { numeric: true });
      })
      .map(([unidad, tareas]) => ({ unidad, tareas: ordenarTareas(tareas) }));
  };

  const formatearUnidad = (unidad) => {
    const valor = Number(unidad);
    return Number.isFinite(valor) ? String(valor) : String(unidad || '');
  };

  const esForo = (nombreTarea) => /\(\s*foro\s*\)/i.test(nombreTarea || '');

  const calcularEstadoSemaforo = (fechaFinStr) => {
    if (!fechaFinStr || fechaFinStr === 'Sin fecha') {
      return { texto: 'Sin fecha límite', estilo: 'bg-slate-800 text-slate-400 border-slate-700' };
    }

    const diasRestantes = obtenerDiasHastaTarea(fechaFinStr);

    if (diasRestantes < 0) {
      return { texto: 'Vencida', estilo: 'bg-red-950/80 text-red-400 border-red-800/80 font-bold' };
    } else if (diasRestantes === 0) {
      return { texto: '⚠️ Cierra Hoy', estilo: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold animate-pulse' };
    } else if (diasRestantes <= 2) {
      return { texto: `🔴 Quedan ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}`, estilo: 'bg-red-500/15 text-red-300 border-red-500/30 font-semibold' };
    } else if (diasRestantes <= 7) {
      return { texto: `🟠 Quedan ${diasRestantes} días`, estilo: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold' };
    } else {
      return { texto: `🟢 Quedan ${diasRestantes} días`, estilo: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold' };
    }
  };

  const cargarBD = useCallback(async () => {
    setCargando(true);
    const [dataMaterias, dataAlumnos, dataParciales, dataHorarios] = await Promise.all([
      obtenerDatos(),
      obtenerAlumnosAction(),
      obtenerParcialesAction(),
      obtenerHorariosAction()
    ]);
    
    setMaterias(dataMaterias || []);
    setAlumnos(dataAlumnos || []);
    setParciales(dataParciales.parciales || []);
    setNotas(dataParciales.notas || []);
    setHorarios(dataHorarios || []);

    // Inicializar inputs de notas locales
    const mapaNotas = {};
    if (dataParciales.notas) {
      dataParciales.notas.forEach((n) => {
        mapaNotas[`${n.parcial_id}_${n.alumno}`] = n.nota;
      });
    }
    setNotasInputs(mapaNotas);

    const mapaNotasTareas = {};
    dataMaterias?.forEach((materia) => {
      materia.tareas.forEach((tarea) => {
        Object.entries(tarea.notas || {}).forEach(([alumno, nota]) => {
          mapaNotasTareas[`${tarea.id}_${alumno}`] = nota;
        });
      });
    });
    setNotasTareasInputs(mapaNotasTareas);

    if (dataMaterias && dataMaterias.length > 0) {
      if (!materiaSel) setMateriaSel(dataMaterias[0].id);
      if (!materiaParcialSel) setMateriaParcialSel(dataMaterias[0].id);
      if (!materiaHorarioSel) setMateriaHorarioSel(dataMaterias[0].id);
    }
    setCargando(false);
  }, [materiaSel, materiaParcialSel, materiaHorarioSel]);

  useEffect(() => {
    // La carga inicial sincroniza el estado con la base de datos externa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarBD();
  }, [cargarBD]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!inputUser.trim() || !inputPass.trim()) return;

    const res = await validarLoginAction(inputUser, inputPass);

    if (res.exito) {
      iniciarSesionLocal(res.usuario);
      setMostrarAvisoInicio(true);
      setErrorLogin('');
      setInputUser('');
      setInputPass('');
    } else {
      setErrorLogin(res.mensaje);
    }
  };

  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    setMsgPassChange({ tipo: '', texto: '' });

    const res = await cambiarPasswordAction(userPassChange, currentPassChange, newPassChange);

    if (res.exito) {
      setMsgPassChange({ tipo: 'exito', texto: res.mensaje });
      setTimeout(() => {
        setModalPasswordOpen(false);
        setUserPassChange('');
        setCurrentPassChange('');
        setNewPassChange('');
        setMsgPassChange({ tipo: '', texto: '' });
      }, 1500);
    } else {
      setMsgPassChange({ tipo: 'error', texto: res.mensaje });
    }
  };

  const toggleDesplegarAlumno = (nombreAlumno) => {
    setAlumnosDesplegados((prev) => ({
      ...prev,
      [nombreAlumno]: !prev[nombreAlumno]
    }));
  };

  const toggleDesplegarMateria = (materiaId) => {
    setMateriasDesplegadas((prev) => ({
      ...prev,
      [materiaId]: !prev[materiaId]
    }));
  };

  const handleCrearAlumno = async (e) => {
    e.preventDefault();
    if (!nuevoAlumnoNombre.trim()) return;
    await crearAlumnoAction(nuevoAlumnoNombre);
    setNuevoAlumnoNombre('');
    await cargarBD();
  };

  const handleGuardarEdicionAlumno = async (e) => {
    e.preventDefault();
    if (!alumnoEnEdicion || !alumnoEnEdicion.nuevoNombre.trim()) return;
    await editarAlumnoAction(alumnoEnEdicion.antiguoNombre, alumnoEnEdicion.nuevoNombre);
    setAlumnoEnEdicion(null);
    await cargarBD();
  };

  const handleEliminarAlumno = async (nombre) => {
    if (confirm(`¿Seguro que querés eliminar a "${nombre}" de la lista?`)) {
      await eliminarAlumnoAction(nombre);
      await cargarBD();
    }
  };

  const handleToggleTarea = async (tareaId, alumno) => {
    await toggleTareaAction(tareaId, alumno);
    await cargarBD();
  };

  const handleCrearMateria = async (e) => {
    e.preventDefault();
    if (!nuevaMateriaNombre.trim()) return;
    const resultado = await crearMateriaAction({
      nombre: nuevaMateriaNombre,
      anio: nuevoMateriaAnio,
      cuatrimestre: nuevoMateriaCuatrimestre
    });
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudo crear la materia.');
      return;
    }
    setNuevaMateriaNombre('');
    await cargarBD();
  };

  const handleGuardarCondicionesMateria = async (e) => {
    e.preventDefault();
    if (!materiaCondicionesEnEdicion) return;
    const resultado = await editarCondicionesMateriaAction({
      ...materiaCondicionesEnEdicion,
      usuario: usuarioActual
    });
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudieron guardar las condiciones.');
      return;
    }
    setMateriaCondicionesEnEdicion(null);
    await cargarBD();
  };

  const handleGuardarRenombrarMateria = async (e) => {
    e.preventDefault();
    if (!materiaEnEdicion) return;
    await renombrarMateriaAction(materiaEnEdicion.id, materiaEnEdicion.nombre);
    setMateriaEnEdicion(null);
    await cargarBD();
  };

  const handleEliminarMateria = async (id, nombre) => {
    if (confirm(`¿Seguro que querés eliminar la materia "${nombre}" y sus tareas?`)) {
      await eliminarMateriaAction(id);
      await cargarBD();
    }
  };

  const handleCrearTarea = async (e) => {
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
      tipo: tipoTarea
    });
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudo crear la tarea.');
      return;
    }
    setNombreTarea('');
    setFechaInicio('');
    setFechaFin('');
    setDetallesTarea('');
    setUnidadTarea('');
    setTareaConNota(false);
    setTipoTarea('actividad');
    await cargarBD();
    setPestana('materias');
  };

  const handleGuardarEdicionTarea = async (e) => {
    e.preventDefault();
    if (!tareaEnEdicion) return;
    const resultado = await editarTareaAction(tareaEnEdicion.tarea);
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudo editar la tarea.');
      return;
    }
    setTareaEnEdicion(null);
    await cargarBD();
  };

  const obtenerEstadoMateria = (materia, alumno) => {
    const trabajosPracticos = materia.tareas.filter((tarea) => tarea.tipo === 'trabajo_practico');
    if (!materia.condiciones && trabajosPracticos.length === 0) return null;
    if (trabajosPracticos.length === 0) return { texto: 'Sin TPs cargados', estilo: 'text-slate-400 bg-slate-800/60 border-slate-700' };

    const notas = trabajosPracticos.map((tarea) => {
      const valor = tarea.notas?.[alumno];
      return valor === undefined ? null : Number.parseFloat(String(valor).replace(',', '.'));
    });
    if (notas.some((nota) => nota === null || !Number.isFinite(nota))) {
      return { texto: 'En curso', estilo: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
    }
    if (notas.some((nota) => nota < materia.notaMinimaRegularizar)) {
      return { texto: 'Desaprueba', estilo: 'text-red-300 bg-red-500/10 border-red-500/30' };
    }
    if (notas.every((nota) => nota >= materia.notaMinimaPromocionar)) {
      return { texto: 'Promociona', estilo: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
    }
    return { texto: 'Regulariza', estilo: 'text-blue-300 bg-blue-500/10 border-blue-500/30' };
  };

  const handleEliminarTarea = async (id) => {
    if (confirm('¿Seguro que querés borrar esta tarea?')) {
      await eliminarTareaAction(id);
      await cargarBD();
    }
  };

  const handleNotaTareaChangeLocal = (tareaId, alumno, valor) => {
    setNotasTareasInputs((prev) => ({
      ...prev,
      [`${tareaId}_${alumno}`]: valor
    }));
  };

  const handleGuardarNotaTareaOnBlur = async (tareaId, alumno) => {
    const clave = `${tareaId}_${alumno}`;
    const resultado = await guardarNotaTareaAction(tareaId, alumno, notasTareasInputs[clave] || '', usuarioActual);
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar la nota de la tarea.');
      await cargarBD();
      return;
    }
    await cargarBD();
  };

  const handleCrearHorario = async (e) => {
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
      usuario: usuarioActual
    });
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar el horario.');
      return;
    }

    setHoraInicioHorario('');
    setHoraFinHorario('');
    setAulaHorario('');
    await cargarBD();
    setPestana('horarios');
  };

  const handleEliminarHorario = async (id) => {
    if (!confirm('¿Seguro que querés borrar este horario?')) return;
    const resultado = await eliminarHorarioAction(id, usuarioActual);
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudo borrar el horario.');
      return;
    }
    await cargarBD();
  };

  // HANDLERS PARCIALES Y NOTAS
  const handleCrearParcial = async (e) => {
    e.preventDefault();
    if (!nombreParcial.trim() || !materiaParcialSel) return;
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

    if (!resultado?.exito) {
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

  const iniciarEdicionParcial = (parcial) => {
    setParcialEnEdicion(parcial);
    setMateriaParcialSel(parcial.materia_id);
    setNombreParcial(parcial.nombre);
    setFechaParcial(parcial.fecha === 'Sin fecha' ? '' : parcial.fecha);
    setDetallesParcial(parcial.detalles === 'Sin observaciones' ? '' : parcial.detalles || '');
    setPestana('admin');
  };

  const handleEliminarParcial = async (id) => {
    if (confirm('¿Seguro que querés borrar este parcial y sus notas cargadas?')) {
      const resultado = await eliminarParcialAction(id, usuarioActual);
      if (!resultado?.exito) {
        alert(resultado?.mensaje || 'No se pudo borrar el parcial.');
        return;
      }
      await cargarBD();
    }
  };

  const handleNotaChangeLocal = (parcialId, alumno, valor) => {
    setNotasInputs((prev) => ({
      ...prev,
      [`${parcialId}_${alumno}`]: valor
    }));
  };

  const handleGuardarNotaOnBlur = async (parcialId, alumno) => {
    if (!esAdmin) return;
    const clave = `${parcialId}_${alumno}`;
    const valor = notasInputs[clave] || '';
    const resultado = await guardarNotaParcialAction(parcialId, alumno, valor, usuarioActual);
    if (!resultado?.exito) {
      alert(resultado?.mensaje || 'No se pudo guardar la nota.');
      await cargarBD();
    }
  };

  const parcialEstaHabilitado = (fecha) => {
    if (!fecha || fecha === 'Sin fecha') return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaParcial = new Date(`${fecha}T00:00:00`);
    return !Number.isNaN(fechaParcial.getTime()) && fechaParcial <= hoy;
  };

  const tareaEstaHabilitada = (fecha) => {
    if (!fecha || fecha === 'Sin fecha') return true;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaInicio = new Date(`${fecha}T00:00:00`);
    return !Number.isNaN(fechaInicio.getTime()) && fechaInicio <= hoy;
  };

  const tareaDentroDelPlazo = (fecha) => {
    if (!fecha || fecha === 'Sin fecha') return true;
    const diasRestantes = obtenerDiasHastaTarea(fecha);
    return diasRestantes !== null && diasRestantes >= 0;
  };

  const tareaPuedeGestionarse = (tarea) =>
    tareaEstaHabilitada(tarea.inicio) && tareaDentroDelPlazo(tarea.fin);

  const obtenerResumenTareasAlumno = (alumno) => {
    const tareasNoCompletadas = materias.flatMap((materia) => materia.tareas)
      .filter((tarea) => !tareaCompletadaPor(tarea, alumno));
    const pendientes = tareasNoCompletadas.filter((tarea) => tareaEstaHabilitada(tarea.inicio));
    const futuras = tareasNoCompletadas.filter((tarea) => !tareaEstaHabilitada(tarea.inicio));

    return { pendientes, futuras, tareasNoCompletadas };
  };

  const historialPorAlumno = (alumno) => {
    const tareas = materias.flatMap((materia) => materia.tareas
      .filter((tarea) => tareaCompletadaPor(tarea, alumno))
      .map((tarea) => ({
        id: `tarea-${tarea.id}`,
        materia: materia.nombre,
        nombre: tarea.nombre,
        unidad: tarea.unidad,
        fecha: tarea.conNota ? tarea.notaCargadaEn?.[alumno] : tarea.completadoEn?.[alumno],
        fechaCompletada: tarea.conNota ? tarea.notaCargadaEn?.[alumno] : tarea.completadoEn?.[alumno],
        nota: tarea.conNota ? tarea.notas?.[alumno] : null,
        tipo: tarea.conNota ? 'Tarea con nota' : esForo(tarea.nombre) ? 'Foro' : 'Actividad'
      })));
    const parcialesDelAlumno = notas
      .filter((nota) => nota.alumno === alumno)
      .map((nota) => {
        const parcial = parciales.find((item) => item.id === nota.parcial_id);
        return {
          id: `parcial-${nota.parcial_id}`,
          materia: materias.find((materia) => materia.id === parcial?.materia_id)?.nombre || 'Materia',
          nombre: parcial?.nombre || 'Parcial',
          fecha: nota.cargada_en,
          fechaCompletada: nota.cargada_en,
          nota: nota.nota,
          tipo: 'Parcial'
        };
      });

    return [...tareas, ...parcialesDelAlumno].sort((a, b) => obtenerTimestamp(b.fecha) - obtenerTimestamp(a.fecha));
  };

  const agruparHistorial = (historial) => {
    const materiasHistorial = new Map();

    historial.forEach((registro) => {
      const gruposPorUnidad = materiasHistorial.get(registro.materia) || new Map();
      const claveUnidad = registro.tipo === 'Parcial'
        ? 'Evaluaciones'
        : registro.unidad || 'Sin unidad';
      const registrosUnidad = gruposPorUnidad.get(claveUnidad) || [];
      registrosUnidad.push(registro);
      gruposPorUnidad.set(claveUnidad, registrosUnidad);
      materiasHistorial.set(registro.materia, gruposPorUnidad);
    });

    return [...materiasHistorial.entries()]
      .map(([materia, gruposPorUnidad]) => ({
        materia,
        grupos: [...gruposPorUnidad.entries()]
          .map(([unidad, registros]) => ({
            unidad,
            registros: registros.sort((a, b) => obtenerTimestamp(b.fecha) - obtenerTimestamp(a.fecha))
          }))
          .sort((a, b) => {
            if (a.unidad === 'Sin unidad') return 1;
            if (b.unidad === 'Sin unidad') return -1;
            if (a.unidad === 'Evaluaciones') return -1;
            if (b.unidad === 'Evaluaciones') return 1;
            return Number(b.unidad) - Number(a.unidad);
          })
      }))
      .sort((a, b) => {
        const fechaA = obtenerTimestamp(a.grupos[0]?.registros[0]?.fecha) || 0;
        const fechaB = obtenerTimestamp(b.grupos[0]?.registros[0]?.fecha) || 0;
        return fechaB - fechaA;
      });
  };

  const toggleNotasParcial = (parcialId) => {
    setNotasDesplegadas((prev) => ({
      ...prev,
      [parcialId]: !prev[parcialId]
    }));
  };

  const toggleTareaDesdeCliente = async (tareaId, alumno, tarea) => {
    if (!tareaEstaHabilitada(tarea.inicio)) {
      alert('La tarea todavía no está habilitada.');
      return;
    }
    if (!tareaDentroDelPlazo(tarea.fin)) {
      alert('La tarea ya cerró.');
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
  const alumnosDelHistorial = usuarioActual
    ? [usuarioActual, ...restoDeAlumnos]
    : alumnos;
  const parcialesOrdenados = ordenarParciales(parciales);
  const proximoParcial = parcialesOrdenados.find(
    (parcial) => obtenerFechaParcialEnMs(parcial.fecha) >= new Date().setHours(0, 0, 0, 0)
  );
  const materiaProximoParcial = proximoParcial
    ? materias.find((materia) => materia.id === proximoParcial.materia_id)
    : null;
  const notificaciones = usuarioActual && !esAdmin
    ? [
      ...materias.flatMap((materia) => materia.tareas
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
      ...parciales
        .map((parcial) => ({
          id: `parcial-${parcial.id}`,
          tipo: 'parcial',
          nombre: parcial.nombre,
          materia: materias.find((materia) => materia.id === parcial.materia_id)?.nombre || 'Materia',
          dias: obtenerDiasHastaFecha(parcial.fecha)
        }))
        .filter(({ dias }) => dias === 1),
      ...materias.flatMap((materia) => materia.tareas
        .map((tarea) => ({
          id: `apertura-${tarea.id}`,
          tipo: 'apertura',
          nombre: tarea.nombre,
          materia: materia.nombre,
          dias: obtenerDiasHastaFecha(tarea.inicio)
        }))
        .filter(({ dias }) => dias === 1))
    ].sort((a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre))
    : [];
  const horariosProximoParcial = proximoParcial
    ? horarios
      .filter((horario) => horario.materia_id === proximoParcial.materia_id)
      .sort((a, b) => String(a.dia).localeCompare(String(b.dia)) || a.hora_inicio.localeCompare(b.hora_inicio))
    : [];
  const nombresDias = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes'
  };
  const ranking = alumnos
    .map((alumno) => {
      const tareasCompletadas = materias.flatMap((materia) => materia.tareas)
        .filter((tarea) => tareaCompletadaPor(tarea, alumno));
      const foros = tareasCompletadas.filter((tarea) => !tarea.conNota && esForo(tarea.nombre)).length;
      const actividades = tareasCompletadas.filter((tarea) => !tarea.conNota && !esForo(tarea.nombre)).length;
      const notasTareasAlumno = tareasCompletadas
        .filter((tarea) => tarea.conNota)
        .map((tarea) => Number.parseFloat(String(tarea.notas?.[alumno]).replace(',', '.')))
        .filter((nota) => Number.isFinite(nota) && nota >= 1 && nota <= 10);
      const notasAlumno = notas
        .filter((nota) => nota.alumno === alumno)
        .map((nota) => Number.parseFloat(String(nota.nota).replace(',', '.')))
        .filter((nota) => Number.isFinite(nota) && nota >= 0 && nota <= 10);
      const tareasConPuntaje = materias.flatMap((materia) => materia.tareas
        .filter((tarea) => tareaCompletadaPor(tarea, alumno))
        .map((tarea) => ({
          materia: materia.nombre,
          nombre: tarea.nombre,
          fechaCarga: tarea.conNota ? tarea.notaCargadaEn?.[alumno] : tarea.completadoEn?.[alumno],
          puntos: tarea.conNota
            ? Number.parseFloat(String(tarea.notas?.[alumno]).replace(',', '.'))
            : esForo(tarea.nombre) ? 1 : 2,
          tipo: tarea.conNota ? 'Nota de tarea' : esForo(tarea.nombre) ? 'Foro' : 'Actividad'
        }))
        .filter((tarea) => tarea.puntos >= (tarea.tipo === 'Nota de tarea' ? 1 : 0) && tarea.puntos <= (tarea.tipo === 'Nota de tarea' ? 10 : 2)));
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
        .filter((parcial) => Number.isFinite(parcial.nota) && parcial.nota >= 0 && parcial.nota <= 10);
      const ultimaCompletadaEn = tareasCompletadas
        .map((tarea) => tarea.conNota ? tarea.notaCargadaEn?.[alumno] : tarea.completadoEn?.[alumno])
        .map(obtenerTimestamp)
        .filter((fecha) => fecha !== null)
        .sort((a, b) => b - a)[0] || Number.MAX_SAFE_INTEGER;

      return {
        alumno,
        puntos: foros + actividades * 2 + notasAlumno.reduce((total, nota) => total + nota / 10, 0) + notasTareasAlumno.reduce((total, nota) => total + nota, 0),
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
  const datosComparacion = alumnoComparar && usuarioActual
    ? (() => {
      const usuarioRanking = ranking.find((item) => item.alumno === usuarioActual);
      const comparadoRanking = ranking.find((item) => item.alumno === alumnoComparar);
      if (!usuarioRanking || !comparadoRanking) return null;

      const historialUsuario = historialPorAlumno(usuarioActual);
      const historialComparado = historialPorAlumno(alumnoComparar);
      const diferenciaPuntos = usuarioRanking.puntos - comparadoRanking.puntos;
      const puntosEmpatados = Math.abs(diferenciaPuntos) < 0.0001;
      const ultimaTareaUsuario = historialUsuario.find((registro) => obtenerTimestamp(registro.fecha) !== null);
      const ultimaTareaComparado = historialComparado.find((registro) => obtenerTimestamp(registro.fecha) !== null);
      let motivo;

      if (!puntosEmpatados) {
        const ganador = diferenciaPuntos > 0 ? usuarioActual : alumnoComparar;
        motivo = `${ganador} está arriba porque tiene más puntos.`;
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
        motivo
      };
    })()
    : null;
  const parcialesAgrupados = parcialesOrdenados.reduce((grupos, parcial) => {
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

  return (
    <main className="min-h-screen bg-[#0f141c] text-slate-200 p-4 sm:p-6 md:p-10 font-sans selection:bg-blue-500 selection:text-white">
      <header className="max-w-9xl mx-auto mb-8 bg-[#161c26] border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🎓</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              UGR - Tareas y Parciales
            </h1>
          </div>
          <p className="text-sm sm:text-base text-slate-400 flex items-center gap-2 mt-1">
            {usuarioActual ? (
              <>
                <span>Alumno activo:</span>
                <strong className="text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg text-sm sm:text-base">
                  {usuarioActual}
                </strong>
              </>
            ) : (
              ''
            )}
          </p>
        </div>

        {usuarioActual && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                aria-label={`Notificaciones${notificaciones.length ? ` (${notificaciones.length})` : ''}`}
                aria-expanded={notificacionesAbiertas}
                onClick={() => setNotificacionesAbiertas((abiertas) => !abiertas)}
                className="relative bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-2.5 rounded-xl text-lg transition-all cursor-pointer"
              >
                🔔
                {notificaciones.length > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#161c26]">
                    {notificaciones.length > 9 ? '9+' : notificaciones.length}
                  </span>
                )}
              </button>
              {notificacionesAbiertas && (
                <div className="absolute right-0 top-14 z-50 w-[calc(100vw-2rem)] max-w-80 bg-[#161c26] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <p className="text-sm font-bold text-white">Recordatorios</p>
                    <span className="text-xs text-slate-400">Recordatorios</span>
                  </div>
                  {notificaciones.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-slate-400">No tenés recordatorios pendientes.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                      {notificaciones.map((notificacion) => {
                        const texto = notificacion.tipo === 'parcial'
                          ? 'Rendís mañana'
                          : notificacion.tipo === 'apertura'
                            ? 'Se habilita mañana'
                            : notificacion.dias === 0
                              ? 'Vence hoy'
                              : `Vence en ${notificacion.dias} ${notificacion.dias === 1 ? 'día' : 'días'}`;
                        return (
                          <button
                            type="button"
                            key={notificacion.id}
                            onClick={() => {
                              setPestana(notificacion.tipo === 'parcial' ? 'parciales' : 'materias');
                              setNotificacionesAbiertas(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-800/70 transition-colors cursor-pointer"
                          >
                            <p className="text-sm font-semibold text-slate-100 truncate">{notificacion.nombre}</p>
                            <p className="text-xs text-slate-400 mt-1">{notificacion.materia}</p>
                            <p className={`text-xs font-bold mt-2 ${notificacion.tipo === 'vencimiento' && notificacion.dias <= 2 ? 'text-red-300' : 'text-amber-300'}`}>
                              {texto}
                            </p>
                          </button>
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
            {esAdmin && (
              <button
                onClick={() => setPestana('admin')}
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
            Tenés {notificaciones.length} {notificaciones.length === 1 ? 'tarea próxima' : 'tareas próximas'} a vencer. Revisá tus recordatorios.
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
        <div className="max-w-md mx-auto mt-12 bg-[#161c26] border border-slate-800 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-slate-800/80 rounded-2xl mb-2 text-3xl">
              🔑
            </div>
            <h2 className="text-xl font-bold text-white">Iniciar Sesión</h2>
            <p className="text-sm text-slate-400 mt-1"></p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Usuario</label>
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={inputUser}
                onChange={(e) => setInputUser(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-800 focus:border-blue-500/80 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={inputPass}
                onChange={(e) => setInputPass(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-800 focus:border-blue-500/80 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
              />
            </div>
            
            {errorLogin && (
              <p className="text-sm text-red-400 text-center bg-red-950/30 border border-red-900/30 p-3 rounded-lg">
                ⚠️ {errorLogin}
              </p>
            )}
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider transition-all duration-200 shadow-md cursor-pointer"
            >
              Entrar
            </button>
          </form>

          {/* BOTÓN CAMBIAR CONTRASEÑA EN EL LOGIN */}
          <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={() => setModalPasswordOpen(true)}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
            >
              🔐 Modificar o cambiar mi contraseña
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-9xl mx-auto">
          {/* NAVEGACIÓN */}
          <div className="sticky top-0 z-40 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 mb-8 border-b border-slate-800/80 bg-[#0f141c]/95 shadow-lg backdrop-blur-sm flex flex-wrap gap-3">
            <button
              onClick={() => setPestana('alumnos')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'alumnos'
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>👥</span> Estado por Alumno
            </button>
            <button
              onClick={() => setPestana('materias')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'materias'
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>📚</span> Materias y Consignas
            </button>
            <button
              onClick={() => setPestana('promocion')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'promocion'
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🎯</span> Promoción
            </button>

            <button
              onClick={() => setPestana('historial')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'historial'
                  ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🕘</span> Historial
            </button>

            {/* NUEVO BOTÓN PARCIALES */}
            <button
              onClick={() => setPestana('parciales')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'parciales'
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>📋</span> Parciales y Notas
            </button>

            <button
              onClick={() => setPestana('ranking')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'ranking'
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🏆</span> Ranking
            </button>

            <button
              onClick={() => setPestana('horarios')}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                pestana === 'horarios'
                  ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-[#161c26] text-slate-400 border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <span>🗓️</span> Horarios de cursada
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
                <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
                  {proximoParcial && (
                    <aside className="lg:sticky lg:top-6 bg-purple-950/20 border border-purple-500/30 rounded-2xl p-5 shadow-sm">
                      <p className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-4">Próximo examen</p>
                      <div className="space-y-2">
                        <h2 className="text-lg font-bold text-white leading-snug">{proximoParcial.nombre}</h2>
                        <p className="text-sm text-purple-200 leading-relaxed">
                          {materiaProximoParcial?.nombre || 'Materia'}
                        </p>
                        <p className="text-xs font-semibold text-purple-300 border-t border-purple-500/20 pt-3">
                          Fecha: {formatearFechaDDMMAAAA(proximoParcial.fecha)}
                        </p>
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

                  <div className="space-y-8">
                  {/* TU TARJETA DESTACADA */}
                  <div className="bg-[#161c26] border-2 border-blue-500/80 rounded-2xl p-6 shadow-xl ring-1 ring-blue-500/20">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3">
                      <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                        <span>👤</span> {usuarioActual} <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">(Mis Tareas Pendientes)</span>
                      </h2>
                      {(() => {
                        const resumen = obtenerResumenTareasAlumno(usuarioActual);
                        return (
                          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            resumen.pendientes.length === 0
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}>
                            {resumen.pendientes.length === 0 ? '✓ Al día' : `${resumen.pendientes.length} por hacer`}
                            {resumen.futuras.length > 0 && ` · ${resumen.futuras.length} futura${resumen.futuras.length === 1 ? '' : 's'}`}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(() => {
                        const misMateriasConPendientes = materias.filter((m) =>
                          m.tareas.some((t) => !tareaCompletadaPor(t, usuarioActual))
                        );

                        if (misMateriasConPendientes.length === 0) {
                          return (
                            <div className="col-span-full text-center py-8 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 font-medium">
                              🎉 ¡Excelente! No tenés ninguna entrega pendiente.
                            </div>
                          );
                        }

                        return misMateriasConPendientes.map((m) => {
                          const tareasPendientes = m.tareas.filter(
                            (t) => !tareaCompletadaPor(t, usuarioActual)
                          );
                          const gruposTareas = agruparTareasPorUnidad(tareasPendientes);

                          return (
                            <div key={m.id} className="bg-[#0f141c] p-4 rounded-xl border border-slate-800/80">
                              <h3 className="text-sm font-bold text-amber-400/90 mb-3 flex items-center gap-1.5">
                                <span>📌</span> {m.nombre}
                              </h3>
                              {gruposTareas.map((grupo) => (
                                <div key={grupo.unidad || 'sin-unidad'} className="space-y-2.5">
                                  {grupo.unidad && <p className="text-xs font-bold uppercase tracking-wider text-blue-300">Unidad {formatearUnidad(grupo.unidad)}</p>}
                                  <ul className="space-y-3">
                                    {grupo.tareas.map((t) => {
                                      const semaforo = calcularEstadoSemaforo(t.fin);
                                      return (
                                        <li key={t.id} className="flex flex-col gap-1.5 bg-[#161c26]/80 p-3 rounded-lg border border-slate-800/60">
                                          <div className="flex items-start gap-2.5">
                                            {!t.conNota && (
                                              <input
                                                type="checkbox"
                                                checked={false}
                                                disabled={!tareaPuedeGestionarse(t)}
                                                onChange={() => toggleTareaDesdeCliente(t.id, usuarioActual, t)}
                                                className="mt-0.5 h-5 w-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                              />
                                            )}
                                            <span className="text-sm sm:text-base text-slate-100 font-semibold leading-snug">
                                              {t.nombre}{t.conNota && <span className="text-xs text-purple-300 font-normal"> (con nota)</span>}
                                            </span>
                                            {!tareaEstaHabilitada(t.inicio) && (
                                              <span className="text-[11px] text-blue-300">Abre el {formatearFechaDDMMAAAA(t.inicio)}</span>
                                            )}
                                          </div>
                                          <div className="pl-7 flex items-end justify-between gap-3">
                                            <span className={`text-xs px-2.5 py-0.5 rounded-md border ${semaforo.estilo}`}>
                                              {semaforo.texto}
                                            </span>
                                            {t.conNota && (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                pattern="[0-9]+([.,][0-9]+)?"
                                                placeholder="Nota"
                                                disabled={!tareaPuedeGestionarse(t)}
                                                value={notasTareasInputs[`${t.id}_${usuarioActual}`] || ''}
                                                onChange={(e) => handleNotaTareaChangeLocal(t.id, usuarioActual, e.target.value)}
                                                onBlur={() => handleGuardarNotaTareaOnBlur(t.id, usuarioActual)}
                                                className="w-20 bg-[#0f141c] border border-purple-500/50 rounded-lg p-1.5 text-center text-sm text-white focus:outline-none"
                                              />
                                            )}
                                          </div>
                                          {t.conNota && (
                                            <details className="pl-7 pt-1">
                                              <summary className="text-[11px] font-semibold text-blue-300 cursor-pointer select-none">
                                                Ver notas de los demás
                                              </summary>
                                              <div className="mt-2 space-y-1">
                                                {alumnos.filter((alumno) => alumno !== usuarioActual && t.notas?.[alumno] !== undefined).length > 0 ? (
                                                  alumnos
                                                    .filter((alumno) => alumno !== usuarioActual && t.notas?.[alumno] !== undefined)
                                                    .map((alumno) => (
                                                      <div key={alumno} className="flex justify-between gap-3 text-[11px] text-slate-300">
                                                        <span className="truncate">{alumno}</span>
                                                        <strong className="text-purple-300">{t.notas[alumno]}</strong>
                                                      </div>
                                                    ))
                                                ) : (
                                                  <span className="text-[11px] text-slate-500 italic">Todavía no hay notas cargadas.</span>
                                                )}
                                              </div>
                                            </details>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* RESTO DE COMPAÑEROS COLAPSADOS */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">
                      Compañeros de Cursada ({restoDeAlumnos.length})
                    </h3>

                    {restoDeAlumnos.map((alumno) => {
                      const estaDesplegado = !!alumnosDesplegados[alumno];

                      const resumenAlumno = obtenerResumenTareasAlumno(alumno);

                      return (
                        <div
                          key={alumno}
                          className="bg-[#161c26] border border-slate-800/80 rounded-2xl overflow-hidden transition-all"
                        >
                          <button
                            onClick={() => toggleDesplegarAlumno(alumno)}
                            className="w-full p-4 sm:p-5 flex justify-between items-center text-left hover:bg-slate-800/40 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">👤</span>
                              <div className="flex flex-col items-start gap-1 min-w-0">
                                <span className="text-base font-bold text-white">{alumno}</span>
                              </div>
                              <span className="text-xs text-slate-500 font-normal hidden sm:inline">
                                {estaDesplegado ? '(Tocar para ocultar)' : '(Tocar para ver detalle)'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                                  resumenAlumno.pendientes.length === 0
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {resumenAlumno.pendientes.length === 0 ? '✓ Al día' : `${resumenAlumno.pendientes.length} por hacer`}
                                {resumenAlumno.futuras.length > 0 && ` · ${resumenAlumno.futuras.length} futura${resumenAlumno.futuras.length === 1 ? '' : 's'}`}
                              </span>
                              <span className="text-slate-400 text-sm font-bold">
                                {estaDesplegado ? '▲' : '▼'}
                              </span>
                            </div>
                          </button>

                          {estaDesplegado && (
                            <div className="p-5 border-t border-slate-800/80 bg-[#0f141c]/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {resumenAlumno.tareasNoCompletadas.length === 0 ? (
                                <p className="col-span-full text-sm text-emerald-400/90 italic py-3 text-center">
                                  🎉 ¡Al día! Este alumno no tiene tareas pendientes.
                                </p>
                              ) : (
                                <>
                                {resumenAlumno.pendientes.length === 0 && resumenAlumno.futuras.length > 0 && (
                                  <p className="col-span-full text-sm text-blue-300/90 italic py-3 text-center">
                                    No tiene tareas abiertas pendientes. Tiene {resumenAlumno.futuras.length} tarea{resumenAlumno.futuras.length === 1 ? '' : 's'} futura{resumenAlumno.futuras.length === 1 ? '' : 's'}.
                                  </p>
                                )}
                                {materias.map((m) => {
                                  const tareasPendientes = m.tareas.filter(
                                    (t) => !tareaCompletadaPor(t, alumno)
                                  );

                                  if (tareasPendientes.length === 0) return null;
                                  const gruposTareas = agruparTareasPorUnidad(tareasPendientes);

                                  return (
                                    <div key={m.id} className="bg-[#0f141c] p-4 rounded-xl border border-slate-800/60">
                                      <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                                        <span>📌</span> {m.nombre}
                                      </h4>
                                      {gruposTareas.map((grupo) => (
                                        <div key={grupo.unidad || 'sin-unidad'} className="space-y-2 mb-3 last:mb-0">
                                          {grupo.unidad && <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300">Unidad {formatearUnidad(grupo.unidad)}</p>}
                                          <ul className="space-y-2">
                                            {grupo.tareas.map((t) => {
                                              const semaforo = calcularEstadoSemaforo(t.fin);
                                              return (
                                                <li key={t.id} className="bg-[#161c26]/60 p-2.5 rounded-lg border border-slate-800/50 flex flex-col gap-1">
                                                  <span className="text-xs text-slate-200 font-semibold">
                                                    • {t.nombre}
                                                  </span>
                                                  {!tareaEstaHabilitada(t.inicio) && (
                                                    <span className="text-[10px] text-blue-300">Abre el {formatearFechaDDMMAAAA(t.inicio)}</span>
                                                  )}
                                                  <span className={`text-[10px] w-fit px-2 py-0.5 rounded border ${semaforo.estilo}`}>
                                                    {semaforo.texto}
                                                  </span>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>

                </div>
              )}

              {/* VISTA 2: MATERIAS */}
              {pestana === 'materias' && (
                <div className="space-y-6">
                  {materias.length === 0 ? (
                    <div className="bg-[#161c26] border border-slate-800 p-12 rounded-2xl text-center text-slate-400 text-sm">
                      Todavía no hay materias cargadas.
                    </div>
                  ) : (
                    materias.map((m) => {
                      const mostrarCompletadas = !!materiasDesplegadas[m.id];
                      const tareasPendientes = m.tareas.filter(
                        (t) => !tareaCompletadaPor(t, usuarioActual)
                      );
                      const tareasCompletadas = m.tareas.filter(
                        (t) => tareaCompletadaPor(t, usuarioActual)
                      );
                      const gruposTareas = agruparTareasPorUnidad(
                        mostrarCompletadas ? m.tareas : tareasPendientes
                      );

                      return (
                        <div key={m.id} className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 border-b border-slate-800 pb-3 gap-3">
                            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                              <span>📘</span> {m.nombre}
                            </h2>
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              {tareasCompletadas.length > 0 && (
                                <button
                                  onClick={() => toggleDesplegarMateria(m.id)}
                                  className="text-xs text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                                >
                                  {mostrarCompletadas
                                    ? 'Ocultar completadas'
                                    : `Mostrar ${tareasCompletadas.length} completada${tareasCompletadas.length === 1 ? '' : 's'}`}
                                </button>
                              )}
                              {esAdmin && (
                                <div className="flex gap-2">
                                <button
                                  onClick={() => setMateriaCondicionesEnEdicion({
                                    id: m.id,
                                    condiciones: m.condiciones || '',
                                    notaMinimaRegularizar: m.notaMinimaRegularizar,
                                    notaMinimaPromocionar: m.notaMinimaPromocionar
                                  })}
                                  className="text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                                >
                                  Condiciones
                                </button>
                                <button
                                  onClick={() => setMateriaEnEdicion({ id: m.id, nombre: m.nombre })}
                                  className="text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleEliminarMateria(m.id, m.nombre)}
                                  className="text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                                >
                                  Eliminar
                                </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-5">
                            {gruposTareas.length === 0 ? (
                              <p className="text-sm text-slate-500 italic">
                                {m.tareas.length === 0
                                  ? 'Sin consignas cargadas en esta materia.'
                                  : 'Ya completaste todas las tareas de esta materia.'}
                              </p>
                            ) : (
                              gruposTareas.map((grupo) => (
                                <div key={grupo.unidad || 'sin-unidad'} className="space-y-3">
                                  {grupo.unidad && (
                                    <h3 className="border-b border-blue-500/20 pb-2 text-sm font-extrabold uppercase tracking-wider text-blue-300">
                                      Unidad {formatearUnidad(grupo.unidad)}
                                    </h3>
                                  )}
                                  {grupo.tareas.map((t) => {
                                    const semaforo = calcularEstadoSemaforo(t.fin);

                                    return (
                                      <div key={t.id} className="bg-[#0f141c] p-6 rounded-xl border border-slate-800/80 flex flex-col lg:flex-row justify-between gap-6">
                                    <div className="space-y-3 flex-1">
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="font-bold text-blue-400 text-base sm:text-lg flex items-center gap-2">
                                          <span>📝</span> {t.nombre}
                                        </h3>

                                        <span className={`text-xs px-3 py-1 rounded-md border ${semaforo.estilo}`}>
                                          {semaforo.texto}
                                        </span>
                                        {t.conNota && (
                                          <span className="text-xs px-3 py-1 rounded-md border bg-purple-500/10 text-purple-300 border-purple-500/30">
                                            Tarea con nota
                                          </span>
                                        )}

                                        {esAdmin && (
                                          <div className="flex gap-1.5 ml-auto sm:ml-2">
                                            <button
                                              onClick={() => setTareaEnEdicion({ materiaId: m.id, tarea: { ...t } })}
                                              className="text-xs text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded font-semibold cursor-pointer"
                                            >
                                              Editar
                                            </button>
                                            <button
                                              onClick={() => handleEliminarTarea(t.id)}
                                              className="text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1 rounded font-semibold cursor-pointer"
                                            >
                                              Borrar
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      <div className="bg-[#161c26] border border-slate-800 rounded-xl p-4">
                                        <span className="text-xs font-semibold text-slate-400 block mb-1">
                                          📄 Detalle / Consigna:
                                        </span>
                                        <p className="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
                                          {t.detalles || 'Sin observaciones adicionales.'}
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap gap-5 text-xs sm:text-sm text-slate-400 pt-1 font-medium">
                                        <span className="flex items-center gap-1.5">
                                          📅 Abre: <strong className="text-slate-100">{formatearFechaDDMMAAAA(t.inicio)}</strong>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                          ⏳ Vence: <strong className="text-slate-100">{formatearFechaDDMMAAAA(t.fin)}</strong>
                                        </span>
                                      </div>
                                    </div>

                                    <div className="lg:w-[260px] border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between">
                                      {t.conNota ? (
                                        <div>
                                          <label className="text-xs sm:text-sm font-bold text-slate-300 block mb-2.5">
                                            Tu nota (1 a 10)
                                          </label>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            pattern="[0-9]+([.,][0-9]+)?"
                                            placeholder="-"
                                            disabled={!tareaPuedeGestionarse(t)}
                                            value={notasTareasInputs[`${t.id}_${usuarioActual}`] || ''}
                                            onChange={(e) => handleNotaTareaChangeLocal(t.id, usuarioActual, e.target.value)}
                                            onBlur={() => handleGuardarNotaTareaOnBlur(t.id, usuarioActual)}
                                            className="w-24 bg-[#161c26] border border-purple-500/50 rounded-lg p-2 text-center font-bold text-purple-300 focus:outline-none"
                                          />
                                        </div>
                                      ) : (
                                      <div>
                                        <span className="text-xs sm:text-sm font-bold text-slate-300 block mb-2.5">Completada por:</span>
                                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                                          {t.completadoPor.length > 0 ? (
                                            t.completadoPor.map((u) => {
                                              const puedoQuitar = u === usuarioActual || esAdmin;
                                              return (
                                                <span
                                                  key={u}
                                                  className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5"
                                                >
                                                  ✓ {u}
                                                  {puedoQuitar && (
                                                    <button
                                                      onClick={() => handleToggleTarea(t.id, u)}
                                                      className="hover:text-red-400 font-bold ml-1 text-xs cursor-pointer"
                                                    >
                                                      ✕
                                                    </button>
                                                  )}
                                                </span>
                                              );
                                            })
                                          ) : (
                                            <span className="text-xs text-slate-600 italic">Nadie entregó todavía</span>
                                          )}
                                        </div>
                                      </div>
                                      )}
                                      {t.conNota && (
                                        <details className="mt-4 border-t border-slate-800 pt-3">
                                          <summary className="text-xs font-semibold text-blue-300 cursor-pointer select-none">
                                            Ver notas de los demás
                                          </summary>
                                          <div className="mt-2 space-y-1.5">
                                            {alumnos.filter((alumno) => alumno !== usuarioActual && t.notas?.[alumno] !== undefined).length > 0 ? (
                                              alumnos
                                                .filter((alumno) => alumno !== usuarioActual && t.notas?.[alumno] !== undefined)
                                                .map((alumno) => (
                                                  <div key={alumno} className="flex justify-between gap-3 text-xs text-slate-300">
                                                    <span className="truncate">{alumno}</span>
                                                    <strong className="text-purple-300">{t.notas[alumno]}</strong>
                                                  </div>
                                                ))
                                            ) : (
                                              <span className="text-xs text-slate-500 italic">Todavía no hay notas cargadas.</span>
                                            )}
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {pestana === 'promocion' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                      <span>🎯</span> Promoción por materia
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Estado calculado con los trabajos prácticos y sus notas.</p>
                  </div>
                  {materias.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Todavía no hay materias cargadas.</p>
                  ) : (
                    materias.map((materia) => (
                      <section key={materia.id} className="bg-[#161c26] border border-slate-800 rounded-2xl p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-4">
                          <div>
                            <h3 className="text-lg font-bold text-white">{materia.nombre}</h3>
                            <p className="text-xs text-slate-400 mt-1">Regulariza desde {materia.notaMinimaRegularizar} · Promociona desde {materia.notaMinimaPromocionar}</p>
                          </div>
                          {esAdmin && (
                            <button
                              onClick={() => setMateriaCondicionesEnEdicion({
                                id: materia.id,
                                condiciones: materia.condiciones || '',
                                notaMinimaRegularizar: materia.notaMinimaRegularizar,
                                notaMinimaPromocionar: materia.notaMinimaPromocionar
                              })}
                              className="text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                            >
                              Editar condiciones
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap mt-4">
                          {materia.condiciones || 'Condiciones todavía no cargadas.'}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
                          {alumnos.map((alumno) => {
                            const estado = obtenerEstadoMateria(materia, alumno);
                            return (
                              <div key={alumno} className="flex items-center justify-between gap-3 bg-[#0f141c] border border-slate-800 rounded-xl p-3">
                                <span className="text-sm font-semibold text-slate-200 truncate">{alumno}</span>
                                {estado ? (
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${estado.estilo}`}>{estado.texto}</span>
                                ) : (
                                  <span className="text-xs text-slate-500">Sin regla</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              )}

              {pestana === 'historial' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                      <span>🕘</span> Historial de entregas y notas
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Tareas realizadas y calificaciones registradas por alumno.</p>
                  </div>

                  {datosComparacion && (
                    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-white">
                            Comparación: {usuarioActual} vs. {alumnoComparar}
                          </h3>
                          <p className="mt-2 text-sm text-emerald-200">{datosComparacion.motivo}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAlumnoComparar('')}
                          className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[datosComparacion.usuarioRanking, datosComparacion.comparadoRanking].map((item) => (
                          <div key={item.alumno} className="rounded-xl border border-slate-800/80 bg-[#0f141c] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-white">{item.alumno}</span>
                              <strong className="text-emerald-300">{item.puntos.toFixed(1)} pts</strong>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.tareasConPuntaje.length + item.parcialesConPuntaje.length} registros con puntaje · {item.actividades} actividades
                            </p>
                            {item.alumno === usuarioActual && datosComparacion.ultimaTareaUsuario ? (
                              <p className="mt-2 text-xs text-slate-400">
                                Última tarea: {datosComparacion.ultimaTareaUsuario.nombre} · {formatearFechaHora(datosComparacion.ultimaTareaUsuario.fecha)}
                              </p>
                            ) : item.alumno === alumnoComparar && datosComparacion.ultimaTareaComparado ? (
                              <p className="mt-2 text-xs text-slate-400">
                                Última tarea: {datosComparacion.ultimaTareaComparado.nombre} · {formatearFechaHora(datosComparacion.ultimaTareaComparado.fecha)}
                              </p>
                            ) : (
                              <p className="mt-2 text-xs text-slate-500">Sin tareas con fecha registrada.</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {datosComparacion.puntosEmpatados && (
                        <p className="mt-3 text-xs text-slate-400">
                          Están empatados en puntos. El orden se resolvió comparando la fecha de la última tarea registrada y, si hace falta, la cantidad de actividades.
                        </p>
                      )}
                    </div>
                  )}

                  {alumnosDelHistorial.map((alumno) => {
                    const estaDesplegado = alumno === usuarioActual || !!alumnosDesplegados[`historial-${alumno}`];
                    const historial = historialPorAlumno(alumno);
                    const historialAgrupado = agruparHistorial(historial);

                    return (
                      <details
                        key={alumno}
                        open={estaDesplegado}
                        onToggle={(evento) => {
                          if (alumno !== usuarioActual) {
                            const abierto = evento.currentTarget.open;
                            setAlumnosDesplegados((prev) => ({
                              ...prev,
                              [`historial-${alumno}`]: abierto
                            }));
                          }
                        }}
                        className={`bg-[#161c26] border rounded-2xl overflow-hidden ${
                          alumno === usuarioActual ? 'border-blue-500/70' : 'border-slate-800/80'
                        }`}
                      >
                        <summary className="cursor-pointer list-none p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-slate-800/40">
                          <span className="font-bold text-white flex items-center gap-2">
                            <span>👤</span> {alumno}
                            {alumno === usuarioActual && <span className="text-xs font-semibold text-blue-300">(vos)</span>}
                          </span>
                          <span className="text-xs text-slate-400">{historial.length} registro{historial.length === 1 ? '' : 's'}</span>
                        </summary>
                        <div className="border-t border-slate-800/80 p-4 sm:p-5">
                          {alumno !== usuarioActual && (
                            <button
                              type="button"
                              onClick={() => setAlumnoComparar(alumno)}
                              className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                            >
                              Comparar conmigo
                            </button>
                          )}
                          {historial.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Todavía no hay tareas realizadas ni notas registradas.</p>
                          ) : (
                            <div className="space-y-5">
                              {historialAgrupado.map((grupoMateria) => (
                                <section key={grupoMateria.materia} className="space-y-3">
                                  <h3 className="border-b border-cyan-500/30 pb-2 text-sm font-extrabold uppercase tracking-wider text-cyan-300">
                                    {grupoMateria.materia}
                                  </h3>
                                  {grupoMateria.grupos.map((grupoUnidad) => (
                                    <div key={grupoUnidad.unidad} className="space-y-2">
                                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">
                                        {grupoUnidad.unidad === 'Evaluaciones'
                                          ? grupoUnidad.unidad
                                          : grupoUnidad.unidad === 'Sin unidad'
                                            ? grupoUnidad.unidad
                                            : `Unidad ${formatearUnidad(grupoUnidad.unidad)}`}
                                      </h4>
                                      {grupoUnidad.registros.map((registro) => (
                                        <div key={registro.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0f141c] p-3">
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-200 truncate">{registro.nombre}</p>
                                            <p className="text-xs text-slate-500">{registro.tipo}</p>
                                          </div>
                                          <div className="flex items-center gap-3 shrink-0">
                                            {registro.fechaCompletada && (
                                              <span className="text-[11px] text-slate-500">
                                                Completada: {formatearFechaHora(registro.fechaCompletada)}
                                              </span>
                                            )}
                                            {registro.nota !== null && registro.nota !== undefined && (
                                              <strong className="text-sm text-purple-300">Nota: {registro.nota}/10</strong>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </section>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}

              {/* VISTA NUEVA: PARCIALES Y NOTAS */}
              {pestana === 'parciales' && (
                <div className="space-y-6">
                  {parciales.length === 0 ? (
                    <div className="bg-[#161c26] border border-slate-800 p-12 rounded-2xl text-center text-slate-400 text-sm">
                      Aún no se han programado parciales.
                    </div>
                  ) : (
                    parcialesAgrupados.map((grupo) => (
                      <section key={grupo.id} className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                          <span className="text-lg">📘</span>
                          <h2 className="text-lg sm:text-xl font-extrabold text-white">{grupo.nombre}</h2>
                        </div>

                        <div className="space-y-4">
                          {grupo.parciales.map((p) => {
                      const parcialDisponible = parcialEstaHabilitado(p.fecha);

                      return (
                        <div key={p.id} className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-slate-800 pb-3 gap-3">
                            <div>
                              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                                <span>📋</span> {p.nombre}
                              </h2>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <span className="text-xs sm:text-sm bg-purple-500/10 text-purple-300 border border-purple-500/30 px-3.5 py-1.5 rounded-xl font-semibold">
                                📅 {formatearFechaDDMMAAAA(p.fecha)}
                              </span>
                              {esAdmin && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => iniciarEdicionParcial(p)}
                                    className="text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleEliminarParcial(p.id)}
                                    className="text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                                  >
                                    Borrar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {p.detalles && (
                            <p className="text-sm text-slate-300 mb-6 bg-[#0f141c] p-3.5 rounded-xl border border-slate-800/80">
                              ℹ️ {p.detalles}
                            </p>
                          )}

                          {/* SECCIÓN CARGA DE NOTAS */}
                          <div className="border-t border-slate-800/80 pt-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                  {esAdmin ? 'Cargar notas' : 'Tu nota'}
                                </h3>
                                {!parcialDisponible && (
                                  <p className="text-xs text-amber-300 mt-1">
                                    La carga se habilita a partir de la fecha del parcial.
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleNotasParcial(p.id)}
                                className="text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg font-semibold cursor-pointer"
                              >
                                {notasDesplegadas[p.id]
                                  ? 'Ocultar notas'
                                  : esAdmin && parcialDisponible
                                    ? 'Cargar notas'
                                    : 'Ver notas'}
                              </button>
                            </div>

                            {usuarioActual && (() => {
                              const claveMiNota = `${p.id}_${usuarioActual}`;
                              const valorMiNota = notasInputs[claveMiNota] || '';

                              return (
                                <div className="bg-purple-950/20 border border-purple-500/40 p-3 rounded-xl flex items-center justify-between gap-3">
                                  <span className="text-sm font-semibold text-slate-200 flex items-center gap-2 truncate">
                                    <span>👤</span> Tu nota ({usuarioActual})
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]+([.,][0-9]+)?"
                                    placeholder="-"
                                    disabled={!esAdmin || !parcialDisponible}
                                    value={valorMiNota}
                                    onChange={(e) => handleNotaChangeLocal(p.id, usuarioActual, e.target.value)}
                                    onBlur={() => handleGuardarNotaOnBlur(p.id, usuarioActual)}
                                    className={`w-16 text-center font-bold text-sm py-1 px-2 rounded-lg border focus:outline-none transition-all ${
                                      esAdmin && parcialDisponible
                                        ? 'bg-[#161c26] text-purple-300 border-purple-500/50 focus:border-purple-400'
                                        : 'bg-transparent text-slate-400 border-transparent cursor-not-allowed'
                                    }`}
                                  />
                                </div>
                              );
                            })()}

                            {notasDesplegadas[p.id] && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                                {alumnos.filter((alum) => alum !== usuarioActual).map((alum) => {
                                  const claveInput = `${p.id}_${alum}`;
                                  const valorNota = notasInputs[claveInput] || '';

                                  return (
                                    <div
                                      key={alum}
                                      className="p-3 rounded-xl border flex items-center justify-between gap-3 bg-[#0f141c] border-slate-800/80"
                                    >
                                      <span className="text-sm font-semibold text-slate-200 flex items-center gap-2 truncate">
                                        <span>👤</span> {alum}
                                      </span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]+([.,][0-9]+)?"
                                        placeholder="-"
                                        disabled={!esAdmin || !parcialDisponible}
                                        value={valorNota}
                                        onChange={(e) => handleNotaChangeLocal(p.id, alum, e.target.value)}
                                        onBlur={() => handleGuardarNotaOnBlur(p.id, alum)}
                                        className={`w-16 text-center font-bold text-sm py-1 px-2 rounded-lg border focus:outline-none transition-all ${
                                          esAdmin && parcialDisponible
                                            ? 'bg-[#161c26] text-purple-300 border-purple-500/50 focus:border-purple-400'
                                            : 'bg-transparent text-slate-400 border-transparent cursor-not-allowed'
                                        }`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              )}

              {pestana === 'ranking' && (
                <div className="space-y-6">
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 border-b border-slate-800 pb-4">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                          <span>🏆</span> Ranking de la cursada
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">Puntaje acumulado de tareas, foros y parciales.</p>
                      </div>
                      <span className="text-xs text-slate-500">Se actualiza al marcar tareas</span>
                    </div>

                    {ranking.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Todavía no hay alumnos cargados.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {rankingPodio.map((item, indice) => {
                            const iconosPodio = ['🥇', '🥈', '🥉'];
                            const estilosPodio = [
                              'border-amber-400/60 bg-amber-500/10',
                              'border-slate-400/60 bg-slate-400/10',
                              'border-orange-700/60 bg-orange-700/10'
                            ];

                            return (
                              <div
                                key={item.alumno}
                                className={`flex flex-col items-center text-center gap-2 p-5 rounded-2xl border ${
                                  item.alumno === usuarioActual
                                    ? 'ring-2 ring-emerald-400/60'
                                    : ''
                                } ${estilosPodio[indice]}`}
                              >
                                <span className="text-4xl">{iconosPodio[indice]}</span>
                                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">{indice + 1}° puesto</span>
                                <p className="font-extrabold text-white text-lg truncate max-w-full">{item.alumno}</p>
                                <strong className="text-2xl font-extrabold text-emerald-300">{item.puntos.toFixed(1)}</strong>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400">puntos</span>
                              </div>
                            );
                          })}
                        </div>

                        {restoRanking.length > 0 && (
                          <div className="mt-6 space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resto de la cursada</h3>
                            {restoRanking.map((item, indice) => (
                              <div
                                key={item.alumno}
                                className={`flex items-center gap-3 sm:gap-4 p-4 rounded-xl border ${
                                  item.alumno === usuarioActual
                                    ? 'bg-emerald-500/10 border-emerald-500/40'
                                    : 'bg-[#0f141c] border-slate-800/80'
                                }`}
                              >
                                <span className="w-8 text-center text-lg font-extrabold text-slate-400">#{indice + 4}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-white truncate">{item.alumno}</p>
                                </div>
                                <span className="text-right">
                                  <strong className="block text-xl font-extrabold text-emerald-300">{item.puntos.toFixed(1)}</strong>
                                  <small className="text-[10px] uppercase tracking-wider text-slate-500">puntos</small>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {pestana === 'horarios' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Semana de cursada</p>
                      <h2 className="mt-1 text-2xl font-extrabold text-white">Horarios</h2>
                    </div>
                    <p className="text-xs text-slate-500">{horarios.length} {horarios.length === 1 ? 'clase cargada' : 'clases cargadas'}</p>
                  </div>
                  {horarios.length === 0 ? (
                    <div className="bg-[#161c26] border border-slate-800 p-12 rounded-2xl text-center text-slate-400 text-sm">
                      Todavía no hay horarios de cursada cargados.
                    </div>
                  ) : (
                    <div className="schedule-scroll rounded-2xl border border-slate-800 bg-[#111821] p-3 sm:p-4">
                      <div className="grid min-w-[900px] grid-cols-5 gap-4">
                        {[
                          ['1', 'Lunes', 'text-cyan-300', 'bg-cyan-400'],
                          ['2', 'Martes', 'text-blue-300', 'bg-blue-400'],
                          ['3', 'Miércoles', 'text-violet-300', 'bg-violet-400'],
                          ['4', 'Jueves', 'text-fuchsia-300', 'bg-fuchsia-400'],
                          ['5', 'Viernes', 'text-amber-300', 'bg-amber-400']
                        ].map(([dia, nombreDia, colorTexto, colorBarra]) => {
                          const horariosDelDia = horarios
                            .filter((horario) => String(horario.dia) === dia)
                            .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

                          return (
                            <section key={dia} className="schedule-day min-h-80 rounded-xl border border-slate-800/80 bg-[#161c26] p-4">
                              <header className="mb-4 border-b border-slate-800 pb-3">
                                <p className={`text-sm font-extrabold uppercase tracking-widest ${colorTexto}`}>{nombreDia}</p>
                                <p className="mt-1 text-xs text-slate-500">{horariosDelDia.length} {horariosDelDia.length === 1 ? 'clase' : 'clases'}</p>
                              </header>
                              <div className="space-y-3">
                                {horariosDelDia.length === 0 ? (
                                  <p className="px-1 py-6 text-center text-xs text-slate-600">Libre</p>
                                ) : horariosDelDia.map((horario) => {
                                  const materia = materias.find((item) => item.id === horario.materia_id);
                                  return (
                                    <article key={horario.id} className="schedule-card relative overflow-hidden rounded-lg border border-slate-700/80 bg-[#0f141c] p-4 shadow-sm">
                                      <span className={`absolute inset-x-0 top-0 h-0.5 ${colorBarra}`} />
                                      <p className="text-sm font-bold text-white">{horario.hora_inicio} - {horario.hora_fin}</p>
                                      <p className="mt-3 line-clamp-2 text-sm font-semibold leading-tight text-slate-200">{materia?.nombre || 'Materia no disponible'}</p>
                                      {horario.aula && <p className="mt-3 text-xs text-slate-500">Aula {horario.aula}</p>}
                                      {esAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleEliminarHorario(horario.id)}
                                          className="mt-3 text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                                        >
                                          Borrar
                                        </button>
                                      )}
                                    </article>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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
                            <option key={m.id} value={m.id}>{m.nombre}</option>
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
                          rows="3"
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
                            <option key={m.id} value={m.id}>{m.nombre}</option>
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
                          rows="3"
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
                            <option key={m.id} value={m.id}>{m.nombre}</option>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Abre</label>
                  <input
                    type="date"
                    value={tareaEnEdicion.tarea.inicio}
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
                    value={tareaEnEdicion.tarea.fin}
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
                  rows="4"
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
                  rows="5"
                  value={materiaCondicionesEnEdicion.condiciones}
                  onChange={(e) => setMateriaCondicionesEnEdicion({ ...materiaCondicionesEnEdicion, condiciones: e.target.value })}
                  placeholder="Ej: Para regularizar hay que completar todos los trabajos prácticos..."
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mínima para regularizar</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.01"
                    value={materiaCondicionesEnEdicion.notaMinimaRegularizar}
                    onChange={(e) => setMateriaCondicionesEnEdicion({ ...materiaCondicionesEnEdicion, notaMinimaRegularizar: e.target.value })}
                    className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mínima para promocionar</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
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
    </main>
  );
}
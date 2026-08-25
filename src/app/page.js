'use client';

import { useState, useEffect } from 'react';
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
  crearTareaAction,
  editarTareaAction,
  eliminarTareaAction,
  cambiarPasswordAction,
  obtenerParcialesAction,
  crearParcialAction,
  editarParcialAction,
  eliminarParcialAction,
  guardarNotaParcialAction
} from './actions';

export default function Home() {
  const [materias, setMaterias] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [pestana, setPestana] = useState('alumnos');
  const [cargando, setCargando] = useState(true);
  const [iniciado, setIniciado] = useState(false);

  // Estado para Parciales y Notas
  const [parciales, setParciales] = useState([]);
  const [notas, setNotas] = useState([]);
  const [notasInputs, setNotasInputs] = useState({});
  const [notasDesplegadas, setNotasDesplegadas] = useState({});

  // Acordeón para compañeros
  const [alumnosDesplegados, setAlumnosDesplegados] = useState({});
  const [materiasDesplegadas, setMateriasDesplegadas] = useState({});

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
  const [materiaSel, setMateriaSel] = useState('');
  const [nombreTarea, setNombreTarea] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [detallesTarea, setDetallesTarea] = useState('');

  // Form Admin (Parciales)
  const [materiaParcialSel, setMateriaParcialSel] = useState('');
  const [nombreParcial, setNombreParcial] = useState('');
  const [fechaParcial, setFechaParcial] = useState('');
  const [detallesParcial, setDetallesParcial] = useState('');
  const [parcialEnEdicion, setParcialEnEdicion] = useState(null);

  // Modales edición
  const [tareaEnEdicion, setTareaEnEdicion] = useState(null);
  const [materiaEnEdicion, setMateriaEnEdicion] = useState(null);
  const [alumnoEnEdicion, setAlumnoEnEdicion] = useState(null);

  const esAdmin = usuarioActual === "Matute";

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
          setUsuarioActual(usuario);
          localStorage.setItem('sesion_ugr', JSON.stringify({ usuario, timestamp: ahora }));
        } else {
          localStorage.removeItem('sesion_ugr');
        }
      } catch (e) {
        localStorage.removeItem('sesion_ugr');
      }
    }
    setIniciado(true);
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

  const calcularEstadoSemaforo = (fechaFinStr) => {
    if (!fechaFinStr || fechaFinStr === 'Sin fecha') {
      return { texto: 'Sin fecha límite', estilo: 'bg-slate-800 text-slate-400 border-slate-700' };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let year, month, day;
    const partes = fechaFinStr.split('-');

    if (partes[0].length === 4) {
      [year, month, day] = partes.map(Number);
    } else {
      [day, month, year] = partes.map(Number);
    }

    const fechaLimite = new Date(year, month - 1, day);
    const diferenciaMs = fechaLimite.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

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

  const cargarBD = async () => {
    setCargando(true);
    const [dataMaterias, dataAlumnos, dataParciales] = await Promise.all([
      obtenerDatos(),
      obtenerAlumnosAction(),
      obtenerParcialesAction()
    ]);
    
    setMaterias(dataMaterias || []);
    setAlumnos(dataAlumnos || []);
    setParciales(dataParciales.parciales || []);
    setNotas(dataParciales.notas || []);

    // Inicializar inputs de notas locales
    const mapaNotas = {};
    if (dataParciales.notas) {
      dataParciales.notas.forEach((n) => {
        mapaNotas[`${n.parcial_id}_${n.alumno}`] = n.nota;
      });
    }
    setNotasInputs(mapaNotas);

    if (dataMaterias && dataMaterias.length > 0) {
      if (!materiaSel) setMateriaSel(dataMaterias[0].id);
      if (!materiaParcialSel) setMateriaParcialSel(dataMaterias[0].id);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarBD();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!inputUser.trim() || !inputPass.trim()) return;

    const res = await validarLoginAction(inputUser, inputPass);

    if (res.exito) {
      iniciarSesionLocal(res.usuario);
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
    await crearMateriaAction(nuevaMateriaNombre);
    setNuevaMateriaNombre('');
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
    await crearTareaAction({
      materiaId: materiaSel,
      nombre: nombreTarea,
      inicio: fechaInicio,
      fin: fechaFin,
      detalles: detallesTarea
    });
    setNombreTarea('');
    setFechaInicio('');
    setFechaFin('');
    setDetallesTarea('');
    await cargarBD();
    setPestana('materias');
  };

  const handleGuardarEdicionTarea = async (e) => {
    e.preventDefault();
    if (!tareaEnEdicion) return;
    await editarTareaAction(tareaEnEdicion.tarea);
    setTareaEnEdicion(null);
    await cargarBD();
  };

  const handleEliminarTarea = async (id) => {
    if (confirm('¿Seguro que querés borrar esta tarea?')) {
      await eliminarTareaAction(id);
      await cargarBD();
    }
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

  const toggleNotasParcial = (parcialId) => {
    setNotasDesplegadas((prev) => ({
      ...prev,
      [parcialId]: !prev[parcialId]
    }));
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

  return (
    <main className="min-h-screen bg-[#0f141c] text-slate-200 p-4 sm:p-6 md:p-10 font-sans selection:bg-blue-500 selection:text-white">
      <header className="max-w-6xl mx-auto mb-8 bg-[#161c26] border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
            <button
              onClick={() => {
                setUserPassChange(usuarioActual);
                setModalPasswordOpen(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              🔑 Cambiar Clave
            </button>
            <button
              onClick={cerrarSesionLocal}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>🚪</span> Salir
            </button>
          </div>
        )}
      </header>

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
        <div className="max-w-6xl mx-auto">
          {/* NAVEGACIÓN */}
          <div className="flex flex-wrap gap-3 mb-8">
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

            {esAdmin && (
              <button
                onClick={() => setPestana('admin')}
                className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ml-auto cursor-pointer ${
                  pestana === 'admin'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-[#161c26] text-amber-400/80 border-slate-800 hover:bg-slate-800/60'
                }`}
              >
                <span>⚙️</span> Panel de Carga
              </button>
            )}
          </div>

          {cargando ? (
            <div className="text-center py-20 text-slate-400 text-sm font-medium flex flex-col items-center gap-3">
              <span className="text-3xl animate-spin">⌛</span>
              Cargando datos de la cursada...
            </div>
          ) : (
            <>
              {pestana === 'alumnos' && (
                <div className="space-y-8">
                  {/* TU TARJETA DESTACADA */}
                  <div className="bg-[#161c26] border-2 border-blue-500/80 rounded-2xl p-6 shadow-xl ring-1 ring-blue-500/20">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3">
                      <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                        <span>👤</span> {usuarioActual} <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">(Mis Tareas Pendientes)</span>
                      </h2>
                      {(() => {
                        const misPendientes = materias.flatMap((m) =>
                          m.tareas.filter((t) => !t.completadoPor.includes(usuarioActual))
                        ).length;
                        return (
                          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            misPendientes === 0
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}>
                            {misPendientes === 0 ? '✓ Al día' : `${misPendientes} por hacer`}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(() => {
                        const misMateriasConPendientes = materias.filter((m) =>
                          m.tareas.some((t) => !t.completadoPor.includes(usuarioActual))
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
                            (t) => !t.completadoPor.includes(usuarioActual)
                          );
                          const tareasOrdenadas = ordenarTareas(tareasPendientes);

                          return (
                            <div key={m.id} className="bg-[#0f141c] p-4 rounded-xl border border-slate-800/80">
                              <h3 className="text-sm font-bold text-amber-400/90 mb-3 flex items-center gap-1.5">
                                <span>📌</span> {m.nombre}
                              </h3>
                              <ul className="space-y-3">
                                {tareasOrdenadas.map((t) => {
                                  const semaforo = calcularEstadoSemaforo(t.fin);
                                  return (
                                    <li key={t.id} className="flex flex-col gap-1.5 bg-[#161c26]/80 p-3 rounded-lg border border-slate-800/60">
                                      <div className="flex items-start gap-2.5">
                                        <input
                                          type="checkbox"
                                          checked={false}
                                          onChange={() => handleToggleTarea(t.id, usuarioActual)}
                                          className="mt-0.5 h-5 w-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span className="text-sm sm:text-base text-slate-100 font-semibold leading-snug">
                                          {t.nombre}
                                        </span>
                                      </div>
                                      <div className="pl-7 flex items-center justify-between">
                                        <span className={`text-xs px-2.5 py-0.5 rounded-md border ${semaforo.estilo}`}>
                                          {semaforo.texto}
                                        </span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
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

                      const pendientesTotal = materias.flatMap((m) =>
                        m.tareas.filter((t) => !t.completadoPor.includes(alumno))
                      ).length;

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
                              <span className="text-base font-bold text-white">{alumno}</span>
                              <span className="text-xs text-slate-500 font-normal hidden sm:inline">
                                {estaDesplegado ? '(Tocar para ocultar)' : '(Tocar para ver detalle)'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                                  pendientesTotal === 0
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {pendientesTotal === 0 ? '✓ Al día' : `${pendientesTotal} por hacer`}
                              </span>
                              <span className="text-slate-400 text-sm font-bold">
                                {estaDesplegado ? '▲' : '▼'}
                              </span>
                            </div>
                          </button>

                          {estaDesplegado && (
                            <div className="p-5 border-t border-slate-800/80 bg-[#0f141c]/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {pendientesTotal === 0 ? (
                                <p className="col-span-full text-sm text-emerald-400/90 italic py-3 text-center">
                                  🎉 ¡Al día! Este alumno no tiene tareas pendientes.
                                </p>
                              ) : (
                                materias.map((m) => {
                                  const tareasPendientes = m.tareas.filter(
                                    (t) => !t.completadoPor.includes(alumno)
                                  );

                                  if (tareasPendientes.length === 0) return null;
                                  const tareasOrdenadas = ordenarTareas(tareasPendientes);

                                  return (
                                    <div key={m.id} className="bg-[#0f141c] p-4 rounded-xl border border-slate-800/60">
                                      <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                                        <span>📌</span> {m.nombre}
                                      </h4>
                                      <ul className="space-y-2">
                                        {tareasOrdenadas.map((t) => {
                                          const semaforo = calcularEstadoSemaforo(t.fin);
                                          return (
                                            <li key={t.id} className="bg-[#161c26]/60 p-2.5 rounded-lg border border-slate-800/50 flex flex-col gap-1">
                                              <span className="text-xs text-slate-200 font-semibold">
                                                • {t.nombre}
                                              </span>
                                              <span className={`text-[10px] w-fit px-2 py-0.5 rounded border ${semaforo.estilo}`}>
                                                {semaforo.texto}
                                              </span>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                        (t) => !t.completadoPor.includes(usuarioActual)
                      );
                      const tareasCompletadas = m.tareas.filter(
                        (t) => t.completadoPor.includes(usuarioActual)
                      );
                      const tareasOrdenadas = ordenarTareas(
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
                            {tareasOrdenadas.length === 0 ? (
                              <p className="text-sm text-slate-500 italic">
                                {m.tareas.length === 0
                                  ? 'Sin consignas cargadas en esta materia.'
                                  : 'Ya completaste todas las tareas de esta materia.'}
                              </p>
                            ) : (
                              tareasOrdenadas.map((t) => {
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
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
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
                    parciales.map((p) => {
                      const materiaAsoc = materias.find((m) => m.id === p.materia_id);
                      const nombreMateria = materiaAsoc ? materiaAsoc.nombre : 'MATERIA';
                      const parcialDisponible = parcialEstaHabilitado(p.fecha);

                      return (
                        <div key={p.id} className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-slate-800 pb-3 gap-3">
                            <div>
                              <span className="text-xs font-extrabold text-purple-400 uppercase tracking-wider block mb-1">
                                📘 {nombreMateria}
                              </span>
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
                    })
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
    </main>
  );
}
import { useState } from 'react';
import { gestionarGrupoTareaAction } from '../app/actions';
import type { Grupo, Tarea } from '../core/cursada';
import type { GestionarGrupoParams } from '../app/actions';

interface Props {
  tarea: Tarea;
  usuarioActual: string | null;
  recargar: (mostrarCarga?: boolean) => void | Promise<unknown>;
  esAdmin?: boolean;
  alumnos?: string[];
}

export default function GrupoTarea({ tarea, usuarioActual, recargar, esAdmin = false, alumnos = [] }: Props) {
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [desplegados, setDesplegados] = useState<Record<string, boolean>>({});
  const [mostrarOtros, setMostrarOtros] = useState(false);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);

  // Panel admin
  const [adminAlumno, setAdminAlumno] = useState('');
  const [adminGrupoId, setAdminGrupoId] = useState('');
  const [adminNuevoNombre, setAdminNuevoNombre] = useState('');
  const [adminModo, setAdminModo] = useState('existente');

  const grupos = tarea.grupos || [];
  const cupo = Number(tarea.cupo_maximo) || 0;

  const plazas = (g: Grupo) => {
    const actuales = g.integrantes?.length || 0;
    return cupo === 0 ? `${actuales} integrante${actuales === 1 ? '' : 's'}` : `${actuales}/${cupo} plazas`;
  };

  const propio = grupos.find((g) => usuarioActual != null && g.integrantes?.includes(usuarioActual));

  const toggleDesplegado = (id: string | undefined) => {
    if (!id) return;
    setDesplegados((prev) => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  };

  const estaDesplegado = (id: string | undefined, porDefecto = true) => (
    id !== undefined && desplegados[id] !== undefined ? desplegados[id] : porDefecto
  );

  const gestionar = async (datos: Omit<GestionarGrupoParams, 'tareaId'>) => {
    if (ocupado) return;
    setOcupado(true);
    setMensaje('');
    try {
      const resultado = await gestionarGrupoTareaAction({ tareaId: tarea.id, ...datos });
      if (!resultado?.exito) {
        setMensaje(resultado?.mensaje || 'No se pudo actualizar el grupo.');
        return;
      }
      setNombre('');
      setAdminNuevoNombre('');
      await recargar();
    } catch {
      setMensaje('No se pudo actualizar el grupo. Probá nuevamente.');
    } finally {
      setOcupado(false);
    }
  };

  const handleAdminAsignar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adminAlumno) return setMensaje('Seleccioná un alumno.');
    if (adminModo === 'existente' && !adminGrupoId) return setMensaje('Seleccioná un grupo.');
    if (adminModo === 'nuevo' && !adminNuevoNombre.trim()) return setMensaje('Ingresá el nombre del grupo.');
    if (adminModo === 'existente') {
      await gestionar({ grupoId: adminGrupoId, alumnoNombre: adminAlumno });
    } else {
      await gestionar({ nombre: adminNuevoNombre.trim(), alumnoNombre: adminAlumno });
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#111927] to-[#0c1017] p-4 sm:p-5 space-y-4 shadow-sm text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base sm:text-lg">👥</span>
          <h4 className="font-bold text-cyan-300 text-sm sm:text-base">Trabajo Grupal</h4>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
            {cupo > 0 ? `Cupo máx: ${cupo}` : 'Sin límite de cupo'}
          </span>
        </div>
        {esAdmin && (
          <button
            type="button"
            onClick={() => setMostrarAdmin(!mostrarAdmin)}
            className="text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg font-semibold cursor-pointer self-start sm:self-auto"
          >
            🛠️ {mostrarAdmin ? 'Ocultar panel admin' : 'Administrar integrantes'}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Las entregas y notas registradas se sincronizan automáticamente entre todos los integrantes del grupo.
      </p>
      {propio ? (
        <div className="space-y-3">
          <div className="bg-[#141d2d] border border-cyan-500/30 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-400">Estás en el grupo:</span>
                <span className="font-bold text-cyan-200 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-lg">
                  {propio.nombre}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {plazas(propio)}
                </span>
              </div>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => gestionar({ salir: true })}
                className="text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-40"
              >
                Salir del grupo
              </button>
            </div>

            <div className="pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => toggleDesplegado(propio.id)}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 py-1 flex items-center gap-1.5 cursor-pointer"
              >
                <span>👥 Integrantes ({propio.integrantes?.length || 0})</span>
                <span className="text-[10px] text-slate-400">{estaDesplegado(propio.id, true) ? '▲ Ocultar' : '▼ Ver desplegable'}</span>
              </button>
              {estaDesplegado(propio.id, true) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {propio.integrantes?.map((m) => (
                    <span
                      key={m}
                      className={`text-xs px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                        m === usuarioActual
                          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 font-bold'
                          : 'bg-slate-800/90 text-slate-200 border-slate-700'
                      }`}
                    >
                      <span>👤 {m}</span>
                      {m === usuarioActual && <span className="text-[10px] text-cyan-400 font-normal">(vos)</span>}
                      {esAdmin && (
                        <button
                          type="button"
                          title={`Quitar a ${m}`}
                          disabled={ocupado}
                          onClick={() => gestionar({ salir: true, alumnoNombre: m })}
                          className="text-red-400 hover:text-red-300 ml-1 font-bold cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
            <span className="text-base leading-none">⚠️</span>
            <div>
              <span className="font-bold block text-sm">Todavía no estás en ningún grupo</span>
              <span>Unite a un grupo existente o creá uno nuevo para entregar la tarea y compartir notas.</span>
            </div>
          </div>

          {grupos.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Grupos disponibles:</span>
              <div className="space-y-2">
                {grupos.map((g) => {
                  const lleno = cupo > 0 && (g.integrantes?.length || 0) >= cupo;
                  const abierto = estaDesplegado(g.id, false);
                  return (
                    <div key={g.id} className="bg-[#121927] border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{g.nombre}</span>
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${
                            lleno ? 'bg-red-500/10 text-red-300 border-red-500/30' : 'bg-cyan-950/50 text-cyan-300 border-cyan-800/40'
                          }`}>
                            {lleno ? '🔴 Lleno' : plazas(g)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleDesplegado(g.id)}
                            className="text-xs text-slate-300 hover:text-cyan-300 flex items-center gap-1 cursor-pointer py-1 px-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60"
                          >
                            👥 Integrantes ({g.integrantes?.length || 0}) {abierto ? '▲' : '▼'}
                          </button>
                          <button
                            type="button"
                            disabled={ocupado || lleno}
                            onClick={() => g.id && gestionar({ grupoId: g.id })}
                            className="text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 disabled:opacity-40 px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            {lleno ? 'Cupo lleno' : 'Unirme'}
                          </button>
                          {esAdmin && (
                            <button
                              type="button"
                              title="Eliminar grupo"
                              disabled={ocupado}
                              onClick={() => g.id && confirm(`¿Eliminar "${g.nombre}"?`) && gestionar({ eliminarGrupoId: g.id })}
                              className="text-xs text-red-400 hover:text-red-300 p-1 cursor-pointer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                      {abierto && (
                        <div className="bg-[#090d14] rounded-lg p-2.5 border border-slate-800/80">
                          {g.integrantes?.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">Sin integrantes</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {g.integrantes?.map((m) => (
                                <span key={m} className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                                  👤 {m}
                                  {esAdmin && (
                                    <button
                                      type="button"
                                      title={`Quitar a ${m}`}
                                      disabled={ocupado}
                                      onClick={() => gestionar({ salir: true, alumnoNombre: m })}
                                      className="text-red-400 hover:text-red-300 ml-1 font-bold cursor-pointer text-xs"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="bg-[#121927] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">O creá tu propio grupo:</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                aria-label="Nombre del nuevo grupo"
                maxLength={100}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Grupo 1, Los Pumas, etc."
                disabled={ocupado}
                className="bg-[#0c1017] border border-slate-700 rounded-lg px-3 py-2 min-w-0 flex-1 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                disabled={ocupado || !nombre.trim()}
                onClick={() => gestionar({ nombre })}
                className="text-xs sm:text-sm font-semibold text-cyan-300 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg px-4 py-2 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                ➕ Crear y unirme
              </button>
            </div>
          </div>
        </div>
      )}

      {esAdmin && mostrarAdmin && (
        <div className="mt-3 pt-3 border-t border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 space-y-3">
          <h5 className="font-bold text-amber-300 text-xs sm:text-sm flex items-center gap-1.5">
            🛠️ Panel de Asignación Manual (Admin)
          </h5>
          <form onSubmit={handleAdminAsignar} className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Alumno:</label>
                <select
                  value={adminAlumno}
                  onChange={(e) => setAdminAlumno(e.target.value)}
                  disabled={ocupado}
                  className="w-full bg-[#0f141c] border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar alumno --</option>
                  {alumnos.map((a) => {
                    const gDeEste = grupos.find((g) => g.integrantes?.includes(a));
                    return (
                      <option key={a} value={a}>
                        {a} {gDeEste ? `(en: ${gDeEste.nombre})` : '(sin grupo)'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Tipo de asignación:</label>
                <div className="flex gap-3 pt-1">
                  <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                    <input type="radio" name="adminModo" value="existente" checked={adminModo === 'existente'} onChange={() => setAdminModo('existente')} />
                    Grupo existente
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                    <input type="radio" name="adminModo" value="nuevo" checked={adminModo === 'nuevo'} onChange={() => setAdminModo('nuevo')} />
                    Nuevo grupo
                  </label>
                </div>
              </div>
            </div>

            {adminModo === 'existente' ? (
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Grupo destino:</label>
                <select
                  value={adminGrupoId}
                  onChange={(e) => setAdminGrupoId(e.target.value)}
                  disabled={ocupado || grupos.length === 0}
                  className="w-full bg-[#0f141c] border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar grupo --</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre} ({plazas(g)})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Nombre del nuevo grupo:</label>
                <input
                  type="text"
                  maxLength={100}
                  value={adminNuevoNombre}
                  onChange={(e) => setAdminNuevoNombre(e.target.value)}
                  placeholder="Nombre del grupo"
                  disabled={ocupado}
                  className="w-full bg-[#0f141c] border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={ocupado || !adminAlumno}
                className="text-xs font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg px-3.5 py-1.5 cursor-pointer disabled:opacity-40"
              >
                Guardar asignación
              </button>
            </div>
          </form>
        </div>
      )}

      {mensaje && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium p-2.5 rounded-lg">
          {mensaje}
        </div>
      )}
    </section>
  );
}

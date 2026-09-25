import {
  type Materia,
  type Tarea,
  agruparTareasPorUnidad,
  calcularEstadoSemaforo,
  formatearFechaDDMMAAAA,
  formatearUnidad,
  obtenerDiasHastaApertura,
  obtenerIconoMateria,
  tareaCompletadaPor,
  tareaFaltaNota,
  tareaPendienteAlumno,
  tareaPuedeGestionarse
} from '../core/cursada';

import { useMemo } from 'react';
import { alumnosDeLaMateria, materiasQueCursa, type InscripcionAlumno } from '../lib/companeros';
import GrupoTarea from './GrupoTarea';

interface CondicionesEdicion {
  id: string;
  condiciones: string;
  notaMinimaRegularizar: number | string;
  notaMinimaPromocionar: number | string;
  reglaPromocion: string;
}

interface Props {
  materias: Materia[];
  inscripciones?: InscripcionAlumno[];
  recargar: (mostrarCarga?: boolean) => void | Promise<unknown>;
  alumnos: string[];
  usuarioActual: string | null;
  esAdmin: boolean;
  materiasExpandidas: Record<string, boolean>;
  materiasDesplegadas: Record<string, boolean>;
  toggleExpandirMateria: (materiaId: string) => void;
  toggleDesplegarMateria: (materiaId: string) => void;
  setMateriaCondicionesEnEdicion: (condiciones: CondicionesEdicion) => void;
  setMateriaEnEdicion: (materia: { id: string; nombre: string }) => void;
  handleEliminarMateria: (id: string, nombre: string) => void;
  setTareaEnEdicion: (edicion: { materiaId: string; tarea: Tarea }) => void;
  handleEliminarTarea: (id: string) => void;
  toggleTareaDesdeCliente: (tareaId: string, alumno: string, tarea: Tarea) => void;
  handleToggleTarea: (tareaId: string, alumno: string) => void;
  notasTareasInputs: Record<string, string>;
  handleNotaTareaChangeLocal: (tareaId: string, alumno: string, valor: string) => void;
  handleGuardarNotaTareaOnBlur: (tareaId: string, alumno: string) => void;
  tareaFoco: { materiaId: string; tareaId: string } | null;
  tareaFocoVisible: boolean;
}

// Vista "Materias": consignas por materia/unidad con marcado de entrega,
// notas propias y de los compañeros, y resaltado de la tarea a la que se
// llegó desde "Estado por Alumno".
export default function VistaMaterias({
  materias,
  inscripciones = [],
  recargar,
  alumnos,
  usuarioActual,
  esAdmin,
  materiasExpandidas,
  materiasDesplegadas,
  toggleExpandirMateria,
  toggleDesplegarMateria,
  setMateriaCondicionesEnEdicion,
  setMateriaEnEdicion,
  handleEliminarMateria,
  setTareaEnEdicion,
  handleEliminarTarea,
  toggleTareaDesdeCliente,
  handleToggleTarea,
  notasTareasInputs,
  handleNotaTareaChangeLocal,
  handleGuardarNotaTareaOnBlur,
  tareaFoco,
  tareaFocoVisible,
}: Props) {
  const { materiasCursando, otrasMaterias } = useMemo(() => {
    const ids = materiasQueCursa(inscripciones, usuarioActual || '');
    return {
      materiasCursando: materias.filter((m) => ids.has(m.id)),
      otrasMaterias: materias.filter((m) => !ids.has(m.id))
    };
  }, [materias, inscripciones, usuarioActual]);

  const renderTarjetaMateria = (m: Materia) => {
          const cursan = alumnosDeLaMateria(inscripciones, m.id);
          const expandida = !!materiasExpandidas[m.id];
          const mostrarCompletadas = !!materiasDesplegadas[m.id];
          const tareasPendientes = m.tareas.filter(
            (t) => tareaPendienteAlumno(t, usuarioActual)
          );
          const tareasCompletadas = m.tareas.filter(
            (t) => tareaCompletadaPor(t, usuarioActual)
          );
          const gruposTareas = agruparTareasPorUnidad(
            mostrarCompletadas ? m.tareas : tareasPendientes
          );
          const resumenPlegada = tareasPendientes.length > 0
            ? `${tareasPendientes.length} pendiente${tareasPendientes.length === 1 ? '' : 's'}`
            : m.tareas.length === 0
              ? 'Sin tareas'
              : 'Al día';

          return (
            <div key={m.id} className="bg-[#161c26] border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-stretch gap-2 p-3 sm:p-4 border-b border-slate-800/80">
                <button
                  type="button"
                  onClick={() => toggleExpandirMateria(m.id)}
                  aria-expanded={expandida}
                  className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 text-left rounded-lg hover:bg-slate-800/40 px-2 py-1 -mx-2 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 text-sm shrink-0" aria-hidden="true">{expandida ? '▼' : '▶'}</span>
                  <span className="text-lg shrink-0" aria-hidden="true">{obtenerIconoMateria(m.nombre)}</span>
                  <span className="text-base sm:text-lg font-bold text-white truncate">{m.nombre}</span>
                  {!expandida && (
                    <span className="ml-auto shrink-0 text-xs font-semibold text-slate-400 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
                      {resumenPlegada}
                    </span>
                  )}
                </button>
                {esAdmin && (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-center">
                    <button
                      type="button"
                      onClick={() => setMateriaCondicionesEnEdicion({
                        id: m.id,
                        condiciones: m.condiciones || '',
                        notaMinimaRegularizar: m.notaMinimaRegularizar,
                        notaMinimaPromocionar: m.notaMinimaPromocionar,
                        reglaPromocion: m.reglaPromocion
                      })}
                      className="text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg font-semibold cursor-pointer"
                    >
                      Cond.
                    </button>
                    <button
                      type="button"
                      onClick={() => setMateriaEnEdicion({ id: m.id, nombre: m.nombre })}
                      className="text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded-lg font-semibold cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminarMateria(m.id, m.nombre)}
                      className="text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-lg font-semibold cursor-pointer"
                    >
                      Borrar
                    </button>
                  </div>
                )}
              </div>

              {expandida && (
              <div className="p-4 sm:p-6 pt-3 sm:pt-4 space-y-4">
                {tareasCompletadas.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => toggleDesplegarMateria(m.id)}
                      className="text-xs text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                    >
                      {mostrarCompletadas
                        ? 'Ocultar completadas'
                        : `Mostrar ${tareasCompletadas.length} completada${tareasCompletadas.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                )}
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
                        const semaforo = calcularEstadoSemaforo(t.fin, t.inicio);
                        const diasParaAbrir = obtenerDiasHastaApertura(t.inicio);
                        const grupoPropio = usuarioActual
                          ? t.grupos?.find((g) => g.integrantes?.includes(usuarioActual))
                          : undefined;
    
                        return (
                          <div
                            key={t.id}
                            id={`tarea-${t.id}`}
                            className={`bg-[#0f141c] p-6 rounded-xl border flex flex-col lg:flex-row justify-between gap-6 transition-shadow ${
                              tareaFoco?.tareaId === t.id && tareaFocoVisible
                                ? 'border-blue-500/80 ring-2 ring-blue-500/50'
                                : 'border-slate-800/80'
                            }`}
                          >
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-blue-400 text-base sm:text-lg flex items-center gap-2">
                              <span>📝</span> {t.nombre}
                            </h3>

                            {t.url && (
                              <a
                                href={t.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir la página de la tarea en UGR Virtual"
                                className="text-xs px-2.5 py-1 rounded-md border bg-blue-500/10 text-cyan-300 border-blue-500/30 hover:bg-blue-500/20 font-semibold inline-flex items-center gap-1.5 transition-colors"
                              >
                                Ver en UGR ↗
                              </a>
                            )}
    
                            <span className={`text-xs px-3 py-1 rounded-md border ${semaforo.estilo}`}>
                              {semaforo.texto}
                            </span>
                            {t.conNota && (
                              <span className="text-xs px-3 py-1 rounded-md border bg-purple-500/10 text-purple-300 border-purple-500/30">
                                {tareaFaltaNota(t, usuarioActual) ? 'Entregada · falta nota' : 'Tarea con nota'}
                              </span>
                            )}

                            {t.grupal && (
                              <span
                                className={`text-xs px-3 py-1 rounded-md border inline-flex items-center gap-1.5 font-semibold ${
                                  grupoPropio
                                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                <span>👥</span>
                                <span>
                                  {grupoPropio ? `Grupo: ${grupoPropio.nombre}` : 'Grupal · entrega individual'}
                                </span>
                                {Number(t.cupo_maximo) > 0 && (
                                  <span className="text-[10px] opacity-75 font-normal">
                                    (máx. {t.cupo_maximo})
                                  </span>
                                )}
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
    
                          {t.grupal && (
                            <GrupoTarea
                              tarea={t}
                              materiaNombre={m.nombre}
                              usuarioActual={usuarioActual}
                              recargar={recargar}
                              esAdmin={esAdmin}
                              alumnos={cursan}
                            />
                          )}
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
                              <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-300 mb-3">
                                <input
                                  type="checkbox"
                                  checked={tareaCompletadaPor(t, usuarioActual)}
                                  disabled={!usuarioActual || !tareaPuedeGestionarse(t)}
                                  onChange={() => usuarioActual && toggleTareaDesdeCliente(t.id, usuarioActual, t)}
                                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                                />
                                {tareaCompletadaPor(t, usuarioActual)
                                  ? 'Marcar como no entregada'
                                  : t.grupal && !grupoPropio
                                    ? 'Marcar entregada (individual)'
                                    : 'Marcar como entregada'}
                              </label>
                              <label className="text-xs sm:text-sm font-bold text-slate-300 block mb-2.5">
                                {t.grupal ? 'Nota del grupo (UGR Virtual)' : 'Nota en UGR Virtual'}
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]+([.,][0-9]+)?"
                                placeholder="-"
                                disabled={!esAdmin}
                                readOnly={!esAdmin}
                                value={notasTareasInputs[`${t.id}_${usuarioActual}`] || ''}
                                onChange={(e) => usuarioActual && handleNotaTareaChangeLocal(t.id, usuarioActual, e.target.value)}
                                onBlur={() => usuarioActual && handleGuardarNotaTareaOnBlur(t.id, usuarioActual)}
                                className="w-24 bg-[#161c26] border border-purple-500/50 rounded-lg p-2 text-center font-bold text-purple-300 focus:outline-none"
                              />
                            </div>
                          ) : (
                          <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3">
                              <input
                                type="checkbox"
                                checked={tareaCompletadaPor(t, usuarioActual)}
                                disabled={!usuarioActual || !tareaPuedeGestionarse(t)}
                                onChange={() => usuarioActual && toggleTareaDesdeCliente(t.id, usuarioActual, t)}
                              />
                              {t.grupal ? (grupoPropio ? 'Entrega del grupo' : 'Entregada (individual)') : 'Entregada'}
                            </label>
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
                                {((t.grupal ? cursan : alumnos).filter((alumno) => alumno !== usuarioActual && t.notas?.[alumno] !== undefined)).length > 0 ? (
                                  (t.grupal ? cursan : alumnos)
                                    .filter((alumno) => alumno !== usuarioActual && t.notas?.[alumno] !== undefined)
                                    .map((alumno) => (
                                      <div key={alumno} className="flex justify-between gap-3 text-xs text-slate-300">
                                        <span className="truncate">{alumno}</span>
                                        <strong className="text-purple-300">{t.notas?.[alumno]}</strong>
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
              )}
            </div>
          );
  };

  return (
    <div className="space-y-6">
      {materias.length === 0 ? (
        <div className="bg-[#161c26] border border-slate-800 p-12 rounded-2xl text-center text-slate-400 text-sm">
          Todavía no hay materias cargadas.
        </div>
      ) : (
        <>
          {materiasCursando.map((m) => renderTarjetaMateria(m))}
          {otrasMaterias.length > 0 && (
            <>
              {materiasCursando.length > 0 && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-t border-slate-800 pt-4">
                  {esAdmin ? 'Otras materias del período' : 'Más materias'}
                </p>
              )}
              {otrasMaterias.map((m) => renderTarjetaMateria(m))}
            </>
          )}
        </>
      )}
    </div>
  );
}

import DetalleSyncSiu from './DetalleSyncSiu';
import ModalOverlay from './ModalOverlay';
import type { ModalSincronizacionProps } from './types';

export default function ModalSincronizacion({
  syncTipo,
  syncEstado,
  syncMensaje,
  syncDatos,
  syncSiuDetalle,
  syncSeleccionados,
  syncAvisosSeleccionados,
  syncEventosSeleccionados,
  etiquetaMateria,
  onCerrar,
  onBuscarDeNuevo,
  onMarcarTodasTareas,
  onToggleTarea,
  onMarcarTodasAvisos,
  onToggleAviso,
  onToggleEvento,
  onAplicarCambios
}: ModalSincronizacionProps) {
  return (
    <ModalOverlay maxWidth="2xl">
      <div className="max-h-[85vh] overflow-y-auto -m-2 p-2">
        <div className="float-right flex gap-3">
          {syncTipo === 'ugr' && (
            <button type="button" onClick={onBuscarDeNuevo} disabled={syncEstado === 'cargando'} className="text-xs text-cyan-300 disabled:opacity-50">Buscar de nuevo</button>
          )}
          <button type="button" onClick={onCerrar} className="text-xs text-slate-300">Cerrar</button>
        </div>
        {syncTipo === 'siu' ? (
          <>
            <h3 className="text-base font-bold text-white mb-1">🎓 Sincronizar SIU Guaraní</h3>
            <p className="text-xs text-slate-400 mb-4">Lee el plan de estudio en SIU Guaraní e importa las notas finales de materias ya aprobadas o promocionadas.</p>
          </>
        ) : (
          <>
            <h3 className="text-base font-bold text-white mb-1">🔄 Sincronizar con UGR Virtual</h3>
            <p className="text-xs text-slate-400 mb-4">Busca las tareas nuevas del campus y te las muestra antes de cargarlas.</p>
          </>
        )}

        {syncEstado === 'cargando' && (
          <div className="text-center py-8">
            <span className="text-3xl animate-spin inline-block">⏳</span>
            <p className="mt-3 text-sm text-slate-300">{syncTipo === 'siu' ? 'Consultando SIU Guaraní...' : 'Consultando UGR Virtual...'}</p>
          </div>
        )}

        {syncTipo === 'siu' && syncEstado === 'listo' && syncSiuDetalle && (
          <DetalleSyncSiu {...syncSiuDetalle} />
        )}

        {syncTipo === 'siu' && syncEstado === 'error' && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{syncMensaje}</div>
        )}

        {syncTipo === 'ugr' && syncEstado === 'error' && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{syncMensaje}</div>
        )}

        {syncTipo === 'ugr' && syncEstado === 'listo' && syncDatos && (
          <div className="space-y-4">
            {(syncDatos.notasCargadas?.length || 0) > 0 && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Notas cargadas</p>
                <ul className="mt-2 space-y-1">
                  {syncDatos.notasCargadas?.map((item) => (
                    <li key={`${item.nombre}-${item.nota}`}>Se cargó la nota {item.nota} en «{item.nombre}».</li>
                  ))}
                </ul>
              </div>
            )}
            {(syncDatos.pendientesEntrega?.length || 0) > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Falta entregar en la página</p>
                <ul className="mt-2 space-y-1">
                  {syncDatos.pendientesEntrega?.map((item) => (
                    <li key={item.nombre}>Entregá «{item.nombre}» para cargarle la nota.</li>
                  ))}
                </ul>
              </div>
            )}
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
                    <button type="button" onClick={() => onMarcarTodasTareas(true)} className="text-slate-400 hover:text-emerald-300 cursor-pointer underline">
                      Tildar todas
                    </button>
                    <span className="text-slate-600">·</span>
                    <button type="button" onClick={() => onMarcarTodasTareas(false)} className="text-slate-400 hover:text-red-300 cursor-pointer underline">
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
                          onToggleTarea(tarea.idMoodle);
                        }}
                        aria-hidden="true"
                        className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                          tildada ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-[#0f141c] opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={tildada}
                            onChange={() => onToggleTarea(tarea.idMoodle)}
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

            {(syncDatos.avisos?.length || 0) > 0 ? (
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300">
                    📢 {syncAvisosSeleccionados.size} de {syncDatos.avisos.length} aviso(s) para publicar en la campana
                  </span>
                  <div className="flex gap-2 text-[11px]">
                    <button type="button" onClick={() => onMarcarTodasAvisos(true)} className="text-slate-400 hover:text-purple-300 cursor-pointer underline">
                      Tildar todos
                    </button>
                    <span className="text-slate-600">·</span>
                    <button type="button" onClick={() => onMarcarTodasAvisos(false)} className="text-slate-400 hover:text-red-300 cursor-pointer underline">
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
                          tildado ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-700 bg-[#0f141c] opacity-60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'A') return;
                            onToggleAviso(aviso.id);
                          }}
                          className="w-full text-left cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={tildado}
                              onChange={() => onToggleAviso(aviso.id)}
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
                              onChange={() => onToggleEvento(aviso.id)}
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
                onClick={onCerrar}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
              {(syncDatos.detectadas.length > 0 || syncDatos.avisos.length > 0) && !syncDatos.confirmar && (
                <button
                  type="button"
                  onClick={onAplicarCambios}
                  disabled={syncSeleccionados.size === 0 && syncAvisosSeleccionados.size === 0}
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
    </ModalOverlay>
  );
}

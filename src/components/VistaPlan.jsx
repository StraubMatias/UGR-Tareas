import {
  formatearFechaHora,
  obtenerDiasHastaTarea,
} from '../lib/cursada';

// Vista "Plan de estudio": materias, códigos y correlativas del plan oficial,
// estados por alumno y el modal "Tu camino para adelantar" (simulador).
export default function VistaPlan({
  planDeEstudio,
  cuatrimestresPlan,
  alumnos,
  usuarioActual,
  esAdmin,
  planModalAbierto,
  setPlanModalAbierto,
  obtenerCorrelativasPendientes,
  obtenerMateriaPlan,
  obtenerCorrelativasPendientesSimuladas,
  obtenerProgresoMateria,
  progresoPlanEnEdicion,
  setProgresoPlanEnEdicion,
  handleGuardarProgresoPlan,
  materiasAprobadasUsuario,
  materiasPendientesUsuario,
  materiasSimuladas,
  setMateriasSimuladas,
  cuatrimestreActivo,
  setCuatrimestreSimulado,
  cuatrimestreSugerido,
  materiasDelSimulador,
  materiasRecomendadas,
  materiasExtraDisponibles,
  materiasPriorizadas,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Tecnicatura Universitaria en Ciberseguridad</p>
          <h2 className="mt-1 text-2xl font-extrabold text-white">Plan de estudio</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Materias, códigos y correlativas según el plan oficial.</p>
        </div>
        <button
          type="button"
          onClick={() => setPlanModalAbierto(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-extrabold text-cyan-200 transition hover:bg-cyan-400/20"
        >
          <span aria-hidden="true">◈</span>
          Ver mi camino
        </button>
      </div>
      {cuatrimestresPlan.map((cuatrimestre) => {
        const materiasDelCuatrimestre = planDeEstudio.filter((materia) => materia.cuatrimestre === cuatrimestre);
        return (
          <section key={cuatrimestre} className="space-y-3">
            <h3 className="border-b border-amber-500/30 pb-2 text-sm font-extrabold uppercase tracking-wider text-amber-300">
              {cuatrimestre}
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {materiasDelCuatrimestre.map((materia) => {
                const correlativasPendientes = obtenerCorrelativasPendientes(materia, usuarioActual);
                return (
                <article key={materia.codigo} className="rounded-xl border border-slate-800 bg-[#161c26] p-4">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-extrabold text-cyan-300">
                      {materia.codigo}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold leading-snug text-white">{materia.nombre}</h4>
                      <p className="mt-2 text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">Correlativas:</span>{' '}
                        {materia.correlativas.length > 0
                          ? materia.correlativas.map((correlativa) => {
                            const materiaCorrelativa = obtenerMateriaPlan(correlativa);
                            return materiaCorrelativa
                              ? `${materiaCorrelativa.codigo} · ${materiaCorrelativa.nombre} · ${materiaCorrelativa.cuatrimestre}`
                              : correlativa;
                          }).join(' | ')
                          : 'Ninguna'}
                      </p>
                    </div>
                  </div>
                  <p className={`mt-3 text-xs font-bold ${correlativasPendientes.length === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {correlativasPendientes.length === 0
                      ? '✓ Correlativas cumplidas'
                      : `Requiere: ${correlativasPendientes.map((correlativa) => obtenerMateriaPlan(correlativa)?.nombre || correlativa).join(' · ')}`}
                  </p>
                  <details className="mt-4 border-t border-slate-800 pt-3">
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                      Ver estados por alumno
                    </summary>
                    <div className="mt-3 space-y-2">
                      {(esAdmin
                        ? [usuarioActual, ...alumnos.filter((alumno) => alumno !== usuarioActual)]
                        : [usuarioActual]
                      ).map((alumno) => {
                        const progreso = obtenerProgresoMateria(alumno, materia.codigo);
                        const puedeEditar = esAdmin || alumno === usuarioActual;
                        const claveProgreso = `${alumno}_${materia.codigo}`;
                        const edicion = progresoPlanEnEdicion[claveProgreso] || {
                          estado: progreso?.estado || 'pendiente',
                          nota: progreso?.nota || ''
                        };
                        const requiereNota = ['aprobada', 'promocionada'].includes(edicion.estado);
                        return (
                          <div
                            key={`${materia.codigo}-${alumno}`}
                            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                              alumno === usuarioActual
                                ? 'border-cyan-500/40 bg-cyan-500/10'
                                : 'border-transparent'
                            }`}
                          >
                            <span className={`font-semibold ${alumno === usuarioActual ? 'text-cyan-200' : 'text-slate-300'}`}>
                              {alumno}{alumno === usuarioActual ? ' · vos' : ''}
                            </span>
                            {puedeEditar ? (
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <select
                                  value={edicion.estado}
                                  onChange={(evento) => setProgresoPlanEnEdicion((actual) => ({
                                    ...actual,
                                    [claveProgreso]: {
                                      estado: evento.target.value,
                                      nota: ['aprobada', 'promocionada'].includes(evento.target.value) ? edicion.nota : ''
                                    }
                                  }))}
                                  className="rounded-lg border border-slate-700 bg-[#0f141c] px-2 py-1.5 font-semibold text-slate-200 outline-none focus:border-cyan-400"
                                >
                                  <option value="pendiente">Pendiente</option>
                                  {esAdmin && <option value="cursando">Cursando</option>}
                                  <option value="aprobada">Aprobada</option>
                                  <option value="promocionada">Promocionada</option>
                                </select>
                                {requiereNota && (
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    step="0.01"
                                    value={edicion.nota}
                                    onChange={(evento) => setProgresoPlanEnEdicion((actual) => ({
                                      ...actual,
                                      [claveProgreso]: { ...edicion, nota: evento.target.value }
                                    }))}
                                    placeholder="Nota"
                                    aria-label={`Nota final de ${materia.nombre} para ${alumno}`}
                                    className="w-20 rounded-lg border border-slate-700 bg-[#0f141c] px-2 py-1.5 font-semibold text-slate-200 outline-none focus:border-cyan-400"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleGuardarProgresoPlan(alumno, materia.codigo, edicion.estado, edicion.nota)}
                                  className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-extrabold text-cyan-200 hover:bg-cyan-500/20"
                                >
                                  Guardar
                                </button>
                              </div>
                            ) : (
                              <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-bold capitalize text-slate-300">
                                {progreso?.estado || 'pendiente'}{progreso?.nota ? ` · ${progreso.nota}` : ''}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </article>
                );
              })}
            </div>
          </section>
        );
      })}
    
      {planModalAbierto && (
        <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) setPlanModalAbierto(false);
        }}>
          <section className="calendar-modal max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="camino-plan-titulo">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Planificador personal</p>
                <h3 id="camino-plan-titulo" className="mt-1 text-xl font-extrabold text-white">Tu camino para adelantar</h3>
                <p className="mt-1 text-sm text-slate-400">Una simulación basada en tus aprobadas y las correlativas del plan.</p>
              </div>
              <button type="button" className="calendar-modal-close" aria-label="Cerrar camino del plan" onClick={() => setPlanModalAbierto(false)}>×</button>
            </div>
    
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Aprobadas reales</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{materiasAprobadasUsuario.length}<span className="text-sm font-semibold text-slate-400"> / {planDeEstudio.length}</span></p>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Avance</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{Math.round((materiasAprobadasUsuario.length / planDeEstudio.length) * 100)}%</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Pendientes</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{materiasPendientesUsuario.length}</p>
              </div>
            </div>
    
            <div className="mt-5 grid gap-4 border-b border-slate-800 pb-5 sm:grid-cols-2">
              <div className="text-sm font-semibold text-slate-300">
                Materias que suponés aprobar
                <p className="mt-1 text-xs font-normal text-slate-500">Marcá las materias hipotéticas. Las aprobadas reales ya están incluidas.</p>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {materiasPendientesUsuario.map((materia) => {
                    const seleccionada = materiasSimuladas.includes(materia.codigo);
                    return (
                      <label key={materia.codigo} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs transition ${seleccionada ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-100' : 'border-slate-800 bg-[#0f141c] text-slate-300 hover:border-slate-600'}`}>
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          onChange={() => setMateriasSimuladas((actuales) => seleccionada ? actuales.filter((codigo) => codigo !== materia.codigo) : [...actuales, materia.codigo])}
                          className="mt-0.5 accent-cyan-400"
                        />
                        <span><strong>{materia.codigo}</strong> · {materia.nombre}</span>
                      </label>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setMateriasSimuladas([])} className="mt-2 text-xs font-bold text-slate-500 hover:text-cyan-300">Limpiar selección ({materiasSimuladas.length})</button>
              </div>
              <label className="text-sm font-semibold text-slate-300">
                Cuatrimestre a planificar
                <select
                  value={cuatrimestreActivo}
                  onChange={(evento) => setCuatrimestreSimulado(evento.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0f141c] px-3 py-2 text-white outline-none focus:border-cyan-400"
                >
                  {cuatrimestresPlan.map((cuatrimestre) => <option key={cuatrimestre} value={cuatrimestre}>{cuatrimestre}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">Sugerido por tu avance: {cuatrimestreSugerido}.</span>
              </label>
            </div>
    
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-white">Para ese cuatrimestre</h4>
                <span className="text-xs text-slate-500">{materiasDelSimulador.length} pendientes</span>
              </div>
              {materiasDelSimulador.length === 0 ? (
                <p className="rounded-xl border border-slate-800 bg-[#0f141c] p-4 text-sm text-slate-400">No quedan materias pendientes en este cuatrimestre.</p>
              ) : (
                <div className="space-y-2">
                  {materiasDelSimulador.map((materia) => {
                    const correlativasPendientes = obtenerCorrelativasPendientesSimuladas(materia);
                    const puedeCursar = correlativasPendientes.length === 0;
                    return (
                      <div key={materia.codigo} className={`rounded-xl border p-3 ${puedeCursar ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{materia.nombre}</p>
                            <p className="mt-1 text-xs text-slate-400">{materia.codigo}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider ${puedeCursar ? 'border-emerald-400/40 text-emerald-300' : 'border-amber-400/40 text-amber-300'}`}>
                            {puedeCursar ? 'Podés cursar' : 'Bloqueada'}
                          </span>
                        </div>
                        {!puedeCursar && <p className="mt-2 text-xs text-amber-200">Falta: {correlativasPendientes.map((correlativa) => obtenerMateriaPlan(correlativa)?.nombre || correlativa).join(' · ')}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-sm font-bold text-cyan-200">Resultado: {materiasRecomendadas.length} {materiasRecomendadas.length === 1 ? 'materia habilitada' : 'materias habilitadas'} para priorizar.</p>
              {materiasExtraDisponibles.length > 0 && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-extrabold uppercase tracking-wider text-purple-200">Extras que podés adelantar</h5>
                      <p className="mt-1 text-xs text-purple-100/70">No pertenecen a este cuatrimestre, pero ya tenés las correlativas para cursarlas.</p>
                    </div>
                    <span className="text-xs font-bold text-purple-200">{materiasExtraDisponibles.length} disponibles</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {materiasExtraDisponibles.slice(0, 5).map(({ materia, habilita }) => (
                      <div key={materia.codigo} className="flex items-center justify-between gap-3 rounded-lg border border-purple-400/20 bg-[#0f141c]/50 p-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{materia.nombre}</p>
                          <p className="text-xs text-purple-100/60">{materia.codigo} · {materia.cuatrimestre}</p>
                        </div>
                        <span className="shrink-0 text-right text-xs font-bold text-purple-200">{habilita > 0 ? `desbloquea ${habilita}` : 'suma avance'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(materiasRecomendadas.length > 0 || materiasExtraDisponibles.length > 0) && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">Cómo te conviene cursar</h5>
                  <p className="mt-2 text-sm text-emerald-50/90">
                    Priorizá las {materiasRecomendadas.length} materias habilitadas del cuatrimestre y sumá {Math.min(2, materiasExtraDisponibles.length)} extra{Math.min(2, materiasExtraDisponibles.length) === 1 ? '' : 's'} con mayor desbloqueo.
                  </p>
                  <p className="mt-2 text-xs text-emerald-100/70">La sugerencia busca adelantar correlativas sin reemplazar la decisión final de carga, horarios o disponibilidad.</p>
                </div>
              )}
              {materiasPriorizadas.length > 0 && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-cyan-200">Qué te conviene priorizar</h5>
                  <div className="mt-3 space-y-2">
                    {materiasPriorizadas.slice(0, 3).map(({ materia, habilita }) => (
                      <div key={materia.codigo} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-white">{materia.nombre}</span>
                        <span className="shrink-0 text-xs font-bold text-cyan-200">{habilita > 0 ? `desbloquea ${habilita}` : 'habilitada ahora'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

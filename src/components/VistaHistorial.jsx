import {
  agruparHistorial,
  formatearFechaHora,
  formatearUnidad,
  historialPorAlumno,
  obtenerIconoMateria
} from '../lib/cursada';

// Vista "Historial de entregas y notas": despliegue por alumno de las tareas
// realizadas, sus notas y el modal de comparación entre dos compañeros.
export default function VistaHistorial({
  materias,
  notas,
  parciales,
  usuarioActual,
  alumnoComparar,
  setAlumnoComparar,
  datosComparacion,
  alumnosDelHistorial,
  historialPropioAbierto,
  setHistorialPropioAbierto,
  alumnosDesplegados,
  setAlumnosDesplegados
}) {
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <span>🕘</span> Historial de entregas y notas
        </h2>
        <p className="text-sm text-slate-400 mt-1">Tareas realizadas y calificaciones registradas por alumno.</p>
      </div>

      {datosComparacion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setAlumnoComparar('');
          }}
        >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="comparacion-titulo"
          className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-emerald-500/40 bg-[#101720] p-4 shadow-2xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="comparacion-titulo" className="text-base font-bold text-white">
                Comparación: {usuarioActual} vs. {alumnoComparar}
              </h3>
              <p className="mt-2 text-sm text-emerald-200">{datosComparacion.motivo}</p>
            </div>
            <button
              type="button"
              onClick={() => setAlumnoComparar('')}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-500 hover:text-white cursor-pointer"
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
          <div className="mt-4 border-t border-slate-800/80 pt-4">
            <h4 className="text-sm font-bold text-white">
              {datosComparacion.puntosEmpatados ? 'Coincidencias y desempate' : 'Qué explica la diferencia'}
            </h4>
            {datosComparacion.razonesPuntos.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {datosComparacion.razonesPuntos.map((razon) => (
                  <li key={razon.id} className="text-xs text-slate-300">
                    <span className={razon.diferencia > 0 ? 'text-emerald-300' : 'text-amber-300'}>
                      {razon.diferencia > 0 ? `${usuarioActual} gana` : `${alumnoComparar} gana`}
                    </span>
                    {' '}· {razon.texto}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No hay diferencias de tareas, notas o parciales para explicar.</p>
            )}
            {datosComparacion.puntosEmpatados && (
              <p className="mt-2 text-xs text-slate-300">{datosComparacion.motivo}</p>
            )}
          </div>
        </div>
        </div>
      )}

      {alumnosDelHistorial.map((alumno) => {
        const estaDesplegado = alumno === usuarioActual
          ? historialPropioAbierto
          : !!alumnosDesplegados[`historial-${alumno}`];
        const historial = historialPorAlumno(alumno, materias, notas, parciales);
        const historialAgrupado = agruparHistorial(historial);

        return (
          <details
            key={alumno}
            open={estaDesplegado}
            onToggle={(evento) => {
              const abierto = evento.currentTarget.open;
              if (alumno === usuarioActual) {
                setHistorialPropioAbierto(abierto);
              } else {
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
              <span className="flex items-center gap-3 text-xs text-slate-400">
                {historial.length} registro{historial.length === 1 ? '' : 's'}
                <span aria-hidden="true">{estaDesplegado ? '▲' : '▼'}</span>
              </span>
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
                      <h3 className="border-b border-cyan-500/30 pb-2 text-sm font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                        <span className="normal-case">{obtenerIconoMateria(grupoMateria.materia)}</span>
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
  );
}
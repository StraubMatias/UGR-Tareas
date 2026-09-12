import { parcialHabilitado as parcialEstaHabilitado } from '../app/validators';
import { formatearFechaDDMMAAAA, obtenerDiasHastaFecha, obtenerIconoMateria } from '../lib/cursada';

// Vista "Parciales": listado agrupado por materia con carga de notas propia y
// de los compañeros (los admin pueden editar la de todos).
export default function VistaParciales({
  parciales,
  parcialesAgrupados,
  esAdmin,
  usuarioActual,
  alumnos,
  iniciarEdicionParcial,
  handleEliminarParcial,
  toggleNotasParcial,
  notasDesplegadas,
  notasInputs,
  handleNotaChangeLocal,
  handleGuardarNotaOnBlur
}) {
  return (
    <div className="space-y-6">
      {parciales.length === 0 ? (
        <div className="bg-[#161c26] border border-slate-800 p-12 rounded-2xl text-center text-slate-400 text-sm">
          Aún no se han programado parciales.
        </div>
      ) : (
        parcialesAgrupados.map((grupo) => (
          <section key={grupo.id} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
              <span className="text-lg">{obtenerIconoMateria(grupo.nombre)}</span>
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
                            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-full px-2.5 py-1">
                              <span>⏰</span>
                              {(() => {
                                const diasParaAbrir = obtenerDiasHastaFecha(p.fecha);
                                return diasParaAbrir === 0 ? 'Abre hoy' : `Abre en ${diasParaAbrir} ${diasParaAbrir === 1 ? 'día' : 'días'}`;
                              })()}
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
                              disabled={!parcialDisponible}
                              value={valorMiNota}
                              onChange={(e) => handleNotaChangeLocal(p.id, usuarioActual, e.target.value)}
                              onBlur={() => handleGuardarNotaOnBlur(p.id, usuarioActual)}
                              className={`w-16 text-center font-bold text-sm py-1 px-2 rounded-lg border focus:outline-none transition-all ${
                                parcialDisponible
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
  );
}
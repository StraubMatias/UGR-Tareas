import { etiquetaMateria } from '../lib/cursada';

// Vista "Ranking de la cursada": podio y resto de la cursada con el puntaje
// acumulado de tareas, foros y parciales de cada alumno.
export default function VistaRanking({
  materias,
  usuarioActual,
  materiaRanking,
  setMateriaRanking,
  ranking,
  rankingPodio,
  restoRanking
}) {
  return (
    <div className="space-y-6">
      <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span>🏆</span> Ranking de la cursada
            </h2>
            <p className="text-sm text-slate-400 mt-1">Puntaje acumulado de tareas, foros y parciales.</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <label htmlFor="materia-ranking" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Vista del ranking
            </label>
            <select
              id="materia-ranking"
              value={materiaRanking}
              onChange={(e) => setMateriaRanking(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#0f141c] px-3 py-2 text-sm font-semibold text-white outline-none transition-colors focus:border-emerald-400 cursor-pointer"
            >
              <option value="general">Todas las materias</option>
              {materias.map((materia) => (
                <option key={materia.id} value={materia.id}>{etiquetaMateria(materia.nombre)}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">Se actualiza al marcar tareas</span>
          </div>
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
  );
}
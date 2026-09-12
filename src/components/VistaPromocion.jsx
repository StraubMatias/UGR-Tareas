import { obtenerIconoMateria } from '../lib/cursada';

// Vista "Promoción por materia": estado calculado por materia con las reglas
// de regularización/promoción cargadas en el panel de administración.
export default function VistaPromocion({
  materias,
  esAdmin,
  usuarioActual,
  alumnosOrdenadosPromocion,
  obtenerEstadoMateria,
  setMateriaCondicionesEnEdicion
}) {
  return (
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
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{obtenerIconoMateria(materia.nombre)}</span> {materia.nombre}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Regulariza desde {materia.notaMinimaRegularizar}{['activos_porcentaje', 'tp_porcentaje_nota'].includes(materia.reglaPromocion) ? '%' : ''} · Promociona desde {materia.notaMinimaPromocionar}{materia.reglaPromocion === 'activos_porcentaje' ? '%' : ''}
                </p>
              </div>
              {esAdmin && (
                <button
                  onClick={() => setMateriaCondicionesEnEdicion({
                    id: materia.id,
                    condiciones: materia.condiciones || '',
                    notaMinimaRegularizar: materia.notaMinimaRegularizar,
                    notaMinimaPromocionar: materia.notaMinimaPromocionar,
                    reglaPromocion: materia.reglaPromocion
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
              {alumnosOrdenadosPromocion.map((alumno) => {
                const estado = obtenerEstadoMateria(materia, alumno);
                return (
                  <div key={alumno} className={`flex items-center justify-between gap-3 bg-[#0f141c] border rounded-xl p-3 ${
                    alumno === usuarioActual ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-slate-800'
                  }`}>
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
  );
}
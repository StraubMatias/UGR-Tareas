import {
  obtenerGrupoDeAlumno,
  obtenerCompanerosDeGrupo,
  obtenerResumenGruposTarea
} from '../core/cursada';

export default function EstadoGrupoAlumno({ tarea, alumno, alumnos, irATareaEnMaterias }) {
  const resumen = obtenerResumenGruposTarea(tarea, alumnos);
  if (!resumen) return null;
  const grupo = obtenerGrupoDeAlumno(tarea, alumno);
  const companeros = obtenerCompanerosDeGrupo(tarea, alumno);
  const otrosGrupos = resumen.grupos.filter((otro) => otro !== grupo);

  return (
    <div className="estado-tarea-grupo rounded-xl border p-4 space-y-3">
      <div>
        <p className={grupo ? 'font-semibold text-cyan-200' : 'font-semibold text-amber-300'}>
          {grupo ? `Grupo de ${alumno}: ${grupo.nombre}` : `${alumno} todavía no tiene grupo`}
        </p>
        {grupo && (
          <p className="mt-1 text-slate-300">
            Compañeros: {companeros.length ? companeros.join(', ') : 'Sin otros integrantes por ahora.'}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          {resumen.totalGrupos} grupos · {resumen.totalIntegrantes} integrantes asignados
          {resumen.cupo > 0 && ` · Máximo ${resumen.cupo} por grupo`}
        </p>
      </div>
      <details>
        <summary className="cursor-pointer text-cyan-300 font-medium">
          {grupo ? 'Otros grupos' : 'Ver grupos'} ({otrosGrupos.length}) · Sin grupo ({resumen.totalSinGrupo})
        </summary>
        <div className="mt-3 space-y-3">
          {otrosGrupos.length ? (
            <ul className="space-y-2">
              {otrosGrupos.map((otro) => (
                <li key={otro.id} className="rounded-lg bg-slate-950/40 p-3">
                  <p className="font-semibold text-slate-200">
                    {otro.nombre}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {otro.integrantes?.length || 0}{resumen.cupo > 0 ? `/${resumen.cupo}` : ''} integrantes
                    </span>
                  </p>
                  <p className="mt-1 text-slate-300">{otro.integrantes?.join(', ') || 'Sin integrantes'}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-slate-400">{grupo ? 'No hay otros grupos.' : 'Todavía no se formaron grupos.'}</p>}
          <div className="border-t border-slate-700/60 pt-3">
            <p className="font-medium text-slate-200">Alumnos sin grupo</p>
            <p className="mt-1 text-slate-300">{resumen.sinGrupo.join(', ') || 'Todos tienen grupo asignado.'}</p>
          </div>
        </div>
      </details>
      <button type="button" onClick={() => irATareaEnMaterias(tarea.id)} className="text-xs font-semibold text-cyan-300 hover:underline cursor-pointer">
        Gestionar grupos en Materias ↗
      </button>
    </div>
  );
}

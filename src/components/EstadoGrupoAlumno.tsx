import {
  etiquetaModoEntregaTarea,
  modoEntregaDeTarea,
  obtenerGrupoDeAlumno,
  type Tarea
} from '../core/cursada';

interface Props {
  tarea: Tarea;
  alumno: string;
  esPropia: boolean;
  esAdmin?: boolean;
  onAbrirGrupos: () => void;
}

export default function EstadoGrupoAlumno({ tarea, alumno, esPropia, esAdmin = false, onAbrirGrupos }: Props) {
  if (!tarea.grupal) return null;
  const modo = modoEntregaDeTarea(tarea);
  const grupo = obtenerGrupoDeAlumno(tarea, alumno);
  const etiqueta = etiquetaModoEntregaTarea(tarea, alumno);
  const sinGrupo = !grupo;
  const urgente = modo === 'grupal_obligatorio' && sinGrupo;

  return (
    <div className={`rounded-xl border px-3 py-2.5 flex flex-wrap items-center gap-2 ${urgente ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-[#0c121a]/80'}`}>
      <span className={`text-xs font-medium ${urgente ? 'text-amber-200' : 'text-slate-300'}`}>
        {etiqueta}
      </span>
      {(esPropia || esAdmin) && (
        <div className="flex flex-wrap gap-2 ml-auto">
          {esPropia && sinGrupo && (
            <button
              type="button"
              onClick={onAbrirGrupos}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-100 cursor-pointer hover:bg-cyan-500/25"
            >
              Crear o unirme a un grupo
            </button>
          )}
          {esPropia && grupo && (
            <button
              type="button"
              onClick={onAbrirGrupos}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 cursor-pointer hover:bg-slate-800"
            >
              Ver grupos
            </button>
          )}
          {esAdmin && !esPropia && (
            <button
              type="button"
              onClick={onAbrirGrupos}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 cursor-pointer hover:bg-slate-800"
            >
              Grupos de la tarea
            </button>
          )}
        </div>
      )}
      {esPropia && sinGrupo && modo === 'grupal_obligatorio' && (
        <p className="w-full text-[11px] text-amber-200/90">Para marcar la entrega necesitás estar en un grupo.</p>
      )}
    </div>
  );
}

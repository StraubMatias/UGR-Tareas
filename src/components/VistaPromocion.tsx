import { useState } from 'react';
import { obtenerIconoMateria, type Materia } from '../core/cursada';
import { materiasQueCursa, type InscripcionAlumno } from '../lib/companeros';
import type { BadgeEstadoMateria } from '../lib/estado-materia-ui';
import type { LineaDesgloseActivos } from '../lib/promocion-materia';
import { reglaPromocionEfectiva } from '../lib/promocion-materia';

const etiquetaLineaActivos: Record<LineaDesgloseActivos['estado'], string> = {
  hecha: 'Hecha',
  espera_nota: 'Entregada · sin nota',
  pendiente: 'Pendiente',
  no_cuenta: 'Todavía no cuenta'
};

function DesgloseActivos({ lineas }: { lineas: LineaDesgloseActivos[] }) {
  const cuentan = lineas.filter((l) => l.estado !== 'no_cuenta');
  const fuera = lineas.filter((l) => l.estado === 'no_cuenta');
  if (cuentan.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-[#0f141c] p-3 sm:p-4">
      <p className="text-xs font-semibold text-slate-300 mb-2">Actividades que cuentan hoy para el %</p>
      <ul className="space-y-1.5 text-xs text-slate-400 max-h-64 overflow-y-auto">
        {cuentan.map((linea) => (
          <li key={`${linea.tipo}-${linea.nombre}`} className="flex justify-between gap-2">
            <span className="text-slate-300 truncate">{linea.nombre}</span>
            <span className={`shrink-0 font-medium ${
              linea.estado === 'hecha' ? 'text-emerald-400/90'
                : linea.estado === 'espera_nota' ? 'text-cyan-400/90'
                  : 'text-amber-400/90'
            }`}>
              {etiquetaLineaActivos[linea.estado]}
            </span>
          </li>
        ))}
      </ul>
      {fuera.length > 0 && (
        <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800">
          Parcial futuro ({fuera.length}): entra al total el día del examen.
        </p>
      )}
    </div>
  );
}

function BadgePromocion({ estado }: { estado: BadgeEstadoMateria }) {
  const muestraPct = estado.porcentaje != null && estado.total != null && estado.total > 0;
  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0 max-w-[11rem] sm:max-w-none">
      <div className="flex items-center gap-1.5">
        {muestraPct && (
          <span className="text-xs font-bold text-slate-200 tabular-nums" title={`${estado.cumplidas ?? 0} de ${estado.total} actividades`}>
            {estado.porcentaje}%
          </span>
        )}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${estado.estilo}`}>{estado.texto}</span>
      </div>
      {estado.aviso && (
        <span className="text-[10px] sm:text-xs text-slate-400 text-right leading-tight">{estado.aviso}</span>
      )}
    </div>
  );
}

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
  esAdmin: boolean;
  usuarioActual: string | null;
  alumnosOrdenadosPromocion: string[];
  obtenerEstadoMateria: (materia: Materia, alumno: string) => BadgeEstadoMateria | null;
  setMateriaCondicionesEnEdicion: (condiciones: CondicionesEdicion) => void;
}

function TarjetaMateria({
  materia,
  inscripciones,
  esAdmin,
  usuarioActual,
  alumnosOrdenadosPromocion,
  obtenerEstadoMateria,
  setMateriaCondicionesEnEdicion
}: {
  materia: Materia;
  inscripciones: InscripcionAlumno[];
  esAdmin: boolean;
  usuarioActual: string | null;
  alumnosOrdenadosPromocion: string[];
  obtenerEstadoMateria: (materia: Materia, alumno: string) => BadgeEstadoMateria | null;
  setMateriaCondicionesEnEdicion: (condiciones: CondicionesEdicion) => void;
}) {
  const [expandida, setExpandida] = useState(false);
  const cursan = alumnosOrdenadosPromocion.filter((alumno) => materiasQueCursa(inscripciones, alumno).has(materia.id));
  const yoCursa = usuarioActual ? materiasQueCursa(inscripciones, usuarioActual).has(materia.id) : false;
  const miEstado = yoCursa && usuarioActual ? obtenerEstadoMateria(materia, usuarioActual) : null;
  const reglaVista = reglaPromocionEfectiva(materia);

  return (
    <section className="bg-[#161c26] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-stretch gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setExpandida((abierta) => !abierta)}
          aria-expanded={expandida}
          className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 text-left rounded-lg hover:bg-slate-800/40 px-2 py-1 -mx-2 cursor-pointer transition-colors"
        >
          <span className="text-slate-500 text-sm shrink-0" aria-hidden="true">{expandida ? '▼' : '▶'}</span>
          <span className="text-lg shrink-0" aria-hidden="true">{obtenerIconoMateria(materia.nombre)}</span>
          <span className="text-base sm:text-lg font-bold text-white truncate">{materia.nombre}</span>
          {!expandida && miEstado && (
            <span className="ml-auto">
              <BadgePromocion estado={miEstado} />
            </span>
          )}
          {!expandida && !miEstado && (
            <span className="ml-auto shrink-0 text-xs text-slate-500">
              {yoCursa ? 'Sin regla' : 'No la cursás'}
            </span>
          )}
        </button>
        {esAdmin && (
          <button
            type="button"
            onClick={() => setMateriaCondicionesEnEdicion({
              id: materia.id,
              condiciones: materia.condiciones || '',
              notaMinimaRegularizar: materia.notaMinimaRegularizar,
              notaMinimaPromocionar: materia.notaMinimaPromocionar,
              reglaPromocion: materia.reglaPromocion
            })}
            className="shrink-0 self-center text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg font-semibold cursor-pointer"
          >
            Editar
          </button>
        )}
      </div>

      {expandida && (
        <div className="px-4 sm:px-6 pb-5 border-t border-slate-800 pt-4">
          {yoCursa && miEstado && (
            <div className="flex justify-end mb-3">
              <BadgePromocion estado={miEstado} />
            </div>
          )}
          {reglaVista !== 'metodologia' && (
            <p className="text-xs text-slate-400 mb-3">
              {reglaVista === 'activos_porcentaje' && (
                <>
                  Regulariza desde {materia.notaMinimaRegularizar}% · Promociona desde {materia.notaMinimaPromocionar}%
                  {' '}(todas las tareas cargadas + parcialitos con fecha de hoy o anterior; parcialitos futuros suman ese día)
                </>
              )}
              {reglaVista === 'tp_porcentaje_nota' && (
                <>Regulariza con {materia.notaMinimaRegularizar}% de entregas aprobadas · Promociona con cada entrega calificada ≥ {materia.notaMinimaPromocionar}</>
              )}
              {reglaVista === 'riesgos_tps' && (
                <>Al menos 3 actividades prácticas (incluye cuestionarios) · Promociona con notas ≥ {materia.notaMinimaPromocionar}</>
              )}
              {!['activos_porcentaje', 'tp_porcentaje_nota', 'riesgos_tps'].includes(reglaVista) && (
                <>Regulariza desde {materia.notaMinimaRegularizar} · Promociona desde {materia.notaMinimaPromocionar}</>
              )}
              {reglaVista === 'parciales_y_tps' && ' · Cada parcial rendido y cada TP con nota'}
            </p>
          )}
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {materia.condiciones || 'Condiciones todavía no cargadas.'}
          </p>
          {yoCursa && reglaVista === 'activos_porcentaje' && miEstado?.desgloseActivos?.length ? (
            <DesgloseActivos lineas={miEstado.desgloseActivos} />
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
            {cursan.map((alumno) => {
              const estado = obtenerEstadoMateria(materia, alumno);
              return (
                <div key={alumno} className={`flex items-center justify-between gap-3 bg-[#0f141c] border rounded-xl p-3 ${
                  yoCursa && alumno === usuarioActual ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-slate-800'
                }`}>
                  <span className="text-sm font-semibold text-slate-200 truncate">{alumno}</span>
                  {estado ? (
                    <BadgePromocion estado={estado} />
                  ) : (
                    <span className="text-xs text-slate-500">Sin regla</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// Vista "Promoción por materia": estado calculado por materia con las reglas
// de regularización/promoción cargadas en el panel de administración.
export default function VistaPromocion({
  materias,
  inscripciones = [],
  esAdmin,
  usuarioActual,
  alumnosOrdenadosPromocion,
  obtenerEstadoMateria,
  setMateriaCondicionesEnEdicion
}: Props) {
  const [verResto, setVerResto] = useState(false);
  const propias = materiasQueCursa(inscripciones, usuarioActual || '');
  const deLaCursada = materias.filter((materia) => propias.has(materia.id));
  const elResto = materias.filter((materia) => !propias.has(materia.id));
  const propsTarjeta = {
    inscripciones,
    esAdmin,
    usuarioActual,
    alumnosOrdenadosPromocion,
    obtenerEstadoMateria,
    setMateriaCondicionesEnEdicion
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <span>🎯</span> Promoción por materia
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Tocá una materia para ver condiciones y el estado de cada alumno. Plegada, ves tu estado al costado.
        </p>
        {esAdmin && elResto.length > 0 && (
          <button
            type="button"
            onClick={() => setVerResto((abierto) => !abierto)}
            className="mt-3 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            {verResto ? 'Ocultar materias que no curso' : `Ver las ${elResto.length} materia(s) que no curso`}
          </button>
        )}
      </div>
      {deLaCursada.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Todavía no hay materias de tu cursada.</p>
      ) : (
        deLaCursada.map((materia) => (
          <TarjetaMateria key={materia.id} materia={materia} {...propsTarjeta} />
        ))
      )}
      {esAdmin && verResto && elResto.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide pt-2">
            Materias que no curso
          </h3>
          {elResto.map((materia) => (
            <TarjetaMateria key={materia.id} materia={materia} {...propsTarjeta} />
          ))}
        </>
      )}
    </div>
  );
}

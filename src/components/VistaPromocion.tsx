import { useState } from 'react';
import { obtenerIconoMateria, type Materia } from '../core/cursada';
import { materiasQueCursa, type InscripcionAlumno } from '../lib/companeros';

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
  obtenerEstadoMateria: (materia: Materia, alumno: string) => { texto: string; estilo: string } | null;
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
  obtenerEstadoMateria: (materia: Materia, alumno: string) => { texto: string; estilo: string } | null;
  setMateriaCondicionesEnEdicion: (condiciones: CondicionesEdicion) => void;
}) {
  const cursan = alumnosOrdenadosPromocion.filter((alumno) => materiasQueCursa(inscripciones, alumno).has(materia.id));
  return (
    <section className="bg-[#161c26] border border-slate-800 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{obtenerIconoMateria(materia.nombre)}</span> {materia.nombre}
          </h3>
          {materia.reglaPromocion !== 'metodologia' && (
            <p className="text-xs text-slate-400 mt-1">
              Regulariza desde {materia.notaMinimaRegularizar}{['activos_porcentaje', 'tp_porcentaje_nota'].includes(materia.reglaPromocion) ? '%' : ''} · Promociona desde {materia.notaMinimaPromocionar}{materia.reglaPromocion === 'activos_porcentaje' ? '%' : ''}
            </p>
          )}
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
        {cursan.map((alumno) => {
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
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <span>🎯</span> Promoción por materia
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {propias.size > 0
            ? 'Tu cursada. El estado se calcula con los trabajos prácticos y sus notas.'
            : 'Estado calculado con los trabajos prácticos y sus notas.'}
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

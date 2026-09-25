import { useState } from 'react';
import { parcialHabilitado as parcialEstaHabilitado } from '../app/validators';
import { formatearFechaDDMMAAAA, obtenerDiasHastaFecha, obtenerIconoMateria, type Parcial } from '../core/cursada';

interface GrupoParciales {
  id: string;
  nombre: string;
  parciales: Parcial[];
}

interface Props {
  parciales: Parcial[];
  parcialesAgrupados: GrupoParciales[];
  esAdmin: boolean;
  usuarioActual: string | null;
  alumnos: string[];
  iniciarEdicionParcial: (parcial: Parcial) => void;
  handleEliminarParcial: (id: string) => void;
  toggleNotasParcial: (parcialId: string) => void;
  notasDesplegadas: Record<string, boolean>;
  notasInputs: Record<string, string>;
  handleNotaChangeLocal: (parcialId: string, alumno: string, valor: string) => void;
  handleGuardarNotaOnBlur: (parcialId: string, alumno: string) => void;
}

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
}: Props) {
  const [materiasExpandidas, setMateriasExpandidas] = useState<Record<string, boolean>>({});

  const toggleMateria = (materiaId: string) => {
    setMateriasExpandidas((prev) => ({ ...prev, [materiaId]: !prev[materiaId] }));
  };

  const renderParcial = (p: Parcial) => {
    const parcialDisponible = parcialEstaHabilitado(p.fecha);

    return (
      <div key={p.id} className="bg-[#0f141c] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-slate-800 pb-3 gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span aria-hidden="true">📋</span> {p.nombre}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm bg-purple-500/10 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl font-semibold">
              📅 {formatearFechaDDMMAAAA(p.fecha)}
            </span>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir el parcial en UGR Virtual"
                className="text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline"
              >
                Ver en UGR ↗
              </a>
            )}
            {esAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => iniciarEdicionParcial(p)}
                  className="text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                >
                  Editar
                </button>
                <button
                  type="button"
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
          <p className="text-sm text-slate-300 mb-4 bg-[#161c26] p-3 rounded-xl border border-slate-800/80">
            ℹ️ {p.detalles}
          </p>
        )}

        <div className="border-t border-slate-800/80 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {esAdmin ? 'Cargar notas' : 'Tu nota'}
              </h4>
              {!parcialDisponible && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-full px-2.5 py-1">
                  <span aria-hidden="true">📅</span>
                  {(() => {
                    const dias = obtenerDiasHastaFecha(p.fecha);
                    if (dias === 0) return 'Se toma hoy. La nota entra al sincronizar, después de rendirlo.';
                    return `Se toma en ${dias} ${dias === 1 ? 'día' : 'días'}. La nota entra al sincronizar, después de rendirlo.`;
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
                  <span aria-hidden="true">👤</span> Tu nota ({usuarioActual})
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]+([.,][0-9]+)?"
                  placeholder="-"
                  disabled
                  readOnly
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
                    className="p-3 rounded-xl border flex items-center justify-between gap-3 bg-[#161c26] border-slate-800/80"
                  >
                    <span className="text-sm font-semibold text-slate-200 flex items-center gap-2 truncate">
                      <span aria-hidden="true">👤</span> {alum}
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
                          ? 'bg-[#0f141c] text-purple-300 border-purple-500/50 focus:border-purple-400'
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
  };

  return (
    <div className="space-y-4">
      {parciales.length === 0 ? (
        <div className="bg-[#161c26] border border-slate-800 p-12 rounded-2xl text-center text-slate-400 text-sm">
          Aún no se han programado parciales.
        </div>
      ) : (
        parcialesAgrupados.map((grupo) => {
          const expandida = !!materiasExpandidas[grupo.id];
          const cantidad = grupo.parciales.length;
          const resumen = `${cantidad} parcial${cantidad === 1 ? '' : 'es'}`;

          return (
            <section key={grupo.id} className="bg-[#161c26] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => toggleMateria(grupo.id)}
                aria-expanded={expandida}
                className="w-full flex items-center gap-2 sm:gap-3 text-left px-3 py-3 sm:px-4 sm:py-3.5 rounded-t-2xl hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <span className="text-slate-500 text-sm shrink-0" aria-hidden="true">{expandida ? '▼' : '▶'}</span>
                <span className="text-lg shrink-0" aria-hidden="true">{obtenerIconoMateria(grupo.nombre)}</span>
                <span className="text-base sm:text-lg font-extrabold text-white truncate">{grupo.nombre}</span>
                {!expandida && (
                  <span className="ml-auto shrink-0 text-xs font-semibold text-slate-400 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-md">
                    {resumen}
                  </span>
                )}
              </button>

              {expandida && (
                <div className="px-3 sm:px-4 pb-4 pt-1 space-y-4 border-t border-slate-800">
                  {grupo.parciales.map((p) => renderParcial(p))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

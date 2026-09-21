'use client';

import { useId, useState } from 'react';
import { agruparTareasPorUnidad, obtenerResumenTareasAlumno } from '../core/cursada';
import EstadoTareaAlumno from './EstadoTareaAlumno';

const ESTADOS = [
  ['pendientes', 'Pendientes'],
  ['faltaNota', 'Sin nota'],
  ['futuras', 'Futuras'],
  ['completadas', 'Completadas']
];

export default function EstadoAlumno({ alumno, materias, abierto, alAlternar, ...acciones }) {
  const [filtro, setFiltro] = useState('pendientes');
  const contenidoId = useId();
  const resumen = obtenerResumenTareasAlumno(alumno, materias);
  const propia = alumno === acciones.usuarioActual;
  const seleccionadas = filtro === 'grupales'
    ? materias.flatMap((materia) => materia.tareas || []).filter((tarea) => tarea.grupal)
    : resumen[filtro];
  const ids = new Set(seleccionadas.map((tarea) => tarea.id));
  const filtros = [...ESTADOS, ['grupales', 'Grupales']];

  return (
    <section className={`rounded-2xl border overflow-hidden ${propia ? 'border-cyan-500/40 bg-[#131e29]' : 'border-slate-800 bg-[#131b25]'}`}>
      <h3>
        <button type="button" aria-expanded={abierto} aria-controls={contenidoId} onClick={alAlternar}
          className="w-full flex flex-wrap items-center justify-between gap-3 p-5 text-left hover:bg-white/[0.025] cursor-pointer">
          <span className="min-w-0">
            <span className="estado-alumno-nombre block text-white break-words">{alumno}</span>
            <span className="estado-alumno-resumen block text-xs text-slate-400 mt-1">{propia ? 'Tu situación · ' : ''}{resumen.completadas.length} de {resumen.total} tareas completadas</span>
          </span>
          <span className="flex items-center flex-wrap gap-2 text-xs text-slate-300">
            <span className={resumen.pendientes.length ? 'text-amber-300' : 'text-emerald-300'}>{resumen.pendientes.length} pendientes</span>
            <span>· {resumen.faltaNota.length} sin nota</span>
            <span>· {resumen.futuras.length} futuras</span>
            <span className="ml-2" aria-hidden="true">{abierto ? '−' : '+'}</span>
          </span>
        </button>
      </h3>
      <div id={contenidoId} hidden={!abierto}>
        {abierto && (
          <div className="border-t border-slate-800 p-4 sm:p-5 space-y-5">
            <div className="estado-filtros flex flex-wrap gap-2" role="group" aria-label={`Filtrar tareas de ${alumno}`}>
              {filtros.map(([clave, etiqueta]) => (
                <button key={clave} type="button" aria-pressed={filtro === clave} onClick={() => setFiltro(clave)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer ${filtro === clave ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                  <span>{etiqueta}</span>{' '}
                  <span className="estado-filtro-contador">{clave === 'grupales' ? resumen.totalGrupales : resumen[clave].length}</span>
                </button>
              ))}
            </div>
            {seleccionadas.length === 0 ? (
              <p role="status" className="rounded-xl border border-slate-800 p-6 text-center text-sm text-slate-300">
                {resumen.total === 0 ? 'Todavía no hay tareas cargadas.' : filtro === 'pendientes' ? 'No hay entregas abiertas pendientes. Podés consultar las notas, tareas futuras y grupos en los otros filtros.' : 'No hay tareas en esta categoría.'}
              </p>
                                                ) : (
              <div className="estado-tareas-contenedor flex flex-wrap gap-2">
                {materias
                  .flatMap((materia) => 
                    (materia.tareas || [])
                      .filter((tarea) => ids.has(tarea.id))
                      .map((tarea) => ({ tarea, materia }))
                  )
                  .map(({ tarea, materia }) => (
                    <div key={tarea.id} className="w-[calc(50%-0.5rem)] bg-slate-800/20 rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b border-slate-700/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></span>
                        {materia.nombre}
                      </div>
                      <EstadoTareaAlumno tarea={tarea} alumno={alumno}
                        materia={materia} 
                        unidad={tarea.unidad} 
                        alumnos={acciones.alumnos}
                        usuarioActual={acciones.usuarioActual}
                        irATareaEnMaterias={acciones.irATareaEnMaterias}
                        toggleTareaDesdeCliente={acciones.toggleTareaDesdeCliente}
                        notasTareasInputs={acciones.notasTareasInputs}
                        handleNotaTareaChangeLocal={acciones.handleNotaTareaChangeLocal}
                        handleGuardarNotaTareaOnBlur={acciones.handleGuardarNotaTareaOnBlur}
          />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

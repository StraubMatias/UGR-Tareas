'use client';

import { useId, useState } from 'react';
import {
  obtenerResumenTareasAlumno,
  ordenarTareas,
  acentoVisualMateria,
  obtenerIconoMateria,
  tituloVisibleMateria,
  type Materia,
  type Tarea
} from '../core/cursada';
import { alumnosDeLaMateria, materiasEnComun, materiasQueCursa, type InscripcionAlumno } from '../lib/companeros';
import type { InvitacionGrupoEnviadaTablero } from './portal/types';
import EstadoTareaAlumno from './EstadoTareaAlumno';

const ESTADOS = [
  ['pendientes', 'Pendientes'],
  ['faltaNota', 'Sin nota'],
  ['futuras', 'Futuras'],
  ['completadas', 'Completadas']
] as const;

type ClaveFiltro = 'pendientes' | 'faltaNota' | 'futuras' | 'completadas' | 'grupales';

interface Props {
  alumno: string;
  materias: Materia[];
  inscripciones?: InscripcionAlumno[];
  abierto: boolean;
  alAlternar: () => void;
  alumnos: string[];
  usuarioActual: string | null;
  esAdmin?: boolean;
  irATareaEnMaterias: (tareaId: string) => void;
  toggleTareaDesdeCliente: (tareaId: string, alumno: string, tarea: Tarea) => void;
  notasTareasInputs: Record<string, string>;
  handleNotaTareaChangeLocal: (tareaId: string, alumno: string, valor: string) => void;
  handleGuardarNotaTareaOnBlur: (tareaId: string, alumno: string) => void;
  recargarTablero?: (mostrarCarga?: boolean) => void | Promise<unknown>;
  invitacionesGrupoEnviadas?: InvitacionGrupoEnviadaTablero[];
}

export default function EstadoAlumno({ alumno, materias, inscripciones = [], abierto, alAlternar, esAdmin = false, ...acciones }: Props) {
  const [filtro, setFiltro] = useState<ClaveFiltro>('pendientes');
  const contenidoId = useId();
  const propia = alumno === acciones.usuarioActual;
  const suyas = materiasQueCursa(inscripciones, alumno);
  const propiasDelViewer = materiasQueCursa(inscripciones, acciones.usuarioActual || '');
  const idsCursada = propia
    ? suyas
    : materiasEnComun(inscripciones, acciones.usuarioActual || '', alumno);
  const materiasDelAlumno = materias.filter((materia) => idsCursada.has(materia.id));
  const resumen = obtenerResumenTareasAlumno(alumno, materiasDelAlumno);
  const avisoCursada = propia && suyas.size === 0
    ? 'Tu cuenta todavía no tiene cursada'
    : suyas.size === 0
      ? 'Todavía no sincronizó su cursada'
      : materiasDelAlumno.length === 0 && propiasDelViewer.size === 0
        ? 'Sincronizá para ver las materias en común'
        : materiasDelAlumno.length === 0
          ? 'No cursan materias en común'
          : '';
  const seleccionadas = filtro === 'grupales' ? resumen.grupales : resumen[filtro];
  const ids = new Set(seleccionadas.map((tarea) => tarea.id));
  const filtros = ([...ESTADOS, ['grupales', 'Grupales']] as [ClaveFiltro, string][]);
  const bloquesPorMateria = materiasDelAlumno
    .map((materia) => ({
      materia,
      tareas: ordenarTareas((materia.tareas || []).filter((tarea) => ids.has(tarea.id)))
    }))
    .filter((bloque) => bloque.tareas.length > 0);
  const modoCompacto = bloquesPorMateria.length >= 2
    && bloquesPorMateria.every((bloque) => bloque.tareas.length === 1);

  return (
    <section className={`rounded-2xl border overflow-hidden ${propia ? 'border-cyan-500/40 bg-[#131e29]' : 'border-slate-800 bg-[#131b25]'}`}>
      <h3>
        <button type="button" aria-expanded={abierto} aria-controls={contenidoId} onClick={alAlternar}
          className="w-full flex flex-wrap items-center justify-between gap-3 p-5 text-left hover:bg-white/[0.025] cursor-pointer">
          <span className="min-w-0">
            <span className="estado-alumno-nombre block text-white break-words">{alumno}</span>
            <span className="estado-alumno-resumen block text-xs text-slate-400 mt-1">{avisoCursada || `${propia ? 'Tu situación · ' : ''}${resumen.completadas.length} de ${resumen.total} tareas completadas`}</span>
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
                {resumen.total === 0 ? 'Todavía no hay tareas cargadas.' : filtro === 'pendientes' ? 'No hay entregas abiertas pendientes. Podés consultar las notas, tareas futuras y grupos en los otros filtros.' : filtro === 'grupales' ? 'No hay trabajos grupales activos. Los que ya tienen nota cargada están en Completadas.' : 'No hay tareas en esta categoría.'}
              </p>
            ) : (
              <div
                className={`estado-tareas-por-materia${modoCompacto ? ' estado-bloques-materia-compactos' : ''}`}
                data-cantidad-bloques={bloquesPorMateria.length}
              >
                {bloquesPorMateria.map(({ materia, tareas }) => {
                  const acento = acentoVisualMateria(materia.id);
                  return (
                    <section
                      key={materia.id}
                      className="estado-materia-bloque rounded-xl border overflow-hidden"
                      style={{
                        borderColor: acento.borde,
                        background: acento.fondo
                      }}
                    >
                      <header
                        className="estado-materia-bloque-cabecera flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-800/80"
                        style={{ color: acento.texto }}
                      >
                        <span className="text-lg leading-none" aria-hidden="true">
                          {obtenerIconoMateria(materia.nombre)}
                        </span>
                        <h4 className="estado-materia-bloque-titulo text-sm font-semibold text-slate-100 m-0 min-w-0 break-words">
                          {tituloVisibleMateria(materia.nombre)}
                        </h4>
                        <span className="ml-auto text-xs text-slate-500 shrink-0">
                          {tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}
                        </span>
                      </header>
                      <div
                        className="estado-tareas-contenedor estado-tareas-columnas p-3 sm:p-3.5"
                        data-cantidad-tareas={tareas.length}
                      >
                        {tareas.map((tarea) => (
                          <div key={tarea.id} className="estado-tarea-slot">
                            <EstadoTareaAlumno
                              tarea={tarea}
                              alumno={alumno}
                              materia={materia}
                              unidad={tarea.unidad}
                              ocultarContextoMateria
                              alumnos={alumnosDeLaMateria(inscripciones, materia.id)}
                              usuarioActual={acciones.usuarioActual}
                              irATareaEnMaterias={acciones.irATareaEnMaterias}
                              toggleTareaDesdeCliente={acciones.toggleTareaDesdeCliente}
                              notasTareasInputs={acciones.notasTareasInputs}
                              handleNotaTareaChangeLocal={acciones.handleNotaTareaChangeLocal}
                              handleGuardarNotaTareaOnBlur={acciones.handleGuardarNotaTareaOnBlur}
                              recargarTablero={acciones.recargarTablero}
                              invitacionesGrupoEnviadas={acciones.invitacionesGrupoEnviadas}
                              esAdmin={esAdmin}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

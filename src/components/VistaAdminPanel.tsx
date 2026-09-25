'use client';

import type { FormEvent } from 'react';
import type { Materia } from '../core/cursada';

export interface VistaAdminPanelProps {
  alumnos: string[];
  materias: Materia[];
  etiquetaMateria: (nombre: string) => string;
  nuevoAlumnoNombre: string;
  onNuevoAlumnoNombre: (v: string) => void;
  nuevoMateriaAnio: string;
  onNuevoMateriaAnio: (v: string) => void;
  nuevoMateriaCuatrimestre: string;
  onNuevoMateriaCuatrimestre: (v: string) => void;
  nuevaMateriaNombre: string;
  onNuevaMateriaNombre: (v: string) => void;
  materiaSel: string;
  onMateriaSel: (v: string) => void;
  nombreTarea: string;
  onNombreTarea: (v: string) => void;
  unidadTarea: string;
  onUnidadTarea: (v: string) => void;
  tipoTarea: string;
  onTipoTarea: (v: string) => void;
  tareaConNota: boolean;
  onTareaConNota: (v: boolean) => void;
  tareaGrupal: boolean;
  onTareaGrupal: (v: boolean) => void;
  cupoMaximo: number;
  onCupoMaximo: (v: number) => void;
  fechaInicio: string;
  onFechaInicio: (v: string) => void;
  fechaFin: string;
  onFechaFin: (v: string) => void;
  detallesTarea: string;
  onDetallesTarea: (v: string) => void;
  materiaParcialSel: string;
  onMateriaParcialSel: (v: string) => void;
  nombreParcial: string;
  onNombreParcial: (v: string) => void;
  fechaParcial: string;
  onFechaParcial: (v: string) => void;
  detallesParcial: string;
  onDetallesParcial: (v: string) => void;
  materiaHorarioSel: string;
  onMateriaHorarioSel: (v: string) => void;
  diaHorario: string;
  onDiaHorario: (v: string) => void;
  horaInicioHorario: string;
  onHoraInicioHorario: (v: string) => void;
  horaFinHorario: string;
  onHoraFinHorario: (v: string) => void;
  aulaHorario: string;
  onAulaHorario: (v: string) => void;
  onCrearAlumno: (e: FormEvent<HTMLFormElement>) => void;
  onEliminarAlumno: (nombre: string) => void;
  onEditarAlumno: (antiguo: string) => void;
  onCrearMateria: (e: FormEvent<HTMLFormElement>) => void;
  onCrearTarea: (e: FormEvent<HTMLFormElement>) => void;
  onCrearParcial: (e: FormEvent<HTMLFormElement>) => void;
  onCrearHorario: (e: FormEvent<HTMLFormElement>) => void;
}

export default function VistaAdminPanel(props: VistaAdminPanelProps) {
  const {
    alumnos, materias, etiquetaMateria,
    nuevoAlumnoNombre, onNuevoAlumnoNombre,
    nuevoMateriaAnio, onNuevoMateriaAnio,
    nuevoMateriaCuatrimestre, onNuevoMateriaCuatrimestre,
    nuevaMateriaNombre, onNuevaMateriaNombre,
    materiaSel, onMateriaSel,
    nombreTarea, onNombreTarea,
    unidadTarea, onUnidadTarea,
    tipoTarea, onTipoTarea,
    tareaConNota, onTareaConNota,
    tareaGrupal, onTareaGrupal,
    cupoMaximo, onCupoMaximo,
    fechaInicio, onFechaInicio,
    fechaFin, onFechaFin,
    detallesTarea, onDetallesTarea,
    materiaParcialSel, onMateriaParcialSel,
    nombreParcial, onNombreParcial,
    fechaParcial, onFechaParcial,
    detallesParcial, onDetallesParcial,
    materiaHorarioSel, onMateriaHorarioSel,
    diaHorario, onDiaHorario,
    horaInicioHorario, onHoraInicioHorario,
    horaFinHorario, onHoraFinHorario,
    aulaHorario, onAulaHorario,
    onCrearAlumno, onEliminarAlumno, onEditarAlumno,
    onCrearMateria, onCrearTarea, onCrearParcial, onCrearHorario
  } = props;

  return (
    <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* ALUMNOS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>👤</span> Agregar Alumnos
                    </h2>
                    <form onSubmit={onCrearAlumno} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Carlos"
                          value={nuevoAlumnoNombre}
                          onChange={(e) => onNuevoAlumnoNombre(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Año</label>
                          <input
                            type="number"
                            min="2000"
                            step="1"
                            required
                            value={nuevoMateriaAnio}
                            onChange={(e) => onNuevoMateriaAnio(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Cuatrimestre</label>
                          <select
                            value={nuevoMateriaCuatrimestre}
                            onChange={(e) => onNuevoMateriaCuatrimestre(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
                          >
                            <option value="1">1°</option>
                            <option value="2">2°</option>
                          </select>
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Guardar Alumno
                      </button>
                    </form>

                    <div className="mt-6 border-t border-slate-800 pt-4">
                      <span className="text-xs font-bold text-slate-400 block mb-2">Registrados ({alumnos.length}):</span>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {alumnos.map((a) => (
                          <div key={a} className="bg-[#0f141c] p-2.5 rounded-lg border border-slate-800 flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-slate-200 font-medium">{a}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => onEditarAlumno(a)}
                                className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => onEliminarAlumno(a)}
                                className="text-red-400 hover:text-red-300 font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* MATERIAS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>📚</span> Nueva Materia
                    </h2>
                    <form onSubmit={onCrearMateria} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: SEGURIDAD EN REDES"
                          value={nuevaMateriaNombre}
                          onChange={(e) => onNuevaMateriaNombre(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none transition-all"
                        />
                      </div>
                      <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Guardar Materia
                      </button>
                    </form>
                  </div>

                  {/* TAREAS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>➕</span> Nueva Tarea
                    </h2>
                    <form onSubmit={onCrearTarea} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Materia</label>
                        <select
                          value={materiaSel}
                          onChange={(e) => onMateriaSel(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none font-medium cursor-pointer"
                        >
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Título de la Tarea</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: TP N°1 - Análisis de Logs"
                          value={nombreTarea}
                          onChange={(e) => onNombreTarea(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Unidad (opcional)</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Ej: 1"
                          value={unidadTarea}
                          onChange={(e) => onUnidadTarea(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de tarea</label>
                        <select
                          value={tipoTarea}
                          onChange={(e) => {
                            onTipoTarea(e.target.value);
                            if (e.target.value === 'trabajo_practico') onTareaConNota(true);
                          }}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
                        >
                          <option value="actividad">Actividad</option>
                          <option value="foro">Foro</option>
                          <option value="trabajo_practico">Trabajo práctico</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-3 text-sm font-semibold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tareaConNota || tipoTarea === 'trabajo_practico'}
                          disabled={tipoTarea === 'trabajo_practico'}
                          onChange={(e) => onTareaConNota(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                        />
                        Esta tarea se califica con nota
                      </label>
                      <label className="flex items-center gap-3 text-sm font-semibold text-cyan-200">
                        <input type="checkbox" checked={tareaGrupal} onChange={(e) => onTareaGrupal(e.target.checked)} />
                        Trabajo grupal (opcional en grupo; si no, entrega individual)
                      </label>
                      {tareaGrupal && (
                        <div className="flex flex-col gap-1">
                          <label className="block text-xs font-semibold text-slate-300">Cupo máximo por grupo (0 = sin límite)</label>
                          <input
                            type="number"
                            min="0"
                            value={cupoMaximo}
                            onChange={(e) => onCupoMaximo(parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Abre</label>
                          <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => onFechaInicio(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Vence</label>
                          <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => onFechaFin(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Consigna / Detalles</label>
                        <textarea
                          rows={3}
                          placeholder="Texto o pautas para el trabajo..."
                          value={detallesTarea}
                          onChange={(e) => onDetallesTarea(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        ></textarea>
                      </div>

                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Publicar Tarea
                      </button>
                    </form>
                  </div>

                  {/* NUEVO: CARGAR PARCIAL */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>📋</span> 'Nuevo Parcial'
                    </h2>
                    <form onSubmit={onCrearParcial} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Materia</label>
                        <select
                          value={materiaParcialSel}
                          onChange={(e) => onMateriaParcialSel(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none font-medium cursor-pointer"
                        >
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Título / Instancia</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Primer Parcial"
                          value={nombreParcial}
                          onChange={(e) => onNombreParcial(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha del Examen</label>
                        <input
                          type="date"
                          value={fechaParcial}
                          onChange={(e) => onFechaParcial(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Temas / Aclaraciones</label>
                        <textarea
                          rows={3}
                          placeholder="Unidades que entran, aula, etc..."
                          value={detallesParcial}
                          onChange={(e) => onDetallesParcial(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        ></textarea>
                      </div>

                      <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        'Publicar Parcial'
                      </button>
                    </form>
                  </div>

                  {/* HORARIOS */}
                  <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-base font-bold text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <span>🗓️</span> Nuevo Horario
                    </h2>
                    <form onSubmit={onCrearHorario} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Materia</label>
                        <select
                          value={materiaHorarioSel}
                          onChange={(e) => onMateriaHorarioSel(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-white focus:outline-none font-medium cursor-pointer"
                        >
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{etiquetaMateria(m.nombre)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Día</label>
                        <select
                          value={diaHorario}
                          onChange={(e) => onDiaHorario(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
                        >
                          <option value="1">Lunes</option>
                          <option value="2">Martes</option>
                          <option value="3">Miércoles</option>
                          <option value="4">Jueves</option>
                          <option value="5">Viernes</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Desde</label>
                          <input
                            type="time"
                            required
                            value={horaInicioHorario}
                            onChange={(e) => onHoraInicioHorario(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Hasta</label>
                          <input
                            type="time"
                            required
                            value={horaFinHorario}
                            onChange={(e) => onHoraFinHorario(e.target.value)}
                            className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Aula (opcional)</label>
                        <input
                          type="text"
                          placeholder="Ej: Aula 12"
                          value={aulaHorario}
                          onChange={(e) => onAulaHorario(e.target.value)}
                          className="w-full bg-[#0f141c] border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                        Publicar Horario
                      </button>
                    </form>
                  </div>
                </div>
    </div>
  );
}

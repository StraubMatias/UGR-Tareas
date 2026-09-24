import type { FormEvent } from 'react';
import type { Tarea } from '../../core/cursada';
import ModalOverlay from './ModalOverlay';

export interface EdicionAlumno {
  antiguoNombre: string;
  nuevoNombre: string;
}

export interface EdicionMateria {
  id: string;
  nombre: string;
}

export interface EdicionTarea {
  materiaId: string;
  tarea: Tarea;
}

export interface EdicionCondicionesMateria {
  id: string;
  condiciones: string;
  notaMinimaRegularizar: number | string;
  notaMinimaPromocionar: number | string;
  reglaPromocion: string;
}

interface ModalesEdicionProps {
  alumnoEnEdicion: EdicionAlumno | null;
  onCerrarAlumno: () => void;
  onCambiarAlumno: (valor: EdicionAlumno) => void;
  onGuardarAlumno: (e: FormEvent<HTMLFormElement>) => void;
  materiaEnEdicion: EdicionMateria | null;
  onCerrarMateria: () => void;
  onCambiarMateria: (valor: EdicionMateria) => void;
  onGuardarMateria: (e: FormEvent<HTMLFormElement>) => void;
  tareaEnEdicion: EdicionTarea | null;
  onCerrarTarea: () => void;
  onCambiarTarea: (valor: EdicionTarea) => void;
  onGuardarTarea: (e: FormEvent<HTMLFormElement>) => void;
  materiaCondicionesEnEdicion: EdicionCondicionesMateria | null;
  onCerrarCondiciones: () => void;
  onCambiarCondiciones: (valor: EdicionCondicionesMateria) => void;
  onGuardarCondiciones: (e: FormEvent<HTMLFormElement>) => void;
}

export default function ModalesEdicion({
  alumnoEnEdicion,
  onCerrarAlumno,
  onCambiarAlumno,
  onGuardarAlumno,
  materiaEnEdicion,
  onCerrarMateria,
  onCambiarMateria,
  onGuardarMateria,
  tareaEnEdicion,
  onCerrarTarea,
  onCambiarTarea,
  onGuardarTarea,
  materiaCondicionesEnEdicion,
  onCerrarCondiciones,
  onCambiarCondiciones,
  onGuardarCondiciones
}: ModalesEdicionProps) {
  return (
    <>
      {alumnoEnEdicion && (
        <ModalOverlay maxWidth="md">
          <h3 className="text-base font-bold text-white mb-4">Editar Alumno</h3>
          <form onSubmit={onGuardarAlumno} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
              <input
                type="text"
                required
                value={alumnoEnEdicion.nuevoNombre}
                onChange={(e) => onCambiarAlumno({ ...alumnoEnEdicion, nuevoNombre: e.target.value })}
                className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCerrarAlumno} className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="w-1/2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Guardar
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {materiaEnEdicion && (
        <ModalOverlay maxWidth="md">
          <h3 className="text-base font-bold text-white mb-4">Editar Materia</h3>
          <form onSubmit={onGuardarMateria} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
              <input
                type="text"
                required
                value={materiaEnEdicion.nombre}
                onChange={(e) => onCambiarMateria({ ...materiaEnEdicion, nombre: e.target.value })}
                className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCerrarMateria} className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="w-1/2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Guardar
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {tareaEnEdicion && (
        <ModalOverlay maxWidth="xl">
          <h3 className="text-base font-bold text-white mb-4">Editar Tarea</h3>
          <form onSubmit={onGuardarTarea} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Título</label>
              <input
                type="text"
                required
                value={tareaEnEdicion.tarea.nombre}
                onChange={(e) =>
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: { ...tareaEnEdicion.tarea, nombre: e.target.value }
                  })
                }
                className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unidad (opcional)</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ej: 1"
                value={tareaEnEdicion.tarea.unidad || ''}
                onChange={(e) =>
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: { ...tareaEnEdicion.tarea, unidad: e.target.value }
                  })
                }
                className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de tarea</label>
              <select
                value={tareaEnEdicion.tarea.tipo || 'actividad'}
                onChange={(e) =>
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: {
                      ...tareaEnEdicion.tarea,
                      tipo: e.target.value,
                      conNota: e.target.value === 'trabajo_practico' || tareaEnEdicion.tarea.conNota
                    }
                  })
                }
                className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="actividad">Actividad</option>
                <option value="foro">Foro</option>
                <option value="trabajo_practico">Trabajo práctico</option>
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(tareaEnEdicion.tarea.conNota) || tareaEnEdicion.tarea.tipo === 'trabajo_practico'}
                disabled={tareaEnEdicion.tarea.tipo === 'trabajo_practico'}
                onChange={(e) =>
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: { ...tareaEnEdicion.tarea, conNota: e.target.checked }
                  })
                }
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
              />
              Esta tarea se califica con nota
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-cyan-200">
              <input
                type="checkbox"
                checked={Boolean(tareaEnEdicion.tarea.grupal)}
                onChange={(e) =>
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: { ...tareaEnEdicion.tarea, grupal: e.target.checked }
                  })
                }
              />
              Trabajo grupal (comparte entrega y nota)
            </label>
            {Boolean(tareaEnEdicion.tarea.grupal) && (
              <div className="flex flex-col gap-1 mt-2">
                <label className="block text-xs font-semibold text-slate-300">Cupo máximo por grupo (0 = sin límite)</label>
                <input
                  type="number"
                  min="0"
                  value={tareaEnEdicion.tarea.cupo_maximo ?? 0}
                  onChange={(e) =>
                    onCambiarTarea({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, cupo_maximo: parseInt(e.target.value, 10) || 0 }
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Abre</label>
                <input
                  type="date"
                  value={tareaEnEdicion.tarea.inicio ?? ''}
                  onChange={(e) =>
                    onCambiarTarea({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, inicio: e.target.value }
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Vence</label>
                <input
                  type="date"
                  value={tareaEnEdicion.tarea.fin ?? ''}
                  onChange={(e) =>
                    onCambiarTarea({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, fin: e.target.value }
                    })
                  }
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Consigna / Detalles</label>
              <textarea
                rows={4}
                value={tareaEnEdicion.tarea.detalles}
                onChange={(e) =>
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: { ...tareaEnEdicion.tarea, detalles: e.target.value }
                  })
                }
                className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCerrarTarea} className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Guardar Cambios
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {materiaCondicionesEnEdicion && (
        <ModalOverlay maxWidth="xl">
          <h3 className="text-base font-bold text-white mb-1">Condiciones de promoción</h3>
          <p className="text-xs text-slate-400 mb-5">Las notas se calculan sobre los trabajos prácticos cargados.</p>
          <form onSubmit={onGuardarCondiciones} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Condiciones de la materia</label>
              <textarea
                rows={5}
                value={materiaCondicionesEnEdicion.condiciones}
                onChange={(e) => onCambiarCondiciones({ ...materiaCondicionesEnEdicion, condiciones: e.target.value })}
                placeholder="Ej: Para regularizar hay que completar todos los trabajos prácticos..."
                className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {['activos_porcentaje', 'tp_porcentaje_nota'].includes(materiaCondicionesEnEdicion.reglaPromocion)
                    ? 'Porcentaje para regularizar'
                    : 'Mínima para regularizar'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={['activos_porcentaje', 'tp_porcentaje_nota'].includes(materiaCondicionesEnEdicion.reglaPromocion) ? '100' : '10'}
                  step="0.01"
                  value={materiaCondicionesEnEdicion.notaMinimaRegularizar}
                  onChange={(e) => onCambiarCondiciones({ ...materiaCondicionesEnEdicion, notaMinimaRegularizar: e.target.value })}
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {materiaCondicionesEnEdicion.reglaPromocion === 'activos_porcentaje' ? 'Porcentaje para promocionar' : 'Mínima para promocionar'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={materiaCondicionesEnEdicion.reglaPromocion === 'activos_porcentaje' ? '100' : '10'}
                  step="0.01"
                  value={materiaCondicionesEnEdicion.notaMinimaPromocionar}
                  onChange={(e) => onCambiarCondiciones({ ...materiaCondicionesEnEdicion, notaMinimaPromocionar: e.target.value })}
                  className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onCerrarCondiciones} className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Cancelar
              </button>
              <button type="submit" className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                Guardar condiciones
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </>
  );
}

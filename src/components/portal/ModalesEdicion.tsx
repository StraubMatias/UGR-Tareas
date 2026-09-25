import type { FormEvent } from 'react';
import { flagsDeModoEntrega, type Tarea } from '../../core/cursada';
import CamposModoEntregaTarea, { modoEntregaDesdeTarea } from '../CamposModoEntregaTarea';
import ModalOverlay, { ModalOverlayBody, ModalOverlayFooter, ModalOverlayHeader } from './ModalOverlay';

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

function BotonesModal({
  onCancel,
  cancelLabel = 'Cancelar',
  submitLabel,
  submitClass = 'bg-amber-600 hover:bg-amber-500'
}: {
  onCancel: () => void;
  cancelLabel?: string;
  submitLabel: string;
  submitClass?: string;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="w-1/2 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
      >
        {cancelLabel}
      </button>
      <button type="submit" className={`w-1/2 rounded-xl py-3 text-xs font-bold text-white cursor-pointer ${submitClass}`}>
        {submitLabel}
      </button>
    </div>
  );
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
          <form onSubmit={onGuardarAlumno} className="flex min-h-0 flex-1 flex-col">
            <ModalOverlayHeader title="Editar alumno" onClose={onCerrarAlumno} closeLabel="Cancelar" />
            <ModalOverlayBody className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Nombre</label>
                <input
                  type="text"
                  required
                  value={alumnoEnEdicion.nuevoNombre}
                  onChange={(e) => onCambiarAlumno({ ...alumnoEnEdicion, nuevoNombre: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                />
              </div>
            </ModalOverlayBody>
            <ModalOverlayFooter>
              <BotonesModal onCancel={onCerrarAlumno} submitLabel="Guardar" />
            </ModalOverlayFooter>
          </form>
        </ModalOverlay>
      )}

      {materiaEnEdicion && (
        <ModalOverlay maxWidth="md">
          <form onSubmit={onGuardarMateria} className="flex min-h-0 flex-1 flex-col">
            <ModalOverlayHeader title="Editar materia" onClose={onCerrarMateria} closeLabel="Cancelar" />
            <ModalOverlayBody className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Nombre</label>
                <input
                  type="text"
                  required
                  value={materiaEnEdicion.nombre}
                  onChange={(e) => onCambiarMateria({ ...materiaEnEdicion, nombre: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                />
              </div>
            </ModalOverlayBody>
            <ModalOverlayFooter>
              <BotonesModal onCancel={onCerrarMateria} submitLabel="Guardar" />
            </ModalOverlayFooter>
          </form>
        </ModalOverlay>
      )}

      {tareaEnEdicion && (
        <ModalOverlay maxWidth="full">
          <form onSubmit={onGuardarTarea} className="flex min-h-0 flex-1 flex-col">
            <ModalOverlayHeader title="Editar tarea" onClose={onCerrarTarea} closeLabel="Cancelar" />
            <ModalOverlayBody className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Título</label>
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
                  className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Unidad (opcional)</label>
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
                  className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Tipo de tarea</label>
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
                  className="w-full cursor-pointer rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                >
                  <option value="actividad">Actividad</option>
                  <option value="foro">Foro</option>
                  <option value="trabajo_practico">Trabajo práctico</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-200">
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
              <CamposModoEntregaTarea
                modo={modoEntregaDesdeTarea(tareaEnEdicion.tarea)}
                onModo={(modo) => {
                  const flags = flagsDeModoEntrega(modo);
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: {
                      ...tareaEnEdicion.tarea,
                      grupal: flags.grupal,
                      permite_individual: flags.permiteIndividual,
                      cupo_maximo: flags.grupal ? (tareaEnEdicion.tarea.cupo_maximo ?? 0) : 0
                    }
                  });
                }}
                cupoMaximo={Number(tareaEnEdicion.tarea.cupo_maximo) || 0}
                onCupoMaximo={(cupo) =>
                  onCambiarTarea({
                    ...tareaEnEdicion,
                    tarea: { ...tareaEnEdicion.tarea, cupo_maximo: cupo }
                  })
                }
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Abre</label>
                  <input
                    type="date"
                    value={tareaEnEdicion.tarea.inicio ?? ''}
                    onChange={(e) =>
                      onCambiarTarea({
                        ...tareaEnEdicion,
                        tarea: { ...tareaEnEdicion.tarea, inicio: e.target.value }
                      })
                    }
                    className="w-full cursor-pointer rounded-xl border border-slate-800 bg-[#0f141c] p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Vence</label>
                  <input
                    type="date"
                    value={tareaEnEdicion.tarea.fin ?? ''}
                    onChange={(e) =>
                      onCambiarTarea({
                        ...tareaEnEdicion,
                        tarea: { ...tareaEnEdicion.tarea, fin: e.target.value }
                      })
                    }
                    className="w-full cursor-pointer rounded-xl border border-slate-800 bg-[#0f141c] p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Consigna / Detalles</label>
                <textarea
                  rows={6}
                  value={tareaEnEdicion.tarea.detalles}
                  onChange={(e) =>
                    onCambiarTarea({
                      ...tareaEnEdicion,
                      tarea: { ...tareaEnEdicion.tarea, detalles: e.target.value }
                    })
                  }
                  className="min-h-[8rem] w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                />
              </div>
            </ModalOverlayBody>
            <ModalOverlayFooter>
              <BotonesModal
                onCancel={onCerrarTarea}
                submitLabel="Guardar cambios"
                submitClass="bg-blue-600 hover:bg-blue-500"
              />
            </ModalOverlayFooter>
          </form>
        </ModalOverlay>
      )}

      {materiaCondicionesEnEdicion && (
        <ModalOverlay maxWidth="2xl">
          <form onSubmit={onGuardarCondiciones} className="flex min-h-0 flex-1 flex-col">
            <ModalOverlayHeader
              title="Condiciones de promoción"
              subtitle="Las notas se calculan sobre los trabajos prácticos cargados."
              onClose={onCerrarCondiciones}
              closeLabel="Cancelar"
            />
            <ModalOverlayBody className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Condiciones de la materia</label>
                <textarea
                  rows={6}
                  value={materiaCondicionesEnEdicion.condiciones}
                  onChange={(e) => onCambiarCondiciones({ ...materiaCondicionesEnEdicion, condiciones: e.target.value })}
                  placeholder="Ej: Para regularizar hay que completar todos los trabajos prácticos..."
                  className="min-h-[8rem] w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
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
                    className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    {materiaCondicionesEnEdicion.reglaPromocion === 'activos_porcentaje' ? 'Porcentaje para promocionar' : 'Mínima para promocionar'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={materiaCondicionesEnEdicion.reglaPromocion === 'activos_porcentaje' ? '100' : '10'}
                    step="0.01"
                    value={materiaCondicionesEnEdicion.notaMinimaPromocionar}
                    onChange={(e) => onCambiarCondiciones({ ...materiaCondicionesEnEdicion, notaMinimaPromocionar: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0f141c] p-3 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
            </ModalOverlayBody>
            <ModalOverlayFooter>
              <BotonesModal
                onCancel={onCerrarCondiciones}
                submitLabel="Guardar condiciones"
                submitClass="bg-emerald-600 hover:bg-emerald-500"
              />
            </ModalOverlayFooter>
          </form>
        </ModalOverlay>
      )}
    </>
  );
}

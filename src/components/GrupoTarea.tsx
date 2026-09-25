import { useState, type FormEvent } from 'react';
import { gestionarGrupoTareaAction, invitarAGrupoTareaAction } from '../app/actions';
import {
  alumnoEligioEntregaIndividual,
  modoEntregaDeTarea,
  type Grupo,
  type Tarea
} from '../core/cursada';
import type { GestionarGrupoParams } from '../app/actions';

interface Props {
  tarea: Tarea;
  materiaNombre?: string;
  usuarioActual: string | null;
  recargar: (mostrarCarga?: boolean) => void | Promise<unknown>;
  esAdmin?: boolean;
  alumnos?: string[];
  alumnoContexto?: string | null;
}

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() || '')
    .join('') || '?';
}

function FichaPersona({ nombre, propio = false }: { nombre: string; propio?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs ${propio ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-slate-700 bg-slate-900/70 text-slate-200'}`}>
      <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${propio ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700 text-slate-100'}`} aria-hidden="true">
        {iniciales(nombre)}
      </span>
      {nombre}
      {propio && <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300">Vos</span>}
    </span>
  );
}

export default function GrupoTarea({
  tarea,
  materiaNombre = 'esta materia',
  usuarioActual,
  recargar,
  esAdmin = false,
  alumnos = [],
  alumnoContexto = null
}: Props) {
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [verOtros, setVerOtros] = useState(false);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  const [adminAlumno, setAdminAlumno] = useState('');
  const [adminGrupoId, setAdminGrupoId] = useState('');
  const [adminNuevoNombre, setAdminNuevoNombre] = useState('');
  const [adminModo, setAdminModo] = useState('existente');

  const grupos = tarea.grupos || [];
  const cupo = Number(tarea.cupo_maximo) || 0;
  const modo = modoEntregaDeTarea(tarea);
  const sujeto = alumnoContexto || usuarioActual;
  const propio = sujeto
    ? grupos.find((grupo) => grupo.integrantes?.some((integrante) => integrante.toLowerCase() === sujeto.toLowerCase()))
    : undefined;
  const puedeGestionar = Boolean(usuarioActual && (!alumnoContexto || alumnoContexto.toLowerCase() === usuarioActual.toLowerCase()));
  const entregaIndividualActiva = sujeto ? alumnoEligioEntregaIndividual(tarea, sujeto) : false;
  const ocupados = new Set(grupos.flatMap((grupo) => grupo.integrantes || []).map((nombreIntegrante) => nombreIntegrante.toLowerCase()));
  const libres = alumnos.filter((alumno) => !ocupados.has(alumno.toLowerCase()));
  const libresParaVer = libres.filter((alumno) => alumno.toLowerCase() !== usuarioActual?.toLowerCase());

  const plazas = (grupo: Grupo) => {
    const actuales = grupo.integrantes?.length || 0;
    return cupo === 0 ? `${actuales} ${actuales === 1 ? 'integrante' : 'integrantes'}` : `${actuales} de ${cupo}`;
  };

  const invitar = async (alumnoNombre: string) => {
    if (ocupado || !propio?.id) return;
    setOcupado(true);
    setMensaje('');
    try {
      const resultado = await invitarAGrupoTareaAction({
        tareaId: tarea.id,
        grupoId: propio.id,
        alumnoNombre
      });
      if (!resultado?.exito) {
        setMensaje(resultado?.mensaje || 'No se pudo enviar la invitación.');
        return;
      }
      setMensaje(resultado.mensaje || `Invitación enviada a ${alumnoNombre}.`);
      await recargar(false);
    } catch {
      setMensaje('No se pudo enviar la invitación.');
    } finally {
      setOcupado(false);
    }
  };

  const gestionar = async (datos: Omit<GestionarGrupoParams, 'tareaId'>) => {
    if (ocupado) return;
    setOcupado(true);
    setMensaje('');
    try {
      const resultado = await gestionarGrupoTareaAction({ tareaId: tarea.id, ...datos });
      if (!resultado?.exito) {
        setMensaje(resultado?.mensaje || 'No se pudo actualizar el grupo.');
        return;
      }
      setNombre('');
      setAdminNuevoNombre('');
      await recargar();
    } catch {
      setMensaje('No se pudo actualizar el grupo. Probá nuevamente.');
    } finally {
      setOcupado(false);
    }
  };

  const crearGrupo = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!nombre.trim()) return;
    void gestionar({ nombre: nombre.trim() });
  };

  const handleAdminAsignar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!adminAlumno) return setMensaje('Elegí un alumno de esta materia.');
    if (adminModo === 'existente' && !adminGrupoId) return setMensaje('Elegí un grupo.');
    if (adminModo === 'nuevo' && !adminNuevoNombre.trim()) return setMensaje('Poné el nombre del grupo.');
    if (adminModo === 'existente') await gestionar({ grupoId: adminGrupoId, alumnoNombre: adminAlumno });
    else await gestionar({ nombre: adminNuevoNombre.trim(), alumnoNombre: adminAlumno });
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#101720] p-4 sm:p-5 space-y-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Trabajo grupal</p>
          <h4 className="mt-1 text-base font-bold text-white">
            {modo === 'grupal_obligatorio' ? 'Solo se entrega en grupo' : 'Grupal o individual'}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {modo === 'grupal_obligatorio'
              ? 'Tenés que crear un grupo o unirte a uno para marcar la entrega. Entrega y nota se comparten entre integrantes.'
              : 'Podés entregar solo o en grupo. En grupo, entrega y nota se comparten.'}
            {' '}Solo aparecen alumnos que cursan {materiaNombre}.
            {cupo > 0 ? ` Cada grupo puede tener hasta ${cupo} personas.` : ' No hay límite de integrantes.'}
          </p>
        </div>
        {esAdmin && (
          <button
            type="button"
            onClick={() => setMostrarAdmin((abierto) => !abierto)}
            className="self-start rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 cursor-pointer"
          >
            {mostrarAdmin ? 'Cerrar asignación' : 'Asignar alumnos'}
          </button>
        )}
      </div>

      {puedeGestionar && !propio && modo === 'grupal_opcional' && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-[#0c121a] p-4">
          <input
            type="checkbox"
            className="mt-1"
            checked={entregaIndividualActiva}
            disabled={ocupado}
            onChange={(evento) => void gestionar({ entregaIndividual: evento.target.checked })}
          />
          <span>
            <span className="block text-sm font-bold text-white">La hago individual</span>
            <span className="mt-1 block text-xs text-slate-400">
              Marcá esto si vas a entregar por tu cuenta, sin armar grupo. Podés desmarcarlo y unirte a uno después.
            </span>
          </span>
        </label>
      )}

      {propio ? (
        <div className="space-y-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tu grupo</p>
              <p className="mt-1 text-lg font-black text-white">{propio.nombre}</p>
              <p className="text-xs text-cyan-200">{plazas(propio)}</p>
            </div>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => gestionar({ salir: true })}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-40"
            >
              Salir del grupo
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {propio.integrantes?.map((integrante) => (
              <span key={integrante} className="inline-flex items-center gap-1">
                <FichaPersona nombre={integrante} propio={integrante.toLowerCase() === usuarioActual?.toLowerCase()} />
                {esAdmin && (
                  <button
                    type="button"
                    aria-label={`Quitar a ${integrante}`}
                    disabled={ocupado}
                    onClick={() => gestionar({ salir: true, alumnoNombre: integrante })}
                    className="text-xs text-red-300 cursor-pointer disabled:opacity-40"
                  >
                    Quitar
                  </button>
                )}
              </span>
            ))}
          </div>
          {libresParaVer.length > 0 && puedeGestionar && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Invitar a tu grupo</p>
              <ul className="space-y-1.5">
                {libresParaVer.map((alumno) => (
                  <li key={alumno} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 px-2 py-1.5">
                    <FichaPersona nombre={alumno} />
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void invitar(alumno)}
                      className="shrink-0 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-bold text-cyan-100 cursor-pointer disabled:opacity-40"
                    >
                      Invitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : puedeGestionar ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <form onSubmit={crearGrupo} className="rounded-xl border border-slate-800 bg-[#0c121a] p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-white">Crear un grupo</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Elegí un nombre. Quedás adentro y tus compañeros de {materiaNombre} se pueden sumar.
              </p>
            </div>
            <label className="block text-xs font-medium text-slate-300" htmlFor={`grupo-${tarea.id}`}>
              Nombre del grupo
            </label>
            <input
              id={`grupo-${tarea.id}`}
              maxLength={100}
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder={usuarioActual ? `Grupo de ${usuarioActual}` : 'Nombre del grupo'}
              disabled={ocupado}
              className="w-full rounded-xl border border-slate-700 bg-[#0c1017] px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={ocupado || !nombre.trim()}
              className="w-full rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 cursor-pointer disabled:opacity-40"
            >
              {ocupado ? 'Guardando…' : 'Crear y entrar'}
            </button>
          </form>

          <div className="rounded-xl border border-slate-800 bg-[#0c121a] p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-white">Unirme a un grupo</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {grupos.length > 0 ? 'Estos grupos ya están armados en esta tarea.' : 'Cuando alguien cree un grupo, aparece acá para que te unas.'}
              </p>
            </div>
            {grupos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-500">
                Todavía no hay grupos. El primero lo podés crear vos.
              </p>
            ) : (
              <ul className="space-y-2">
                {grupos.map((grupo) => {
                  const ocupadas = grupo.integrantes?.length || 0;
                  const lleno = cupo > 0 && ocupadas >= cupo;
                  const avance = cupo > 0 ? Math.min(100, Math.round((ocupadas / cupo) * 100)) : 0;
                  return (
                    <li key={grupo.id} className="rounded-xl border border-slate-800 bg-[#101720] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-100">{grupo.nombre}</p>
                          <p className="text-xs text-slate-400">{lleno ? 'Sin lugares' : plazas(grupo)}</p>
                        </div>
                        <button
                          type="button"
                          disabled={ocupado || lleno}
                          onClick={() => grupo.id && gestionar({ grupoId: grupo.id })}
                          className="shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 cursor-pointer disabled:opacity-40"
                        >
                          {lleno ? 'Completo' : 'Unirme'}
                        </button>
                      </div>
                      {cupo > 0 && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                          <div className={`h-full ${lleno ? 'bg-amber-400' : 'bg-cyan-400'}`} style={{ width: `${avance}%` }} />
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        {grupo.integrantes?.length ? grupo.integrantes.join(', ') : 'Sin integrantes'}
                      </p>
                      {esAdmin && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => grupo.id && confirm(`¿Eliminar el grupo "${grupo.nombre}"?`) && gestionar({ eliminarGrupoId: grupo.id })}
                          className="mt-2 text-xs text-red-300 cursor-pointer disabled:opacity-40"
                        >
                          Eliminar grupo
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 rounded-lg border border-dashed border-slate-700 px-3 py-3">
          {sujeto ? `${sujeto} todavía no tiene grupo en esta tarea.` : 'Seleccioná un alumno para gestionar grupos.'}
        </p>
      )}

      {!propio && libres.length > 0 && (
        <div className="rounded-xl border border-slate-800 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Cursan {materiaNombre} y todavía no tienen grupo
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {libres.map((alumno) => (
              <FichaPersona key={alumno} nombre={alumno} propio={alumno.toLowerCase() === usuarioActual?.toLowerCase()} />
            ))}
          </div>
        </div>
      )}

      {propio && grupos.some((grupo) => grupo.id !== propio.id) && (
        <div>
          <button
            type="button"
            onClick={() => setVerOtros((abierto) => !abierto)}
            className="text-xs font-semibold text-slate-300 cursor-pointer"
          >
            {verOtros ? 'Ocultar los otros grupos' : `Ver los otros ${grupos.length - 1} grupos`}
          </button>
          {verOtros && (
            <ul className="mt-2 space-y-2">
              {grupos.filter((grupo) => grupo.id !== propio.id).map((grupo) => (
                <li key={grupo.id} className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300">
                  <span className="font-semibold text-slate-100">{grupo.nombre}</span>
                  <span className="text-slate-500"> · {plazas(grupo)}</span>
                  <p className="mt-1">{grupo.integrantes?.join(', ') || 'Sin integrantes'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {esAdmin && mostrarAdmin && (
        <form onSubmit={handleAdminAsignar} className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-bold text-amber-100">Asignar a alguien de esta materia</p>
          <label className="block text-xs text-slate-300">
            Alumno
            <select
              value={adminAlumno}
              onChange={(evento) => setAdminAlumno(evento.target.value)}
              disabled={ocupado}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0f141c] p-2 text-sm text-white"
            >
              <option value="">Elegir alumno</option>
              {alumnos.map((alumno) => {
                const grupo = grupos.find((item) => item.integrantes?.some((integrante) => integrante.toLowerCase() === alumno.toLowerCase()));
                return (
                  <option key={alumno} value={alumno}>
                    {alumno} {grupo ? `· ${grupo.nombre}` : '· sin grupo'}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="flex gap-4 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`modo-${tarea.id}`} checked={adminModo === 'existente'} onChange={() => setAdminModo('existente')} />
              Grupo existente
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`modo-${tarea.id}`} checked={adminModo === 'nuevo'} onChange={() => setAdminModo('nuevo')} />
              Grupo nuevo
            </label>
          </div>
          {adminModo === 'existente' ? (
            <select
              value={adminGrupoId}
              onChange={(evento) => setAdminGrupoId(evento.target.value)}
              disabled={ocupado || grupos.length === 0}
              className="w-full rounded-lg border border-slate-700 bg-[#0f141c] p-2 text-sm text-white"
            >
              <option value="">Elegir grupo</option>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>{grupo.nombre} ({plazas(grupo)})</option>
              ))}
            </select>
          ) : (
            <input
              maxLength={100}
              value={adminNuevoNombre}
              onChange={(evento) => setAdminNuevoNombre(evento.target.value)}
              placeholder="Nombre del grupo"
              disabled={ocupado}
              className="w-full rounded-lg border border-slate-700 bg-[#0f141c] p-2 text-sm text-white"
            />
          )}
          <button
            type="submit"
            disabled={ocupado || !adminAlumno}
            className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 cursor-pointer disabled:opacity-40"
          >
            Guardar asignación
          </button>
        </form>
      )}

      {mensaje && (
        <p
          role="alert"
          className={`rounded-lg border px-3 py-2 text-xs ${
            /invitación/i.test(mensaje)
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {mensaje}
        </p>
      )}
    </section>
  );
}

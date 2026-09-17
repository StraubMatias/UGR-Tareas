import { useState } from 'react';
import { gestionarGrupoTareaAction } from '../app/actions';
import { tareaCompletadaPor } from '../lib/cursada';

export default function GrupoTarea({ tarea, usuarioActual, recargar }) {
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const grupos = tarea.grupos || [];
  const cupo = tarea.cupo_maximo || 0;
  const plazas = (g) => {
    const actuales = g.integrantes.length;
    return cupo === 0 ? 'Sin límite' : `${actuales}/${cupo}`;
  };
  const propio = grupos.find((g) => g.integrantes.includes(usuarioActual));
  const bloqueado = (g) => g.integrantes.some((a) => tareaCompletadaPor(tarea, a));
  const progresoPropio = tareaCompletadaPor(tarea, usuarioActual);
  const gestionar = async (datos) => {
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
      await recargar();
    } catch {
      setMensaje('No se pudo actualizar el grupo. Probá nuevamente.');
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3 text-sm">
      <h4 className="font-bold text-cyan-300">👥 Trabajo grupal{propio ? ` · ${propio.nombre}` : ''}</h4>
      <p className="text-xs text-slate-400">La nota y la entrega se comparten con todos los integrantes de este grupo, solo en este trabajo. Corregir o borrar la nota también afecta a todos.</p>
      <p className="text-xs text-slate-400">Formen el grupo antes de cargar entrega o nota. No se pueden cambiar integrantes mientras haya una entrega o nota registrada.</p>
      {propio ? (
        <div className="space-y-2">
          <p className="text-slate-200">Integrantes: {propio.integrantes.join(', ')}</p>
          <button type="button" disabled={ocupado || bloqueado(propio)} onClick={() => gestionar({ salir: true })} className="text-amber-300 border border-amber-500/30 rounded-lg px-3 py-1 disabled:opacity-40">Salir del grupo</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-cyan-200">Creá un grupo o unite a uno para cargar la entrega y la nota.</p>
          {grupos.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-col">
                <span>{g.nombre}: {g.integrantes.join(', ')}{bloqueado(g) ? ' · Cerrado por entrega/nota' : ''}</span>
                <span className="text-[10px] text-slate-400">Plazas: {plazas(g)}</span>
              </span>
              <button
                type="button"
                disabled={ocupado || progresoPropio || bloqueado(g) || (cupo > 0 && g.integrantes.length >= cupo)}
                onClick={() => gestionar({ grupoId: g.id })}
                className="text-cyan-300 border border-cyan-500/30 rounded-lg px-3 py-1 disabled:opacity-40"
              >
                {cupo > 0 && g.integrantes.length >= cupo ? 'Lleno' : 'Unirme'}
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <input aria-label="Nombre del nuevo grupo" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del grupo" disabled={ocupado || progresoPropio} className="bg-[#0f141c] border border-slate-700 rounded-lg p-2 min-w-0" />
            <button type="button" disabled={ocupado || progresoPropio || !nombre.trim()} onClick={() => gestionar({ nombre })} className="text-cyan-300 border border-cyan-500/30 rounded-lg px-3 py-1 disabled:opacity-40">Crear y unirme</button>
          </div>
        </div>
      )}
      {mensaje && <p role="alert" className="text-red-300">{mensaje}</p>}
    </section>
  );
}

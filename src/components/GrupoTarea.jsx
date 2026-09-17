import { useState } from 'react';
import { gestionarGrupoTareaAction } from '../app/actions';

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
      <p className="text-xs text-slate-400">
        La nota y la entrega se comparten con todos los integrantes de este grupo. Si vos o alguien del grupo ya tiene entrega o nota registrada, se sincronizará automáticamente para los demás integrantes al unirse.
      </p>
      {propio ? (
        <div className="space-y-2">
          <p className="text-slate-200">Integrantes: {propio.integrantes.join(', ')}</p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => gestionar({ salir: true })}
            className="text-amber-300 border border-amber-500/30 rounded-lg px-3 py-1 disabled:opacity-40 hover:bg-amber-500/10 cursor-pointer text-xs"
          >
            Salir del grupo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-cyan-200">Creá un grupo o unite a uno existente:</p>
          {grupos.map((g) => {
            const lleno = cupo > 0 && g.integrantes.length >= cupo;
            return (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 bg-[#0f141c]/60 p-2.5 rounded-lg border border-slate-800">
                <span className="flex flex-col">
                  <span className="font-medium text-slate-200">{g.nombre}: {g.integrantes.join(', ')}</span>
                  <span className="text-[10px] text-slate-400">Plazas: {plazas(g)}</span>
                </span>
                <button
                  type="button"
                  disabled={ocupado || lleno}
                  onClick={() => gestionar({ grupoId: g.id })}
                  className="text-cyan-300 border border-cyan-500/30 rounded-lg px-3 py-1 disabled:opacity-40 hover:bg-cyan-500/10 cursor-pointer text-xs"
                >
                  {lleno ? 'Lleno' : 'Unirme'}
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            <input
              aria-label="Nombre del nuevo grupo"
              maxLength={100}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del nuevo grupo"
              disabled={ocupado}
              className="bg-[#0f141c] border border-slate-700 rounded-lg p-2 min-w-0 flex-1 text-white text-xs focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              disabled={ocupado || !nombre.trim()}
              onClick={() => gestionar({ nombre })}
              className="text-cyan-300 border border-cyan-500/30 rounded-lg px-3 py-1 disabled:opacity-40 hover:bg-cyan-500/10 cursor-pointer text-xs font-semibold"
            >
              Crear y unirme
            </button>
          </div>
        </div>
      )}
      {mensaje && <p role="alert" className="text-red-300 text-xs font-medium">{mensaje}</p>}
    </section>
  );
}

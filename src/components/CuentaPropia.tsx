'use client';

import { useState, type FormEvent } from 'react';
import { sincronizarCuentaUgrAction, type ResumenMateriaSync } from '../app/actions';

export function ResumenCursada({ resumen }: { resumen: ResumenMateriaSync[] }) {
  if (resumen.length === 0) return null;
  const totalNuevas = resumen.reduce((total, fila) => total + fila.nuevas.length, 0);
  const notasCargadas = resumen.flatMap((fila) => (fila.notasCargadas || []).map((linea) => ({ materia: fila.materia, linea })));
  const pendientesEntrega = resumen.flatMap((fila) => fila.pendientesEntrega || []);
  const notasNoLeidas = resumen.flatMap((fila) => fila.notasNoLeidas || []);
  return (
    <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto">
      {notasCargadas.length > 0 && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Notas cargadas</p>
          <ul className="mt-2 space-y-1 text-sm text-white">
            {notasCargadas.map((item) => (
              <li key={`${item.materia}-${item.linea}`}>Se cargó {item.linea}</li>
            ))}
          </ul>
        </div>
      )}
      {pendientesEntrega.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Falta entregar en la página</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100">
            {pendientesEntrega.map((nombre) => (
              <li key={nombre}>Entregá «{nombre}» para cargarle la nota.</li>
            ))}
          </ul>
        </div>
      )}
      {notasNoLeidas.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Sin nota en la actividad</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100">
            {notasNoLeidas.map((nombre) => (
              <li key={nombre}>{nombre}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Estás inscripto a</p>
        <p className="mt-1 text-sm font-bold text-white">
          {resumen.length} {resumen.length === 1 ? 'materia' : 'materias'}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-200">
          {resumen.map((materia) => (
            <li key={`insc-${materia.materia}`}>
              {materia.materia}
              {materia.materiaNueva ? (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">nueva en la página</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          {totalNuevas > 0
            ? `Se cargaron ${totalNuevas} tarea(s) que no estaban.`
            : 'No había tareas nuevas: ya estaban cargadas.'}
        </p>
      </div>
      {resumen.map((materia) => (
        <div key={materia.materia} className="rounded-xl border border-slate-800 bg-[#0d1117] p-3">
          <p className="text-sm font-bold text-white">{materia.materia}</p>
          {materia.nuevas.length > 0 ? (
            <div className="mt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">No estaban cargadas</p>
              <ul className="mt-1 space-y-0.5 text-sm text-slate-200">
                {materia.nuevas.map((nombre) => (
                  <li key={nombre}>+ {nombre}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No había tareas nuevas en esta materia.</p>
          )}
          {materia.yaEstaban.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ya estaban, no se duplicaron</p>
              <ul className="mt-1 space-y-0.5 text-sm text-slate-400">
                {materia.yaEstaban.map((nombre) => (
                  <li key={nombre}>· {nombre}</li>
                ))}
              </ul>
            </div>
          )}
          {(materia.cronogramaNuevo?.length || 0) > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Cronograma que no estaba</p>
              <ul className="mt-1 space-y-0.5 text-sm text-slate-200">
                {materia.cronogramaNuevo?.map((nombre) => (
                  <li key={nombre}>+ {nombre}</li>
                ))}
              </ul>
            </div>
          )}
          {(materia.cronogramaYa?.length || 0) > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cronograma ya cargado</p>
              <ul className="mt-1 space-y-0.5 text-sm text-slate-400">
                {materia.cronogramaYa?.map((nombre) => (
                  <li key={nombre}>· {nombre}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CuentaPropia({
  usuario,
  onSincronizada,
  onCerrar,
  onInterrumpida
}: {
  usuario: string;
  onSincronizada?: (mensaje: string, resumen?: ResumenMateriaSync[]) => void;
  onCerrar?: () => void;
  onInterrumpida?: () => void;
}) {
  const [dni, setDni] = useState('');
  const [ugrPassword, setUgrPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<ResumenMateriaSync[]>([]);
  const [enviando, setEnviando] = useState(false);

  const sincronizar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensaje('');
    setError('');
    setResumen([]);
    setEnviando(true);
    const dniIngresado = dni;
    const claveIngresada = ugrPassword;
    setUgrPassword('');
    try {
      const resultado = await sincronizarCuentaUgrAction(dniIngresado, claveIngresada);
      setDni('');
      if (!resultado.exito) {
        setError(resultado.mensaje || 'No se pudo sincronizar.');
        return;
      }
      const aviso = resultado.mensaje || 'Cursada actualizada.';
      setMensaje(aviso);
      setResumen(resultado.resumen || []);
      onSincronizada?.(aviso, resultado.resumen);
    } catch (error) {
      const crudo = error instanceof Error ? error.message : '';
      if (/unexpected response/i.test(crudo)) {
        setError('Se cortó la respuesta, pero lo que alcanzó a guardarse ya quedó. Sincronizá de nuevo para completar.');
        onInterrumpida?.();
      } else {
        setError('No se pudo sincronizar.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="w-full max-w-xl mx-auto rounded-2xl border border-slate-800 bg-[#121821] p-6 sm:p-8">
      <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Sincronizar con UGR Virtual</p>
      <h2 className="mt-2 text-2xl font-black text-white">{usuario}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Pedimos el DNI y la clave de UGR Virtual solo para esta sincronización. No se guardan. Te dice a qué materias estás inscripto, las guarda en tu cursada y después carga únicamente las tareas que todavía no estaban.
      </p>

      <form onSubmit={sincronizar} className="mt-6 space-y-4" autoComplete="off">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="ugr-dni">DNI de UGR Virtual</label>
          <input
            id="ugr-dni"
            value={dni}
            onChange={(evento) => setDni(evento.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-800 bg-[#0d1117] p-3.5 text-base text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="ugr-clave">Contraseña de UGR Virtual</label>
          <input
            id="ugr-clave"
            type="password"
            value={ugrPassword}
            onChange={(evento) => setUgrPassword(evento.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-800 bg-[#0d1117] p-3.5 text-base text-white"
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 cursor-pointer disabled:opacity-50"
        >
          {enviando ? 'Sincronizando…' : 'Sincronizar mi cursada'}
        </button>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className="w-full text-xs font-semibold text-slate-400 cursor-pointer disabled:opacity-50"
          >
            {resumen.length > 0 ? 'Cerrar' : 'Cancelar'}
          </button>
        )}
      </form>

      {mensaje && <p className="mt-4 text-sm text-emerald-300">{mensaje}</p>}
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      <ResumenCursada resumen={resumen} />
    </section>
  );
}

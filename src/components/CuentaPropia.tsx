'use client';

import { useState, type FormEvent } from 'react';
import { sincronizarCuentaUgrAction, sincronizarCuentaSiuAction, type ResumenMateriaSync } from '../app/actions';
import DetalleSyncSiu from './portal/DetalleSyncSiu';
import type { NotaPlanSiu } from '../lib/importar-plan-siu';

export function ResumenCursada({ resumen }: { resumen: ResumenMateriaSync[] }) {
  if (resumen.length === 0) return null;
  const totalNuevas = resumen.reduce((total, fila) => total + fila.nuevas.length, 0);
  const notasCargadas = resumen.flatMap((fila) => (fila.notasCargadas || []).map((linea) => ({ materia: fila.materia, linea })));
  const pendientesEntrega = resumen.flatMap((fila) => fila.pendientesEntrega || []);
  const notasNoLeidas = resumen.flatMap((fila) => fila.notasNoLeidas || []);
  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
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

type FuenteSync = 'ugr' | 'siu';
type FaseSync = 'credenciales' | 'cargando' | 'listo' | 'error';

function SyncCargando({ fuente }: { fuente: FuenteSync }) {
  return (
    <div className="text-center py-10">
      <span className="text-3xl animate-spin inline-block" aria-hidden="true">⏳</span>
      <p className="mt-3 text-sm font-semibold text-slate-200">
        {fuente === 'siu' ? 'Estamos sincronizando con SIU Guaraní…' : 'Estamos sincronizando con UGR Virtual…'}
      </p>
      <p className="mt-2 text-xs text-slate-400">No cierres esta ventana hasta que termine.</p>
    </div>
  );
}

export default function CuentaPropia({
  usuario,
  fuenteInicial = 'ugr',
  variante = 'pagina',
  permitirCambiarFuente = true,
  onCompletado,
  onCerrar,
  onInterrumpida
}: {
  usuario: string;
  fuenteInicial?: FuenteSync;
  variante?: 'modal' | 'pagina';
  permitirCambiarFuente?: boolean;
  onCompletado?: () => void;
  onCerrar?: () => void;
  onInterrumpida?: () => void;
}) {
  const [fuente, setFuente] = useState<FuenteSync>(fuenteInicial);
  const [fase, setFase] = useState<FaseSync>('credenciales');
  const [dni, setDni] = useState('');
  const [clave, setClave] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<ResumenMateriaSync[]>([]);
  const [detalleSiu, setDetalleSiu] = useState<{
    mensaje: string;
    enCurso: number;
    notasCargadas: NotaPlanSiu[];
    notasYaCargadas: NotaPlanSiu[];
  } | null>(null);

  const reiniciarCredenciales = () => {
    setFase('credenciales');
    setError('');
    setMensaje('');
    setResumen([]);
    setDetalleSiu(null);
    setDni('');
    setClave('');
  };

  const cambiarFuente = (nueva: FuenteSync) => {
    if (fase === 'cargando') return;
    setFuente(nueva);
    reiniciarCredenciales();
  };

  const sincronizar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const usuarioIngresado = dni.trim();
    const claveIngresada = clave;
    if (!usuarioIngresado || !claveIngresada) {
      setError(fuente === 'ugr' ? 'Completá el DNI y la contraseña de UGR Virtual.' : 'Completá usuario y contraseña de SIU Guaraní.');
      return;
    }
    setMensaje('');
    setError('');
    setResumen([]);
    setDetalleSiu(null);
    setDni('');
    setClave('');
    setFase('cargando');
    try {
      if (fuente === 'ugr') {
        const resultado = await sincronizarCuentaUgrAction(usuarioIngresado, claveIngresada);
        if (!resultado.exito) {
          setError(resultado.mensaje || 'No se pudo sincronizar.');
          setFase('error');
          return;
        }
        const aviso = resultado.mensaje || 'Cursada actualizada.';
        setMensaje(aviso);
        setResumen(resultado.resumen || []);
        setFase('listo');
        onCompletado?.();
      } else {
        const resultado = await sincronizarCuentaSiuAction(usuarioIngresado, claveIngresada);
        if (!resultado.exito) {
          setError(resultado.mensaje || 'No se pudo sincronizar.');
          setFase('error');
          return;
        }
        const aviso = resultado.mensaje || 'Plan de estudio actualizado.';
        setMensaje(aviso);
        setDetalleSiu({
          mensaje: aviso,
          enCurso: resultado.enCurso || 0,
          notasCargadas: resultado.notasCargadas || [],
          notasYaCargadas: resultado.notasYaCargadas || []
        });
        setFase('listo');
        onCompletado?.();
      }
    } catch (err) {
      const crudo = err instanceof Error ? err.message : '';
      if (/unexpected response/i.test(crudo)) {
        setError('Se cortó la respuesta, pero lo que alcanzó a guardarse ya quedó. Podés sincronizar de nuevo para completar.');
        onInterrumpida?.();
      } else {
        setError('No se pudo sincronizar.');
      }
      setFase('error');
    }
  };

  const contenedor =
    variante === 'pagina'
      ? 'w-full max-w-xl mx-auto rounded-2xl border border-slate-800 bg-[#121821] p-6 sm:p-8'
      : 'w-full';

  const titulo =
    fuente === 'siu' ? '🎓 Sincronizar SIU Guaraní' : '🔄 Sincronizar con UGR Virtual';

  return (
    <section className={contenedor}>
      {variante === 'modal' && onCerrar && (
        <div className="flex justify-end mb-2">
          <button type="button" onClick={onCerrar} className="text-xs text-slate-300 hover:text-white cursor-pointer">
            Cerrar
          </button>
        </div>
      )}

      {fase === 'credenciales' && (
        <>
          <h3 className="text-base font-bold text-white mb-1">{titulo}</h3>
          <p className="text-xs text-slate-400 mb-1">{usuario}</p>
          <p className="text-xs text-slate-400 mb-4">
            {fuente === 'ugr'
              ? 'DNI y clave de UGR Virtual solo para esta sincronización. Carga tu cursada y las tareas que falten en el tablero.'
              : 'Usuario y clave de SIU Guaraní solo para esta sincronización. Importa las notas finales del plan a la pestaña Plan.'}
          </p>

          {permitirCambiarFuente && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => cambiarFuente('ugr')}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${
                  fuente === 'ugr'
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                    : 'border-slate-800 bg-[#0d1117] text-slate-400'
                }`}
              >
                UGR Virtual
              </button>
              <button
                type="button"
                onClick={() => cambiarFuente('siu')}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${
                  fuente === 'siu'
                    ? 'border-blue-500/50 bg-blue-500/15 text-blue-100'
                    : 'border-slate-800 bg-[#0d1117] text-slate-400'
                }`}
              >
                SIU Guaraní
              </button>
            </div>
          )}

          <form onSubmit={sincronizar} className="space-y-4" autoComplete="off">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="sync-usuario">
                {fuente === 'ugr' ? 'DNI de UGR Virtual' : 'Usuario de SIU Guaraní'}
              </label>
              <input
                id="sync-usuario"
                value={dni}
                onChange={(evento) => setDni(evento.target.value)}
                inputMode={fuente === 'ugr' ? 'numeric' : 'text'}
                autoComplete="off"
                className="w-full rounded-xl border border-slate-800 bg-[#0d1117] p-3.5 text-base text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="sync-clave">Contraseña</label>
              <input
                id="sync-clave"
                type="password"
                value={clave}
                onChange={(evento) => setClave(evento.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-800 bg-[#0d1117] p-3.5 text-base text-white"
              />
            </div>
            <button
              type="submit"
              className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-slate-950 cursor-pointer ${
                fuente === 'siu' ? 'bg-blue-400 hover:bg-blue-300' : 'bg-cyan-500 hover:bg-cyan-400'
              }`}
            >
              {fuente === 'siu' ? 'Importar plan SIU' : 'Sincronizar mi cursada'}
            </button>
            {onCerrar && (
              <button
                type="button"
                onClick={onCerrar}
                className="w-full text-xs font-semibold text-slate-400 cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </form>
        </>
      )}

      {fase === 'cargando' && <SyncCargando fuente={fuente} />}

      {fase === 'error' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">{titulo}</h3>
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={reiniciarCredenciales}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
            >
              Volver a intentar
            </button>
            {onCerrar && (
              <button
                type="button"
                onClick={onCerrar}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {fase === 'listo' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">{titulo}</h3>
          {fuente === 'ugr' ? (
            <>
              {mensaje && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-1">Resultado</p>
                  <p>{mensaje}</p>
                </div>
              )}
              <ResumenCursada resumen={resumen} />
            </>
          ) : (
            detalleSiu && <DetalleSyncSiu {...detalleSiu} />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={reiniciarCredenciales}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
            >
              Sincronizar de nuevo
            </button>
            {onCerrar && (
              <button
                type="button"
                onClick={onCerrar}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                Listo
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useProgresoSyncEstimado } from '../hooks/useProgresoSyncEstimado';
import { sincronizarCuentaUgrAction, sincronizarCuentaSiuAction, type MateriaInscriptaSync, type ResumenMateriaSync } from '../app/actions';
import dynamic from 'next/dynamic';

const DetalleSyncSiu = dynamic(() => import('./portal/DetalleSyncSiu'));
import type { NotaPlanSiu } from '../lib/importar-plan-siu';

function filaTieneCambios(fila: ResumenMateriaSync): boolean {
  return (
    fila.nuevas.length > 0
    || (fila.fechasActualizadas?.length ?? 0) > 0
    || (fila.cronogramaNuevo?.length ?? 0) > 0
    || (fila.parcialesNuevos?.length ?? 0) > 0
    || (fila.notasCargadas?.length ?? 0) > 0
    || (fila.pendientesEntrega?.length ?? 0) > 0
    || (fila.notasNoLeidas?.length ?? 0) > 0
  );
}

export function ResumenCursada({
  resumen,
  materiasInscriptas = []
}: {
  resumen: ResumenMateriaSync[];
  materiasInscriptas?: MateriaInscriptaSync[];
}) {
  const filas = resumen.filter(filaTieneCambios);
  const hayCambios = filas.length > 0;

  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      {!hayCambios && (
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-200">Nada nuevo que cargar</p>
          <p className="mt-1 text-xs text-slate-500">Las tareas que ya tenías siguen igual en el tablero.</p>
        </div>
      )}

      {hayCambios && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300/90">Qué cambió</p>
      )}

      {filas.map((materia) => (
        <div key={materia.materia} className="rounded-xl border border-slate-800 bg-[#0d1117] p-3.5 space-y-3">
          <p className="text-sm font-bold text-white">{materia.materia}</p>

          {(materia.fechasActualizadas?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-300">Fechas actualizadas</p>
              <ul className="mt-1.5 space-y-1 text-sm text-violet-100/95">
                {materia.fechasActualizadas?.map((linea) => (
                  <li key={linea} className="flex gap-2">
                    <span className="text-violet-400 shrink-0">↻</span>
                    <span>{linea}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {materia.nuevas.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Tareas nuevas</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-slate-200">
                {materia.nuevas.map((nombre) => (
                  <li key={nombre} className="flex gap-2">
                    <span className="text-cyan-400 shrink-0">+</span>
                    <span>{nombre}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(materia.parcialesNuevos?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Parciales nuevos</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-slate-200">
                {materia.parcialesNuevos?.map((nombre) => (
                  <li key={nombre}>+ {nombre}</li>
                ))}
              </ul>
            </div>
          )}

          {(materia.cronogramaNuevo?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">Cronograma</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-slate-200">
                {materia.cronogramaNuevo?.map((nombre) => (
                  <li key={nombre}>+ {nombre}</li>
                ))}
              </ul>
            </div>
          )}

          {(materia.notasCargadas?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Notas</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-emerald-100">
                {materia.notasCargadas?.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            </div>
          )}

          {(materia.pendientesEntrega?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Falta entregar en UGR</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-amber-100">
                {materia.pendientesEntrega?.map((nombre) => (
                  <li key={nombre}>«{nombre}»</li>
                ))}
              </ul>
            </div>
          )}

          {(materia.notasNoLeidas?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Sin nota legible</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-amber-100">
                {materia.notasNoLeidas?.map((nombre) => (
                  <li key={nombre}>{nombre}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {materiasInscriptas.length > 0 && (
        <details className="rounded-xl border border-slate-800/80 bg-[#0a0e14] px-3 py-2 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-400 hover:text-slate-300">
            Materias consultadas ({materiasInscriptas.length})
          </summary>
          <ul className="mt-2 space-y-0.5 text-slate-400">
            {materiasInscriptas.map((item) => (
              <li key={item.materia}>
                {item.materia}
                {item.materiaNueva ? (
                  <span className="ml-1.5 text-[10px] font-bold uppercase text-cyan-500/80">nueva</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type FuenteSync = 'ugr' | 'siu';
type FaseSync = 'credenciales' | 'cargando' | 'listo' | 'error';

function SyncCargando({
  fuente,
  progreso,
  etapa
}: {
  fuente: FuenteSync;
  progreso: number;
  etapa: string;
}) {
  const titulo = fuente === 'siu' ? 'Sincronizando con SIU Guaraní' : 'Sincronizando con UGR Virtual';
  const barra = fuente === 'siu' ? 'from-blue-500 to-cyan-400' : 'from-cyan-500 to-emerald-400';

  return (
    <div className="py-8 px-1">
      <p className="text-sm font-semibold text-slate-200 text-center">{titulo}</p>
      <p className="mt-1 text-xs text-slate-400 text-center min-h-[1.25rem]">{etapa || 'Iniciando…'}</p>

      <div
        className="mt-6 w-full h-2.5 rounded-full bg-slate-800/90 border border-slate-700/80 overflow-hidden"
        role="progressbar"
        aria-valuenow={progreso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={titulo}
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barra} transition-[width] duration-500 ease-out`}
          style={{ width: `${progreso}%` }}
        />
      </div>

      <p className="mt-2 text-center text-xs font-semibold tabular-nums text-slate-400">{progreso}%</p>
      <p className="mt-4 text-center text-xs text-slate-500">No cierres esta ventana hasta que termine.</p>
    </div>
  );
}

export default function CuentaPropia({
  usuario,
  fuenteInicial = 'ugr',
  variante = 'pagina',
  permitirCambiarFuente = true,
  usarCredencialesServidor = false,
  onCompletado,
  onCerrar,
  onInterrumpida
}: {
  usuario: string;
  fuenteInicial?: FuenteSync;
  variante?: 'modal' | 'pagina';
  permitirCambiarFuente?: boolean;
  usarCredencialesServidor?: boolean;
  onCompletado?: () => void;
  onCerrar?: () => void;
  onInterrumpida?: () => void;
}) {
  const [fuente, setFuente] = useState<FuenteSync>(fuenteInicial);
  const [fase, setFase] = useState<FaseSync>(usarCredencialesServidor ? 'cargando' : 'credenciales');
  const [dni, setDni] = useState('');
  const [clave, setClave] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<ResumenMateriaSync[]>([]);
  const [materiasInscriptas, setMateriasInscriptas] = useState<MateriaInscriptaSync[]>([]);
  const [detalleSiu, setDetalleSiu] = useState<{
    mensaje: string;
    enCurso: number;
    notasCargadas: NotaPlanSiu[];
    notasYaCargadas: NotaPlanSiu[];
  } | null>(null);

  const { progreso, etapa, marcarCompletado } = useProgresoSyncEstimado(fase === 'cargando', fuente);

  const reiniciarCredenciales = () => {
    setError('');
    setMensaje('');
    setResumen([]);
    setMateriasInscriptas([]);
    setDetalleSiu(null);
    setDni('');
    setClave('');
    if (usarCredencialesServidor) {
      void ejecutarSync('', '');
      return;
    }
    setFase('credenciales');
  };

  const cambiarFuente = (nueva: FuenteSync) => {
    if (fase === 'cargando') return;
    setFuente(nueva);
    reiniciarCredenciales();
  };

  const ejecutarSync = async (usuarioIngresado: string, claveIngresada: string) => {
    setMensaje('');
    setError('');
    setResumen([]);
    setMateriasInscriptas([]);
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
        setMateriasInscriptas(resultado.materiasInscriptas || []);
        await marcarCompletado();
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
        await marcarCompletado();
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

  const syncServidorIniciado = useRef(false);
  useEffect(() => {
    if (!usarCredencialesServidor || syncServidorIniciado.current) return;
    syncServidorIniciado.current = true;
    void ejecutarSync('', '');
  }, [usarCredencialesServidor]);

  const sincronizar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const usuarioIngresado = dni.trim();
    const claveIngresada = clave;
    if (!usuarioIngresado || !claveIngresada) {
      setError(fuente === 'ugr' ? 'Completá el DNI y la contraseña de UGR Virtual.' : 'Completá usuario y contraseña de SIU Guaraní.');
      return;
    }
    await ejecutarSync(usuarioIngresado, claveIngresada);
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

      {fase === 'cargando' && <SyncCargando fuente={fuente} progreso={progreso} etapa={etapa} />}

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
              <ResumenCursada resumen={resumen} materiasInscriptas={materiasInscriptas} />
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

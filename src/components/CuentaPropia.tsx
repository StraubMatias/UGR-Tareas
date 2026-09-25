'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useProgresoSyncEstimado } from '../hooks/useProgresoSyncEstimado';
import { sincronizarCuentaUgrAction, sincronizarCuentaSiuAction, type MateriaInscriptaSync, type ResumenMateriaSync } from '../app/actions';
import { fusionarLineasInforme, fusionarResumenSync, mensajeDesdeInforme } from '../lib/informe-sync-ugr';
import { planPasadasSyncUgr } from '../lib/sync-ugr-orquestacion';
import type { OpcionesSincronizarUgr } from '../app/actions';
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

export function InformeSyncUgr({ lineas }: { lineas: string[] }) {
  if (lineas.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-5 text-center">
        <p className="text-sm font-medium text-slate-200">Nada nuevo que cargar</p>
        <p className="mt-1 text-xs text-slate-500">UGR Virtual no tenía tareas, fechas ni notas nuevas para vos.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Qué hizo la sincronización</p>
      <ul className="mt-3 space-y-2 text-sm text-emerald-50/95 list-none">
        {lineas.map((linea) => (
          <li key={linea} className="flex gap-2">
            <span className="text-emerald-400 shrink-0" aria-hidden="true">•</span>
            <span>{linea}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResumenCursada({
  resumen,
  materiasInscriptas = [],
  informeLineas = []
}: {
  resumen: ResumenMateriaSync[];
  materiasInscriptas?: MateriaInscriptaSync[];
  informeLineas?: string[];
}) {
  const filas = resumen.filter(filaTieneCambios);
  const hayCambios = filas.length > 0;

  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <InformeSyncUgr lineas={informeLineas} />

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
  const [informeLineas, setInformeLineas] = useState<string[]>([]);
  const [materiasInscriptas, setMateriasInscriptas] = useState<MateriaInscriptaSync[]>([]);
  const [detalleSiu, setDetalleSiu] = useState<{
    mensaje: string;
    enCurso: number;
    notasCargadas: NotaPlanSiu[];
    notasYaCargadas: NotaPlanSiu[];
  } | null>(null);
  const [avisoParcial, setAvisoParcial] = useState('');
  const [etapaManual, setEtapaManual] = useState('');

  const { progreso, etapa, marcarCompletado } = useProgresoSyncEstimado(fase === 'cargando', fuente);
  const etapaVisible = etapaManual || etapa;

  const reiniciarCredenciales = () => {
    setError('');
    setMensaje('');
    setResumen([]);
    setInformeLineas([]);
    setMateriasInscriptas([]);
    setDetalleSiu(null);
    setAvisoParcial('');
    setEtapaManual('');
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
    setInformeLineas([]);
    setMateriasInscriptas([]);
    setDetalleSiu(null);
    setAvisoParcial('');
    setEtapaManual('');
    setDni('');
    setClave('');
    setFase('cargando');
    try {
      if (fuente === 'ugr') {
        let lineasAcumuladas: string[] = [];
        let resumenAcumulado: ResumenMateriaSync[] = [];
        let materiasAcumuladas: MateriaInscriptaSync[] = [];

        const aplicarResultadoUgr = (resultado: {
          informeLineas?: string[];
          resumen?: ResumenMateriaSync[];
          materiasInscriptas?: MateriaInscriptaSync[];
        }) => {
          lineasAcumuladas = fusionarLineasInforme(lineasAcumuladas, resultado.informeLineas || []);
          resumenAcumulado = fusionarResumenSync(resumenAcumulado, resultado.resumen || []);
          if (resultado.materiasInscriptas?.length) materiasAcumuladas = resultado.materiasInscriptas;
          setInformeLineas(lineasAcumuladas);
          setResumen(resumenAcumulado.filter(filaTieneCambios));
          setMateriasInscriptas(materiasAcumuladas);
        };

        const llamarUgr = (opciones: OpcionesSincronizarUgr) => (
          sincronizarCuentaUgrAction(usuarioIngresado, claveIngresada, opciones)
        );

        const mensajeSiSeCorta = (err: unknown) => {
          const crudo = err instanceof Error ? err.message : '';
          return /unexpected response/i.test(crudo)
            ? 'Se cortó la conexión con el servidor (tiempo límite). '
            : '';
        };

        let huboTrabajo = false;
        setEtapaManual('Conectando con UGR Virtual y leyendo tu cursada…');
        let preparacion;
        try {
          preparacion = await llamarUgr({ fase: 'preparar' });
        } catch (err) {
          setError(`${mensajeSiSeCorta(err)}No se pudo iniciar la sincronización. Probá de nuevo.`.trim());
          setFase('error');
          return;
        }
        if (!preparacion.exito) {
          setError(preparacion.mensaje || 'No se pudo sincronizar.');
          setFase('error');
          return;
        }
        aplicarResultadoUgr(preparacion);

        const plan = planPasadasSyncUgr(preparacion.materiaIdsSync || []);
        const lotesMaterias = plan.lotesMaterias;

        for (let indice = 0; indice < lotesMaterias.length; indice += 1) {
          const lote = lotesMaterias[indice];
          setEtapaManual(
            lotesMaterias.length === 1
              ? 'Sincronizando tareas, fechas y notas…'
              : `Sincronizando materias (${indice + 1}/${lotesMaterias.length})…`
          );
          try {
            const resultadoLote = await llamarUgr({ fase: 'materias', materiaIds: lote });
            if (!resultadoLote.exito) {
              if (huboTrabajo) {
                setAvisoParcial('No se completaron todas las materias; lo ya procesado quedó guardado en el tablero.');
                onInterrumpida?.();
                break;
              }
              setError(resultadoLote.mensaje || 'No se pudo sincronizar.');
              setFase('error');
              return;
            }
            aplicarResultadoUgr(resultadoLote);
            huboTrabajo = true;
          } catch (err) {
            if (huboTrabajo) {
              setAvisoParcial(`${mensajeSiSeCorta(err)}Lo procesado hasta acá quedó guardado. Podés sincronizar de nuevo para el resto.`.trim());
              onInterrumpida?.();
              break;
            }
            setError(`${mensajeSiSeCorta(err)}No se pudo sincronizar.`.trim());
            setFase('error');
            return;
          }
        }

        const lotesAvisos = plan.lotesAvisos;
        for (let indice = 0; indice < lotesAvisos.length; indice += 1) {
          setEtapaManual(
            lotesAvisos.length === 1
              ? 'Revisando avisos del campus…'
              : `Avisos del campus (${indice + 1}/${lotesAvisos.length})…`
          );
          try {
            const resultadoAvisos = await llamarUgr({ fase: 'avisos', materiaIds: lotesAvisos[indice] });
            if (resultadoAvisos.exito) {
              aplicarResultadoUgr(resultadoAvisos);
            } else {
              setAvisoParcial('No pudimos terminar todos los foros de avisos; tareas, fechas y notas ya quedaron guardadas.');
              onInterrumpida?.();
              break;
            }
          } catch (err) {
            setAvisoParcial(
              `${mensajeSiSeCorta(err)}Se interrumpió la lectura de avisos; lo principal del tablero ya quedó actualizado.`.trim()
            );
            onInterrumpida?.();
            break;
          }
        }

        setEtapaManual('');
        const materiasSync = Math.max(materiasAcumuladas.length, 1);
        setMensaje(mensajeDesdeInforme(lineasAcumuladas, materiasSync));
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
    } catch {
      setError('No se pudo sincronizar.');
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

      {fase === 'cargando' && <SyncCargando fuente={fuente} progreso={progreso} etapa={etapaVisible} />}

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
              {avisoParcial && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {avisoParcial}
                </div>
              )}
              <ResumenCursada resumen={resumen} informeLineas={informeLineas} materiasInscriptas={materiasInscriptas} />
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

'use client';

import { useState } from 'react';
import {
  cargarDatosConstanciasSiuAction,
  cargarMesasExamenSiuAction,
  descargarComprobanteSiuAction,
  solicitarConstanciaSiuAction,
  type OpcionConstancia,
  type TipoConstanciaSiu
} from '../../app/actions/constancias';
import ModalOverlay, { ModalOverlayBody, ModalOverlayFooter, ModalOverlayHeader } from './ModalOverlay';
import {
  claveTipoDesdeNombreSiu,
  diasDeValidez,
  etiquetaVigencia,
  filtrarConstanciasVigentes,
  type SolicitudConstancia
} from '../../lib/constancias-vigentes';

interface ModalSolicitudesProps {
  onCerrar: () => void;
  /** El admin puede usar las credenciales de SIU del servidor, sin tipearlas. */
  esAdmin?: boolean;
}

/** Formulario externo para la constancia de examen parcial (se completa en Google). */
const FORMULARIO_EXAMEN_PARCIAL = 'https://forms.gle/6F2nbLbVT1gXR97SA';

const campoClase =
  'w-full rounded-lg border border-slate-700 bg-[#111722] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60';

const etiquetaClase = 'mb-1 block text-xs font-semibold text-slate-300';

type OpcionSolicitud = 'examen_parcial' | 'alumno_regular' | 'examen_final' | 'promedio_academico' | 'promedio_sin_aplazos';

const OPCIONES_SIU: Array<{ clave: OpcionSolicitud; titulo: string; detalle: string; icono: string }> = [
  {
    clave: 'alumno_regular',
    titulo: 'Constancia de alumno regular',
    detalle: 'Certifica que estás inscripto como alumno regular.',
    icono: '🎓'
  },
  {
    clave: 'examen_final',
    titulo: 'Constancia de examen final',
    detalle: 'Certifica el examen final de una mesa; elegís materia y turno.',
    icono: '🧾'
  },
  {
    clave: 'promedio_academico',
    titulo: 'Constancia de promedio académico',
    detalle: 'Certifica el promedio de tu carrera.',
    icono: '📊'
  },
  {
    clave: 'promedio_sin_aplazos',
    titulo: 'Constancia de promedio académico sin aplazos',
    detalle: 'Certifica el promedio de tu carrera sin contar aplazos.',
    icono: '📈'
  }
];

export default function ModalSolicitudes({ onCerrar, esAdmin = false }: ModalSolicitudesProps) {
  const [opcion, setOpcion] = useState<OpcionSolicitud | null>(null);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [conectado, setConectado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [usarServidor, setUsarServidor] = useState(esAdmin);

  const [tipos, setTipos] = useState<TipoConstanciaSiu[]>([]);
  const [anios, setAnios] = useState<OpcionConstancia[]>([]);
  const [turnos, setTurnos] = useState<OpcionConstancia[]>([]);
  const [actividades, setActividades] = useState<OpcionConstancia[]>([]);
  const [mesas, setMesas] = useState<OpcionConstancia[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudConstancia[]>([]);

  const [copias, setCopias] = useState(1);
  const [presentar, setPresentar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [anio, setAnio] = useState('');
  const [turno, setTurno] = useState('');
  const [actividad, setActividad] = useState('');
  const [mesa, setMesa] = useState('');

  const tipo = tipos.find((t) => t.clave === opcion);
  const necesitaFiltro = opcion === 'examen_final';
  const esFormularioExterno = opcion === 'examen_parcial';
  const vigentes = filtrarConstanciasVigentes(solicitudes);
  const vencidas = solicitudes.filter((s) => !filtrarConstanciasVigentes([s]).length);

  /** Al pedir una constancia de un tipo que ya tiene, se precarga ese tipo. */
  const solicitarTipo = (clave: string) => {
    setOpcion(clave as OpcionSolicitud);
    setMensaje(null);
  };

  /** Conectar a SIU: hace falta para ver las vigentes y para registrar la solicitud. */
  const conectar = async () => {
    setCargando(true);
    setMensaje(null);
    const res = await cargarDatosConstanciasSiuAction(usarServidor ? '' : usuario, usarServidor ? '' : clave);
    setCargando(false);
    if (!res.exito) {
      setMensaje({ ok: false, texto: res.mensaje || 'No se pudo conectar con SIU Guaraní.' });
      return;
    }
    setTipos(res.tipos || []);
    setAnios(res.anios || []);
    setTurnos(res.turnos || []);
    setActividades(res.actividades || []);
    setMesas(res.mesas || []);
    setSolicitudes(res.solicitudes || []);
    setConectado(true);
    const anioActual = String(new Date().getFullYear());
    if ((res.anios || []).some((a) => a.valor === anioActual)) setAnio(anioActual);
    else     if (res.anios?.length) setAnio(res.anios[0].valor);
  };

  const recargarMesas = async (anioValue: string, turnoValue: string, actividadValue: string) => {
    if (!anioValue || !actividadValue) {
      setMesas([]);
      return;
    }
    const res = await cargarMesasExamenSiuAction(
      usarServidor ? '' : usuario,
      usarServidor ? '' : clave,
      anioValue,
      turnoValue,
      actividadValue
    );
    setMesas(res.exito ? res.mesas || [] : []);
  };

  const enviar = async () => {
    if (!opcion) return;
    setEnviando(true);
    setMensaje(null);
    const res = await solicitarConstanciaSiuAction(
      usarServidor ? '' : usuario,
      usarServidor ? '' : clave,
      {
        tipoClave: opcion,
        copias,
        presentar,
        observaciones,
        filtro: necesitaFiltro && mesa ? { campo: 'llamado_mesa', valor: mesa } : null
      }
    );
    setEnviando(false);
    if (!res.exito) {
      setMensaje({ ok: false, texto: res.mensaje || 'No se pudo registrar la solicitud.' });
      return;
    }
    if (res.solicitudes) setSolicitudes(res.solicitudes);
    setMensaje({ ok: true, texto: res.mensaje || 'Solicitud registrada en SIU Guaraní.' });
    setPresentar('');
    setObservaciones('');
  };

  const volverAlMenu = () => {
    setOpcion(null);
    setMensaje(null);
  };

  const descargar = async (
    solicitud: { fecha: string; presentar: string; constancia: string; comprobante: string },
    claveFila: string
  ) => {
    setDescargando(claveFila);
    setMensaje(null);
    const res = await descargarComprobanteSiuAction(
      usarServidor ? '' : usuario,
      usarServidor ? '' : clave,
      {
        url: solicitud.comprobante,
        nombre: `constancia-${solicitud.fecha}-${solicitud.presentar}`
      }
    );
    setDescargando(null);
    if (!res.exito || !res.base64) {
      setMensaje({ ok: false, texto: res.mensaje || 'No se pudo descargar el comprobante.' });
      return;
    }
    const binario = Uint8Array.from(atob(res.base64), (caracter) => caracter.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([binario], { type: 'application/pdf' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = res.nombreArchivo || 'constancia.pdf';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
    setMensaje({ ok: true, texto: `Comprobante descargado (${res.nombreArchivo}).` });
  };

  /** Formulario de conexión a SIU: se usa en el menú y al pedir una constancia. */
  const formularioConexion = (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void conectar();
      }}
    >
      <p className="text-xs text-slate-400">
        Iniciá sesión con tu usuario y contraseña de SIU Guaraní para ver tus constancias y registrar solicitudes.
      </p>
      {esAdmin && (
        <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#111722] px-3 py-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={usarServidor}
            onChange={(e) => setUsarServidor(e.target.checked)}
          />
          Usar las credenciales de SIU del servidor (sin tipearlas)
        </label>
      )}
      {!usarServidor && (
        <>
          <div>
            <label className={etiquetaClase} htmlFor="solicitud-usuario">Usuario de SIU Guaraní</label>
            <input
              id="solicitud-usuario"
              className={campoClase}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className={etiquetaClase} htmlFor="solicitud-clave">Contraseña</label>
            <input
              id="solicitud-clave"
              type="password"
              className={campoClase}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
        </>
      )}
      {mensaje && !mensaje.ok ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{mensaje.texto}</p>
      ) : null}
      <button
        type="submit"
        disabled={cargando}
        className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60 cursor-pointer"
      >
        {cargando ? 'Conectando…' : 'Conectar a SIU Guaraní'}
      </button>
    </form>
  );

  return (
    <ModalOverlay maxWidth="2xl" variant="panel">
      <div className="flex min-h-0 flex-1 flex-col">
        <ModalOverlayHeader
          title="Solicitudes"
          subtitle="Constancias y certificados de la carrera"
          onClose={onCerrar}
        />
        <ModalOverlayBody>
          {!opcion ? (
            <div className="space-y-4">
              {conectado && (
                <section className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-100">Tus constancias vigentes</h3>
                    <span className="text-[11px] text-slate-400">
                      {vigentes.length} vigente{vigentes.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {vigentes.length === 0 ? (
                    <p className="rounded-xl border border-slate-700 bg-[#111722] px-4 py-3 text-xs text-slate-400">
                      No tenés constancias vigentes. Pedí una abajo y te llega por mail.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {vigentes.map((s, i) => {
                        const clave = claveTipoDesdeNombreSiu(s.constancia);
                        const dias = diasDeValidez(s);
                        return (
                          <li
                            key={`${s.fecha}-${s.presentar}-${i}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-100">{s.constancia}</p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                Pedida el {s.fecha} · Presentada a {s.presentar || '—'}
                              </p>
                              <p
                                className={`mt-1 text-[11px] font-semibold ${
                                  dias !== null && dias <= 30 ? 'text-amber-300' : 'text-emerald-300'
                                }`}
                              >
                                {etiquetaVigencia(s)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {s.comprobante && (
                                <button
                                  type="button"
                                  onClick={() => void descargar(s, `${s.fecha}-${i}`)}
                                  disabled={descargando === `${s.fecha}-${i}`}
                                  title={`Descargar el PDF de la constancia del ${s.fecha}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50 cursor-pointer"
                                >
                                  {descargando === `${s.fecha}-${i}` ? '⏳' : '📄'} PDF
                                </button>
                              )}
                              {clave && (
                                <button
                                  type="button"
                                  onClick={() => solicitarTipo(clave)}
                                  title="Pedir una constancia nueva de este tipo"
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
                                >
                                  ➕ Solicitar
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {vencidas.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Tenés {vencidas.length} constancia{vencidas.length === 1 ? '' : 's'} vencida
                      {vencidas.length === 1 ? '' : 's'}: pedilas de nuevo si las necesitás.
                    </p>
                  )}
                </section>
              )}

              {!conectado && (
                <section className="space-y-2 rounded-xl border border-slate-700 bg-[#111722] p-4">
                  <h3 className="text-sm font-bold text-slate-100">Ver mis constancias vigentes</h3>
                  {formularioConexion}
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-100">Pedir una constancia</h3>
                <button
                  type="button"
                  onClick={() => solicitarTipo('examen_parcial')}
                  className="flex w-full items-start gap-3 rounded-xl border border-slate-700 bg-[#111722] p-4 text-left transition-colors hover:border-cyan-500/40 hover:bg-[#141b26] cursor-pointer"
                >
                  <span className="text-lg" aria-hidden="true">📄</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-100">Constancia de examen parcial</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                      Se completa en el formulario una vez rendido el parcial; el certificado llega por mail.
                    </span>
                  </span>
                </button>

                {OPCIONES_SIU.map((item) => (
                  <button
                    key={item.clave}
                    type="button"
                    onClick={() => solicitarTipo(item.clave)}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-700 bg-[#111722] p-4 text-left transition-colors hover:border-cyan-500/40 hover:bg-[#141b26] cursor-pointer"
                  >
                    <span className="text-lg" aria-hidden="true">{item.icono}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-100">{item.titulo}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-400">{item.detalle}</span>
                    </span>
                  </button>
                ))}
              </section>
            </div>
          ) : esFormularioExterno ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={volverAlMenu}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ← Volver a las solicitudes
              </button>
              <div className="rounded-xl border border-slate-700 bg-[#111722] p-4">
                <h4 className="text-sm font-bold text-slate-100">Constancia de examen parcial</h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  La constancia de examen parcial se pide una vez rendido el parcial, completando el formulario
                  de la cátedra. Recibís el certificado por mail dentro de las 24 h.
                </p>
                <a
                  href={FORMULARIO_EXAMEN_PARCIAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25"
                >
                  📄 Abrir formulario <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          ) : !conectado ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={volverAlMenu}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ← Volver a las solicitudes
              </button>
              {formularioConexion}
            </div>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                onClick={volverAlMenu}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ← Volver a las solicitudes
              </button>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={etiquetaClase} htmlFor="solicitud-tipo">Tipo de constancia</label>
                  <input
                    id="solicitud-tipo"
                    className={`${campoClase} opacity-70`}
                    value={tipo?.etiqueta || ''}
                    readOnly
                  />
                </div>                <div>
                  <label className={etiquetaClase} htmlFor="solicitud-copias">Copias</label>
                  <select
                    id="solicitud-copias"
                    className={campoClase}
                    value={copias}
                    onChange={(e) => setCopias(Number(e.target.value))}
                    disabled={!tipo || tipo.copias <= 1}
                  >
                    {Array.from({ length: Math.max(1, tipo?.copias || 1) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {necesitaFiltro && (
                <div className="space-y-4 rounded-xl border border-slate-700 bg-[#111722] p-4">
                  <p className="text-xs text-slate-400">
                    Para la constancia de examen final elegí la mesa de examen.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className={etiquetaClase} htmlFor="solicitud-anio">Año académico</label>
                      <select
                        id="solicitud-anio"
                        className={campoClase}
                        value={anio}
                        onChange={(e) => {
                          setAnio(e.target.value);
                          setMesa('');
                          void recargarMesas(e.target.value, turno, actividad);
                        }}
                      >
                        <option value="">-- Seleccione --</option>
                        {anios.map((a) => (
                          <option key={a.valor} value={a.valor}>{a.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={etiquetaClase} htmlFor="solicitud-turno">Turno de examen</label>
                      <select
                        id="solicitud-turno"
                        className={campoClase}
                        value={turno}
                        onChange={(e) => {
                          setTurno(e.target.value);
                          setMesa('');
                          void recargarMesas(anio, e.target.value, actividad);
                        }}
                      >
                        <option value="">Todos</option>
                        {turnos.map((t) => (
                          <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={etiquetaClase} htmlFor="solicitud-actividad">Materia</label>
                      <select
                        id="solicitud-actividad"
                        className={campoClase}
                        value={actividad}
                        onChange={(e) => {
                          setActividad(e.target.value);
                          setMesa('');
                          void recargarMesas(anio, turno, e.target.value);
                        }}
                      >
                        <option value="">-- Seleccione --</option>
                        {actividades.map((a) => (
                          <option key={a.valor} value={a.valor}>{a.etiqueta}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={etiquetaClase} htmlFor="solicitud-mesa">Mesa de examen</label>
                    <select
                      id="solicitud-mesa"
                      className={campoClase}
                      value={mesa}
                      onChange={(e) => setMesa(e.target.value)}
                    >
                      <option value="">-- Seleccione --</option>
                      {mesas.map((m) => (
                        <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                      ))}
                    </select>
                    {mesas.length === 0 ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        No hay mesas de examen cargadas para esa combinación.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <div>
                <label className={etiquetaClase} htmlFor="solicitud-presentar">Presentar a</label>
                <input
                  id="solicitud-presentar"
                  className={campoClase}
                  value={presentar}
                  onChange={(e) => setPresentar(e.target.value)}
                  placeholder="Trabajo, Colectivo, obra social…"
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <label className={etiquetaClase} htmlFor="solicitud-observaciones">Observaciones (opcional)</label>
                <textarea
                  id="solicitud-observaciones"
                  className={`${campoClase} min-h-20`}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  maxLength={200}
                />
              </div>

              {mensaje ? (
                <p
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    mensaje.ok
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/40 bg-red-500/10 text-red-200'
                  }`}
                >
                  {mensaje.texto}
                </p>
              ) : null}

              {solicitudes.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-bold text-slate-200">Solicitudes registradas</h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#111722] text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Constancia</th>
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Presentar a</th>
                          <th className="px-3 py-2 font-semibold">Estado</th>
                          <th className="px-3 py-2 font-semibold">Vencimiento</th>
                          <th className="px-3 py-2 font-semibold">Comprobante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {solicitudes.map((s, i) => (
                          <tr key={`${s.fecha}-${i}`} className="border-t border-slate-800 text-slate-300">
                            <td className="px-3 py-2">{s.constancia}</td>
                            <td className="px-3 py-2">{s.fecha}</td>
                            <td className="px-3 py-2">{s.presentar}</td>
                            <td className="px-3 py-2">{s.estado}</td>
                            <td className="px-3 py-2">{s.vencimiento}</td>
                            <td className="px-3 py-2">
                              {s.comprobante ? (
                                <button
                                  type="button"
                                  onClick={() => void descargar(s, `${s.fecha}-${i}`)}
                                  disabled={descargando === `${s.fecha}-${i}`}
                                  title={`Descargar el PDF de la constancia del ${s.fecha}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50 cursor-pointer"
                                >
                                  {descargando === `${s.fecha}-${i}` ? '⏳' : '📄'} PDF
                                </button>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </ModalOverlayBody>
        {conectado && !esFormularioExterno && (
          <ModalOverlayFooter>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={enviando || !presentar.trim() || (necesitaFiltro && !mesa)}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50 cursor-pointer"
              >
                {enviando ? 'Enviando…' : 'Solicitar constancia'}
              </button>
            </div>
          </ModalOverlayFooter>
        )}
      </div>
    </ModalOverlay>
  );
}

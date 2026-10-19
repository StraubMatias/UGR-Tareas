'use client';

import { useState } from 'react';
import {
  cargarDatosConstanciasSiuAction,
  cargarMesasExamenSiuAction,
  solicitarConstanciaSiuAction,
  type OpcionConstancia,
  type TipoConstanciaSiu
} from '../../app/actions/constancias';
import ModalOverlay, { ModalOverlayBody, ModalOverlayFooter, ModalOverlayHeader } from './ModalOverlay';

interface ModalConstanciasSiuProps {
  onCerrar: () => void;
}

const campoClase =
  'w-full rounded-lg border border-slate-700 bg-[#111722] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60';

const etiquetaClase = 'mb-1 block text-xs font-semibold text-slate-300';

export default function ModalConstanciasSiu({ onCerrar }: ModalConstanciasSiuProps) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [conectado, setConectado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const [tipos, setTipos] = useState<TipoConstanciaSiu[]>([]);
  const [anios, setAnios] = useState<OpcionConstancia[]>([]);
  const [turnos, setTurnos] = useState<OpcionConstancia[]>([]);
  const [actividades, setActividades] = useState<OpcionConstancia[]>([]);
  const [mesas, setMesas] = useState<OpcionConstancia[]>([]);
  const [solicitudes, setSolicitudes] = useState<
    Array<{ constancia: string; fecha: string; presentar: string; estado: string; vencimiento: string; comprobante: string }>
  >([]);

  const [tipoClave, setTipoClave] = useState('alumno_regular');
  const [copias, setCopias] = useState(1);
  const [presentar, setPresentar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [anio, setAnio] = useState('');
  const [turno, setTurno] = useState('');
  const [actividad, setActividad] = useState('');
  const [mesa, setMesa] = useState('');

  const tipo = tipos.find((t) => t.clave === tipoClave);
  const necesitaFiltro = tipoClave === 'examen_final';

  const conectar = async () => {
    setCargando(true);
    setMensaje(null);
    const res = await cargarDatosConstanciasSiuAction(usuario, clave);
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
    else if (res.anios?.length) setAnio(res.anios[0].valor);
  };

  const recargarMesas = async (anioValue: string, turnoValue: string, actividadValue: string) => {
    if (!anioValue || !actividadValue) {
      setMesas([]);
      return;
    }
    const res = await cargarMesasExamenSiuAction(usuario, clave, anioValue, turnoValue, actividadValue);
    setMesas(res.exito ? res.mesas || [] : []);
  };

  const enviar = async () => {
    setEnviando(true);
    setMensaje(null);
    const res = await solicitarConstanciaSiuAction(usuario, clave, {
      tipoClave,
      copias,
      presentar,
      observaciones,
      filtro: necesitaFiltro && mesa ? { campo: 'llamado_mesa', valor: mesa } : null
    });
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

  return (
    <ModalOverlay maxWidth="2xl" variant="compact">
      <div className="flex h-full flex-col">
        <ModalOverlayHeader
          title="Constancias y certificados (SIU Guaraní)"
          subtitle="Autogestión → Solicitudes → Nueva solicitud"
          onClose={onCerrar}
        />
        <ModalOverlayBody>
          {!conectado ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void conectar();
              }}
            >
              <p className="text-xs text-slate-400">
                Iniciá sesión con tu usuario y contraseña de SIU Guaraní para solicitar constancias.
              </p>
              <div>
                <label className={etiquetaClase} htmlFor="constancia-usuario">Usuario de SIU Guaraní</label>
                <input
                  id="constancia-usuario"
                  className={campoClase}
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className={etiquetaClase} htmlFor="constancia-clave">Contraseña</label>
                <input
                  id="constancia-clave"
                  type="password"
                  className={campoClase}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
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
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={etiquetaClase} htmlFor="constancia-tipo">Tipo de constancia</label>
                  <select
                    id="constancia-tipo"
                    className={campoClase}
                    value={tipoClave}
                    onChange={(e) => {
                      setTipoClave(e.target.value);
                      setCopias(1);
                      setMesa('');
                    }}
                  >
                    {tipos.map((t) => (
                      <option key={t.clave} value={t.clave}>{t.etiqueta}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiquetaClase} htmlFor="constancia-copias">Copias</label>
                  <select
                    id="constancia-copias"
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
                      <label className={etiquetaClase} htmlFor="constancia-anio">Año académico</label>
                      <select
                        id="constancia-anio"
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
                      <label className={etiquetaClase} htmlFor="constancia-turno">Turno de examen</label>
                      <select
                        id="constancia-turno"
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
                      <label className={etiquetaClase} htmlFor="constancia-actividad">Materia</label>
                      <select
                        id="constancia-actividad"
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
                    <label className={etiquetaClase} htmlFor="constancia-mesa">Mesa de examen</label>
                    <select
                      id="constancia-mesa"
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
                <label className={etiquetaClase} htmlFor="constancia-presentar">Presentar a</label>
                <input
                  id="constancia-presentar"
                  className={campoClase}
                  value={presentar}
                  onChange={(e) => setPresentar(e.target.value)}
                  placeholder="Trabajo, Colectivo, obra social…"
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <label className={etiquetaClase} htmlFor="constancia-observaciones">Observaciones (opcional)</label>
                <textarea
                  id="constancia-observaciones"
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
        {conectado && (
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

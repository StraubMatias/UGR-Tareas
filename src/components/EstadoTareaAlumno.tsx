import { useState } from 'react';
import {
  calcularEstadoSemaforo, formatearFechaDDMMAAAA, formatearUnidad, etiquetaModoEntregaTarea, obtenerIconoMateria,
  tareaCompletadaPor, tareaFaltaNota, tareaPuedeGestionarse, type Materia, type Tarea
} from '../core/cursada';
import EstadoGrupoAlumno from './EstadoGrupoAlumno';
import ModalGruposTarea from './ModalGruposTarea';

interface Props {
  tarea: Tarea;
  alumno: string;
  alumnos: string[];
  usuarioActual: string | null;
  esAdmin?: boolean;
  irATareaEnMaterias: (tareaId: string) => void;
  recargarTablero?: (mostrarCarga?: boolean) => void | Promise<unknown>;
  materia: Materia;
  unidad: string | number | null | undefined;
  ocultarContextoMateria?: boolean;
  toggleTareaDesdeCliente: (tareaId: string, alumno: string, tarea: Tarea) => void;
  notasTareasInputs: Record<string, string>;
  handleNotaTareaChangeLocal: (tareaId: string, alumno: string, valor: string) => void;
  handleGuardarNotaTareaOnBlur: (tareaId: string, alumno: string) => void;
}

export default function EstadoTareaAlumno({
  tarea, alumno, alumnos, usuarioActual, esAdmin = false, irATareaEnMaterias, recargarTablero, materia, unidad,
  ocultarContextoMateria = false,
  toggleTareaDesdeCliente, notasTareasInputs, handleNotaTareaChangeLocal,
  handleGuardarNotaTareaOnBlur
}: Props) {
  const [modalGruposAbierto, setModalGruposAbierto] = useState(false);
  const propia = alumno === usuarioActual;
  const entregada = tareaCompletadaPor(tarea, alumno);
  const faltaNota = tareaFaltaNota(tarea, alumno);
  const semaforo = calcularEstadoSemaforo(tarea.fin, tarea.inicio);
  const puedeGestionar = tareaPuedeGestionarse(tarea);
  const notasOtros = alumnos.filter((nombre) => nombre !== alumno
    && tarea.notas?.[nombre] !== undefined && tarea.notas?.[nombre] !== null && tarea.notas?.[nombre] !== '');
  const recargar = recargarTablero || (() => undefined);

  return (
    <div className="estado-tarea min-w-0 rounded-xl border border-slate-800 bg-[#111a24] p-4 space-y-3">
      {materia && !ocultarContextoMateria && (
        <div className="estado-tarea-contexto border-b border-slate-800">
          <p className="estado-tarea-materia"><span aria-hidden="true">{obtenerIconoMateria(materia.nombre)}</span> {materia.nombre}</p>
          {unidad && <p className="estado-tarea-unidad">{unidad === 'Evaluaciones' ? 'Evaluaciones' : `Unidad ${formatearUnidad(unidad)}`}</p>}
        </div>
      )}
      {ocultarContextoMateria && unidad && (
        <p className="estado-tarea-unidad text-xs text-slate-500 mb-1">
          {unidad === 'Evaluaciones' ? 'Evaluaciones' : `Unidad ${formatearUnidad(unidad)}`}
        </p>
      )}
      <div className="flex items-start gap-3">
        {propia && (
          <input type="checkbox" checked={entregada} disabled={!puedeGestionar}
            onChange={() => toggleTareaDesdeCliente(tarea.id, alumno, tarea)}
            aria-label={`Marcar entregada: ${tarea.nombre}`}
            className="mt-1 h-5 w-5 shrink-0 rounded border border-slate-600 bg-[#0f141c] accent-cyan-400 cursor-pointer disabled:opacity-40" />
        )}
        <div className="min-w-0 flex-1">
          <h4>
            <button type="button" onClick={() => irATareaEnMaterias(tarea.id)}
              className="estado-tarea-titulo text-left text-slate-100 hover:text-cyan-300 cursor-pointer">
              {tarea.nombre}
            </button>
          </h4>
          <p className="estado-tarea-meta">
            <span>
              {etiquetaModoEntregaTarea(tarea, alumno)}
              {tarea.conNota ? ' · Con nota' : ''}
            </span>
            <span className="estado-tarea-fecha">Entrega: {formatearFechaDDMMAAAA(tarea.fin)}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`estado-tarea-estado rounded-md border px-2 py-1 ${entregada ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : semaforo.estilo}`}>
          {faltaNota ? 'Entregada · falta nota' : entregada ? 'Completada' : semaforo.texto}
        </span>
        {tarea.url && <a href={tarea.url} target="_blank" rel="noopener noreferrer" className="estado-tarea-campus hover:underline">Ver en UGR ↗</a>}
      </div>
      <EstadoGrupoAlumno
        tarea={tarea}
        alumno={alumno}
        esPropia={propia}
        esAdmin={esAdmin}
        onAbrirGrupos={() => setModalGruposAbierto(true)}
      />
      <ModalGruposTarea
        abierto={modalGruposAbierto}
        cerrar={() => setModalGruposAbierto(false)}
        tarea={tarea}
        materiaNombre={materia.nombre}
        usuarioActual={usuarioActual}
        alumnos={alumnos}
        recargar={recargar}
        esAdmin={esAdmin}
      />
      {tarea.conNota && (
        <div className="estado-tarea-notas space-y-3">
          {propia ? (
            <label className="flex items-center justify-between gap-3 text-slate-300">
              <span>{tarea.grupal ? 'Nota del grupo' : 'Tu nota'} (1 a 10)</span>
              <input type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?"
                aria-label={`Nota de ${tarea.nombre}`} placeholder="Nota" disabled readOnly
                value={notasTareasInputs[`${tarea.id}_${alumno}`] ?? ''}
                onChange={(e) => handleNotaTareaChangeLocal(tarea.id, alumno, e.target.value)}
                onBlur={() => handleGuardarNotaTareaOnBlur(tarea.id, alumno)}
                className="w-20 rounded-lg border border-purple-500/40 bg-slate-950 p-2 text-center text-white disabled:opacity-40" />
            </label>
          ) : <p className="text-slate-300">Nota: {tarea.notas?.[alumno] || 'Sin cargar'}</p>}
          {propia && (
            <details>
              <summary className="text-xs text-cyan-300 cursor-pointer">Ver notas de los demás ({notasOtros.length})</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {notasOtros.length ? notasOtros.map((nombre) => (
                  <li key={nombre} className="flex justify-between gap-3"><span>{nombre}</span><strong>{tarea.notas?.[nombre]}</strong></li>
                )) : <li>Todavía no hay notas cargadas.</li>}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

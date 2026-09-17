'use client';

import { useId, useState } from 'react';
import EstadoAlumno from './EstadoAlumno';

const normalizar = (texto) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function VistaAlumnos({
  materias = [], alumnos = [], usuarioActual, situacionPropiaAbierta,
  setSituacionPropiaAbierta, alumnosDesplegados, toggleDesplegarAlumno, ...acciones
}) {
  const [busqueda, setBusqueda] = useState('');
  const busquedaId = useId();
  const companeros = alumnos.filter((alumno) => alumno !== usuarioActual);
  const visibles = companeros.filter((alumno) => normalizar(alumno).includes(normalizar(busqueda)));
  const propsCompartidas = { materias, alumnos, usuarioActual, ...acciones };

  return (
    <div className="estado-alumnos min-w-0 space-y-6">
      <header>
        <h2 className="text-xl font-bold text-white">Estado por alumno</h2>
        <p className="mt-2 text-sm text-slate-400">Entregas, notas y equipos de trabajo. Elegí un estado para consultar las tareas.</p>
      </header>
      {usuarioActual && (
        <EstadoAlumno alumno={usuarioActual} abierto={situacionPropiaAbierta}
          alAlternar={() => setSituacionPropiaAbierta((abierta) => !abierta)} {...propsCompartidas} />
      )}
      <section className="space-y-4" aria-label="Compañeros de cursada">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <h2 className="font-semibold text-slate-200">Compañeros de cursada ({companeros.length})</h2>
          <div className="w-full sm:w-72">
            <label htmlFor={busquedaId} className="block mb-1 text-xs text-slate-400">Buscar compañero</label>
            <input id={busquedaId} type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre del alumno" className="w-full rounded-lg border border-slate-700 bg-[#111a24] px-3 py-2 text-sm text-white" />
          </div>
        </div>
        {visibles.map((alumno) => (
          <EstadoAlumno key={alumno} alumno={alumno} abierto={!!alumnosDesplegados[alumno]}
            alAlternar={() => toggleDesplegarAlumno(alumno)} {...propsCompartidas} />
        ))}
        {visibles.length === 0 && <p role="status" className="py-5 text-sm text-slate-400">{companeros.length ? 'No hay compañeros que coincidan con la búsqueda.' : 'No hay otros alumnos en esta comisión.'}</p>}
      </section>
    </div>
  );
}

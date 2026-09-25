'use client';

import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import type { Materia, Tarea } from '../core/cursada';
import { alumnosEnEstado, type InscripcionAlumno } from '../lib/companeros';
import EstadoAlumno from './EstadoAlumno';

const normalizar = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

interface Props {
  materias?: Materia[];
  inscripciones?: InscripcionAlumno[];
  alumnos?: string[];
  registrados?: string[];
  usuarioActual: string | null;
  esAdmin?: boolean;
  situacionPropiaAbierta: boolean;
  setSituacionPropiaAbierta: Dispatch<SetStateAction<boolean>>;
  alumnosDesplegados: Record<string, boolean>;
  toggleDesplegarAlumno: (nombre: string) => void;
  toggleTareaDesdeCliente: (tareaId: string, alumno: string, tarea: Tarea) => void;
  irATareaEnMaterias: (tareaId: string) => void;
  notasTareasInputs: Record<string, string>;
  handleNotaTareaChangeLocal: (tareaId: string, alumno: string, valor: string) => void;
  handleGuardarNotaTareaOnBlur: (tareaId: string, alumno: string) => void;
}

export default function VistaAlumnos({
  materias = [], inscripciones = [], alumnos = [], registrados, usuarioActual, esAdmin = false, situacionPropiaAbierta,
  setSituacionPropiaAbierta, alumnosDesplegados, toggleDesplegarAlumno, ...acciones
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  const busquedaId = useId();
  const companeros = alumnosEnEstado(inscripciones, usuarioActual || '', registrados?.length ? registrados : alumnos, esAdmin)
    .filter((alumno) => alumno !== usuarioActual);
  const visibles = companeros.filter((alumno) => normalizar(alumno).includes(normalizar(busqueda)));
  const propsCompartidas = { materias, inscripciones, alumnos, usuarioActual, esAdmin, ...acciones };

  return (
    <div className="estado-alumnos min-w-0 space-y-6">
      <header>
        <h2 className="text-xl font-bold text-white">Estado por alumno</h2>
      </header>
      {usuarioActual && (
        <EstadoAlumno alumno={usuarioActual} abierto={situacionPropiaAbierta}
          alAlternar={() => setSituacionPropiaAbierta((abierta) => !abierta)} {...propsCompartidas} />
      )}
      <section className="space-y-4" aria-label="Compañeros de cursada">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <h2 className="estado-companeros-titulo text-slate-200">Compañeros de cursada ({companeros.length})</h2>
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
        {visibles.length === 0 && <p role="status" className="py-5 text-sm text-slate-400">{companeros.length ? 'No hay compañeros que coincidan con la búsqueda.' : 'No hay compañeros que cursen una materia con vos.'}</p>}
      </section>
    </div>
  );
}

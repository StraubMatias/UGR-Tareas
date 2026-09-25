import { useState } from 'react';
import type { AvisoCampusMoodle, Periodo } from '../components/portal/types';
import type { EventoCronograma, Horario, Materia, Nota, Parcial } from '../core/cursada';

export function useTableroEstadoDatos() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [alumnos, setAlumnos] = useState<string[]>([]);
  const [registrados, setRegistrados] = useState<string[]>([]);
  const [inscripciones, setInscripciones] = useState<{ alumno: string; materiaId: string }[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [parciales, setParciales] = useState<Parcial[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [notasInputs, setNotasInputs] = useState<Record<string, string>>({});
  const [notasTareasInputs, setNotasTareasInputs] = useState<Record<string, string>>({});
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cronograma, setCronograma] = useState<EventoCronograma[]>([]);
  const [progresoPlan, setProgresoPlan] = useState<
    { alumno: string | null; materia_codigo: string; estado: string; nota: number | null; actualizado_en: string }[]
  >([]);
  const [avisos, setAvisos] = useState<AvisoCampusMoodle[]>([]);

  return {
    materias,
    setMaterias,
    alumnos,
    setAlumnos,
    registrados,
    setRegistrados,
    inscripciones,
    setInscripciones,
    periodos,
    setPeriodos,
    periodoSeleccionado,
    setPeriodoSeleccionado,
    parciales,
    setParciales,
    notas,
    setNotas,
    notasInputs,
    setNotasInputs,
    notasTareasInputs,
    setNotasTareasInputs,
    horarios,
    setHorarios,
    cronograma,
    setCronograma,
    progresoPlan,
    setProgresoPlan,
    avisos,
    setAvisos
  };
}

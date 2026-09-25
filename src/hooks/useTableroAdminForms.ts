import { useMemo, useState } from 'react';
import type { Parcial, Tarea } from '../core/cursada';
import type { MateriaCondicionesEdicion, ProgresoPlanEdicion, TableroAdminForms } from './tablero-estado/types';

export function useTableroAdminForms() {
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = useState('');
  const [nuevaMateriaNombre, setNuevaMateriaNombre] = useState('');
  const [nuevoMateriaAnio, setNuevoMateriaAnio] = useState('2026');
  const [nuevoMateriaCuatrimestre, setNuevoMateriaCuatrimestre] = useState('2');
  const [materiaSel, setMateriaSel] = useState('');
  const [nombreTarea, setNombreTarea] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [detallesTarea, setDetallesTarea] = useState('');
  const [unidadTarea, setUnidadTarea] = useState('');
  const [tareaConNota, setTareaConNota] = useState(false);
  const [tareaGrupal, setTareaGrupal] = useState(false);
  const [cupoMaximo, setCupoMaximo] = useState(0);
  const [tipoTarea, setTipoTarea] = useState('actividad');
  const [materiaCondicionesEnEdicion, setMateriaCondicionesEnEdicion] = useState<MateriaCondicionesEdicion | null>(null);
  const [materiaParcialSel, setMateriaParcialSel] = useState('');
  const [nombreParcial, setNombreParcial] = useState('');
  const [fechaParcial, setFechaParcial] = useState('');
  const [detallesParcial, setDetallesParcial] = useState('');
  const [parcialEnEdicion, setParcialEnEdicion] = useState<Parcial | null>(null);
  const [materiaHorarioSel, setMateriaHorarioSel] = useState('');
  const [diaHorario, setDiaHorario] = useState('1');
  const [horaInicioHorario, setHoraInicioHorario] = useState('');
  const [horaFinHorario, setHoraFinHorario] = useState('');
  const [aulaHorario, setAulaHorario] = useState('');
  const [tareaEnEdicion, setTareaEnEdicion] = useState<{ materiaId: string; tarea: Tarea } | null>(null);
  const [materiaEnEdicion, setMateriaEnEdicion] = useState<{ id: string; nombre: string } | null>(null);
  const [alumnoEnEdicion, setAlumnoEnEdicion] = useState<{ antiguoNombre: string; nuevoNombre: string } | null>(null);
  const [progresoPlanEnEdicion, setProgresoPlanEnEdicion] = useState<ProgresoPlanEdicion>({});

  const adminForms: TableroAdminForms = useMemo(
    () => ({
      nuevoAlumnoNombre,
      setNuevoAlumnoNombre,
      nuevoMateriaAnio,
      setNuevoMateriaAnio,
      nuevoMateriaCuatrimestre,
      setNuevoMateriaCuatrimestre,
      nuevaMateriaNombre,
      setNuevaMateriaNombre,
      materiaSel,
      setMateriaSel,
      nombreTarea,
      setNombreTarea,
      unidadTarea,
      setUnidadTarea,
      tipoTarea,
      setTipoTarea,
      tareaConNota,
      setTareaConNota,
      tareaGrupal,
      setTareaGrupal,
      cupoMaximo,
      setCupoMaximo,
      fechaInicio,
      setFechaInicio,
      fechaFin,
      setFechaFin,
      detallesTarea,
      setDetallesTarea,
      materiaParcialSel,
      setMateriaParcialSel,
      nombreParcial,
      setNombreParcial,
      fechaParcial,
      setFechaParcial,
      detallesParcial,
      setDetallesParcial,
      materiaHorarioSel,
      setMateriaHorarioSel,
      diaHorario,
      setDiaHorario,
      horaInicioHorario,
      setHoraInicioHorario,
      horaFinHorario,
      setHoraFinHorario,
      aulaHorario,
      setAulaHorario,
      setAlumnoEnEdicion
    }),
    [
      nuevoAlumnoNombre,
      nuevoMateriaAnio,
      nuevoMateriaCuatrimestre,
      nuevaMateriaNombre,
      materiaSel,
      nombreTarea,
      unidadTarea,
      tipoTarea,
      tareaConNota,
      tareaGrupal,
      cupoMaximo,
      fechaInicio,
      fechaFin,
      detallesTarea,
      materiaParcialSel,
      nombreParcial,
      fechaParcial,
      detallesParcial,
      materiaHorarioSel,
      diaHorario,
      horaInicioHorario,
      horaFinHorario,
      aulaHorario
    ]
  );

  const cerrarParcialEdicion = () => {
    setParcialEnEdicion(null);
    setNombreParcial('');
    setFechaParcial('');
    setDetallesParcial('');
  };

  const hayModalAbierto =
    Boolean(materiaCondicionesEnEdicion)
    || Boolean(parcialEnEdicion)
    || Boolean(tareaEnEdicion)
    || Boolean(materiaEnEdicion)
    || Boolean(alumnoEnEdicion)
    || Object.keys(progresoPlanEnEdicion).length > 0;

  return {
    nuevoAlumnoNombre,
    setNuevoAlumnoNombre,
    nuevaMateriaNombre,
    setNuevaMateriaNombre,
    nuevoMateriaAnio,
    nuevoMateriaCuatrimestre,
    materiaSel,
    setMateriaSel,
    nombreTarea,
    fechaInicio,
    fechaFin,
    detallesTarea,
    unidadTarea,
    tareaConNota,
    tareaGrupal,
    cupoMaximo,
    tipoTarea,
    setNombreTarea,
    setFechaInicio,
    setFechaFin,
    setDetallesTarea,
    setUnidadTarea,
    setTareaConNota,
    setTareaGrupal,
    setCupoMaximo,
    setTipoTarea,
    materiaCondicionesEnEdicion,
    setMateriaCondicionesEnEdicion,
    materiaParcialSel,
    setMateriaParcialSel,
    nombreParcial,
    setNombreParcial,
    fechaParcial,
    setFechaParcial,
    detallesParcial,
    setDetallesParcial,
    parcialEnEdicion,
    setParcialEnEdicion,
    materiaHorarioSel,
    setMateriaHorarioSel,
    diaHorario,
    horaInicioHorario,
    horaFinHorario,
    aulaHorario,
    setHoraInicioHorario,
    setHoraFinHorario,
    setAulaHorario,
    tareaEnEdicion,
    setTareaEnEdicion,
    materiaEnEdicion,
    setMateriaEnEdicion,
    alumnoEnEdicion,
    setAlumnoEnEdicion,
    progresoPlanEnEdicion,
    setProgresoPlanEnEdicion,
    adminForms,
    cerrarParcialEdicion,
    hayModalAbierto
  };
}

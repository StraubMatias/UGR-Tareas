import type { Dispatch, SetStateAction } from 'react';
import type { Parcial, Tarea } from '../../core/cursada';

export type MateriaCondicionesEdicion = {
  id: string;
  condiciones: string;
  notaMinimaRegularizar: number | string;
  notaMinimaPromocionar: number | string;
  reglaPromocion: string;
};

export type ProgresoPlanEdicion = Record<string, { estado: string; nota: string }>;

export type TableroAdminForms = {
  nuevoAlumnoNombre: string;
  setNuevoAlumnoNombre: Dispatch<SetStateAction<string>>;
  nuevoMateriaAnio: string;
  setNuevoMateriaAnio: Dispatch<SetStateAction<string>>;
  nuevoMateriaCuatrimestre: string;
  setNuevoMateriaCuatrimestre: Dispatch<SetStateAction<string>>;
  nuevaMateriaNombre: string;
  setNuevaMateriaNombre: Dispatch<SetStateAction<string>>;
  materiaSel: string;
  setMateriaSel: Dispatch<SetStateAction<string>>;
  nombreTarea: string;
  setNombreTarea: Dispatch<SetStateAction<string>>;
  unidadTarea: string;
  setUnidadTarea: Dispatch<SetStateAction<string>>;
  tipoTarea: string;
  setTipoTarea: Dispatch<SetStateAction<string>>;
  tareaConNota: boolean;
  setTareaConNota: Dispatch<SetStateAction<boolean>>;
  tareaGrupal: boolean;
  setTareaGrupal: Dispatch<SetStateAction<boolean>>;
  cupoMaximo: number;
  setCupoMaximo: Dispatch<SetStateAction<number>>;
  fechaInicio: string;
  setFechaInicio: Dispatch<SetStateAction<string>>;
  fechaFin: string;
  setFechaFin: Dispatch<SetStateAction<string>>;
  detallesTarea: string;
  setDetallesTarea: Dispatch<SetStateAction<string>>;
  materiaParcialSel: string;
  setMateriaParcialSel: Dispatch<SetStateAction<string>>;
  nombreParcial: string;
  setNombreParcial: Dispatch<SetStateAction<string>>;
  fechaParcial: string;
  setFechaParcial: Dispatch<SetStateAction<string>>;
  detallesParcial: string;
  setDetallesParcial: Dispatch<SetStateAction<string>>;
  materiaHorarioSel: string;
  setMateriaHorarioSel: Dispatch<SetStateAction<string>>;
  diaHorario: string;
  setDiaHorario: Dispatch<SetStateAction<string>>;
  horaInicioHorario: string;
  setHoraInicioHorario: Dispatch<SetStateAction<string>>;
  horaFinHorario: string;
  setHoraFinHorario: Dispatch<SetStateAction<string>>;
  aulaHorario: string;
  setAulaHorario: Dispatch<SetStateAction<string>>;
  setAlumnoEnEdicion: Dispatch<SetStateAction<{ antiguoNombre: string; nuevoNombre: string } | null>>;
};

export type TareaEnEdicion = { materiaId: string; tarea: Tarea };
export type ParcialEnEdicion = Parcial | null;

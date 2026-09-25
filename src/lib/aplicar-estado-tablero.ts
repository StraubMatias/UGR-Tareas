import type { Dispatch, SetStateAction } from 'react';
import type { AvisoCampusMoodle, InvitacionGrupoEnviadaTablero, InvitacionGrupoTablero, Periodo } from '../components/portal/types';
import type { EventoCronograma, Horario, Materia, Nota, Parcial } from '../core/cursada';

export interface EstadoCompletoTablero {
  usuario?: string;
  rol?: string;
  origen?: string;
  ugrUsuario?: string | null;
  periodos?: Periodo[];
  periodoActivo?: string | null;
  materias?: Materia[];
  alumnos?: string[];
  registrados?: string[];
  inscripciones?: { alumno: string; materiaId: string }[];
  parciales?: Parcial[];
  notas?: Nota[];
  horarios?: Horario[];
  cronograma?: EventoCronograma[];
  progresoPlan?: {
    alumno: string | null;
    materia_codigo: string;
    estado: string;
    nota: number | null;
    actualizado_en: string;
  }[];
  avisos?: AvisoCampusMoodle[];
  invitacionesGrupo?: InvitacionGrupoTablero[];
  invitacionesGrupoEnviadas?: InvitacionGrupoEnviadaTablero[];
}

export interface AplicarEstadoTableroCallbacks {
  setPeriodos: Dispatch<SetStateAction<Periodo[]>>;
  setMaterias: Dispatch<SetStateAction<Materia[]>>;
  setAlumnos: Dispatch<SetStateAction<string[]>>;
  setRegistrados: Dispatch<SetStateAction<string[]>>;
  setInscripciones: Dispatch<SetStateAction<{ alumno: string; materiaId: string }[]>>;
  setParciales: Dispatch<SetStateAction<Parcial[]>>;
  setNotas: Dispatch<SetStateAction<Nota[]>>;
  setHorarios: Dispatch<SetStateAction<Horario[]>>;
  setCronograma: Dispatch<SetStateAction<EventoCronograma[]>>;
  setProgresoPlan: Dispatch<SetStateAction<NonNullable<EstadoCompletoTablero['progresoPlan']>>>;
  setAvisos: Dispatch<SetStateAction<AvisoCampusMoodle[]>>;
  setInvitacionesGrupo: Dispatch<SetStateAction<InvitacionGrupoTablero[]>>;
  setInvitacionesGrupoEnviadas: Dispatch<SetStateAction<InvitacionGrupoEnviadaTablero[]>>;
  setRolUsuario: Dispatch<SetStateAction<string | null>>;
  setOrigenCuenta: Dispatch<SetStateAction<string | null>>;
  setUgrUsuarioCuenta: Dispatch<SetStateAction<string | null>>;
  setNotasInputs: Dispatch<SetStateAction<Record<string, string>>>;
  setNotasTareasInputs: Dispatch<SetStateAction<Record<string, string>>>;
  setMateriaSel: Dispatch<SetStateAction<string>>;
  setMateriaParcialSel: Dispatch<SetStateAction<string>>;
  setMateriaHorarioSel: Dispatch<SetStateAction<string>>;
  setMateriaRanking: Dispatch<SetStateAction<string>>;
}

/** Hidrata el estado local del tablero desde `obtenerEstadoCompleto`. */
export function aplicarEstadoTablero(
  estado: EstadoCompletoTablero | null | undefined,
  cb: AplicarEstadoTableroCallbacks
) {
  if (!estado) return;

  cb.setPeriodos(estado.periodos || []);
  cb.setMaterias(estado.materias || []);
  cb.setAlumnos(estado.alumnos || []);
  cb.setRegistrados(estado.registrados || estado.alumnos || []);
  cb.setInscripciones(estado.inscripciones || []);
  cb.setParciales(estado.parciales || []);
  cb.setNotas(estado.notas || []);
  cb.setHorarios(estado.horarios || []);
  cb.setCronograma(estado.cronograma || []);
  cb.setProgresoPlan(estado.progresoPlan || []);
  cb.setAvisos(estado.avisos || []);
  cb.setInvitacionesGrupo(estado.invitacionesGrupo || []);
  cb.setInvitacionesGrupoEnviadas(estado.invitacionesGrupoEnviadas || []);
  if (estado.rol) cb.setRolUsuario(estado.rol);
  if (estado.origen) cb.setOrigenCuenta(estado.origen);
  if ('ugrUsuario' in estado) cb.setUgrUsuarioCuenta(estado.ugrUsuario || null);

  const mapaNotas: Record<string, string> = {};
  (estado.notas || []).forEach((n) => {
    mapaNotas[`${n.parcial_id}_${n.alumno}`] = String(n.nota ?? '');
  });
  cb.setNotasInputs(mapaNotas);

  const mapaNotasTareas: Record<string, string> = {};
  (estado.materias || []).forEach((materia) => {
    materia.tareas.forEach((tarea) => {
      Object.entries(tarea.notas || {}).forEach(([alumno, nota]) => {
        mapaNotasTareas[`${tarea.id}_${alumno}`] = String(nota);
      });
    });
  });
  cb.setNotasTareasInputs(mapaNotasTareas);

  if (estado.materias && estado.materias.length > 0) {
    const primera = estado.materias[0].id;
    cb.setMateriaSel((valorActual) => valorActual || primera);
    cb.setMateriaParcialSel((valorActual) => valorActual || primera);
    cb.setMateriaHorarioSel((valorActual) => valorActual || primera);
    cb.setMateriaRanking((valorActual) => {
      if (!valorActual) return primera;
      const idsCursada = new Set(
        (estado.inscripciones || [])
          .filter((i) => i.alumno === estado.usuario)
          .map((i) => i.materiaId)
      );
      const materiaCursada = estado.materias!.find(
        (m) => m.id === valorActual && idsCursada.has(m.id)
      );
      if (materiaCursada) return valorActual;
      const primeraCursada = estado.materias!.find((m) => idsCursada.has(m.id));
      return primeraCursada?.id ?? primera;
    });
  }
}

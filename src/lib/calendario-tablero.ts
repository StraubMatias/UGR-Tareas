import type { EventoCronograma, Horario, Materia, Parcial } from '../core/cursada';
import { presentarCronogramaDelDia } from './cronograma-vista';

export const NOMBRES_DIAS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes'
};

export const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const INICIO_CURSADA = new Date(2026, 7, 18);
export const FIN_CURSADA = new Date(2027, 2, 1);

export function formatearFechaCalendario(fecha: string | null | undefined) {
  if (!fecha || fecha === 'Sin fecha') return null;
  const partes = String(fecha).slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some((parte) => !Number.isFinite(parte))) return null;
  return `${partes[0]}-${String(partes[1]).padStart(2, '0')}-${String(partes[2]).padStart(2, '0')}`;
}

export function obtenerClaveDiaCalendario(fecha: string | null | undefined) {
  return formatearFechaCalendario(fecha);
}

/** Clave `YYYY-MM-DD` del día de referencia (por defecto hoy en hora local). */
export function claveHoyCalendario(ref = new Date()) {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
}

export function obtenerDiaSemanaHorario(fecha: Date) {
  const diaSemana = fecha.getDay();
  return diaSemana === 0 ? 7 : diaSemana;
}

export function fechaDentroDelCronograma(fecha: Date) {
  const fechaNormalizada = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const esRecesoDeEnero = fechaNormalizada.getMonth() === 0;
  return fechaNormalizada >= INICIO_CURSADA && fechaNormalizada < FIN_CURSADA && !esRecesoDeEnero;
}

export function diasCalendarioDelMes(mesCalendario: Date) {
  const primerDiaMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1);
  const diasEnMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0).getDate();
  const desplazamientoMes = (primerDiaMes.getDay() + 6) % 7;
  return Array.from({ length: desplazamientoMes + diasEnMes }, (_, indice) => {
    if (indice < desplazamientoMes) return null;
    return new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), indice - desplazamientoMes + 1);
  });
}

export function eventosDelDiaCalendario(
  fecha: Date | null,
  {
    parcialesDeLaCursada,
    tareasCalendario,
    horariosDeLaCursada,
    cronogramaDeLaCursada
  }: {
    parcialesDeLaCursada: Parcial[];
    tareasCalendario: Array<{ tarea: Materia['tareas'][number]; materia: Materia }>;
    horariosDeLaCursada: Horario[];
    cronogramaDeLaCursada: EventoCronograma[];
  }
) {
  if (!fecha || !fechaDentroDelCronograma(fecha)) {
    return { parciales: [], tareas: [], horarios: [], cronograma: [], enlacesClasePorMateria: new Map<string, string>() };
  }

  const claveDia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  const diaSemana = obtenerDiaSemanaHorario(fecha);

  const eventosCronogramaDia = cronogramaDeLaCursada.filter((evento) => obtenerClaveDiaCalendario(evento.fecha) === claveDia);
  const materiasSinCursadaDia = new Set(
    eventosCronogramaDia
      .filter((evento) => evento.modalidad !== 'sincrónico' || evento.tipo === 'sin_clases')
      .map((evento) => evento.materia_id)
  );

  const horariosDelDia = horariosDeLaCursada
    .filter((horario) => Number(horario.dia) === diaSemana)
    .filter((horario) => !materiasSinCursadaDia.has(horario.materia_id));
  const porMateria = new Map<string, Horario[]>();
  for (const horario of horariosDelDia) {
    const grupo = porMateria.get(horario.materia_id) || [];
    grupo.push(horario);
    porMateria.set(horario.materia_id, grupo);
  }
  const horariosReales = [...porMateria.values()].flatMap((grupo) => {
    const deHoraYMedia = grupo.filter((horario) => {
      const [ha, ma] = String(horario.hora_inicio).split(':').map(Number);
      const [hb, mb] = String(horario.hora_fin).split(':').map(Number);
      return [ha, ma, hb, mb].every(Number.isFinite) && (hb * 60 + mb) - (ha * 60 + ma) === 90;
    });
    return deHoraYMedia.length > 0 ? deHoraYMedia : grupo;
  }).sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)) || String(a.materia_id).localeCompare(String(b.materia_id)));

  const parciales = parcialesDeLaCursada.filter((parcial) => obtenerClaveDiaCalendario(parcial.fecha) === claveDia);
  const tareas = tareasCalendario.filter(({ tarea }) => obtenerClaveDiaCalendario(tarea.fin) === claveDia);
  const { eventos: cronograma, enlaceClasePorMateria } = presentarCronogramaDelDia(
    eventosCronogramaDia,
    horariosReales,
    parciales,
    tareas.map(({ tarea }) => ({ nombre: tarea.nombre }))
  );

  return {
    parciales,
    tareas,
    horarios: horariosReales,
    cronograma,
    enlacesClasePorMateria: enlaceClasePorMateria
  };
}

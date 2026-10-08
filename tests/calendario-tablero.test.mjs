import test from 'node:test';
import assert from 'node:assert/strict';

function obtenerDiaSemanaHorario(fecha) {
  const diaSemana = fecha.getDay();
  return diaSemana === 0 ? 7 : diaSemana;
}

function alinearFechaEventoAlHorarioMateria(fechaIso, materiaId, horarios) {
  const clave = String(fechaIso || '').slice(0, 10);
  const horario = horarios.find((h) => h.materia_id === materiaId);
  if (!horario) return clave;
  const [y, m, d] = clave.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const diaEvento = obtenerDiaSemanaHorario(fecha);
  const diaClase = Number(horario.dia);
  if (diaEvento === diaClase) return clave;
  let delta = diaClase - diaEvento;
  if (delta > 3) delta -= 7;
  if (delta < -3) delta += 7;
  const alineada = new Date(y, m - 1, d + delta);
  return `${alineada.getFullYear()}-${String(alineada.getMonth() + 1).padStart(2, '0')}-${String(alineada.getDate()).padStart(2, '0')}`;
}

test('alinearFechaEventoAlHorarioMateria mueve el plan al miércoles de Criptografía', () => {
  const horarios = [{ id: 'h1', materia_id: 'cri', dia: 3, hora_inicio: '18:00', hora_fin: '19:30', aula: 'Virtual' }];
  assert.equal(alinearFechaEventoAlHorarioMateria('2026-09-24', 'cri', horarios), '2026-09-23');
});

test('alinearFechaEventoAlHorarioMateria corrige Conceptos al jueves', () => {
  const horarios = [{ id: 'h1', materia_id: 'dev', dia: 4, hora_inicio: '19:00', hora_fin: '20:30', aula: 'Virtual' }];
  assert.equal(alinearFechaEventoAlHorarioMateria('2026-09-04', 'dev', horarios), '2026-09-03');
});

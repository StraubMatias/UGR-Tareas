import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDARIO_ACADEMICO_2026 } from '../database/calendario-academico-2026.mjs';
import { esRecesoDeEnero, eventosAcademicosParaFecha } from '../src/lib/calendario-academico.mjs';
import {
  horariosParaCeldaCalendario,
  nombreMateriaEnCalendario,
  ordenarHorariosCalendario,
  rangoHorarioCalendario,
  semanasCalendarioDelMes
} from '../src/lib/calendario-celda.ts';

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

test('nombreMateriaEnCalendario abrevia títulos largos de la comisión', () => {
  assert.equal(
    nombreMateriaEnCalendario('(V.TUCS…) Conceptos de Desarrollo de Software'),
    'Desarrollo de software'
  );
  assert.equal(nombreMateriaEnCalendario('Gestión de Activos de la Información'), 'Gestión de activos');
  assert.equal(nombreMateriaEnCalendario('Sistemas de Gestión de la Seguridad'), 'SGSI');
});

test('Auditoría SI y SGSI no se mezclan', () => {
  assert.equal(nombreMateriaEnCalendario('Auditorías de Seguridad de la Información'), 'Auditoría SI');
  assert.equal(
    nombreMateriaEnCalendario('Sistemas de Gestión de Seguridad de la Información (Marcos Normativos)'),
    'SGSI'
  );
});

test('horariosParaCeldaCalendario deja un chip por materia y por nombre+horario', () => {
  const lista = horariosParaCeldaCalendario(
    [
      { materia_id: 'a', hora_inicio: '19:00', hora_fin: '20:30', id: '1' },
      { materia_id: 'a', hora_inicio: '19:00', hora_fin: '20:30', id: '2' },
      { materia_id: 'b', hora_inicio: '19:00', hora_fin: '20:30', id: '3' }
    ],
    (id) => (id === 'a' ? 'Conceptos de Desarrollo de Software' : 'Conceptos de Desarrollo de Software')
  );
  assert.equal(lista.length, 1);
});

test('ordenarHorariosCalendario y semanas del mes', () => {
  const ordenados = ordenarHorariosCalendario([
    { hora_inicio: '19:00' },
    { hora_inicio: '17:00' }
  ]);
  assert.equal(ordenados[0].hora_inicio, '17:00');
  assert.equal(rangoHorarioCalendario('17:00', '18:30'), '17:00–18:30');
  const semanas = semanasCalendarioDelMes([null, null, new Date(2026, 8, 1), new Date(2026, 8, 2)]);
  assert.equal(semanas.length, 1);
  assert.equal(semanas[0].length, 4);
});

test('el calendario académico incluye todos los días de inscripción y examen', () => {
  const eventos = eventosAcademicosParaFecha('2026-02-03', CALENDARIO_ACADEMICO_2026);
  assert.equal(eventos.length, 1);
  assert.match(eventos[0].titulo, /inscripción al 1\.er llamado/i);
  assert.equal(eventosAcademicosParaFecha('2026-02-06', CALENDARIO_ACADEMICO_2026).length, 0);
});

test('la fuente institucional contiene rangos válidos y cubre los dos llamados del Turno 5', () => {
  const ids = new Set(CALENDARIO_ACADEMICO_2026.map((evento) => evento.id));
  assert.equal(ids.size, CALENDARIO_ACADEMICO_2026.length);
  assert.ok(CALENDARIO_ACADEMICO_2026.every((evento) => evento.anio === 2026 && evento.fecha_hasta >= evento.fecha_desde));
  assert.ok(CALENDARIO_ACADEMICO_2026.some((evento) => evento.titulo === '1.er llamado · Turno 5'
    && evento.fecha_desde === '2026-11-30' && evento.fecha_hasta === '2026-12-05'));
  assert.ok(CALENDARIO_ACADEMICO_2026.some((evento) => evento.titulo === '2.º llamado · Turno 5'
    && evento.fecha_desde === '2026-12-14' && evento.fecha_hasta === '2026-12-19'));
});

test('enero muestra hitos globales sin replicar la cursada semanal', () => {
  const fecha = new Date(2026, 0, 19);
  assert.equal(esRecesoDeEnero(fecha), true);
  assert.equal(eventosAcademicosParaFecha('2026-01-19', CALENDARIO_ACADEMICO_2026).length, 1);
  assert.equal(esRecesoDeEnero(new Date(2026, 1, 1)), false);
});

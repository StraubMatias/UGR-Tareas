import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificarEventosCalendario,
  esRecordatorioDeActividad,
  extraerEventosCalendario,
  nombreActividadDeEvento
} from '../lib/calendario.mjs';

const HTML = `
<div data-type="event">
  <div class="card rounded">
    <h3 class="name">Enlace a la clase sincrónica de los Miércoles a las 19 Hs</h3>
    <span class="date" data-timestamp="1790200800">miércoles, 23 septiembre, 19:00</span>
    <span class="date" data-timestamp="1790205600">20:20</span>
  </div>
</div>
<div data-type="event">
  <div class="card rounded">
    <h3 class="name">Enlace a la clase sincrónica de los Miércoles a las 19 Hs</h3>
    <span class="date" data-timestamp="1790805600">miércoles, 30 septiembre, 19:00</span>
    <span class="date" data-timestamp="1790810400">20:20</span>
  </div>
</div>
<div data-type="event">
  <div class="card rounded">
    <h3 class="name">Vencimiento de Auditorías de SI, UII Tarea nro.1</h3>
    <span class="date" data-timestamp="1759017600">sábado, 27 septiembre, 23:55</span>
  </div>
</div>
<div data-type="event">
  <div class="card rounded">
    <h3 class="name">Se cierra Evaluación de avance de medio cursado</h3>
    <span class="date" data-timestamp="1762000000">sábado, 1 noviembre</span>
  </div>
</div>
`;

test('extraerEventosCalendario lee título, día argentino y horario', () => {
  const eventos = extraerEventosCalendario(HTML);
  assert.equal(eventos.length, 4);
  assert.equal(eventos[0].titulo, 'Enlace a la clase sincrónica de los Miércoles a las 19 Hs');
  assert.equal(eventos[0].fecha, '2026-09-23');
  assert.equal(eventos[0].horaInicio, '19:00');
  assert.equal(eventos[0].horaFin, '20:20');
  assert.equal(eventos[0].dia, 3);
});

test('el vencimiento completa la tarea y la clase repetida entra al cronograma y al horario', () => {
  const eventos = extraerEventosCalendario(HTML);
  const { fechas, cronograma, horarios } = clasificarEventosCalendario({
    eventos,
    materiaId: 'm1',
    actividades: [
      { id: 't1', nombre: 'Auditorías de SI, UII Tarea nro.1', tabla: 'tareas' },
      { id: 'p1', nombre: 'Evaluación de avance de medio cursado', tabla: 'parciales' }
    ]
  });
  assert.equal(fechas.length, 2);
  assert.equal(fechas.find((fecha) => fecha.id === 't1').campo, 'fin');
  assert.equal(fechas.find((fecha) => fecha.id === 'p1').tabla, 'parciales');
  assert.equal(cronograma.length, 2);
  assert.equal(cronograma[0].materiaId, 'm1');
  assert.equal(cronograma[0].tipo, 'clase');
  assert.equal(horarios.length, 1);
  assert.equal(horarios[0].dia, '3');
  assert.equal(horarios[0].horaInicio, '19:00');
  assert.equal(horarios[0].horaFin, '20:20');
});

test('el mes del campus también entra, con la fecha del día', () => {
  const eventos = extraerEventosCalendario(`
    <table><tr>
      <td data-region="day" data-day-timestamp="1756684800">
        <a data-action="view-event" title="Link de Clase Sincrónica" href="/mod/zoom/view.php?id=1"><span class="eventname">Link de Clase Sincrónica</span></a>
      </td>
    </tr></table>
  `);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].titulo, 'Link de Clase Sincrónica');
  assert.ok(eventos[0].fecha);
});

test('un vencimiento sin actividad conocida igual se muestra en el cronograma', () => {
  assert.equal(esRecordatorioDeActividad('Vencimiento de TP final'), true);
  assert.equal(nombreActividadDeEvento('Se cierra Cuestionario: Webinar de riesgo'), 'Webinar de riesgo');
  assert.equal(esRecordatorioDeActividad('Clase sincrónica semanal'), false);
  const { cronograma, fechas } = clasificarEventosCalendario({
    eventos: [{ titulo: 'Vencimiento de TP que no está cargado', fecha: '2026-10-02', horaInicio: '23:55', dia: 5 }],
    actividades: [],
    materiaId: 'm1'
  });
  assert.equal(fechas.length, 0);
  assert.equal(cronograma.length, 1);
  assert.match(cronograma[0].titulo, /TP que no está cargado/);
});

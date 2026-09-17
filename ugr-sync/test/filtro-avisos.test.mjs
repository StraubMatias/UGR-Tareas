import test from 'node:test';
import assert from 'node:assert/strict';
import { analizarAvisosParaCronograma, filtrarEventosDeAviso } from '../lib/avisos.mjs';

const casos = [
  ['Cancelación', 'Mañana no hay clases.', 'sin_clases'],
  ['Parcial', 'El parcial será el 21 de septiembre.', 'examen'],
  ['Recuperatorio', 'El recuperatorio será el 21 de septiembre.', 'examen'],
  ['Entrega de tarea', 'La entrega del TP es el 21 de septiembre.', 'entrega'],
  ['Tarea', 'La tarea vence el 21 de septiembre.', 'entrega'],
  ['Apertura de tarea', 'Apertura de la tarea el 21 de septiembre.', 'entrega'],
  ['Nueva clase', 'Mañana tendremos una clase extra.', 'clase'],
  ['Clase de consulta', 'Mañana tendremos una clase de consulta.', 'consulta'],
  ['Bienvenida', 'Bienvenidos a la materia.', null],
  ['Material', 'Mañana subiremos material de la clase.', null],
  ['Grabación', 'La grabación de la clase estará disponible mañana.', null],
  ['Notas', 'Mañana publicaremos las notas del parcial.', null],
  ['Consulta general', 'Mañana responderé las consultas del foro.', null],
  ['Exposición', 'La exposición será el 21 de septiembre.', null],
  ['Examen final', 'El examen final será el 21 de septiembre.', null],
  ['Sin fecha', 'Habrá una nueva clase, fecha a confirmar.', null],
  ['Cancelación pasada', 'El 14 de septiembre no hay clases.', null]
];

for (const [titulo, contenido, tipo] of casos) {
  test(`filtro de avisos: ${titulo}`, () => {
    const aviso = { titulo, contenido, hoy: '2026-09-17', fechaPublicacion: '2026-09-17' };
    const eventos = filtrarEventosDeAviso(aviso, analizarAvisosParaCronograma(aviso));
    if (tipo) {
      assert.ok(eventos.length > 0);
      assert.ok(eventos.every((evento) => evento.tipo === tipo));
    } else {
      assert.deepEqual(eventos, []);
    }
  });
}

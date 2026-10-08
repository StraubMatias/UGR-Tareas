import test from 'node:test';
import assert from 'node:assert/strict';
import {
  elegirEnlaceZoomParaHorarios,
  inferirHorarioDesdeTituloZoom,
  puntuarEnlaceZoomContraCursada
} from '../lib/zoom-cursada.mjs';

test('inferirHorarioDesdeTituloZoom lee día y hora del título del campus', () => {
  const h = inferirHorarioDesdeTituloZoom('Enlace a la clase sincrónica de los Miércoles a las 19 Hs');
  assert.equal(h.dia, 3);
  assert.equal(h.horaInicio, '19:00');
});

test('elige el zoom de las 17:00 para cursada lunes 17:00-18:30', () => {
  const horarios = [{ dia: '1', hora_inicio: '17:00', hora_fin: '18:30' }];
  const enlaces = [
    {
      titulo: 'Clase Miércoles 19 hs',
      urlJoin: 'https://zoom.us/j/aaa',
      dia: 3,
      horaInicio: '19:00'
    },
    {
      titulo: 'Link lunes 16:50',
      urlJoin: 'https://zoom.us/j/bbb?pwd=x',
      dia: 1,
      horaInicio: '16:50',
      horaFin: '18:30'
    }
  ];
  const url = elegirEnlaceZoomParaHorarios(enlaces, horarios);
  assert.equal(url, 'https://zoom.us/j/bbb?pwd=x');
  assert.ok(puntuarEnlaceZoomContraCursada(enlaces[1], { dia: 1, inicio: 17 * 60, fin: 18 * 60 + 30 })
    > puntuarEnlaceZoomContraCursada(enlaces[0], { dia: 1, inicio: 17 * 60, fin: 18 * 60 + 30 }));
});

test('un solo enlace se replica a todos los días de horario', () => {
  const horarios = [
    { dia: '1', hora_inicio: '17:00', hora_fin: '18:30' },
    { dia: '1', hora_inicio: '17:00', hora_fin: '18:30' }
  ];
  const url = elegirEnlaceZoomParaHorarios(
    [{ titulo: 'Zoom cursada', urlJoin: 'https://zoom.us/j/unico', dia: 1, horaInicio: '16:55' }],
    horarios
  );
  assert.equal(url, 'https://zoom.us/j/unico');
});

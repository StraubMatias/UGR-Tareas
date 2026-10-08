import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aportesRankingDeTarea,
  fechaEntregaParaRanking,
  multiplicadorPuntosTarea,
  parseNotaEscalaDiez,
  puntosDeNotaParcial,
  puntosRankingDeTarea
} from '../src/core/cursada.ts';
import { calcularRankingTablero } from '../src/lib/ranking-tablero.ts';

test('puntosDeNotaParcial usa la nota entera (sin dividir por 10)', () => {
  assert.equal(puntosDeNotaParcial(9), 9);
  assert.equal(puntosDeNotaParcial('8,5'), 8.5);
});

test('parcial suma nota completa al ranking; recuperatorio no suma', () => {
  const materias = [{
    id: 'dev',
    nombre: 'Conceptos',
    tareas: []
  }];
  const parciales = [
    { id: 'p1', materia_id: 'dev', nombre: '1er parcial', fecha: '2026-09-01' },
    { id: 'pr', materia_id: 'dev', nombre: 'Recuperatorio 1er parcial', fecha: '2026-10-01' }
  ];
  const notas = [
    { parcial_id: 'p1', alumno: 'Ana', nota: 9 },
    { parcial_id: 'pr', alumno: 'Ana', nota: 10 }
  ];
  const ranking = calcularRankingTablero({
    alumnosRanking: ['Ana'],
    materiasDelRanking: materias,
    materias,
    parciales,
    notas
  });
  assert.equal(ranking[0].puntos, 9);
  assert.equal(ranking[0].parcialesConPuntaje.length, 1);
});

test('tarea con nota aplica multiplicador; parcial no', () => {
  const materias = [{
    id: 'm',
    nombre: 'M',
    tareas: [{
      id: 't1',
      nombre: 'TP',
      conNota: true,
      inicio: '2026-01-01',
      fin: '2026-12-01',
      notas: { Ana: 10 },
      completadoPor: ['Ana'],
      completadoEn: { Ana: '2026-01-03T12:00:00' }
    }]
  }];
  const ranking = calcularRankingTablero({
    alumnosRanking: ['Ana'],
    materiasDelRanking: materias,
    materias,
    parciales: [],
    notas: []
  });
  assert.equal(ranking[0].puntos, 10);
});

test('el total del ranking coincide con la suma del desglose', () => {
  const materias = [{
    id: 'm',
    nombre: 'M',
    tareas: [
      {
        id: 'a1',
        nombre: 'Foro',
        conNota: false,
        inicio: '2026-01-01',
        fin: '2026-12-01',
        completadoPor: ['Ana'],
        completadoEn: { Ana: '2026-01-02' }
      },
      {
        id: 't1',
        nombre: 'TP',
        conNota: true,
        inicio: '2026-01-01',
        fin: '2026-12-01',
        notas: { Ana: 8 },
        completadoPor: ['Ana'],
        completadoEn: { Ana: '2026-01-02' }
      }
    ]
  }];
  const parciales = [{ id: 'p1', materia_id: 'm', nombre: '1er parcial', fecha: '2026-09-01' }];
  const notas = [{ parcial_id: 'p1', alumno: 'Ana', nota: 7 }];
  const ranking = calcularRankingTablero({
    alumnosRanking: ['Ana'],
    materiasDelRanking: materias,
    materias,
    parciales,
    notas
  });
  const item = ranking[0];
  const suma = item.tareasConPuntaje.reduce((s, x) => s + x.puntos, 0)
    + item.parcialesConPuntaje.reduce((s, x) => s + x.puntos, 0);
  assert.equal(item.puntos, suma);
  assert.equal(item.puntos, 1 + 8 + 7);
});

test('entrega múltiple: entrega 1 cerrada con 10 suma aunque entrega 2 esté abierta', () => {
  const tarea = {
    id: 'e',
    nombre: 'Entregas del trabajo práctico- Marco normativo',
    conNota: true,
    inicio: '2026-01-01',
    fin: '2026-12-31',
    notas: {},
    completadoPor: ['Ana'],
    completadoEn: { Ana: '2026-01-05T12:00:00.000Z' },
    entregas: {
      Ana: [
        {
          numero: 1,
          indiceEntrega: 1,
          esActiva: false,
          estado: 'Calificado',
          nota: '10',
          sincronizadoEn: '2026-01-05T12:00:00.000Z'
        },
        {
          numero: 2,
          indiceEntrega: 2,
          esActiva: true,
          estado: 'Reabierta',
          nota: null,
          pendiente: true
        }
      ]
    }
  };
  assert.equal(puntosRankingDeTarea(tarea, 'Ana'), 10);
  assert.equal(aportesRankingDeTarea(tarea, 'Ana').length, 1);
  assert.match(aportesRankingDeTarea(tarea, 'Ana')[0].nombre, /Entrega 1/);
});

test('entrega cerrada usa fecha de entrega real aunque el sync del tablero sea después del cierre', () => {
  const tarea = {
    id: 'e',
    nombre: 'Entregas del trabajo práctico- caso',
    conNota: true,
    inicio: '2026-09-04',
    fin: '2026-10-07',
    notas: {},
    completadoPor: ['Matute'],
    completadoEn: { Matute: '2026-09-07 01:39:50' },
    entregas: {
      Matute: [
        {
          numero: 1,
          indiceEntrega: 1,
          esActiva: false,
          estado: 'Calificado',
          nota: '10',
          sincronizadoEn: '2026-10-08T23:26:42.476Z'
        },
        {
          numero: 2,
          indiceEntrega: 2,
          esActiva: true,
          estado: 'Reabierta',
          nota: null,
          pendiente: true
        }
      ]
    }
  };
  assert.equal(puntosRankingDeTarea(tarea, 'Matute'), 10);
});

test('el ranking usa la fecha de entrega, no la de carga de nota manual/sync', () => {
  const tarea = {
    id: 't',
    nombre: 'TP',
    conNota: true,
    inicio: '2026-09-04',
    fin: '2026-10-07',
    notas: { Ana: 10 },
    completadoPor: ['Ana'],
    completadoEn: { Ana: '2026-09-07 12:00:00' },
    notaCargadaEn: { Ana: '2026-10-08T23:00:00.000Z' }
  };
  assert.equal(fechaEntregaParaRanking(tarea, 'Ana'), '2026-09-07 12:00:00');
  assert.equal(multiplicadorPuntosTarea(tarea, 'Ana', fechaEntregaParaRanking(tarea, 'Ana')), 1);
  assert.equal(multiplicadorPuntosTarea(tarea, 'Ana', tarea.notaCargadaEn.Ana), 0);
});

test('notas duplicadas del mismo parcial no duplican puntos', () => {
  const materias = [{ id: 'm', nombre: 'M', tareas: [] }];
  const parciales = [{ id: 'p1', materia_id: 'm', nombre: '1er parcial', fecha: '2026-09-01' }];
  const notas = [
    { parcial_id: 'p1', alumno: 'Ana', nota: 6 },
    { parcial_id: 'p1', alumno: 'Ana', nota: 9 }
  ];
  const ranking = calcularRankingTablero({
    alumnosRanking: ['Ana'],
    materiasDelRanking: materias,
    materias,
    parciales,
    notas
  });
  assert.equal(ranking[0].puntos, 9);
  assert.equal(ranking[0].parcialesConPuntaje.length, 1);
});

test('parseNotaEscalaDiez normaliza calificaciones sobre 100', () => {
  assert.equal(parseNotaEscalaDiez(85), 8.5);
  assert.equal(parseNotaEscalaDiez(100), 10);
});

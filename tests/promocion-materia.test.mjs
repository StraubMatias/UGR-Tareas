import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reglaPromocionEfectiva,
  evaluarPromocionParcialesYTps,
  evaluarParcialesCuatrimestre,
  evaluarPromocionActivosPorcentaje,
  evaluarPromocionTpPorcentajeNota,
  evaluarPromocionRiesgosTps
} from '../src/lib/promocion-materia.ts';

const materiaConceptos = {
  id: 'dev',
  nombre: 'CONCEPTOS',
  condiciones: 'Para promocionar: los trabajos prácticos con 8 y cada parcial con 8.',
  notaMinimaRegularizar: 6,
  notaMinimaPromocionar: 8,
  reglaPromocion: 'metodologia',
  tareas: []
};

test('reglaPromocionEfectiva detecta parciales + TPs en metodología', () => {
  assert.equal(reglaPromocionEfectiva(materiaConceptos), 'parciales_y_tps');
});

test('promociona con 1er parcial 8 y TPs 8 aunque falte el 2do parcial', () => {
  const parciales = [
    { id: 'p1', materia_id: 'dev', nombre: '1er Parcial', fecha: '2026-09-20' },
    { id: 'p2', materia_id: 'dev', nombre: '2do Parcial', fecha: '2026-12-01' }
  ];
  const notas = [{ parcial_id: 'p1', alumno: 'Ana', nota: 8 }];
  const tps = [
    { id: 't1', nombre: 'TP1', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 8 }, inicio: 'x', fin: 'x', unidad: 1, completadoPor: [] },
    { id: 't2', nombre: 'TP2', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 9 }, inicio: 'x', fin: 'x', unidad: 2, completadoPor: [] }
  ];
  const estado = evaluarPromocionParcialesYTps(materiaConceptos, 'Ana', parciales, notas, tps);
  assert.equal(estado.texto, 'Promociona');
});

test('promociona solo con TPs 10 sin parciales rendidos', () => {
  const parciales = [
    { id: 'p1', materia_id: 'dev', nombre: '1er Parcial', fecha: '2026-10-15' },
    { id: 'p2', materia_id: 'dev', nombre: '2do Parcial', fecha: '2026-12-01' }
  ];
  const tps = [
    { id: 't1', nombre: 'TP1', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 10 }, inicio: 'x', fin: 'x', unidad: 1, completadoPor: [] },
    { id: 't2', nombre: 'TP2', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 10 }, inicio: 'x', fin: 'x', unidad: 2, completadoPor: [] }
  ];
  const estado = evaluarPromocionParcialesYTps(materiaConceptos, 'Ana', parciales, [], tps);
  assert.equal(estado.texto, 'Promociona');
});

test('regulariza con parcial 6 y TPs en promoción', () => {
  const parciales = [
    { id: 'p1', materia_id: 'dev', nombre: '1er Parcial', fecha: '2026-09-20' }
  ];
  const notas = [{ parcial_id: 'p1', alumno: 'Ana', nota: 6 }];
  const tps = [
    { id: 't1', nombre: 'TP1', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 10 }, inicio: 'x', fin: 'x', unidad: 1, completadoPor: [] }
  ];
  const estado = evaluarPromocionParcialesYTps(materiaConceptos, 'Ana', parciales, notas, tps);
  assert.equal(estado.texto, 'Regulariza');
});

test('desaprueba con parcial 4 aunque TPs estén bien', () => {
  const parciales = [
    { id: 'p1', materia_id: 'dev', nombre: '1er Parcial', fecha: '2026-09-20' }
  ];
  const notas = [{ parcial_id: 'p1', alumno: 'Ana', nota: 4 }];
  const tps = [
    { id: 't1', nombre: 'TP1', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 10 }, inicio: 'x', fin: 'x', unidad: 1, completadoPor: [] }
  ];
  const estado = evaluarPromocionParcialesYTps(materiaConceptos, 'Ana', parciales, notas, tps);
  assert.equal(estado.texto, 'Desaprueba');
});

test('activos: parcial y tareas suman al porcentaje 75/90', () => {
  const materia = {
    id: 'act',
    nombre: 'ACTIVOS',
    notaMinimaRegularizar: 75,
    notaMinimaPromocionar: 90,
    reglaPromocion: 'activos_porcentaje',
    tareas: [
      { id: 't1', nombre: 'T1', inicio: '2026-08-01', fin: '2026-12-01', conNota: true, notas: { Ana: 8 }, completadoPor: [] },
      { id: 't2', nombre: 'T2', inicio: '2026-08-01', fin: '2026-12-01', conNota: true, notas: { Ana: 8 }, completadoPor: [] },
      { id: 't3', nombre: 'T3', inicio: '2026-08-01', fin: '2026-12-01', conNota: true, notas: {}, completadoPor: [] }
    ]
  };
  const parciales = [{ id: 'p1', materia_id: 'act', nombre: '1er', fecha: '2026-09-01' }];
  const notas = [{ parcial_id: 'p1', alumno: 'Ana', nota: 7 }];
  const r = evaluarPromocionActivosPorcentaje(materia, 'Ana', parciales, notas, materia.tareas);
  assert.equal(r.texto, 'Regulariza');
});

test('SGSI: promociona con entregas calificadas en 8 aunque falten sin nota', () => {
  const materia = {
    id: 'sgi',
    notaMinimaRegularizar: 75,
    notaMinimaPromocionar: 8,
    reglaPromocion: 'tp_porcentaje_nota',
    tareas: []
  };
  const tps = [
    { id: 'e1', nombre: 'E1', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 10 }, inicio: 'x', fin: 'x', completadoPor: [] },
    { id: 'e2', nombre: 'E2', tipo: 'trabajo_practico', conNota: true, notas: {}, inicio: 'x', fin: 'x', completadoPor: [] },
    { id: 'e3', nombre: 'E3', tipo: 'trabajo_practico', conNota: true, notas: {}, inicio: 'x', fin: 'x', completadoPor: [] },
    { id: 'e4', nombre: 'E4', tipo: 'trabajo_practico', conNota: true, notas: {}, inicio: 'x', fin: 'x', completadoPor: [] }
  ];
  assert.equal(evaluarPromocionTpPorcentajeNota(materia, 'Ana', tps).texto, 'Promociona');
});

test('riesgos: cuestionarios con nota cuentan para promocionar', () => {
  const materia = { id: 'egr', notaMinimaRegularizar: 6, notaMinimaPromocionar: 8, reglaPromocion: 'riesgos_tps', tareas: [] };
  const tareas = [
    { id: 'q1', nombre: 'Cuestionario 1', conNota: true, notas: { Ana: 9 }, inicio: 'x', fin: 'x', completadoPor: [] },
    { id: 'q2', nombre: 'Cuestionario 2', conNota: true, notas: { Ana: 8 }, inicio: 'x', fin: 'x', completadoPor: [] },
    { id: 'tp', nombre: 'TP final', tipo: 'trabajo_practico', conNota: true, notas: { Ana: 8 }, inicio: 'x', fin: 'x', completadoPor: [] }
  ];
  assert.equal(evaluarPromocionRiesgosTps(materia, 'Ana', tareas).texto, 'Promociona');
});

test('solo regulariza si parcial rendido tiene 7', () => {
  const parciales = [
    { id: 'p1', materia_id: 'dev', nombre: '1er Parcial', fecha: '2026-09-20' }
  ];
  const notas = [{ parcial_id: 'p1', alumno: 'Ana', nota: 7 }];
  const r = evaluarParcialesCuatrimestre(parciales, 'dev', 'Ana', notas, 6, 8);
  assert.equal(r.estado?.texto, 'Regulariza');
});

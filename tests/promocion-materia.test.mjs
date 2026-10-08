import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reglaPromocionEfectiva,
  evaluarPromocionParcialesYTps,
  evaluarParcialesCuatrimestre
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

test('solo regulariza si parcial rendido tiene 7', () => {
  const parciales = [
    { id: 'p1', materia_id: 'dev', nombre: '1er Parcial', fecha: '2026-09-20' }
  ];
  const notas = [{ parcial_id: 'p1', alumno: 'Ana', nota: 7 }];
  const r = evaluarParcialesCuatrimestre(parciales, 'dev', 'Ana', notas, 6, 8);
  assert.equal(r.estado?.texto, 'Regulariza');
});

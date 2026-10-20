import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claveTipoDesdeNombreSiu,
  diasDeValidez,
  esConstanciaVigente,
  etiquetaVigencia,
  filtrarConstanciasVigentes,
  normalizarNombreConstancia,
  parsearFechaSiu
} from '../src/lib/constancias-vigentes.ts';

const HOY = new Date(2026, 9, 19); // 19/10/2026

function solicitud(vencimiento, extra = {}) {
  return {
    constancia: 'Constancia de Alumno Regular',
    fecha: '20/09/2026',
    presentar: 'Trabajo',
    solicitadoEn: 'Autogestión',
    copias: '1',
    estado: 'Online',
    vencimiento,
    comprobante: '',
    ...extra
  };
}

test('parsearFechaSiu lee la fecha dd/mm/aaaa de SIU', () => {
  const fecha = parsearFechaSiu('24/08/2026');
  assert.equal(fecha?.getFullYear(), 2026);
  assert.equal(fecha?.getMonth(), 7);
  assert.equal(fecha?.getDate(), 24);
});

test('parsearFechaSiu rechaza fechas imposibles o vacías', () => {
  assert.equal(parsearFechaSiu(''), null);
  assert.equal(parsearFechaSiu('Sin fecha'), null);
  assert.equal(parsearFechaSiu('2026-08-24'), null);
  assert.equal(parsearFechaSiu('32/08/2026'), null);
  assert.equal(parsearFechaSiu('31/02/2026'), null);
});

test('esConstanciaVigente acepta la que vence hoy o más adelante', () => {
  assert.equal(esConstanciaVigente(solicitud('19/10/2026'), HOY), true);
  assert.equal(esConstanciaVigente(solicitud('19/11/2026'), HOY), true);
  assert.equal(esConstanciaVigente(solicitud('24/08/2026'), HOY), false);
});

test('esConstanciaVigente no descarta la que no tiene fecha de vencimiento', () => {
  assert.equal(esConstanciaVigente(solicitud(''), HOY), true);
});

test('diasDeValidez cuenta los días que quedan', () => {
  assert.equal(diasDeValidez(solicitud('19/10/2026'), HOY), 0);
  assert.equal(diasDeValidez(solicitud('20/10/2026'), HOY), 1);
  assert.equal(diasDeValidez(solicitud('19/11/2026'), HOY), 31);
  assert.equal(diasDeValidez(solicitud('18/10/2026'), HOY), -1);
  assert.equal(diasDeValidez(solicitud(''), HOY), null);
});

test('etiquetaVigencia explica en palabras cuándo vence', () => {
  assert.equal(etiquetaVigencia(solicitud('19/10/2026'), HOY), 'Vence hoy');
  assert.equal(etiquetaVigencia(solicitud('20/10/2026'), HOY), 'Vence mañana');
  assert.equal(etiquetaVigencia(solicitud('25/10/2026'), HOY), 'Vence en 6 días');
  assert.equal(etiquetaVigencia(solicitud('19/12/2026'), HOY), 'Vence el 19/12/2026');
  assert.equal(etiquetaVigencia(solicitud('18/10/2026'), HOY), 'Vencida');
  assert.equal(etiquetaVigencia(solicitud(''), HOY), 'Sin fecha de vencimiento');
});

test('filtrarConstanciasVigentes deja solo las que sirven hoy', () => {
  const lista = [
    solicitud('24/08/2026'),
    solicitud('19/12/2026'),
    solicitud('19/10/2026')
  ];
  const vigentes = filtrarConstanciasVigentes(lista, HOY);
  assert.equal(vigentes.length, 2);
  assert.deepEqual(vigentes.map((s) => s.vencimiento), ['19/12/2026', '19/10/2026']);
});

test('claveTipoDesdeNombreSiu reconoce los tipos de constancia de SIU', () => {
  assert.equal(claveTipoDesdeNombreSiu('Constancia de Alumno Regular'), 'alumno_regular');
  assert.equal(claveTipoDesdeNombreSiu('Constancia de Examen Final'), 'examen_final');
  assert.equal(claveTipoDesdeNombreSiu('Constancia de Promedio Académico'), 'promedio_academico');
  assert.equal(claveTipoDesdeNombreSiu('Constancia de Promedio Académico sin aplazos'), 'promedio_sin_aplazos');
  assert.equal(claveTipoDesdeNombreSiu('Constancia de Examen Parcial'), null);
  assert.equal(claveTipoDesdeNombreSiu(''), null);
});

test('normalizarNombreConstancia quita acentos y la palabra constancia', () => {
  assert.equal(normalizarNombreConstancia('Constancia de Promedio Académico'), 'promedio_academico');
  assert.equal(normalizarNombreConstancia('Constancia de Alumno Regular'), 'alumno_regular');
});

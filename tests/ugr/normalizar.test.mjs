import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coincidirMateria,
  inferirTipoTarea,
  limpiarNombreCursoParaBusqueda,
  limpiarTextoParaBusqueda,
  normalizarNombre,
  parsearFechaMoodle,
  parsearTimestampMoodle,
  parsearUnidadMoodle
} from '../../src/lib/ugr/normalizar.mjs';

test('parsearFechaMoodle convierte fechas ISO y en español', () => {
  assert.equal(parsearFechaMoodle('2026-09-25T23:55:00+00:00'), '2026-09-25');
  assert.equal(parsearFechaMoodle('2026-09-25'), '2026-09-25');
  assert.equal(parsearFechaMoodle('viernes, 25 de septiembre de 2026, 23:55'), '2026-09-25');
  assert.equal(parsearFechaMoodle('25/09/2026'), '2026-09-25');
  assert.equal(parsearFechaMoodle(''), null);
  assert.equal(parsearFechaMoodle('Sin fecha'), null);
  assert.equal(parsearFechaMoodle('texto sin fecha'), null);
});

test('parsearTimestampMoodle convierte timestamp a YYYY-MM-DD', () => {
  const ts = new Date('2026-10-02T23:55:00Z').getTime();
  assert.equal(parsearTimestampMoodle(ts), '2026-10-02');
  assert.equal(parsearTimestampMoodle(null), null);
  assert.equal(parsearTimestampMoodle('nope'), null);
});

test('parsearUnidadMoodle convierte rótulos de unidad de Moodle a número', () => {
  assert.equal(parsearUnidadMoodle('Unidad II'), 2);
  assert.equal(parsearUnidadMoodle('Unidad 2'), 2);
  assert.equal(parsearUnidadMoodle('Unidad nro. 3'), 3);
  assert.equal(parsearUnidadMoodle('Unidad IV'), 4);
  assert.equal(parsearUnidadMoodle('UII'), 2);
  assert.equal(parsearUnidadMoodle('U. II'), 2);
  assert.equal(parsearUnidadMoodle('Trabajo nro. 2, UII.'), 2);
  assert.equal(parsearUnidadMoodle('Auditorías de SI, UII Tarea nro.1'), 2);
  assert.equal(parsearUnidadMoodle('Sin unidad'), null);
  assert.equal(parsearUnidadMoodle(''), null);
  assert.equal(parsearUnidadMoodle(null), null);
});

test('inferirTipoTarea detecta foros, TPs y actividades', () => {
  assert.equal(inferirTipoTarea('Foro de presentación'), 'foro');
  assert.equal(inferirTipoTarea('TP 1: contexto organizacional'), 'trabajo_practico');
  assert.equal(inferirTipoTarea('Trabajo práctico integrador'), 'trabajo_practico');
  assert.equal(inferirTipoTarea('Actividad de repaso'), 'actividad');
});

test('limpiarTextoParaBusqueda normaliza mayúsculas y acentos', () => {
  assert.equal(limpiarTextoParaBusqueda('  GESTIÓN DE ACTIVOS  '), 'gestion de activos');
  assert.equal(limpiarTextoParaBusqueda('Evaluación y Riesgos'), 'evaluacion y riesgos');
});

test('limpiarNombreCursoParaBusqueda descarta el prefijo de versión', () => {
  assert.equal(limpiarNombreCursoParaBusqueda('(V.TUCS.1.07.2) AUDITORÍAS DE SEGURIDAD DE LA I...'), 'auditorias de seguridad de la i');
  assert.equal(limpiarNombreCursoParaBusqueda('(V.1.7.2) CIBERDELITOS'), 'ciberdelitos');
  assert.equal(limpiarNombreCursoParaBusqueda('V 1.7.2 Gestión de Activos de la Información'), 'gestion de activos de la informacion');
});

test('normalizarNombre recorta muy largos y usa fallback', () => {
  assert.equal(normalizarNombre({ nombre: '  Hola   mundo  ', cursoNombre: 'X' }), 'Hola mundo');
  assert.equal(normalizarNombre({ nombre: '', cursoNombre: 'Materia' }), 'Materia');
  const largo = 'a'.repeat(250);
  assert.ok(normalizarNombre({ nombre: largo, cursoNombre: '' }).length <= 200);
});

test('coincidirMateria mapea curso a materia ignorando prefijos de carrera', () => {
  const materias = [
    { id: '1', nombre: 'GESTIÓN DE ACTIVOS' },
    { id: '2', nombre: 'EVALUACIÓN Y GESTIÓN DE RIESGOS' },
    { id: '3', nombre: 'SISTEMAS DE GESTIÓN DE SEGURIDAD' }
  ];

  const r1 = coincidirMateria('Tecnicatura - GESTIÓN DE ACTIVOS DE LA INFORMACIÓN', materias);
  assert.equal(r1?.materia.id, '1');

  const r2 = coincidirMateria('EVALUACIÓN Y GESTIÓN DE RIESGOS', materias);
  assert.equal(r2?.materia.id, '2');

  const r3 = coincidirMateria('SISTEMAS DE GESTIÓN DE SEGURIDAD DE LA INFORMACIÓN', materias);
  assert.equal(r3?.materia.id, '3');
});

test('coincidirMateria ignora acentos y devuelve null si no hay match', () => {
  const materias = [{ id: '1', nombre: 'GESTIÓN DE ACTIVOS' }];
  assert.equal(coincidirMateria('Gestion de Activos de la Información', materias)?.materia.id, '1');
  assert.equal(coincidirMateria('Historia del Arte', materias), null);
  assert.equal(coincidirMateria('', materias), null);
});

test('coincidirMateria mapea los cursos reales de UGR Virtual (prefijo V.TUCS.x.y.z)', () => {
  const materias = [
    { id: 'a', nombre: 'AUDITORÍAS DE SEGURIDAD DE LA INFORMACIÓN' },
    { id: 'b', nombre: 'SISTEMAS DE GESTIÓN DE SEGURIDAD DE LA INFORMACIÓN (MARCOS NORMATIVOS)' },
    { id: 'c', nombre: 'CIBERDELITOS' },
    { id: 'd', nombre: 'EVALUACIÓN Y GESTIÓN DE RIESGOS' },
    { id: 'e', nombre: 'GESTIÓN DE ACTIVOS DE LA INFORMACIÓN' }
  ];

  // Nombre completo tal como viene en la página del curso.
  const r1 = coincidirMateria('(V.TUCS.1.07.2) AUDITORÍAS DE SEGURIDAD DE LA INFORMACIÓN', materias);
  assert.equal(r1?.materia.id, 'a');

  const r2 = coincidirMateria('(V.TUCS.1.06.2) SISTEMAS DE GESTIÓN DE SEGURIDAD DE LA INFORMACIÓN (MARCOS NORMATIVOS)', materias);
  assert.equal(r2?.materia.id, 'b');

  const r3 = coincidirMateria('(V.TUCS.1.08.2) CIBERDELITOS', materias);
  assert.equal(r3?.materia.id, 'c');
});
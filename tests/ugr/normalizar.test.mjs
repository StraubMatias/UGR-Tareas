import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claveParcialParaEmparejar,
  claveTareaParaEmparejar,
  coincidirMateria,
  coincidirNombreTarea,
  coincidirParcial,
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

test('claveTareaParaEmparejar ignora el sufijo (FORO) que agrega el usuario', () => {
  assert.equal(
    claveTareaParaEmparejar('Hallazgos de la Semana (FORO)'),
    claveTareaParaEmparejar('Hallazgos de la Semana')
  );
  // El sufijo puede ir con mayúsculas/minúsculas y/o espacios internos.
  assert.equal(
    claveTareaParaEmparejar('Gobierno de Internet ( FORO )'),
    claveTareaParaEmparejar('Gobierno de Internet')
  );
  // No altera nombres de assigns ni foros cuyo título no termina en (FORO).
  assert.equal(claveTareaParaEmparejar('Contexto organizacional y activos de información'), 'contexto organizacional y activos de informacion');
  assert.equal(claveTareaParaEmparejar('Foro de presentación'), 'foro de presentacion');
});

test('coincidirNombreTarea tolera sufijos explicativos que agrega el usuario', () => {
  // Igual nombre → coincide.
  assert.equal(coincidirNombreTarea('Lea y responda- Vargas y Ollarves', 'Lea y responda- Vargas y Ollarves'), true);
  // Sufijo entre paréntesis agregado a mano: Moodle expone «Activos según INCIBE».
  assert.equal(coincidirNombreTarea('Activos según INCIBE (Video 5m)', 'Activos según INCIBE'), true);
  // Sufijo (FORO) ya cubierto por claveTareaParaEmparejar.
  assert.equal(coincidirNombreTarea('Hallazgos de la Semana (FORO)', 'Hallazgos de la Semana'), true);
  // Ignora acentos/mayúsculas.
  assert.equal(coincidirNombreTarea('GESTIÓN DE ACTIVOS', 'Gestión de Activos'), true);
  // Nombres cortos o sin relación no cruzan.
  assert.equal(coincidirNombreTarea('Contexto organizacional y activos de información', 'Trabajo práctico 1'), false);
  assert.equal(coincidirNombreTarea('Trabajo', 'Trabajo práctico integrador'), false); // demasiado corto
  assert.equal(coincidirNombreTarea('', 'Lea y responda'), false);
  assert.equal(coincidirNombreTarea(null, 'Lea y responda'), false);
});

test('coincidirNombreTarea conserva la distinción entre actividad y quiz con sufijo propio', () => {
  // «(Basadre)» y «(Marcos de Referencia)» son parte del nombre real de Moodle:
  // no deben colisionar entre ellos.
  assert.equal(coincidirNombreTarea('Lea y responda (Basadre)', 'Lea y responda (Basadre)'), true);
  assert.equal(coincidirNombreTarea('Lea y responda (Basadre)', 'Lea y responda (Marcos de Referencia)'), false);
});

test('claveParcialParaEmparejar ignora el día/hora que Moodle etiqueta en el anuncio', () => {
  // El campus etiquetó «martes 9 de Junio» pero la fecha real (y la cargada en
  // VistaParciales) es «martes 10 de Noviembre»: ambos deben emparejar.
  assert.equal(
    claveParcialParaEmparejar('Examen PARCIAL de Auditorías, martes 9 de Junio 18hs.'),
    claveParcialParaEmparejar('Examen PARCIAL de Auditorías, martes 10 de Noviembre 18hs.')
  );
  assert.equal(
    claveParcialParaEmparejar('Examen PARCIAL de Auditorías, martes 10 de Noviembre 18hs.'),
    'examen parcial de auditorias'
  );
  // Nombres sin fecha no se tocan.
  assert.equal(claveParcialParaEmparejar('Parcial de la Unidad 1'), 'parcial de la unidad 1');
  assert.equal(claveParcialParaEmparejar('Parcial integrador'), 'parcial integrador');
  assert.equal(claveParcialParaEmparejar(''), '');
});

test('coincidirParcial empareja un parcial ya cargado desde UGR', () => {
  // Caso Auditorías: el parcial está cargado con la fecha real, pero Moodle
  // etiqueta el nombre con la fecha del anuncio. Empareja por el núcleo.
  const parcialAuditorias = {
    id: 'parcial_aud',
    nombre: 'Examen PARCIAL de Auditorías, martes 10 de Noviembre 18hs.',
    fecha: '2026-11-10',
    url: ''
  };
  const porNombre = coincidirParcial({
    parciales: [parcialAuditorias],
    nombre: 'Examen PARCIAL de Auditorías, martes 9 de Junio 18hs.',
    fin: '2026-11-10'
  });
  assert.equal(porNombre, parcialAuditorias);

  // Caso parcialito: el parcial se cargó por cronograma con otro nombre y el
  // mismo vence que la actividad de Moodle. Empareja por fecha de fin.
  const parcialActivos = {
    id: 'parcial_act',
    nombre: '1er parcialito (como lo llama el profe)',
    fecha: '2026-09-28',
    url: ''
  };
  const porFecha = coincidirParcial({
    parciales: [parcialActivos],
    nombre: 'Evaluación de avance de medio cursado',
    fin: '2026-09-28'
  });
  assert.equal(porFecha, parcialActivos);

  // Sin coincidencia: otra fecha y otro nombre → null.
  const sinMatch = coincidirParcial({
    parciales: [parcialActivos],
    nombre: 'Evaluación de avance de medio cursado',
    fin: '2026-10-12'
  });
  assert.equal(sinMatch, null);

  // La coincidencia por fecha respeta la materia: acá se pasa solo el listado
  // de la materia ya filtrada, así que también cubre ese caso por construcción.
  assert.equal(coincidirParcial({ parciales: [], nombre: 'Evaluación de avance', fin: '2026-09-28' }), null);
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
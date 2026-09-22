import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claveParcialParaEmparejar,
  claveTareaParaEmparejar,
  coincidirMateria,
  coincidirNombreTarea,
  coincidirParcial,
  emparejarCursosConMaterias,
  filtrarTareasDuplicadas,
  agruparResumenSync,
  armarMensajeCursada,
  separarEvaluaciones,
  inferirTipoTarea,
  limpiarNombreCursoParaBusqueda,
  limpiarTextoParaBusqueda,
  normalizarNombre,
  parsearFechaMoodle,
  parsearTimestampMoodle,
  parsearUnidadMoodle
} from '../lib/normalizar.mjs';

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

test('parsearTimestampMoodle usa el día que muestra el campus, no el de UTC', () => {
  // 25/09/2026 23:59 en Argentina es 26/09/2026 02:59 UTC.
  assert.equal(parsearTimestampMoodle(1790391540), '2026-09-25');
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
  assert.equal(parsearUnidadMoodle('Módulo 2'), 2);
  assert.equal(parsearUnidadMoodle('Tema 3'), 3);
  assert.equal(parsearUnidadMoodle('Semana 4'), 4);
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

  // Un trabajo que casualmente vence el mismo día no es el parcial.
  assert.equal(coincidirParcial({
    parciales: [parcialActivos],
    nombre: 'Trabajo nro. 2, UII.',
    fin: '2026-09-28'
  }), null);
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

test('emparejarCursosConMaterias reutiliza la materia existente y nombra la nueva', () => {
  const materias = [{ id: 'a', nombre: 'CIBERDELITOS' }];
  const plan = emparejarCursosConMaterias([
    { nombre: '(V.TUCS.1.08.2) CIBERDELITOS' },
    { nombre: '(V.TUCS.1.09.2) GESTIÓN DE ACTIVOS DE LA INFORMACIÓN' },
    { nombre: '   ' }
  ], materias);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].nueva, false);
  assert.equal(plan[0].materiaId, 'a');
  assert.equal(plan[1].nueva, true);
  assert.match(plan[1].nombre, /GESTIÓN DE ACTIVOS/);
  assert.doesNotMatch(plan[1].nombre, /TUCS/);
});

test('emparejarCursosConMaterias da de alta extras del plan que no están en el cuatrimestre', () => {
  const materias = [{ id: 'a', nombre: 'CIBERDELITOS' }];
  const catalogo = [
    { id: '2.16.1', nombre: 'Conceptos de Desarrollo de Software' },
    { id: '2.18.2', nombre: 'Introducción a la Criptografía' }
  ];
  const plan = emparejarCursosConMaterias([
    { nombre: '(V.TUCS.1.08.2) CIBERDELITOS' },
    { nombre: '(V.TUCS.2.16.1) CONCEPTOS DE DESARROLLO DE SOFTWARE' },
    { nombre: '(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA' },
    { nombre: 'Mi Carrera - Espacio de Seguridad' }
  ], materias, catalogo);
  assert.equal(plan.length, 3);
  assert.equal(plan[0].nueva, false);
  assert.equal(plan[1].nueva, true);
  assert.equal(plan[1].nombre, 'Conceptos de Desarrollo de Software');
  assert.equal(plan[2].nueva, true);
  assert.equal(plan[2].nombre, 'Introducción a la Criptografía');
});

test('el segundo alumno reutiliza la materia extra y no duplica tareas', () => {
  const catalogo = [
    { nombre: 'Conceptos de Desarrollo de Software' },
    { nombre: 'Introducción a la Criptografía' },
    { nombre: 'Tratamiento de Incidentes' }
  ];
  const primero = emparejarCursosConMaterias([
    { id: '2218', nombre: '(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA' },
    { id: '2001', nombre: '(V.TUCS.2.17.2) TRATAMIENTO DE INCIDENTES' },
    { id: '2572', nombre: 'Mi Carrera - Espacio de Seguridad' }
  ], [{ id: 'inc', nombre: 'TRATAMIENTO DE INCIDENTES' }], catalogo);
  assert.equal(primero.length, 2);
  const cripto = primero.find((item) => /criptograf/i.test(item.nombre));
  assert.equal(cripto?.nueva, true);

  const periodo = [
    { id: 'inc', nombre: 'TRATAMIENTO DE INCIDENTES' },
    { id: 'cri', nombre: 'INTRODUCCIÓN A LA CRIPTOGRAFÍA' }
  ];
  const segundo = emparejarCursosConMaterias([
    { id: '2218', nombre: '(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA' },
    { id: '2001', nombre: '(V.TUCS.2.17.2) TRATAMIENTO DE INCIDENTES' }
  ], periodo, catalogo);
  assert.equal(segundo.find((item) => item.nombre === 'INTRODUCCIÓN A LA CRIPTOGRAFÍA')?.materiaId, 'cri');
  assert.equal(segundo.find((item) => item.nombre === 'INTRODUCCIÓN A LA CRIPTOGRAFÍA')?.nueva, false);

  const { nuevas, duplicadas } = filtrarTareasDuplicadas(
    [{ materiaId: 'cri', nombre: 'TP 1 Criptografía' }],
    [{ materiaId: 'cri', nombre: 'TP 1 Criptografía' }]
  );
  assert.equal(nuevas.length, 0);
  assert.equal(duplicadas.length, 1);
});

test('armarMensajeCursada dice a qué materias estás inscripto', () => {
  const primero = armarMensajeCursada({
    materias: [{ nombre: 'Introducción a la Criptografía' }, { nombre: 'Tratamiento de Incidentes' }],
    tareasNuevas: 4
  });
  assert.match(primero, /Estás inscripto a 2 materias/);
  assert.match(primero, /Criptografía/);
  assert.match(primero, /Se cargaron 4 tarea/);

  const segundo = armarMensajeCursada({
    materias: [{ nombre: 'Introducción a la Criptografía' }, { nombre: 'Tratamiento de Incidentes' }],
    tareasYa: 4
  });
  assert.match(segundo, /ya estaban cargadas/);
});

test('separarEvaluaciones manda el examen con fecha a parciales y el trabajo a tareas', () => {
  const { tareas, parciales } = separarEvaluaciones([
    { nombre: 'TP 1', fin: '2026-09-25' },
    { nombre: 'Examen parcial', fin: '2026-10-02' },
    { nombre: 'Parcial 1', inicio: '2026-11-03', fin: 'Sin fecha' },
    { nombre: 'Parcialito', fin: 'Sin fecha' }
  ]);
  assert.equal(tareas.length, 2);
  assert.equal(parciales.length, 2);
  assert.equal(parciales[0].nombre, 'Examen parcial');
  assert.equal(parciales.find((item) => item.nombre === 'Parcial 1').fin, '2026-11-03');
});

test('filtrarTareasDuplicadas no deja dos TPs iguales en la misma materia', () => {
  const { nuevas, duplicadas } = filtrarTareasDuplicadas(
    [
      { materiaId: 'm1', nombre: 'TP 1: contexto' },
      { materiaId: 'm1', nombre: 'TP 1: contexto (FORO)' },
      { materiaId: 'm2', nombre: 'TP 1: contexto' }
    ],
    [{ materiaId: 'm1', nombre: 'TP 1: contexto' }]
  );
  assert.equal(nuevas.length, 1);
  assert.equal(nuevas[0].materiaId, 'm2');
  assert.equal(duplicadas.length, 2);
});

test('agruparResumenSync junta por materia lo nuevo y lo que ya estaba', () => {
  const resumen = agruparResumenSync({
    nuevas: [{ materiaId: 'm1', materiaNombre: 'Ciberdelitos', nombre: 'Foro 1' }],
    yaEstaban: [
      { materiaId: 'm1', materiaNombre: 'Ciberdelitos', nombre: 'TP 1' },
      { materiaId: 'm2', materiaNombre: 'Auditorías', nombre: 'Quiz' }
    ],
    cronogramaNuevo: [{ materiaId: 'm1', materiaNombre: 'Ciberdelitos', titulo: 'Clase sincrónica' }],
    cronogramaYa: [{ materiaId: 'm2', materiaNombre: 'Auditorías', titulo: 'Consulta' }]
  });
  const ciber = resumen.find((fila) => fila.materia === 'Ciberdelitos');
  const auditorias = resumen.find((fila) => fila.materia === 'Auditorías');
  assert.deepEqual(ciber?.nuevas, ['Foro 1']);
  assert.deepEqual(ciber?.yaEstaban, ['TP 1']);
  assert.deepEqual(ciber?.cronogramaNuevo, ['Clase sincrónica']);
  assert.deepEqual(auditorias?.yaEstaban, ['Quiz']);
  assert.deepEqual(auditorias?.cronogramaYa, ['Consulta']);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asegurarMateriasDeLaCursada, insertarTareasDetectadas, listarCursosDelCampus, moverTareasQueSonParciales } from '../lib/sync-core.mjs';

function htmlCampus() {
  return 'M.cfg = {"sesskey":"S3SSK3Y","userid":42,"sitename":"UGR"};';
}

test('listarCursosDelCampus trae todas las materias inscriptas, no solo las de la comisión', async () => {
  const cliente = {
    pedir: async (ruta, opts = {}) => {
      if (String(ruta).includes('/lib/ajax/service.php')) {
        const cuerpo = JSON.parse(opts.cuerpo || '[]');
        const metodo = cuerpo[0]?.methodname;
        if (metodo === 'core_enrol_get_users_courses') {
          return {
            html: JSON.stringify([{
              error: false,
              data: [
                { id: 2001, fullname: '(V.TUCS.2.17.2) TRATAMIENTO DE INCIDENTES' },
                { id: 2216, fullname: '(V.TUCS.2.16.1) CONCEPTOS DE DESARROLLO DE SOFTWARE' },
                { id: 2218, fullname: '(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA' },
                { id: 2572, fullname: 'Mi Carrera - Espacio de Seguridad' }
              ]
            }])
          };
        }
        if (metodo === 'core_course_get_enrolled_courses_by_timeline_classification') {
          const classification = cuerpo[0]?.args?.classification;
          if (classification === 'inprogress') {
            return {
              html: JSON.stringify([{
                error: false,
                data: { courses: [{ id: 2001, fullname: '(V.TUCS.2.17.2) TRATAMIENTO DE INCIDENTES' }] }
              }])
            };
          }
          return { html: JSON.stringify([{ error: false, data: { courses: [] } }]) };
        }
      }
      return { html: htmlCampus() };
    }
  };

  const cursos = await listarCursosDelCampus(cliente);
  assert.deepEqual(cursos.map((curso) => curso.id).sort(), ['2001', '2216', '2218']);
  assert.ok(cursos.some((curso) => /criptograf/i.test(curso.nombre)));
  assert.ok(cursos.some((curso) => /DESARROLLO DE SOFTWARE/i.test(curso.nombre)));
});

test('el segundo alumno no vuelve a insertar las tareas que ya cargó el primero', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ugr-cursada-'));
  const db = createClient({ url: `file:${join(dir, 'test.db')}` });
  try {
    await db.execute(`CREATE TABLE tareas (
      id TEXT PRIMARY KEY, materia_id TEXT, nombre TEXT, inicio TEXT, fin TEXT,
      detalles TEXT, unidad INTEGER, con_nota INTEGER, tipo TEXT, url TEXT
    )`);
    const detectadas = [{
      materiaId: 'cri',
      nombre: 'TP 1 Criptografía',
      inicio: 'Sin fecha',
      fin: '2026-11-01',
      url: '/mod/assign/view.php?id=9'
    }];
    assert.equal(await insertarTareasDetectadas({ db, detectadas }), 1);
    assert.equal(await insertarTareasDetectadas({ db, detectadas }), 0);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM tareas')).rows[0].n, 1);

    await db.batch([
      `CREATE TABLE completadas (
        tarea_id TEXT, alumno_id TEXT, alumno TEXT, completada_en TEXT,
        UNIQUE(tarea_id, alumno)
      )`,
      `CREATE TABLE notas_tareas (
        id TEXT PRIMARY KEY, tarea_id TEXT, alumno_id TEXT, alumno TEXT, nota TEXT, cargada_en TEXT,
        cerrada INTEGER NOT NULL DEFAULT 0,
        UNIQUE(tarea_id, alumno)
      )`,
      `CREATE TABLE parciales (id TEXT PRIMARY KEY, materia_id TEXT, nombre TEXT, fecha TEXT)`,
      `CREATE TABLE notas_parciales (id TEXT PRIMARY KEY, parcial_id TEXT, alumno_id TEXT, alumno TEXT, nota TEXT, cerrada INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE cronograma_eventos (
        id TEXT PRIMARY KEY, materia_id TEXT, fecha TEXT, modalidad TEXT, tipo TEXT,
        titulo TEXT, detalles TEXT, url TEXT, origen TEXT,
        UNIQUE(materia_id, fecha, titulo)
      )`
    ], 'write');
    const { aplicarComplementoCampus, insertarEventosCronograma } = await import('../lib/sync-core.mjs');
    const tarea = (await db.execute('SELECT id FROM tareas')).rows[0];
    const sinEntrega = await aplicarComplementoCampus({
      db,
      alumnoId: 'alu_x',
      alumnoNombre: 'Alumno X',
      detectado: {
        progresoAlumno: [{
          tabla: 'nueva',
          id: 'moodle_2218_9',
          materiaId: 'cri',
          nombre: 'TP 1 Criptografía',
          nota: '8',
          entregada: true
        }]
      }
    });
    assert.equal(sinEntrega.notas, 0);
    assert.equal(sinEntrega.pendientesEntrega[0].nombre, 'TP 1 Criptografía');
    await db.execute({
      sql: "INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, datetime('now'))",
      args: [tarea.id, 'alu_x', 'Alumno X']
    });
    const marcas = await aplicarComplementoCampus({
      db,
      alumnoId: 'alu_x',
      alumnoNombre: 'Alumno X',
      detectado: {
        progresoAlumno: [{
          tabla: 'nueva',
          id: 'moodle_2218_9',
          materiaId: 'cri',
          nombre: 'TP 1 Criptografía',
          nota: '8',
          entregada: true
        }]
      }
    });
    assert.equal(marcas.notas, 1);
    assert.equal(marcas.notasCargadas[0].nota, '8');
    const evento = { materiaId: 'cri', fecha: '2026-10-06', titulo: 'Clase de criptografía', tipo: 'clase' };
    assert.equal(await insertarEventosCronograma({ db, eventos: [evento] }), 1);
    assert.equal(await insertarEventosCronograma({ db, eventos: [evento] }), 0);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('asegurarMateriasDeLaCursada crea las extras de otro cuatrimestre y las mapea', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ugr-extras-'));
  const db = createClient({ url: `file:${join(dir, 'test.db')}` });
  try {
    await db.execute('CREATE TABLE materias (id TEXT PRIMARY KEY, nombre TEXT, periodo_id TEXT)');
    await db.execute({
      sql: 'INSERT INTO materias (id, nombre, periodo_id) VALUES (?, ?, ?)',
      args: ['inc', 'TRATAMIENTO DE INCIDENTES', 'p']
    });
    const plan = [
      { nombre: 'Tratamiento de Incidentes' },
      { nombre: 'Introducción a la Criptografía' },
      { nombre: 'Conceptos de Desarrollo de Software' }
    ];
    const cursos = [
      { id: '2001', nombre: '(V.TUCS.2.17.2) TRATAMIENTO DE INCIDENTES' },
      { id: '2218', nombre: '(V.TUCS.2.18.2) INTRODUCCIÓN A LA CRIPTOGRAFÍA' },
      { id: '2216', nombre: '(V.TUCS.2.16.1) CONCEPTOS DE DESARROLLO DE SOFTWARE' },
      { id: '2572', nombre: 'Mi Carrera - Espacio de Seguridad' }
    ];
    const cursada = await asegurarMateriasDeLaCursada({
      db,
      cursos,
      materias: [{ id: 'inc', nombre: 'TRATAMIENTO DE INCIDENTES' }],
      plan,
      periodoId: 'p'
    });
    assert.equal(cursada.mapeos.length, 3);
    assert.equal(cursada.materiasNuevas, 2);
    const guardadas = (await db.execute('SELECT nombre FROM materias')).rows.map((fila) => fila.nombre);
    assert.equal(guardadas.length, 3);
    assert.ok(guardadas.some((nombre) => /criptograf/i.test(nombre)));
    assert.ok(guardadas.some((nombre) => /desarrollo de software/i.test(nombre)));

    const vigentes = (await db.execute('SELECT id, nombre FROM materias')).rows;
    const repetida = await asegurarMateriasDeLaCursada({ db, cursos, materias: vigentes, plan, periodoId: 'p' });
    assert.equal(repetida.materiasNuevas, 0);
    assert.equal(repetida.mapeos.length, 3);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM materias')).rows[0].n, 3);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('un parcial cargado como tarea pasa al apartado de parciales', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ugr-parcial-'));
  const db = createClient({ url: `file:${join(dir, 'test.db')}` });
  try {
    await db.batch([
      `CREATE TABLE tareas (
        id TEXT PRIMARY KEY, materia_id TEXT, nombre TEXT, inicio TEXT, fin TEXT,
        detalles TEXT, url TEXT
      )`,
      `CREATE TABLE parciales (
        id TEXT PRIMARY KEY, materia_id TEXT, nombre TEXT, fecha TEXT, detalles TEXT, url TEXT
      )`,
      `CREATE TABLE notas_tareas (id TEXT PRIMARY KEY, tarea_id TEXT, alumno_id TEXT, alumno TEXT, nota TEXT)`,
      `CREATE TABLE notas_parciales (id TEXT PRIMARY KEY, parcial_id TEXT, alumno_id TEXT, alumno TEXT, nota TEXT)`,
      `CREATE TABLE completadas (tarea_id TEXT, alumno_id TEXT, alumno TEXT, completada_en TEXT)`,
      `CREATE TABLE integrantes_tareas (tarea_id TEXT, alumno_id TEXT)`,
      `CREATE TABLE grupos_tareas (tarea_id TEXT, id TEXT)`
    ], 'write');
    await db.execute({
      sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['t1', 'cri', 'Parcial 1', '2026-11-03', 'Sin fecha', '', '']
    });
    await db.execute({
      sql: 'INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota) VALUES (?, ?, ?, ?, ?)',
      args: ['n1', 't1', 'alu_x', 'Alumno X', '8']
    });
    assert.equal(await moverTareasQueSonParciales({ db, materiaIds: ['cri'] }), 1);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM tareas')).rows[0].n, 0);
    const parcial = (await db.execute('SELECT nombre, fecha FROM parciales')).rows[0];
    assert.equal(parcial.nombre, 'Parcial 1');
    assert.equal(parcial.fecha, '2026-11-03');
    assert.equal((await db.execute('SELECT nota FROM notas_parciales')).rows[0].nota, '8');
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

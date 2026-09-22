import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { insertarTareasDetectadas, listarCursosDelCampus } from '../lib/sync-core.mjs';

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
        UNIQUE(tarea_id, alumno)
      )`,
      `CREATE TABLE parciales (id TEXT PRIMARY KEY, materia_id TEXT, nombre TEXT, fecha TEXT)`,
      `CREATE TABLE notas_parciales (id TEXT PRIMARY KEY, parcial_id TEXT, alumno_id TEXT, alumno TEXT, nota TEXT)`,
      `CREATE TABLE cronograma_eventos (
        id TEXT PRIMARY KEY, materia_id TEXT, fecha TEXT, modalidad TEXT, tipo TEXT,
        titulo TEXT, detalles TEXT, url TEXT, origen TEXT,
        UNIQUE(materia_id, fecha, titulo)
      )`
    ], 'write');
    const { aplicarComplementoCampus, insertarEventosCronograma } = await import('../lib/sync-core.mjs');
    const tarea = (await db.execute('SELECT id FROM tareas')).rows[0];
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
    assert.equal(marcas.notas, 2);
    const hecha = await db.execute({
      sql: 'SELECT alumno_id FROM completadas WHERE tarea_id = ?',
      args: [tarea.id]
    });
    assert.equal(hecha.rows[0].alumno_id, 'alu_x');
    const evento = { materiaId: 'cri', fecha: '2026-10-06', titulo: 'Clase de criptografía', tipo: 'clase' };
    assert.equal(await insertarEventosCronograma({ db, eventos: [evento] }), 1);
    assert.equal(await insertarEventosCronograma({ db, eventos: [evento] }), 0);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

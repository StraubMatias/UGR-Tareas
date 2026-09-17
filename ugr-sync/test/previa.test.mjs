import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sincronizarConPrevia } from '../lib/previa.mjs';

test('previa: detectar una vez, importar sin red, repetir, aislar usuario y vencer', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ugr-previa-'));
  const db = createClient({ url: `file:${join(dir, 'test.db')}` });
  try {
    await db.batch([
      `CREATE TABLE tareas (id TEXT PRIMARY KEY, materia_id TEXT, nombre TEXT, inicio TEXT, fin TEXT, detalles TEXT, unidad INTEGER, con_nota INTEGER, tipo TEXT, url TEXT)`,
      `CREATE TABLE avisos_moodle (id TEXT PRIMARY KEY, curso_id TEXT, curso_nombre TEXT, materia_id TEXT, materia_nombre TEXT, foro_id TEXT, foro_nombre TEXT, hilo_id TEXT, titulo TEXT, autor TEXT, fecha TEXT, contenido TEXT, url TEXT, estado TEXT, creado_en TEXT, UNIQUE(curso_id, hilo_id))`,
      `CREATE TABLE cronograma_eventos (id TEXT PRIMARY KEY, materia_id TEXT, fecha TEXT, modalidad TEXT, tipo TEXT, titulo TEXT, detalles TEXT, url TEXT, origen TEXT, UNIQUE(materia_id, fecha, titulo))`
    ], 'write');
    let llamadas = 0;
    const datos = {
      detectadas: [{ idMoodle: 't1', materiaId: 'm1', nombre: 'TP', url: '/t1' }],
      avisos: [{ id: 'a1', cursoId: 'c1', cursoNombre: 'Curso', materiaId: 'm1', foroId: 'f1', foroNombre: 'Avisos', hiloId: 'h1', titulo: 'Sin clases', fecha: '2026-09-18' }],
      eventosSugeridos: [{ avisoId: 'a1', materiaId: 'm1', fecha: '2026-09-18', titulo: 'Sin clases', tipo: 'sin_clases' }]
    };
    const previa = await sincronizarConPrevia({ db, usuario: 'admin', ahora: 1000, detectar: async () => { llamadas++; return datos; } });
    const args = { db, usuario: 'admin', ahora: 1000, confirmar: true, previaId: previa.previaId, ids: ['t1', 'inventada'], idsAvisos: ['a1'], idsEventos: ['a1'], detectar: () => assert.fail('Importar no debe consultar Moodle') };
    await assert.rejects(sincronizarConPrevia({ ...args, usuario: 'otro' }), /venció/);
    // Un fallo después del INSERT no deja tareas parcialmente importadas.
    await db.execute(`CREATE TRIGGER fallo_aviso BEFORE UPDATE ON avisos_moodle
      BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END`);
    await assert.rejects(sincronizarConPrevia(args), /fallo simulado/);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM tareas')).rows[0].n, 0);
    await db.execute('DROP TRIGGER fallo_aviso');
    const resultado = await sincronizarConPrevia(args);
    assert.equal(resultado.insertadas, 1);
    assert.equal(resultado.avisosAceptados, 1);
    assert.equal(resultado.eventosInsertados, 1);
    assert.deepEqual(await sincronizarConPrevia(args), resultado);
    assert.equal(llamadas, 1);
    for (const tabla of ['tareas', 'avisos_moodle', 'cronograma_eventos']) {
      assert.equal((await db.execute(`SELECT COUNT(*) AS n FROM ${tabla}`)).rows[0].n, 1);
    }
    await assert.rejects(sincronizarConPrevia({ ...args, ahora: 31 * 60 * 1000 }), /venció/);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

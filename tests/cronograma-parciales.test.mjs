import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { promoverParcialesDesdeCronograma } from '../ugr-sync/lib/sync-core.mjs';

test('promoverParcialesDesdeCronograma crea parcial desde evento examen del plan', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ugr-cron-parcial-'));
  const db = createClient({ url: `file:${join(dir, 'test.db')}` });
  try {
    await db.batch([
      'CREATE TABLE materias (id TEXT PRIMARY KEY, nombre TEXT)',
      'CREATE TABLE parciales (id TEXT PRIMARY KEY, materia_id TEXT, nombre TEXT, fecha TEXT, detalles TEXT, url TEXT)',
      `CREATE TABLE cronograma_eventos (
        id TEXT PRIMARY KEY, materia_id TEXT, fecha TEXT, modalidad TEXT, tipo TEXT, titulo TEXT, detalles TEXT, url TEXT, origen TEXT
      )`,
      "INSERT INTO materias VALUES ('dev', 'Conceptos de Desarrollo de Software')",
      `INSERT INTO cronograma_eventos VALUES (
        'cron_dev_1', 'dev', '2026-10-20', 'sincrónico', 'examen', '1er parcial', '', '', 'manual'
      )`
    ], 'write');

    const { insertadas } = await promoverParcialesDesdeCronograma({ db, materiaIds: ['dev'] });
    assert.equal(insertadas, 1);
    const filas = await db.execute('SELECT nombre, fecha FROM parciales WHERE materia_id = ?', ['dev']);
    assert.equal(filas.rows.length, 1);
    assert.equal(filas.rows[0].nombre, '1er parcial');
    assert.equal(filas.rows[0].fecha, '2026-10-20');

    const otra = await promoverParcialesDesdeCronograma({ db, materiaIds: ['dev'] });
    assert.equal(otra.insertadas, 0);

    await db.execute({
      sql: `INSERT INTO cronograma_eventos VALUES (
        'cron_dev_final', 'dev', '2026-12-04', 'sincrónico', 'examen_final', 'Examen 1er llamado turno Diciembre', '', '', 'manual'
      )`
    });
    const finales = await promoverParcialesDesdeCronograma({ db, materiaIds: ['dev'] });
    assert.equal(finales.insertadas, 0);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM parciales WHERE materia_id = ?', ['dev'])).rows[0].n, 1);
  } finally {
    db.close?.();
  }
});

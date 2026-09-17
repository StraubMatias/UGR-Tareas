import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEsquemaGrupos } from '../database/grupos-schema.mjs';
import { asignarGrupo, actualizarProgresoTarea } from '../src/lib/grupos-tareas.mjs';

async function preparar(t) {
  const directorio = mkdtempSync(join(tmpdir(), 'ugr-grupos-'));
  const db = createClient({ url: `file:${join(directorio, 'test.db')}` });
  t.after(() => { db.close(); rmSync(directorio, { recursive: true, force: true }); });
  await db.batch([
    'CREATE TABLE alumnos (id TEXT PRIMARY KEY, nombre TEXT)',
    'CREATE TABLE tareas (id TEXT PRIMARY KEY, inicio TEXT, con_nota INTEGER)',
    'CREATE TABLE completadas (tarea_id TEXT, alumno_id TEXT, alumno TEXT, completada_en TEXT, UNIQUE(tarea_id, alumno))',
    'CREATE TABLE notas_tareas (id TEXT PRIMARY KEY, tarea_id TEXT, alumno_id TEXT, alumno TEXT, nota TEXT, cargada_en TEXT, UNIQUE(tarea_id, alumno))',
    "INSERT INTO alumnos VALUES ('a', 'Ana'), ('b', 'Beto'), ('c', 'Caro')",
    "INSERT INTO tareas VALUES ('t', 'Sin fecha', 1), ('otra', 'Sin fecha', 1), ('individual', 'Sin fecha', 1)"
  ], 'write');
  await crearEsquemaGrupos(db);
  await crearEsquemaGrupos(db);
  await db.execute("UPDATE tareas SET grupal = 1 WHERE id != 'individual'");
  return db;
}
const ana = { id: 'a', nombre: 'Ana' };
const beto = { id: 'b', nombre: 'Beto' };

test('recorrido grupal: autoasignación, entrega, nota, corrección y borrado para ambos', async (t) => {
  const db = await preparar(t);
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'Equipo 1' });
  await asignarGrupo(db, 't', 'b', { grupoId });
  await actualizarProgresoTarea(db, 't', ana, { alternarEntrega: true });
  const entregas = (await db.execute('SELECT * FROM completadas')).rows;
  assert.deepEqual(entregas.map((r) => r.alumno).sort(), ['Ana', 'Beto']);
  assert.equal(entregas[0].completada_en, entregas[1].completada_en);
  await actualizarProgresoTarea(db, 't', beto, { nota: '8,5' });
  let notas = (await db.execute('SELECT * FROM notas_tareas')).rows;
  assert.deepEqual(notas.map((r) => r.nota), ['8.5', '8.5']);
  assert.equal(notas[0].cargada_en, notas[1].cargada_en);
  await assert.rejects(asignarGrupo(db, 't', 'c', { grupoId }), /entrega o nota/);
  await assert.rejects(asignarGrupo(db, 't', 'a', { salir: true }), /entrega o nota/);
  await assert.rejects(actualizarProgresoTarea(db, 't', ana, { alternarEntrega: true }), /borrá la nota/);
  await actualizarProgresoTarea(db, 't', ana, { nota: '9' });
  notas = (await db.execute('SELECT nota FROM notas_tareas')).rows;
  assert.deepEqual(notas.map((r) => r.nota), ['9', '9']);
  await actualizarProgresoTarea(db, 't', beto, { nota: '' });
  assert.equal((await db.execute('SELECT * FROM notas_tareas')).rows.length, 0);
  await actualizarProgresoTarea(db, 't', beto, { alternarEntrega: true });
  assert.equal((await db.execute('SELECT * FROM completadas')).rows.length, 0);
  await asignarGrupo(db, 't', 'a', { salir: true });
  await asignarGrupo(db, 't', 'b', { salir: true });
  assert.equal((await db.execute('SELECT * FROM grupos_tareas')).rows.length, 0);
});

test('aislamiento de tareas, grupos e individuales y validaciones', async (t) => {
  const db = await preparar(t);
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'Equipo' });
  await assert.rejects(asignarGrupo(db, 'otra', 'b', { grupoId }), /no pertenece/);
  await assert.rejects(asignarGrupo(db, 't', 'b', { nombre: 'equipo' }), /Ya existe/);
  await assert.rejects(asignarGrupo(db, 't', 'a', { nombre: 'Otro' }), /Primero salí/);
  await assert.rejects(asignarGrupo(db, 'individual', 'b', { nombre: 'Otro' }), /individual/);
  await assert.rejects(actualizarProgresoTarea(db, 't', beto, { nota: '8' }), /unite/);
  await assert.rejects(actualizarProgresoTarea(db, 't', ana, { nota: '11' }), /entre 1 y 10/);
  await asignarGrupo(db, 't', 'b', { nombre: 'Segundo' });
  await actualizarProgresoTarea(db, 't', ana, { nota: '8' });
  await actualizarProgresoTarea(db, 'individual', beto, { nota: '7' });
  assert.deepEqual((await db.execute('SELECT tarea_id, alumno FROM notas_tareas ORDER BY tarea_id')).rows.map((r) => [r.tarea_id, r.alumno]), [['individual', 'Beto'], ['t', 'Ana']]);
});

test('cupo máximo de integrantes por grupo', async (t) => {
  const db = await preparar(t);
  await db.execute("UPDATE tareas SET cupo_maximo = 2 WHERE id = 't'");
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'Dúo' });
  await asignarGrupo(db, 't', 'b', { grupoId });
  // Intento de unirse a un grupo lleno:
  await assert.rejects(asignarGrupo(db, 't', 'c', { grupoId }), /cupo máximo/);
});

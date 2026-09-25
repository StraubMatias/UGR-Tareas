import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEsquemaGrupos } from '../database/grupos-schema.mjs';
import { asignarGrupo, actualizarProgresoTarea, propagarNotasGrupalesEnMaterias } from '../src/lib/grupos-tareas.ts';

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
const caro = { id: 'c', nombre: 'Caro' };

test('recorrido grupal: autoasignación, entrega, nota, sincronización y corrección', async (t) => {
  const db = await preparar(t);
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'Equipo 1' });
  await asignarGrupo(db, 't', 'b', { grupoId });
  await actualizarProgresoTarea(db, 't', ana, { alternarEntrega: true });
  let entregas = (await db.execute('SELECT * FROM completadas')).rows;
  assert.deepEqual(entregas.map((r) => r.alumno).sort(), ['Ana', 'Beto']);
  assert.equal(entregas[0].completada_en, entregas[1].completada_en);
  await actualizarProgresoTarea(db, 't', beto, { nota: '8,5' });
  let notas = (await db.execute('SELECT * FROM notas_tareas')).rows;
  assert.deepEqual(notas.map((r) => r.nota), ['8.5', '8.5']);
  assert.equal(notas[0].cargada_en, notas[1].cargada_en);

  // Caro se une al grupo existente y automáticamente recibe la entrega y nota sincronizada
  await asignarGrupo(db, 't', 'c', { grupoId });
  entregas = (await db.execute('SELECT * FROM completadas')).rows;
  assert.deepEqual(entregas.map((r) => r.alumno).sort(), ['Ana', 'Beto', 'Caro']);
  notas = (await db.execute('SELECT * FROM notas_tareas')).rows;
  assert.deepEqual(notas.map((r) => r.nota), ['8.5', '8.5', '8.5']);

  await assert.rejects(actualizarProgresoTarea(db, 't', ana, { alternarEntrega: true }), /borrá la nota/);
  await actualizarProgresoTarea(db, 't', ana, { nota: '9' });
  notas = (await db.execute('SELECT nota FROM notas_tareas')).rows;
  assert.deepEqual(notas.map((r) => r.nota), ['9', '9', '9']);
  await actualizarProgresoTarea(db, 't', beto, { nota: '' });
  assert.equal((await db.execute('SELECT * FROM notas_tareas')).rows.length, 0);
  await actualizarProgresoTarea(db, 't', beto, { alternarEntrega: true });
  assert.equal((await db.execute('SELECT * FROM completadas')).rows.length, 0);
  await asignarGrupo(db, 't', 'a', { salir: true });
  await asignarGrupo(db, 't', 'b', { salir: true });
  await asignarGrupo(db, 't', 'c', { salir: true });
  assert.equal((await db.execute('SELECT * FROM grupos_tareas')).rows.length, 0);
});

test('sincronización cuando un alumno con entrega previa crea un grupo y otro se une', async (t) => {
  const db = await preparar(t);
  await db.execute({
    sql: 'INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, ?)',
    args: ['t', 'a', 'Ana', '2026-09-17T10:00:00.000Z']
  });
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'Grupo Alpha' });
  await asignarGrupo(db, 't', 'b', { grupoId });
  const entregas = (await db.execute('SELECT * FROM completadas ORDER BY alumno')).rows;
  assert.equal(entregas.length, 2);
  assert.equal(entregas[0].alumno, 'Ana');
  assert.equal(entregas[1].alumno, 'Beto');
  assert.equal(entregas[1].completada_en, '2026-09-17T10:00:00.000Z');
});

test('aislamiento de tareas, grupos e individuales y validaciones', async (t) => {
  const db = await preparar(t);
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'Equipo' });
  await assert.rejects(asignarGrupo(db, 'otra', 'b', { grupoId }), /no pertenece/);
  await assert.rejects(asignarGrupo(db, 't', 'b', { nombre: 'equipo' }), /Ya existe/);
  await assert.rejects(asignarGrupo(db, 't', 'a', { nombre: 'Otro' }), /Primero salí/);
  await assert.rejects(asignarGrupo(db, 'individual', 'b', { nombre: 'Otro' }), /individual/);
  await actualizarProgresoTarea(db, 't', beto, { alternarEntrega: true });
  assert.deepEqual((await db.execute('SELECT alumno FROM completadas ORDER BY alumno')).rows.map((r) => r.alumno), ['Beto']);
  await assert.rejects(actualizarProgresoTarea(db, 't', ana, { nota: '11' }), /entre 1 y 10/);
  await asignarGrupo(db, 't', 'b', { nombre: 'Segundo' });
  await actualizarProgresoTarea(db, 't', ana, { nota: '8' });
  await actualizarProgresoTarea(db, 'individual', beto, { nota: '7' });
  assert.deepEqual((await db.execute('SELECT tarea_id, alumno FROM notas_tareas ORDER BY tarea_id')).rows.map((r) => [r.tarea_id, r.alumno]), [['individual', 'Beto'], ['t', 'Ana']]);
});

test('propagarNotasGrupalesEnMaterias replica nota tras sync de un integrante', async (t) => {
  const db = await preparar(t);
  await db.batch([
    'CREATE TABLE materias (id TEXT PRIMARY KEY)',
    "INSERT INTO materias VALUES ('m1')",
    'ALTER TABLE tareas ADD COLUMN materia_id TEXT',
    'ALTER TABLE tareas ADD COLUMN nombre TEXT',
    "UPDATE tareas SET materia_id = 'm1', nombre = 'TP grupal' WHERE id = 't'"
  ], 'write');
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'G' });
  await asignarGrupo(db, 't', 'b', { grupoId });
  await db.execute({
    sql: `INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en)
          VALUES ('n1', 't', 'a', 'Ana', '8', datetime('now'))`,
    args: []
  });
  const propagado = await propagarNotasGrupalesEnMaterias(db, 'a', ['m1']);
  assert.equal(propagado.length, 1);
  assert.deepEqual(propagado[0].integrantes, ['Beto']);
  const notas = (await db.execute('SELECT alumno, nota FROM notas_tareas ORDER BY alumno')).rows;
  assert.deepEqual(notas, [{ alumno: 'Ana', nota: '8' }, { alumno: 'Beto', nota: '8' }]);
});

test('cupo máximo de integrantes por grupo', async (t) => {
  const db = await preparar(t);
  await db.execute("UPDATE tareas SET cupo_maximo = 2 WHERE id = 't'");
  const { grupoId } = await asignarGrupo(db, 't', 'a', { nombre: 'Dúo' });
  await asignarGrupo(db, 't', 'b', { grupoId });
  // Intento de unirse a un grupo lleno:
  await assert.rejects(asignarGrupo(db, 't', 'c', { grupoId }), /cupo máximo/);
});
test('múltiples grupos independientes para una misma tarea', async (t) => {
  const db = await preparar(t);
  const { grupoId: g1 } = await asignarGrupo(db, 't', 'a', { nombre: 'Grupo Alpha' });
  const { grupoId: g2 } = await asignarGrupo(db, 't', 'b', { nombre: 'Grupo Beta' });
  assert.notEqual(g1, g2);

  await actualizarProgresoTarea(db, 't', ana, { nota: '10' });
  await actualizarProgresoTarea(db, 't', beto, { nota: '7' });

  const notas = (await db.execute('SELECT alumno, nota FROM notas_tareas ORDER BY alumno')).rows;
  assert.deepEqual(notas, [
    { alumno: 'Ana', nota: '10' },
    { alumno: 'Beto', nota: '7' }
  ]);
});

test('administrador: reasignar alumno entre grupos y eliminar grupo', async (t) => {
  const db = await preparar(t);
  const { grupoId: g1 } = await asignarGrupo(db, 't', 'a', { nombre: 'Grupo 1' });
  const { grupoId: g2 } = await asignarGrupo(db, 't', 'b', { nombre: 'Grupo 2' });

  // Beto se mueve directamente a Grupo 1 mediante el admin (permitirMover: true)
  await asignarGrupo(db, 't', 'b', { grupoId: g1, permitirMover: true });
  const miembrosG1 = (await db.execute({ sql: 'SELECT alumno_id FROM integrantes_tareas WHERE grupo_id = ? ORDER BY alumno_id', args: [g1] })).rows;
  assert.deepEqual(miembrosG1.map((m) => m.alumno_id), ['a', 'b']);

  // Grupo 2 quedó vacío y debe haberse eliminado automáticamente
  const existeG2 = (await db.execute({ sql: 'SELECT 1 FROM grupos_tareas WHERE id = ?', args: [g2] })).rows;
  assert.equal(existeG2.length, 0);

  // Admin elimina el Grupo 1 directamente
  await asignarGrupo(db, 't', null, { eliminarGrupoId: g1 });
  const grupos = (await db.execute('SELECT * FROM grupos_tareas')).rows;
  assert.equal(grupos.length, 0);
  const integrantes = (await db.execute('SELECT * FROM integrantes_tareas')).rows;
  assert.equal(integrantes.length, 0);
});


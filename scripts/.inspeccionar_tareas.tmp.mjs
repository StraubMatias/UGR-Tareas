import { createClient } from '@libsql/client';
process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

console.log('== TABLAS ==');
const tablas = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
for (const t of tablas.rows) console.log(t.name);

console.log('\n== TAREAS (todas, con materia) ==');
const tareas = await db.execute(`
  SELECT t.id, t.nombre, t.tipo, t.inicio, t.fin, t.detalles, m.nombre AS materia
  FROM tareas t LEFT JOIN materias m ON m.id = t.materia_id
  ORDER BY t.fin ASC LIMIT 80`);
for (const t of tareas.rows) console.log(t.fin, '|', t.inicio, '|', t.tipo, '|', t.nombre, '|', t.materia, '|', t.id, '|', (t.detalles || '').slice(0, 60));

console.log('\n== COMPLETADAS ==');
const comp = await db.execute('SELECT * FROM completadas');
for (const c of comp.rows) console.log(c.alumno, '|', c.alumno_id, '|', c.tarea_id);

console.log('\n== ALUMNOS ==');
const al = await db.execute('SELECT id, nombre, rol FROM alumnos');
for (const a of al.rows) console.log(a.id, '|', a.nombre, '|', a.rol);

console.log('\n== NOTAS TAREAS ==');
const nt = await db.execute('SELECT * FROM notas_tareas LIMIT 20');
for (const n of nt.rows) console.log(n.alumno, '|', n.alumno_id, '|', n.tarea_id, '|', n.nota);

console.log('\n== cantidad tareas por materia ==');
const ctm = await db.execute('SELECT materia_id, COUNT(*) n FROM tareas GROUP BY materia_id');
for (const c of ctm.rows) console.log(c.materia_id, '->', c.n);

await db.close();
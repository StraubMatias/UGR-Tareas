import { createClient } from '@libsql/client';
process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

console.log('== AVISOS MOODLE ==');
const avisos = await db.execute("SELECT id, curso_nombre, materia_nombre, foro_nombre, titulo, autor, fecha, estado FROM avisos_moodle ORDER BY fecha DESC LIMIT 60");
for (const a of avisos.rows) console.log(a.fecha, '|', a.estado, '|', a.curso_nombre, '|', a.foro_nombre, '|', a.titulo, '|', a.autor);

console.log('\n== HORARIOS TODOS ==');
const hor = await db.execute("SELECT h.materia_id, m.nombre, h.dia, h.hora_inicio, h.hora_fin FROM horarios h LEFT JOIN materias m ON m.id = h.materia_id ORDER BY h.dia, h.hora_inicio");
for (const h of hor.rows) console.log(h.dia, h.hora_inicio, '-', h.hora_fin, '|', h.nombre, `(${h.materia_id})`);

console.log('\n== CRONOGRAMA_EVENTOS cuenta por materia ==');
const cnt = await db.execute("SELECT m.nombre, COUNT(c.id) AS n FROM cronograma_eventos c LEFT JOIN materias m ON m.id = c.materia_id GROUP BY c.materia_id ORDER BY m.nombre");
for (const c of cnt.rows) console.log(c.nombre, '->', c.n);

console.log('\n== PRAGMA cronograma_eventos ==');
const prag = await db.execute("PRAGMA table_info(cronograma_eventos)");
for (const p of prag.rows) console.log(p.name, p.type, p.notnull);

await db.close();
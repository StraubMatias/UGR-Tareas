import { createClient } from '@libsql/client';
process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

console.log('== CRONOGRAMA semana 14-18 sep por materia ==');
const r = await db.execute(`
  SELECT m.nombre, c.fecha, c.tipo, c.titulo
  FROM cronograma_eventos c LEFT JOIN materias m ON m.id = c.materia_id
  WHERE c.fecha BETWEEN '2026-09-13' AND '2026-09-20'
  ORDER BY c.fecha, m.nombre`);
for (const e of r.rows) console.log(e.fecha, '|', e.nombre, '->', e.tipo, '|', e.titulo);

console.log('\n== TAREAS que vencen 15/09 ==');
const t = await db.execute(`
  SELECT t.nombre, t.fin, m.nombre AS materia, t.tipo
  FROM tareas t LEFT JOIN materias m ON m.id = t.materia_id
  WHERE t.fin = '2026-09-15'
  ORDER BY m.nombre`);
for (const e of t.rows) console.log(e.fin, '|', e.materia, '|', e.tipo, '|', e.nombre);

console.log('\n== TODOS los sin_clases del cronograma ==');
const s = await db.execute(`
  SELECT m.nombre, c.fecha, c.titulo
  FROM cronograma_eventos c LEFT JOIN materias m ON m.id = c.materia_id
  WHERE c.tipo = 'sin_clases' OR c.modalidad = 'sin_clases'
  ORDER BY c.fecha`);
for (const e of s.rows) console.log(e.fecha, '|', e.nombre, '|', e.titulo);

await db.close();
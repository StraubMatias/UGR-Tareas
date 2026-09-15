import { createClient } from '@libsql/client';
process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

console.log('== EVENTOS AUDITORÍAS ==');
const ev = await db.execute(`
  SELECT c.fecha, c.modalidad, c.tipo, c.titulo, c.detalles, c.origen
  FROM cronograma_eventos c
  LEFT JOIN materias m ON m.id = c.materia_id
  WHERE m.nombre LIKE '%AUDITORÍAS%'
  ORDER BY c.fecha ASC`);
for (const e of ev.rows) console.log(e.fecha, '|', e.modalidad, '|', e.tipo, '|', e.titulo, '|', e.detalles, '|', e.origen);

console.log('\n== FECHA 2026-09-15 en todas las materias ==');
const d = await db.execute(`
  SELECT m.nombre, c.tipo, c.titulo
  FROM cronograma_eventos c LEFT JOIN materias m ON m.id = c.materia_id
  WHERE c.fecha = '2026-09-15'`);
for (const e of d.rows) console.log(e.nombre, '->', e.tipo, e.titulo);

await db.close();
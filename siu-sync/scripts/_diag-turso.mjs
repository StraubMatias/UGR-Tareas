import { createClient } from '@libsql/client';
process.loadEnvFile?.('.env.local');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
const t = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1");
console.log('tables', t.rows.length);
console.log(t.rows.map((r) => r.name).join(', '));
const a = await db.execute('SELECT nombre, rol FROM alumnos ORDER BY rol, nombre LIMIT 10');
console.log('alumnos', a.rows);

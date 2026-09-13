// Regenera la contraseña del usuario administrador (ADMIN_USUARIO) con una
// aleatoria larga, la guarda con scrypt en la base y revoca sus sesiones activas.
//
// Uso: npm run admin:reset-password
// Requiere ADMIN_USUARIO y las credenciales de Turso en .env.local o el entorno.
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

process.loadEnvFile?.('.env.local');

const scryptAsync = promisify(scrypt);

async function hashearPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivada = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derivada).toString('hex')}`;
}

function generarPasswordLarga(longitud = 24) {
  // Alfabeto sin caracteres confusos (0/O, 1/l/I).
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_';
  const bytes = randomBytes(longitud);
  let password = '';
  for (let i = 0; i < longitud; i += 1) {
    password += alfabeto[bytes[i] % alfabeto.length];
  }
  return password;
}

async function main() {
  const admin = (process.env.ADMIN_USUARIO || '').trim();
  if (!admin) {
    console.error('❌ Falta ADMIN_USUARIO en .env.local o en el entorno.');
    process.exit(1);
  }

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  const existe = await db.execute({
    sql: 'SELECT nombre, rol FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
    args: [admin]
  });
  if (existe.rows.length === 0) {
    console.error(`❌ No existe el usuario "${admin}" en la tabla alumnos.`);
    await db.close?.();
    process.exit(1);
  }
  const fila = existe.rows[0];

  const nuevaPassword = generarPasswordLarga();
  const hash = await hashearPassword(nuevaPassword);

  // Actualiza password, asegura rol admin y revoca las sesiones activas
  // (sesion_version cambia, así la cookie vieja deja de ser válida).
  await db.execute({
    sql: 'UPDATE alumnos SET password = ?, rol = ?, sesion_version = COALESCE(sesion_version, 0) + 1 WHERE LOWER(nombre) = LOWER(?)',
    args: [hash, 'admin', admin]
  });

  console.log(`✅ Contraseña regenerada para "${fila.nombre}" (rol: admin).`);
  console.log('   Sesiones anteriores invalidadas: hay que volver a iniciar sesión.');
  console.log('');
  console.log('   🔑 Nueva contraseña (guardala ahora, no se vuelve a mostrar):');
  console.log(`      ${nuevaPassword}`);
  console.log('');

  await db.close?.();
}

main().catch((error) => {
  console.error('❌ Error:', error?.message || error);
  process.exit(1);
});
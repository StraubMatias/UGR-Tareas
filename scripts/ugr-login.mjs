// Script: iniciar sesión en UGR Virtual y guardar la sesión.
// Uso: npm run ugr:login
// Requiere UGRVIRTUAL_USER y UGRVIRTUAL_PASSWORD en .env.local.
import { crearCliente } from '../src/lib/ugr/red.mjs';
import { extraerCursos } from '../src/lib/ugr/materias.mjs';
import { UGR_BASE_URL } from '../src/lib/ugr/constantes.mjs';

process.loadEnvFile?.('.env.local');

async function main() {
  const usuario = process.env.UGRVIRTUAL_USER;
  const contrasena = process.env.UGRVIRTUAL_PASSWORD;
  if (!usuario || !contrasena) {
    console.error('❌ Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en .env.local');
    console.error('   Agregalos así:');
    console.error('   UGRVIRTUAL_USER=tu_usuario');
    console.error('   UGRVIRTUAL_PASSWORD=tu_contrasena');
    process.exit(1);
  }

  const cliente = await crearCliente({ usuario, contrasena });
  const sesion = await cliente.autenticar();
  console.log('✅ Sesión iniciada correctamente.');
  console.log(`   URL de destino: ${sesion.url}`);

  // Prueba de lectura: buscamos las materias a las que estás inscripto.
  const page = await cliente.pedir('/course/index.php');
  const cursos = extraerCursos(page.html);
  console.log(`\n📚 Se encontraron ${cursos.length} curso(s):`);
  for (const curso of cursos) {
    console.log(`   • [${curso.id}] ${curso.nombre}`);
  }
}

main().catch((error) => {
  console.error('❌ No se pudo iniciar sesión:', error.message);
  process.exit(1);
});
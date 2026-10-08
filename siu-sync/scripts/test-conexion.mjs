// Prueba de conexión a SIU Guaraní (rutas reales del sync, no /consultas/…).
import { crearClienteSIU } from '../lib/red.mjs';
import { validarCredencialesSiu } from '../lib/autenticar.mjs';
import { SIU_RUTAS } from '../lib/constantes.mjs';
import { sincronizarSIU, parsearPlanEstudio } from '../lib/sync-core.mjs';

process.loadEnvFile?.('.env.local');

async function main() {
  console.log('🔍 Probando conexión a SIU Guaraní...\n');

  // 测试1: 验证 credenciales
  console.log('1. Validando credenciales...');
  try {
    const validacion = await validarCredencialesSiu({
      usuario: process.env.SIU_USER,
      contrasena: process.env.SIU_PASSWORD,
    });
    console.log(`   ✅ Credenciales válidas: ${validacion.usuario}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    process.exit(1);
  }

  // 测试2: 获取 inicio alumno
  console.log('\n2. Conectando a SIU Guaraní...');
  const cliente = await crearClienteSIU({
    usuario: process.env.SIU_USER,
    contrasena: process.env.SIU_PASSWORD,
  });
  console.log('   ✅ Sesión iniciada');

  console.log('\n3. Plan de estudio (lo que importa el tablero)...');
  try {
    const res = await cliente.pedir(`${SIU_RUTAS.planEstudio}?checks=t`);
    const plan = parsearPlanEstudio(res.html);
    const conNota = plan.filter((m) => !m.omitir && m.nota != null).length;
    const enCurso = plan.filter((m) => m.enCurso || m.omitir).length;
    console.log(`   ✅ ${plan.length} filas · ${conNota} con nota · ${enCurso} en curso/sin nota final`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('\n4. Historia académica (referencia)...');
  try {
    const res = await cliente.pedir(`${SIU_RUTAS.historiaAcademica}?checks=t`);
    const ok = res.html?.length > 500 && !/404 Not Found/i.test(res.html);
    console.log(ok ? `   ✅ Página cargada (${res.html.length} caracteres)` : '   ⚠️ Respuesta corta o 404 (no se usa en el sync actual)');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('\n5. Sync completo (misma función que la app)...');
  const sync = await sincronizarSIU({ cliente });
  if (sync.error) console.log(`   ❌ ${sync.error}`);
  else console.log(`   ✅ Plan OK · ${sync.materiasAprobadas.length} notas para importar · ${sync.enCurso} en curso`);

  console.log('\n✅ Pruebas completadas');
}

main().catch(console.error);

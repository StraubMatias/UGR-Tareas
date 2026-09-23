// 测试脚本：验证 SIU Guaraní 连接
import { crearClienteSIU } from '../lib/red.mjs';
import { validarCredencialesSiu } from '../lib/autenticar.mjs';

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

  // 测试3: 访问历史 academica
  console.log('\n3. Consultando historia académica...');
  try {
    const res = await cliente.pedir('/consultas/historia_academica');
    console.log(`   ✅ Página cargada (${res.html.length} caracteres)`);
    console.log('\n   HTML inicial:');
    console.log(res.html.slice(0, 500) + '...');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // 测试4: 访问考试注册
  console.log('\n4. Consultando inscripciones a exámenes...');
  try {
    const res = await cliente.pedir('/consultas/inscripciones_a_examenes');
    console.log(`   ✅ Página cargada (${res.html.length} caracteres)`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('\n✅ Pruebas completadas');
}

main().catch(console.error);

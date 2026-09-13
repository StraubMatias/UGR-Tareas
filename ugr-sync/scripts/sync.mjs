// Script: sincronizar tareas nuevas desde UGR Virtual hacia la base local.
// Uso:
//   npm run ugr:sync          → modo interactivo (pregunta antes de insertar)
//   npm run ugr:sync -- --yes → inserta todo lo detectado sin preguntar
//   npm run ugr:sync -- --dry → solo muestra lo que habría insertado
//
// Requiere UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD y las credenciales de Turso
// en .env.local.
import { createInterface } from 'node:readline/promises';
import { createClient } from '@libsql/client';
import { actualizarUrlsParciales, actualizarUrlsTareas, conectarUGR, detectarTareasNuevas, insertarTareasDetectadas } from '../lib/sync-core.mjs';

process.loadEnvFile?.('.env.local');

function leerFlags() {
  return {
    autoSi: process.argv.includes('--yes') || process.argv.includes('-y'),
    soloSeco: process.argv.includes('--dry') || process.argv.includes('-d')
  };
}

async function preguntarSi(consulta) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const respuesta = await rl.question(`${consulta} [s/N] `);
    return /^(s|si|y|yes)$/i.test(respuesta.trim());
  } finally {
    rl.close();
  }
}

async function main() {
  const flags = leerFlags();
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error('❌ Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN en .env.local');
    process.exit(1);
  }

  const db = createClient({ url: tursoUrl, authToken: tursoToken });
  const cliente = await conectarUGR();

  console.log('🔑 Conectando a UGR Virtual...');
  await cliente.autenticar();
  console.log('✅ Sesión lista.');

  const { materiasLocales, cursos, mapeos, detectadas, urlsActualizar, urlsParcialesActualizar } = await detectarTareasNuevas({ db, cliente });

  console.log(`\n🗂  ${materiasLocales.length} materias locales cargadas.`);
  console.log(`📚 ${cursos.length} curso(s) encontrados en UGR Virtual.`);
  console.log(`🔗 ${mapeos.length} curso(s) mapeado(s) a materias locales:`);
  for (const { curso, coincidencia } of mapeos) {
    console.log(`   • [${curso.id}] "${curso.nombre}" → "${coincidencia.materia.nombre}" (score ${coincidencia.score})`);
  }

  console.log(`\n════════════════════════════════════════`);
  if (urlsActualizar.length > 0) {
    console.log(`🔗 ${urlsActualizar.length} tarea(s) ya existente(s) con enlace de UGR pendiente.`);
  }
  if (urlsParcialesActualizar.length > 0) {
    console.log(`📋 ${urlsParcialesActualizar.length} parcial(es) ya cargado(s) que coinciden con una actividad de UGR (misma materia y fecha); se completará su enlace.`);
  }

  if (detectadas.length === 0) {
    if (!flags.soloSeco && (urlsActualizar.length + urlsParcialesActualizar.length) > 0) {
      const actualizadasTareas = await actualizarUrlsTareas({ db, urlsActualizar });
      const actualizadosParciales = await actualizarUrlsParciales({ db, urlsParcialesActualizar });
      console.log(`✅ Enlace(s) completado(s): ${actualizadasTareas} en tareas y ${actualizadosParciales} en parciales.`);
    } else if (flags.soloSeco && (urlsActualizar.length + urlsParcialesActualizar.length) > 0) {
      console.log('📋 Modo seco: no se escribió nada.');
    }
    console.log('✅ No hay tareas nuevas para agregar.');
    await db.close?.();
    return;
  }

  console.log(`🆕 ${detectadas.length} tarea(s) nueva(s) detectada(s):`);
  detectadas.forEach((t, i) => {
    console.log(`\n  ${i + 1}) ${t.nombre}`);
    console.log(`     Materia: ${t.materiaNombre}`);
    console.log(`     Unidad: ${t.unidad ?? '—'}`);
    console.log(`     Inicio: ${t.inicio}   |   Fin: ${t.fin}`);
    console.log(`     Tipo: ${t.tipo}   |   Con nota: ${t.conNota}`);
    console.log(`     UGR: ${t.url || '—'}`);
  });

  if (flags.soloSeco) {
    console.log('\n📋 Modo seco: no se escribió nada.');
    await db.close?.();
    return;
  }

  const confirmar = flags.autoSi ? true : await preguntarSi(`\n¿Insertar las ${detectadas.length} tareas en la base?`);
  if (!confirmar) {
    console.log('👋 No se insertó nada.');
    await db.close?.();
    return;
  }

  const insertadas = await insertarTareasDetectadas({ db, detectadas });
  const enlacesActualizados = await actualizarUrlsTareas({ db, urlsActualizar });
  const enlacesParcialesActualizados = await actualizarUrlsParciales({ db, urlsParcialesActualizar });
  console.log(`✅ ${insertadas} tarea(s) insertada(s) correctamente.`);
  if (enlacesActualizados > 0) {
    console.log(`🔗 Se completó el enlace de ${enlacesActualizados} tarea(s) existente(s).`);
  }
  if (enlacesParcialesActualizados > 0) {
    console.log(`🔗 Se completó el enlace de ${enlacesParcialesActualizados} parcial(es) existente(s).`);
  }
  await db.close?.();
}

main().catch((error) => {
  console.error('❌ Error en la sincronización:', error?.message || error);
  process.exit(1);
});
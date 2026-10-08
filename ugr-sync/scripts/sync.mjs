// CLI de sincronización con UGR Virtual → Turso.
// Uso:
//   npm run ugr:sync              interactivo
//   npm run ugr:sync -- --yes     sin preguntas (sin PDF de cronograma; usar --cronogramas)
//   npm run ugr:sync -- --dry     solo muestra
//   npm run ugr:sync -- --cronogramas   solo añade fase PDF/Zoom al final
//
// Documentación completa: ugr-sync/docs/GUIA-SINCRONIZACION.md
import { createInterface } from 'node:readline/promises';
import { createClient } from '@libsql/client';
import { conectarUGR } from '../lib/sync-core.mjs';
import {
  faseCronogramasOficiales,
  faseDetectar,
  fasePersistir,
  imprimirResumenDetectado
} from './lib/flujo-sync-comision.mjs';

process.loadEnvFile?.('.env.local');

function leerFlags() {
  const autoSi = process.argv.includes('--yes') || process.argv.includes('-y');
  return {
    autoSi,
    soloSeco: process.argv.includes('--dry') || process.argv.includes('-d'),
    cronogramas: process.argv.includes('--cronogramas')
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

  console.log('🔑 Conectando a UGR Virtual…');
  await cliente.autenticar();
  console.log('✅ Sesión lista.');

  const { detectado, avisosDetectados, eventosSugeridos, mapeos } = await faseDetectar({ db, cliente });
  imprimirResumenDetectado({ detectado, avisosDetectados, eventosSugeridos });

  if (flags.soloSeco) {
    console.log('\n📋 Modo seco: no se escribió nada.');
    await db.close?.();
    return;
  }

  const resultado = await fasePersistir({
    db,
    detectado,
    avisosDetectados,
    eventosSugeridos,
    flags,
    preguntarSi
  });

  if (detectado.detectadas?.length > 0 || avisosDetectados.length > 0) {
    console.log(
      `✅ ${resultado.insertadas} tarea(s). ${resultado.avisosPublicados} aviso(s). ${resultado.eventosAgregados} evento(s) cronograma.`
    );
  }
  if (resultado.enlacesTareas > 0) {
    console.log(`🔗 Enlaces de tareas: ${resultado.enlacesTareas}.`);
  }
  if (resultado.enlacesParciales > 0) {
    console.log(`🔗 Enlaces de parciales: ${resultado.enlacesParciales}.`);
  }

  if (flags.cronogramas) {
    await faseCronogramasOficiales({ db, cliente, mapeos });
  }

  await db.close?.();
}

main().catch((error) => {
  console.error('❌ Error en la sincronización:', error?.message || error);
  process.exit(1);
});

// Script: sincronizar tareas nuevas y avisos de los foros desde UGR Virtual
// hacia la base local.
// Uso:
//   npm run ugr:sync          → modo interactivo (pregunta antes de insertar)
//   npm run ugr:sync -- --yes → inserta/publica todo lo detectado sin preguntar
//   npm run ugr:sync -- --dry → solo muestra lo que habría insertado
//
// Qué hace:
//   * detecta y ofrece tareas nuevas (igual que siempre);
//   * detecta avisos de los foros «Avisos/Consultas» publicados en los últimos
//     7 días y, si se confirma, los PUBLICa en la campana de la app (estado
//     'aceptado') y agrega sus eventos espontáneos (clase extra, consulta,
//     entrega, …) al cronograma. Nunca duplica: cada aviso se registra una sola
//     vez (clave curso_id + hilo_id) y los descartados no se vuelven a proponer.
// Requiere UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD y las credenciales de Turso
// en .env.local.
import { createInterface } from 'node:readline/promises';
import { createClient } from '@libsql/client';
import {
  actualizarUrlsParciales,
  actualizarUrlsTareas,
  aprobarAvisos,
  conectarUGR,
  detectarAvisosMoodle,
  detectarTareasNuevas,
  insertarAvisosDetectados,
  insertarEventosCronograma,
  insertarTareasDetectadas,
  rechazarAvisos
} from '../lib/sync-core.mjs';

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

  // 1) Tareas nuevas + backfill de enlaces.
  const { materiasLocales, cursos, mapeos, detectadas, urlsActualizar, urlsParcialesActualizar } = await detectarTareasNuevas({ db, cliente });
  // 2) Avisos de los foros del campus publicados desde hace 7 días hacia
  // adelante + eventos espontáneos (clase extra, consulta, entrega, …). Se
  // registran siempre que el sync no sea seco (para no volver a proponerlos);
  // lo que decide la pregunta de más abajo es si se PUBLICAN en la campana y
  // se agregan al cronograma.
  const { avisosDetectados, eventosSugeridos } = await detectarAvisosMoodle({ db, cliente, mapeos });

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

  if (detectadas.length > 0) {
    console.log(`🆕 ${detectadas.length} tarea(s) nueva(s) detectada(s):`);
    detectadas.forEach((t, i) => {
      console.log(`\n  ${i + 1}) ${t.nombre}`);
      console.log(`     Materia: ${t.materiaNombre}`);
      console.log(`     Unidad: ${t.unidad ?? '—'}`);
      console.log(`     Inicio: ${t.inicio}   |   Fin: ${t.fin}`);
      console.log(`     Tipo: ${t.tipo}   |   Con nota: ${t.conNota}`);
      console.log(`     UGR: ${t.url || '—'}`);
    });
  }

  if (avisosDetectados.length > 0) {
    console.log(`\n🔔 ${avisosDetectados.length} aviso(s) detectado(s) (publicados en los últimos 7 días):`);
    avisosDetectados.forEach((a, i) => {
      console.log(`   ${i + 1}) [${a.materiaNombre || a.cursoNombre}] ${a.titulo}`);
      console.log(`      Autor: ${a.autor || '—'}   |   Publicado: ${a.fecha}`);
      console.log(`      ${String(a.contenido || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`);
    });
    if (eventosSugeridos.length > 0) {
      console.log(`\n📅 ${eventosSugeridos.length} evento(s) sugerido(s) para el cronograma (día actual o en adelante):`);
      eventosSugeridos.forEach((e, i) => {
        console.log(`   ${i + 1}) ${e.tipo} · ${e.fecha} · ${e.titulo} (${e.materiaNombre})`);
      });
    }
  } else if (detectadas.length === 0) {
    console.log('✅ No hay tareas nuevas ni avisos nuevos para agregar.');
  }

  if (flags.soloSeco) {
    console.log('\n📋 Modo seco: no se escribió nada.');
    await db.close?.();
    return;
  }

  // Registrar las sugerencias de avisos. Nunca duplica: la clave
  // (curso_id, hilo_id) hace que el upsert solo refresque titulo/contenido de
  // hilos ya conocidos. La publicación en la campana se decide recién abajo.
  await insertarAvisosDetectados({ db, avisos: avisosDetectados });

  let insertadas = 0;
  let avisosPublicados = 0;
  let eventosAgregados = 0;
  let enlacesActualizados = 0;
  let enlacesParcialesActualizados = 0;

  if (detectadas.length > 0) {
    const confirmarTareas = flags.autoSi ? true : await preguntarSi(`\n¿Insertar las ${detectadas.length} tareas en la base?`);
    if (confirmarTareas) {
      insertadas = await insertarTareasDetectadas({ db, detectadas });
    }
  }

  if (avisosDetectados.length > 0) {
    const publicarAvisos = flags.autoSi
      ? true
      : await preguntarSi(`\n¿Publicar los ${avisosDetectados.length} avisos en la campana y agregar sus ${eventosSugeridos.length} evento(s) al cronograma?`);
    if (publicarAvisos) {
      avisosPublicados = await aprobarAvisos({ db, ids: avisosDetectados.map((a) => a.id) });
      eventosAgregados = await insertarEventosCronograma({ db, eventos: eventosSugeridos });
    } else {
      // Los que se descartan quedan 'rechazado': no se vuelven a proponer.
      await rechazarAvisos({ db, ids: avisosDetectados.map((a) => a.id) });
    }
  }

  if (urlsActualizar.length > 0) {
    enlacesActualizados = await actualizarUrlsTareas({ db, urlsActualizar });
  }
  if (urlsParcialesActualizar.length > 0) {
    enlacesParcialesActualizados = await actualizarUrlsParciales({ db, urlsParcialesActualizar });
  }

  if (detectadas.length > 0 || avisosDetectados.length > 0) {
    console.log(`✅ ${insertadas} tarea(s) insertada(s). ${avisosPublicados} aviso(s) publicado(s) en la campana. ${eventosAgregados} evento(s) agregado(s) al cronograma.`);
  }
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
/**
 * Fases del CLI `npm run ugr:sync`: detectar → mostrar → escribir → cronogramas.
 * El script `sync.mjs` solo parsea flags, abre DB/sesión y llama estas funciones.
 */
import {
  actualizarUrlsParciales,
  actualizarUrlsTareas,
  aplicarComplementoCampus,
  aprobarAvisos,
  detectarAvisosMoodle,
  detectarTareasNuevas,
  insertarAvisosDetectados,
  insertarEventosCronograma,
  insertarTareasDetectadas,
  rechazarAvisos
} from '../../lib/sync-core.mjs';
import { sincronizarCronogramasOficialesDesdeCampus } from '../../lib/cronograma-oficial.mjs';
import { ejecutarHigieneCronograma } from '../../../database/cronograma-higiene.mjs';

/** Lee tareas nuevas, avisos y datos auxiliares del campus (sin escribir). */
export async function faseDetectar({ db, cliente }) {
  const detectado = await detectarTareasNuevas({ db, cliente });
  const { mapeos } = detectado;
  const avisos = await detectarAvisosMoodle({ db, cliente, mapeos });
  return { detectado, ...avisos, mapeos };
}

/** Imprime resumen legible en consola. */
export function imprimirResumenDetectado({ detectado, avisosDetectados, eventosSugeridos }) {
  const {
    materiasLocales,
    cursos,
    mapeos,
    detectadas,
    urlsActualizar,
    urlsParcialesActualizar,
    eventosCalendario = [],
    horariosNuevos = []
  } = detectado;

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
    console.log(`📋 ${urlsParcialesActualizar.length} parcial(es) con enlace pendiente.`);
  }

  if (detectadas.length > 0) {
    console.log(`🆕 ${detectadas.length} tarea(s) nueva(s) detectada(s):`);
    detectadas.forEach((t, i) => {
      console.log(`\n  ${i + 1}) ${t.nombre}`);
      console.log(`     Materia: ${t.materiaNombre}`);
      console.log(`     Inicio: ${t.inicio}   |   Fin: ${t.fin}`);
      console.log(`     UGR: ${t.url || '—'}`);
    });
  }

  if (avisosDetectados.length > 0) {
    console.log(`\n🔔 ${avisosDetectados.length} aviso(s) detectado(s):`);
    avisosDetectados.forEach((a, i) => {
      console.log(`   ${i + 1}) [${a.materiaNombre || a.cursoNombre}] ${a.titulo}`);
    });
    if (eventosSugeridos.length > 0) {
      console.log(`\n📅 ${eventosSugeridos.length} evento(s) sugerido(s) para el cronograma:`);
      eventosSugeridos.forEach((e, i) => {
        console.log(`   ${i + 1}) ${e.tipo} · ${e.fecha} · ${e.titulo} (${e.materiaNombre})`);
      });
    }
  } else if (detectadas.length === 0) {
    console.log('✅ No hay tareas nuevas ni avisos nuevos para agregar.');
  }

  if (eventosCalendario.length > 0) {
    console.log(`\n📅 ${eventosCalendario.length} evento(s) del calendario del campus.`);
  }
  if (horariosNuevos.length > 0) {
    console.log(`🕒 ${horariosNuevos.length} horario(s) semanal(es) del campus.`);
  }
}

/** Escribe calendario/fechas, registra avisos y aplica confirmaciones del operador. */
export async function fasePersistir({
  db,
  detectado,
  avisosDetectados,
  eventosSugeridos,
  flags,
  preguntarSi
}) {
  const complemento = await aplicarComplementoCampus({ db, detectado });
  if (complemento.eventos || complemento.horarios || complemento.fechas) {
    console.log(`📅 Calendario: ${complemento.eventos} evento(s), ${complemento.horarios} horario(s), ${complemento.fechas} fecha(s) alineada(s).`);
  }

  await insertarAvisosDetectados({ db, avisos: avisosDetectados });

  const { detectadas, urlsActualizar, urlsParcialesActualizar } = detectado;
  let insertadas = 0;
  let avisosPublicados = 0;
  let eventosAgregados = 0;

  if (detectadas.length > 0) {
    const confirmar = flags.autoSi ? true : await preguntarSi(`\n¿Insertar las ${detectadas.length} tareas en la base?`);
    if (confirmar) insertadas = await insertarTareasDetectadas({ db, detectadas });
  }

  if (avisosDetectados.length > 0) {
    const publicar = flags.autoSi
      ? true
      : await preguntarSi(`\n¿Publicar los ${avisosDetectados.length} avisos y agregar ${eventosSugeridos.length} evento(s) al cronograma?`);
    if (publicar) {
      avisosPublicados = await aprobarAvisos({ db, ids: avisosDetectados.map((a) => a.id) });
      eventosAgregados = await insertarEventosCronograma({ db, eventos: eventosSugeridos });
    } else {
      await rechazarAvisos({ db, ids: avisosDetectados.map((a) => a.id) });
    }
  }

  const enlacesTareas = urlsActualizar.length > 0 ? await actualizarUrlsTareas({ db, urlsActualizar }) : 0;
  const enlacesParciales = urlsParcialesActualizar.length > 0
    ? await actualizarUrlsParciales({ db, urlsParcialesActualizar })
    : 0;

  return { insertadas, avisosPublicados, eventosAgregados, enlacesTareas, enlacesParciales };
}

/** PDF/Word oficiales + Zoom + higiene de ruido UGR. */
export async function faseCronogramasOficiales({ db, cliente, mapeos }) {
  console.log('\n📅 Sincronizando cronogramas oficiales (PDF/Word) y enlaces Zoom…');
  const resumen = await sincronizarCronogramasOficialesDesdeCampus({ db, cliente, mapeos });
  for (const fila of resumen) {
    if (fila.eventosPdf < 3) {
      console.log(`   · ${fila.nombre}: sin PDF parseable (${fila.recurso})`);
      continue;
    }
    console.log(
      `   · ${fila.nombre}: ${fila.eventosPdf} fecha(s) → ${fila.insertados} oficial(es); Zoom en ${fila.horariosZoom} horario(s)`
    );
  }
  const higiene = await ejecutarHigieneCronograma(db);
  if (higiene.eventosEliminados > 0) {
    console.log(`   🧹 ${higiene.eventosEliminados} evento(s) de ruido del campus eliminados.`);
  }
  return { resumen, higiene };
}

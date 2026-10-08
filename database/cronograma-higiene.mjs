import { esTituloClaseGenericaDelCampus } from '../ugr-sync/lib/calendario.mjs';
import { promoverParcialesDesdeCronograma } from '../ugr-sync/lib/sync-core.mjs';
import {
  pareceParcialCuatrimestre,
  tituloPareceClaseDePlan
} from '../ugr-sync/lib/normalizar.mjs';
import { repararCronogramaComision2026, PLANES_CRONOGRAMA_COMISION, buscarMateriaPorFragmento } from './planes-cronograma-comision.mjs';
import { textoPareceColumnasFusionadas } from '../ugr-sync/lib/cronograma-oficial.mjs';

function tituloBaseCronograma(titulo) {
  return String(titulo || '')
    .replace(/\s*\(\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\)\s*$/i, '')
    .replace(/\s*\(\d{1,2}:\d{2}\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

function esRecordatorioAperturaCierre(titulo) {
  return /^(se abre|se cierra)\b/i.test(String(titulo || '').trim());
}

function puntajeFilaCronograma(fila) {
  let puntaje = 0;
  if (fila.origen === 'manual') puntaje += 280;
  if (fila.origen === 'oficial') puntaje += 40;
  if (fila.url) puntaje += 30;
  const det = String(fila.detalles || '').trim();
  if (det && !/^horario del campus:/i.test(det)) puntaje += Math.min(det.length, 80);
  if (!esTituloClaseGenericaDelCampus(fila.titulo)) puntaje += Math.min(String(fila.titulo || '').length, 80);
  const titulo = String(fila.titulo || '');
  if (titulo.length > 90) puntaje -= 120;
  if (/^m[oó]dulo\s*(i{1,3}|iv|v|\d+)/i.test(titulo.trim())) puntaje += 60;
  return puntaje;
}

/**
 * Quita ruido del campus cuando ya hay plan manual, deduplica genéricos del mismo día
 * y promueve parciales desde filas tipo examen del cronograma.
 */
async function corregirEventosExamenMalClasificados(db) {
  const filas = await db.execute(
    "SELECT id, titulo, tipo FROM cronograma_eventos WHERE tipo = 'examen'"
  );
  let corregidos = 0;
  for (const fila of filas.rows) {
    const titulo = String(fila.titulo || '');
    if (pareceParcialCuatrimestre(titulo) && !tituloPareceClaseDePlan(titulo)) continue;
    await db.execute({
      sql: "UPDATE cronograma_eventos SET tipo = 'clase' WHERE id = ?",
      args: [fila.id]
    });
    corregidos += 1;
  }
  return corregidos;
}

async function limpiarParcialesMalImportados(db, materias) {
  const ids = [];
  for (const plan of PLANES_CRONOGRAMA_COMISION) {
    const materia = buscarMateriaPorFragmento(materias, plan.materia);
    if (!materia) continue;
    const fechasExamen = new Set(
      plan.filas.filter(([, , tipo]) => tipo === 'examen').map(([fecha]) => fecha)
    );
    const parciales = await db.execute({
      sql: 'SELECT id, nombre, fecha, detalles FROM parciales WHERE materia_id = ?',
      args: [materia.id]
    });
    for (const fila of parciales.rows) {
      const fecha = String(fila.fecha || '').slice(0, 10);
      const blob = `${fila.nombre || ''} ${fila.detalles || ''}`;
      const basura = textoPareceColumnasFusionadas(blob) || /^parcial$/i.test(String(fila.nombre || '').trim());
      const fueraDelPlan = fechasExamen.size > 0
        && !fechasExamen.has(fecha)
        && pareceParcialCuatrimestre(String(fila.nombre || ''));
      if (basura || fueraDelPlan) ids.push(fila.id);
    }
  }
  if (ids.length === 0) return 0;
  for (let i = 0; i < ids.length; i += 80) {
    const trozo = ids.slice(i, i + 80);
    await db.execute({
      sql: `DELETE FROM notas_parciales WHERE parcial_id IN (${trozo.map(() => '?').join(',')})`,
      args: trozo
    });
    await db.execute({
      sql: `DELETE FROM parciales WHERE id IN (${trozo.map(() => '?').join(',')})`,
      args: trozo
    });
  }
  return ids.length;
}

async function limpiarParcialesFantasma(db) {
  const filas = await db.execute('SELECT id, nombre FROM parciales');
  const ids = [];
  for (const fila of filas.rows) {
    const nombre = String(fila.nombre || '');
    if (pareceParcialCuatrimestre(nombre) && !tituloPareceClaseDePlan(nombre)) continue;
    ids.push(fila.id);
  }
  if (ids.length === 0) return 0;
  for (let i = 0; i < ids.length; i += 80) {
    const trozo = ids.slice(i, i + 80);
    await db.execute({
      sql: `DELETE FROM notas_parciales WHERE parcial_id IN (${trozo.map(() => '?').join(',')})`,
      args: trozo
    });
    await db.execute({
      sql: `DELETE FROM parciales WHERE id IN (${trozo.map(() => '?').join(',')})`,
      args: trozo
    });
  }
  return ids.length;
}

export async function ejecutarHigieneCronograma(db) {
  const materias = await db.execute('SELECT id, nombre FROM materias');
  const materiaIds = materias.rows.map((f) => f.id);
  await repararCronogramaComision2026(db, materias.rows);
  const tiposCorregidos = await corregirEventosExamenMalClasificados(db);
  const parcialesFantasma = await limpiarParcialesFantasma(db);
  const parcialesMalImportados = await limpiarParcialesMalImportados(db, materias.rows);

  const todas = await db.execute(
    'SELECT id, materia_id, fecha, titulo, detalles, url, origen, tipo FROM cronograma_eventos'
  );
  const filas = todas.rows.map((r) => ({
    id: r.id,
    materia_id: r.materia_id,
    fecha: r.fecha,
    titulo: r.titulo,
    detalles: r.detalles,
    url: r.url,
    origen: r.origen,
    tipo: r.tipo
  }));

  const manualEnFecha = new Set();
  const manualPorMateria = new Map();
  for (const f of filas) {
    if (f.origen !== 'manual') continue;
    manualPorMateria.set(f.materia_id, (manualPorMateria.get(f.materia_id) || 0) + 1);
    if (f.tipo === 'sin_clases' || f.tipo === 'clase' || f.tipo === 'consulta' || f.tipo === 'examen'
      || f.tipo === 'entrega' || f.tipo === 'exposición') {
      manualEnFecha.add(`${f.materia_id}|${f.fecha}`);
    }
  }
  const materiaConPlanManual = new Set(
    [...manualPorMateria.entries()].filter(([, n]) => n >= 8).map(([id]) => id)
  );

  const idsBorrar = new Set();

  for (const f of filas) {
    if (f.origen !== 'ugr') continue;
    if (esRecordatorioAperturaCierre(f.titulo)) {
      idsBorrar.add(f.id);
      continue;
    }
    if (manualEnFecha.has(`${f.materia_id}|${f.fecha}`) && esTituloClaseGenericaDelCampus(f.titulo)) {
      idsBorrar.add(f.id);
      continue;
    }
    if (materiaConPlanManual.has(f.materia_id) && esTituloClaseGenericaDelCampus(f.titulo)) {
      idsBorrar.add(f.id);
    }
    if (f.origen === 'oficial' && materiaConPlanManual.has(f.materia_id) && manualEnFecha.has(`${f.materia_id}|${f.fecha}`)) {
      idsBorrar.add(f.id);
    }
    if (textoPareceColumnasFusionadas(`${f.titulo} ${f.detalles}`)) {
      idsBorrar.add(f.id);
    }
  }

  const grupos = new Map();
  for (const f of filas) {
    if (idsBorrar.has(f.id)) continue;
    const clave = `${f.materia_id}|${f.fecha}|${tituloBaseCronograma(f.titulo)}`;
    const lista = grupos.get(clave) || [];
    lista.push(f);
    grupos.set(clave, lista);
  }

  const porDiaMateria = new Map();
  for (const f of filas) {
    if (idsBorrar.has(f.id)) continue;
    const clave = `${f.materia_id}|${f.fecha}`;
    const lista = porDiaMateria.get(clave) || [];
    lista.push(f);
    porDiaMateria.set(clave, lista);
  }
  for (const lista of porDiaMateria.values()) {
    if (lista.length < 2) continue;
    const ordenadas = [...lista].sort((a, b) => puntajeFilaCronograma(b) - puntajeFilaCronograma(a));
    const ganadora = ordenadas[0];
    for (const f of ordenadas.slice(1)) {
      if (f.id === ganadora.id) continue;
      idsBorrar.add(f.id);
    }
  }

  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    const ordenadas = [...lista].sort((a, b) => puntajeFilaCronograma(b) - puntajeFilaCronograma(a));
    const ganadora = ordenadas[0];
    for (const f of ordenadas.slice(1)) {
      if (f.id === ganadora.id) continue;
      const ambasGenericas = esTituloClaseGenericaDelCampus(f.titulo) && esTituloClaseGenericaDelCampus(ganadora.titulo);
      const pierdeUgr = f.origen === 'ugr' && (ganadora.origen === 'manual' || ambasGenericas);
      if (pierdeUgr || (f.origen === 'ugr' && ganadora.origen === 'ugr' && ambasGenericas)) {
        idsBorrar.add(f.id);
      }
    }
  }

  if (idsBorrar.size > 0) {
    const lote = [...idsBorrar];
    for (let i = 0; i < lote.length; i += 80) {
      const trozo = lote.slice(i, i + 80);
      const marks = trozo.map(() => '?').join(',');
      await db.execute({
        sql: `DELETE FROM cronograma_eventos WHERE id IN (${marks})`,
        args: trozo
      });
    }
  }

  const parciales = await promoverParcialesDesdeCronograma({ db, materiaIds });

  return {
    eventosEliminados: idsBorrar.size,
    parcialesInsertados: parciales.insertadas,
    tiposCorregidos,
    parcialesFantasma,
    parcialesMalImportados
  };
}

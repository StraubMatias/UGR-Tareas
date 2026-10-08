import { esTituloClaseGenericaDelCampus } from '../ugr-sync/lib/calendario.mjs';
import { promoverParcialesDesdeCronograma } from '../ugr-sync/lib/sync-core.mjs';

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
  if (fila.origen === 'manual') puntaje += 200;
  if (fila.url) puntaje += 30;
  const det = String(fila.detalles || '').trim();
  if (det && !/^horario del campus:/i.test(det)) puntaje += Math.min(det.length, 80);
  if (!esTituloClaseGenericaDelCampus(fila.titulo)) puntaje += Math.min(String(fila.titulo || '').length, 80);
  return puntaje;
}

/**
 * Quita ruido del campus cuando ya hay plan manual, deduplica genéricos del mismo día
 * y promueve parciales desde filas tipo examen del cronograma.
 */
export async function ejecutarHigieneCronograma(db) {
  const materias = await db.execute('SELECT id FROM materias');
  const materiaIds = materias.rows.map((f) => f.id);

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
  }

  const grupos = new Map();
  for (const f of filas) {
    if (idsBorrar.has(f.id)) continue;
    const clave = `${f.materia_id}|${f.fecha}|${tituloBaseCronograma(f.titulo)}`;
    const lista = grupos.get(clave) || [];
    lista.push(f);
    grupos.set(clave, lista);
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
    parcialesInsertados: parciales.insertadas
  };
}

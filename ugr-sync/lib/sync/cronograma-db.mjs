import { randomUUID } from 'node:crypto';
import { esTituloClaseGenericaDelCampus } from '../calendario.mjs';

function tituloSinRango(titulo) {
  return String(titulo || '').replace(/\s*\(\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\)/g, '').replace(/\s+/g, ' ').trim();
}

// Agrega eventos sugeridos al cronograma (origen 'ugr', con el enlace al hilo
// para «Ver en UGR»). Si la misma clase ya estaba con el horario largo del
// campus, se corrige esa fila en vez de dejar las dos.
export async function insertarEventosCronograma({ db, eventos }) {
  if (!Array.isArray(eventos) || eventos.length === 0) return 0;
  const validos = eventos.filter((e) => e && e.materiaId && e.fecha && e.titulo);
  const materiaIds = [...new Set(validos.map((e) => e.materiaId))];
  const exactos = new Set();
  const porBase = new Map();
  const planEnFecha = new Set();
  for (const materiaId of materiaIds) {
    const res = await db.execute({
      sql: 'SELECT id, fecha, titulo, origen, tipo FROM cronograma_eventos WHERE materia_id = ?',
      args: [materiaId]
    });
    for (const fila of res.rows) {
      exactos.add(`${materiaId}|${fila.fecha}|${fila.titulo}`);
      porBase.set(`${materiaId}|${fila.fecha}|${tituloSinRango(fila.titulo)}`, fila);
      if ((fila.origen === 'manual' || fila.origen === 'oficial') && fila.tipo !== 'sin_clases') {
        planEnFecha.add(`${materiaId}|${fila.fecha}`);
      }
    }
  }
  const cambios = [];
  for (const e of validos) {
    const titulo = String(e.titulo).slice(0, 200);
    if (/^(se abre|se cierra)\b/i.test(titulo.trim())) continue;
    if (planEnFecha.has(`${e.materiaId}|${e.fecha}`) && esTituloClaseGenericaDelCampus(titulo)) continue;
    const clave = `${e.materiaId}|${e.fecha}|${titulo}`;
    if (exactos.has(clave)) continue;
    const previa = porBase.get(`${e.materiaId}|${e.fecha}|${tituloSinRango(titulo)}`);
    if (previa && tituloSinRango(previa.titulo) === tituloSinRango(titulo) && previa.titulo !== titulo) {
      cambios.push({
        sql: 'UPDATE cronograma_eventos SET titulo = ?, detalles = ? WHERE id = ?',
        args: [titulo, e.detalles || '', previa.id]
      });
      exactos.add(clave);
      continue;
    }
    exactos.add(clave);
    porBase.set(`${e.materiaId}|${e.fecha}|${tituloSinRango(titulo)}`, { id: '', fecha: e.fecha, titulo });
    cambios.push({
      sql: `INSERT OR IGNORE INTO cronograma_eventos
            (id, materia_id, fecha, modalidad, tipo, titulo, detalles, url, origen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ugr')`,
      args: [
        `cronograma_${e.materiaId}_${e.fecha}_${titulo.slice(0, 60)}_${randomUUID().slice(0, 8)}`,
        e.materiaId,
        e.fecha,
        e.modalidad || 'sincrónico',
        e.tipo || 'clase',
        titulo,
        e.detalles || '',
        e.url || ''
      ]
    });
  }
  if (cambios.length === 0) return 0;
  await db.batch(cambios, 'write');
  return cambios.length;
}
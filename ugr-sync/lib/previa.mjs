import { randomUUID } from 'node:crypto';
import { actualizarUrlsTareas, actualizarUrlsParciales, aplicarComplementoCampus, insertarAvisosDetectados, insertarParcialesSiFaltan, insertarTareasDetectadas, aprobarAvisos, rechazarAvisos, insertarEventosCronograma } from './sync-core.mjs';

// Persistente también en serverless. Solo el servidor escribe el contenido;
// el navegador recibe un identificador y devuelve selecciones, nunca datos a insertar.
export async function prepararPrevias(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS sync_previas (
    id TEXT PRIMARY KEY, usuario TEXT NOT NULL, vence INTEGER NOT NULL,
    datos TEXT NOT NULL, resultado TEXT
  )`);
}

export async function sincronizarConPrevia({ db, usuario, confirmar = false, previaId, ids = [], idsAvisos = [], idsEventos = [], detectar, ahora = Date.now(), alumnoId, alumnoNombre }) {
  await prepararPrevias(db);
  if (!confirmar) {
    const datos = await detectar();
    // Conserva el comportamiento previo: registrar pendientes y completar
    // enlaces existentes no depende de que haya novedades seleccionables.
    await insertarAvisosDetectados({ db, avisos: datos.avisos });
    const parciales = await insertarParcialesSiFaltan({ db, detectadas: datos.parcialesDetectados || [] });
    datos.parcialesInsertados = parciales.insertadas;
    datos.urlsActualizadas = await actualizarUrlsTareas({ db, urlsActualizar: datos.urlsActualizar });
    datos.urlsParcialesActualizadas = await actualizarUrlsParciales({ db, urlsParcialesActualizar: datos.urlsParcialesActualizar });
    const complemento = await aplicarComplementoCampus({ db, detectado: datos, alumnoId, alumnoNombre });
    datos.eventosCalendarioInsertados = complemento.eventos;
    datos.horariosInsertados = complemento.horarios;
    datos.fechasActualizadas = complemento.fechas;
    const id = randomUUID();
    await db.batch([
      { sql: 'DELETE FROM sync_previas WHERE vence < ?', args: [ahora] },
      { sql: 'INSERT INTO sync_previas (id, usuario, vence, datos) VALUES (?, ?, ?, ?)',
        args: [id, usuario, ahora + 30 * 60 * 1000, JSON.stringify(datos)] }
    ], 'write');
    return { ...datos, previaId: id, confirmar: false };
  }

  const tx = await db.transaction('write');
  try {
    const res = await tx.execute({
      sql: 'SELECT datos, resultado FROM sync_previas WHERE id = ? AND usuario = ? AND vence >= ?',
      args: [typeof previaId === 'string' ? previaId : '', usuario, ahora]
    });
    const fila = res.rows[0];
    if (!fila) throw new Error('La vista previa venció o no existe. Cerrá el modal y buscá novedades de nuevo.');
    if (fila.resultado) {
      await tx.commit();
      return JSON.parse(fila.resultado);
    }
    const datos = JSON.parse(fila.datos);
    const pedidas = new Set(Array.isArray(ids) ? ids : []);
    const pedidosAvisos = new Set(Array.isArray(idsAvisos) ? idsAvisos : []);
    const pedidosEventos = new Set(Array.isArray(idsEventos) ? idsEventos : []);
    // Revalidar tareas locales: otra vista previa pudo importarlas entretanto.
    const existentes = (await tx.execute('SELECT materia_id, nombre, url FROM tareas')).rows;
    const seleccionadas = datos.detectadas.filter((t) => pedidas.has(t.idMoodle)
      && !existentes.some((e) => e.materia_id === t.materiaId && (e.nombre === t.nombre || (t.url && e.url === t.url))));
    const pendientes = new Set((await tx.execute("SELECT id FROM avisos_moodle WHERE estado = 'pendiente'")).rows.map((a) => a.id));
    const avisos = datos.avisos.filter((a) => pendientes.has(a.id));
    const aceptados = new Set(avisos.filter((a) => pedidosAvisos.has(a.id)).map((a) => a.id));
    const resultado = {
      ...datos, previaId, confirmar: true,
      insertadas: await insertarTareasDetectadas({ db: tx, detectadas: seleccionadas }),
      avisosAceptados: await aprobarAvisos({ db: tx, ids: [...aceptados] }),
      avisosRechazados: await rechazarAvisos({ db: tx, ids: avisos.filter((a) => !aceptados.has(a.id)).map((a) => a.id) }),
      eventosInsertados: await insertarEventosCronograma({ db: tx, eventos: datos.eventosSugeridos.filter((e) => aceptados.has(e.avisoId) && pedidosEventos.has(e.avisoId)) }),
      urlsActualizadas: datos.urlsActualizadas || 0,
      urlsParcialesActualizadas: datos.urlsParcialesActualizadas || 0
    };
    await tx.execute({ sql: 'UPDATE sync_previas SET resultado = ? WHERE id = ?', args: [JSON.stringify(resultado), previaId] });
    await tx.commit();
    return resultado;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

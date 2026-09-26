import { db } from '../app/turso';
import { PLAN_DE_ESTUDIO } from '../app/plan-utils';
import type { MateriaInscriptaSync, ResumenMateriaSync } from '../app/actions/types';
import {
  construirLineasInformeSync,
  fusionarLineasInforme,
  fusionarResumenSync,
  mensajeDesdeInforme,
  type NotaCampusInforme
} from '../lib/informe-sync-ugr';
import { texto, textoONull } from './action-internals';

export async function periodoDeCursada(): Promise<string> {
  const activo = await db.execute('SELECT id FROM periodos WHERE activo = 1 ORDER BY anio DESC, cuatrimestre DESC LIMIT 1');
  const existente = texto(activo.rows[0]?.id);
  if (existente) return existente;
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const cuatrimestre = ahora.getMonth() >= 7 ? 2 : 1;
  const id = `periodo_${anio}_${cuatrimestre}`;
  await db.execute({
    sql: 'INSERT OR IGNORE INTO periodos (id, anio, cuatrimestre, nombre, activo) VALUES (?, ?, ?, ?, 1)',
    args: [id, anio, cuatrimestre, `${anio} - ${cuatrimestre}° cuatrimestre`]
  });
  return id;
}

export async function inscribirAlumnoEnPeriodo(alumnoId: string, periodoId: string, materiaIds: string[]) {
  const ids = materiaIds.filter(Boolean);
  if (ids.length > 0) {
    await db.batch(ids.map((materiaId) => ({
      sql: 'INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id) VALUES (?, ?)',
      args: [alumnoId, materiaId]
    })), 'write');
    await db.execute({
      sql: `DELETE FROM inscripciones
            WHERE alumno_id = ?
              AND materia_id IN (SELECT id FROM materias WHERE periodo_id = ?)
              AND materia_id NOT IN (${ids.map(() => '?').join(',')})`,
      args: [alumnoId, periodoId, ...ids]
    });
    return;
  }
  await db.execute({
    sql: 'DELETE FROM inscripciones WHERE alumno_id = ? AND materia_id IN (SELECT id FROM materias WHERE periodo_id = ?)',
    args: [alumnoId, periodoId]
  });
}

function filaTieneCambios(fila: ResumenMateriaSync): boolean {
  return (
    fila.nuevas.length > 0
    || (fila.fechasActualizadas?.length ?? 0) > 0
    || (fila.cronogramaNuevo?.length ?? 0) > 0
    || (fila.parcialesNuevos?.length ?? 0) > 0
    || (fila.notasCargadas?.length ?? 0) > 0
    || (fila.pendientesEntrega?.length ?? 0) > 0
    || (fila.notasNoLeidas?.length ?? 0) > 0
  );
}

export function armarMensajeSync({
  materias,
  resumen,
  parciales,
  eventos,
  horarios,
  notasCargadas = [],
  notasNoLeidas = [],
  pendientesEntrega = [],
  fechas,
  condiciones,
  fechasDetalle = []
}: {
  materias: Array<{ nombre: string }>;
  resumen: ResumenMateriaSync[];
  parciales: number;
  eventos: number;
  horarios: number;
  notasCargadas?: Array<{ nombre?: string; nota?: string; yaEstaba?: boolean }>;
  notasNoLeidas?: Array<{ nombre?: string }>;
  pendientesEntrega?: Array<{ nombre?: string }>;
  fechas: number;
  condiciones: number;
  fechasDetalle?: Array<{ materiaNombre?: string; texto?: string }>;
}): string {
  const nuevas = resumen.reduce((total, fila) => total + fila.nuevas.length, 0);
  const cronNuevo = resumen.reduce((total, fila) => total + (fila.cronogramaNuevo?.length || 0), 0);
  const partes: string[] = [];
  const nuevasNotas = notasCargadas.filter((item) => item?.nombre && !item.yaEstaba);
  if (nuevasNotas.length === 1) {
    partes.push(`Nota ${nuevasNotas[0].nota} en «${nuevasNotas[0].nombre}».`);
  } else if (nuevasNotas.length > 1) {
    partes.push(`${nuevasNotas.length} notas nuevas.`);
  }
  if (nuevas === 1) {
    const nombre = resumen.flatMap((fila) => fila.nuevas)[0];
    partes.push(`1 tarea nueva: «${nombre}».`);
  } else if (nuevas > 1) {
    partes.push(`${nuevas} tareas nuevas.`);
  }
  if (fechas === 1 && fechasDetalle[0]?.texto) {
    const materia = fechasDetalle[0].materiaNombre;
    partes.push(materia ? `En ${materia}, ${fechasDetalle[0].texto}.` : fechasDetalle[0].texto);
  } else if (fechas > 1) {
    partes.push(`${fechas} fechas actualizadas según UGR Virtual.`);
  }
  if (parciales === 1) partes.push('1 parcial nuevo.');
  else if (parciales > 1) partes.push(`${parciales} parciales nuevos.`);
  if (cronNuevo) partes.push(`${cronNuevo} fecha(s) de cronograma.`);
  if (eventos) partes.push(`${eventos} evento(s) del campus.`);
  if (horarios) partes.push(`${horarios} horario(s).`);
  if (condiciones) partes.push(`Condiciones de cursada en ${condiciones} materia(s).`);
  for (const item of pendientesEntrega) {
    if (item?.nombre) partes.push(`Falta entregar «${item.nombre}» en la página para cargar la nota.`);
  }
  for (const item of notasNoLeidas) {
    if (item?.nombre) partes.push(`No pude leer la nota de «${item.nombre}».`);
  }
  const n = materias.length;
  if (partes.length === 0) {
    return n === 1
      ? 'Revisamos tu materia del período: no había tareas nuevas, cambios en fechas ni notas nuevas.'
      : `Revisamos ${n} materias: no había tareas nuevas, cambios en fechas ni notas nuevas.`;
  }
  const encabezado = n === 1 ? 'Sincronización lista.' : `Sincronización lista (${n} materias).`;
  return `${encabezado} ${partes.join(' ')}`;
}

type ItemTareaCampus = {
  materiaId?: string;
  materiaNombre?: string;
  nombre?: string;
  fin?: string;
  url?: string;
};

export type FaseSyncUgrCursada = 'preparar' | 'materias' | 'avisos' | 'nucleo' | 'completa';

export type ResultadoSyncUgr = {
  mensaje: string;
  resumen: ResumenMateriaSync[];
  materiasInscriptas: MateriaInscriptaSync[];
  notasCampus: NotaCampusInforme[];
  lineasInforme: string[];
  materiaIds?: string[];
};

async function nombresMateriasInscriptas(alumnoId: string, periodoId: string) {
  const res = await db.execute({
    sql: `SELECT m.id, m.nombre FROM inscripciones i
          JOIN materias m ON m.id = i.materia_id
          WHERE i.alumno_id = ? AND m.periodo_id = ?
          ORDER BY m.nombre`,
    args: [alumnoId, periodoId]
  });
  const nombresPorId = new Map<string, string>();
  const materiaIds: string[] = [];
  for (const fila of res.rows) {
    const id = texto(fila.id);
    materiaIds.push(id);
    nombresPorId.set(id, texto(fila.nombre));
  }
  return { materiaIds, nombresPorId };
}

/** Login + alta de materias del período e inscripciones (sin scrapear tareas todavía). */
export async function prepararCursadaCampusDelAlumno({
  alumnoId,
  cliente
}: {
  alumnoId: string;
  cliente: unknown;
}): Promise<ResultadoSyncUgr> {
  const { listarCursosDelCampus, asegurarMateriasDeLaCursada, limpiarTextoParaBusqueda } = await import('../../ugr-sync/lib/sync-core.mjs');
  const cursos = await listarCursosDelCampus(cliente);
  const periodoId = await periodoDeCursada();
  const materiasPeriodo = await db.execute({
    sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre',
    args: [periodoId]
  });
  const cursada = await asegurarMateriasDeLaCursada({
    db,
    cursos,
    materias: materiasPeriodo.rows.map((fila) => ({
      id: texto(fila.id),
      nombre: texto(fila.nombre)
    })),
    plan: PLAN_DE_ESTUDIO,
    periodoId
  });
  if (cursada.materiaIds.length === 0) {
    throw new Error('UGR Virtual no mostró materias de la carrera para esta cuenta.');
  }
  await inscribirAlumnoEnPeriodo(alumnoId, periodoId, cursada.materiaIds);
  const { nombresPorId, nombresNuevos } = cursada;
  const orden = new Map([...nombresPorId.values()].map((nombre, indice) => [nombre, indice]));
  const materiasInscriptas: MateriaInscriptaSync[] = [...nombresPorId.values()]
    .sort((a, b) => (orden.get(a) ?? 99) - (orden.get(b) ?? 99))
    .map((nombre) => {
      const clave = limpiarTextoParaBusqueda(nombre);
      return { materia: nombre, materiaNueva: !!(clave && nombresNuevos.has(clave)) };
    });
  const n = cursada.materiaIds.length;
  return {
    materiaIds: cursada.materiaIds,
    materiasInscriptas,
    resumen: [],
    notasCampus: [],
    lineasInforme: [],
    mensaje: n === 1
      ? 'Encontramos 1 materia en UGR Virtual; vamos a sincronizarla.'
      : `Encontramos ${n} materias en UGR Virtual; las vamos a sincronizar en pasos cortos.`
  };
}

/** Segunda pasada: foros de avisos y eventos de cronograma (más liviana que el núcleo). */
export async function sincronizarAvisosCampusDelAlumno({
  alumnoId,
  cliente,
  materiaIds: materiaIdsFiltro
}: {
  alumnoId: string;
  cliente: unknown;
  materiaIds?: string[];
}): Promise<ResultadoSyncUgr> {
  const {
    mapeosInscripcionesCampus,
    detectarAvisosMoodle,
    insertarEventosCronograma
  } = await import('../../ugr-sync/lib/sync-core.mjs');

  const periodoId = await periodoDeCursada();
  const { mapeos, materiaIds: materiaIdsInscriptas } = await mapeosInscripcionesCampus({
    cliente,
    db,
    alumnoId,
    periodoId
  });
  const objetivo = materiaIdsFiltro?.length
    ? new Set(materiaIdsFiltro)
    : new Set(materiaIdsInscriptas);
  const mapeosLote = mapeos.filter((m) => objetivo.has(String(m.coincidencia?.materia?.id || '')));
  const materiaIds = [...objetivo];
  if (!mapeosLote.length) {
    return {
      mensaje: 'No había materias inscriptas para revisar avisos del campus.',
      resumen: [],
      materiasInscriptas: [],
      notasCampus: [],
      lineasInforme: []
    };
  }

  const avisos = await detectarAvisosMoodle({ db, cliente, mapeos: mapeosLote });
  type ItemEventoCampus = { materiaId?: string; materiaNombre?: string; titulo?: string; fecha?: string };
  const eventosAvisos = ((avisos.eventosSugeridos || []) as ItemEventoCampus[]).filter((evento) => {
    return !!evento.materiaId && materiaIds.includes(evento.materiaId);
  });
  const eventosInsertados = await insertarEventosCronograma({ db, eventos: eventosAvisos });
  const lineasInforme: string[] = [];
  if (eventosInsertados > 0) {
    lineasInforme.push(`${eventosInsertados} evento(s) del campus agregados al cronograma.`);
  }
  const resumen: ResumenMateriaSync[] = eventosInsertados > 0
    ? [{ materia: 'Cursada', nuevas: [], yaEstaban: [], cronogramaNuevo: [`${eventosInsertados} evento(s) de avisos`], cronogramaYa: [] }]
    : [];

  return {
    mensaje: lineasInforme.length
      ? `Avisos del campus: ${lineasInforme.join(' ')}`
      : 'Revisamos los foros de avisos: no había eventos nuevos para el cronograma.',
    resumen,
    materiasInscriptas: [],
    notasCampus: [],
    lineasInforme
  };
}

/** Scrapea tareas, notas y fechas solo para las materias del lote (una pasada corta). */
export async function sincronizarLoteMateriasDelAlumno({
  alumnoId,
  alumnoNombre,
  cliente,
  materiaIds: materiaIdsLote,
  materiasEnCursada
}: {
  alumnoId: string;
  alumnoNombre: string;
  cliente: unknown;
  materiaIds: string[];
  materiasEnCursada?: number;
}): Promise<ResultadoSyncUgr> {
  const materiaIds = [...new Set(materiaIdsLote.filter(Boolean))];
  if (!materiaIds.length) {
    return {
      mensaje: 'No hay materias en esta pasada.',
      resumen: [],
      materiasInscriptas: [],
      notasCampus: [],
      lineasInforme: []
    };
  }
  const {
    mapeosInscripcionesCampus,
    detectarTareasNuevas,
    filtrarTareasDuplicadas,
    agruparResumenSync,
    anexarLineasResumenSync,
    describirActualizacionFechas,
    insertarTareasDetectadas,
    insertarParcialesSiFaltan,
    actualizarUrlsTareas,
    actualizarUrlsParciales,
    aplicarComplementoCampus,
    cargarNotasDesdeEnlaces
  } = await import('../../ugr-sync/lib/sync-core.mjs');

  const periodoId = await periodoDeCursada();
  const { mapeos, cursos } = await mapeosInscripcionesCampus({
    cliente,
    db,
    alumnoId,
    periodoId
  });
  const objetivo = new Set(materiaIds);
  const mapeosLote = mapeos.filter((m) => objetivo.has(String(m.coincidencia?.materia?.id || '')));
  if (!mapeosLote.length) {
    return {
      mensaje: 'UGR Virtual no mostró estas materias para tu cuenta en esta pasada.',
      resumen: [],
      materiasInscriptas: [],
      notasCampus: [],
      lineasInforme: []
    };
  }
  const { nombresPorId } = await nombresMateriasInscriptas(alumnoId, periodoId);

  const tareas = await detectarTareasNuevas({ db, cliente, cursos, periodoId, alumnoId, mapeos: mapeosLote });
  const detectadas = (tareas.detectadas || []) as ItemTareaCampus[];
  const propias = detectadas.filter((item) => item.materiaId && materiaIds.includes(item.materiaId));
  const existentesDb: Array<{ materiaId: string; nombre: string; url?: string }> = [];
  for (const materiaId of materiaIds) {
    const res = await db.execute({
      sql: 'SELECT materia_id, nombre, url FROM tareas WHERE materia_id = ?',
      args: [materiaId]
    });
    for (const fila of res.rows) {
      existentesDb.push({
        materiaId: texto(fila.materia_id),
        nombre: texto(fila.nombre),
        url: textoONull(fila.url) || undefined
      });
    }
  }
  const { nuevas: faltantes } = filtrarTareasDuplicadas(propias, existentesDb);
  await insertarTareasDetectadas({ db, detectadas: faltantes });
  const parcialesFuente = ((tareas.parcialesDetectados || []) as ItemTareaCampus[])
    .filter((item) => item.materiaId && materiaIds.includes(item.materiaId) && item.nombre && item.fin)
    .map((item) => ({
      ...item,
      materiaNombre: item.materiaNombre || nombresPorId.get(item.materiaId || '') || ''
    }));
  const parcialesResultado = await insertarParcialesSiFaltan({
    db,
    detectadas: parcialesFuente
  });
  await actualizarUrlsTareas({ db, urlsActualizar: tareas.urlsActualizar });
  await actualizarUrlsParciales({ db, urlsParcialesActualizar: tareas.urlsParcialesActualizar });
  const notasTardias = await cargarNotasDesdeEnlaces({
    db,
    cliente,
    materiaIds,
    alumnoId,
    alumnoNombre
  }) as {
    cargadas?: Array<{ materia?: string; nombre?: string; nota?: string; yaEstaba?: boolean }>;
    noLeidas?: Array<{ materia?: string; nombre?: string }>;
    pendientesEntrega?: Array<{ materia?: string; nombre?: string }>;
  };

  type ItemEventoCampus = { materiaId?: string; materiaNombre?: string; titulo?: string; fecha?: string };
  const conNombreMateria = (item: ItemEventoCampus): ItemEventoCampus => ({
    ...item,
    materiaNombre: nombresPorId.get(item.materiaId || '') || item.materiaNombre
  });
  const claveEvento = (item: ItemEventoCampus) => `${item.materiaId}|${item.fecha}|${String(item.titulo || '').slice(0, 200)}`;
  const existentesCron = new Set<string>();
  for (const materiaId of materiaIds) {
    const yaCron = await db.execute({
      sql: 'SELECT fecha, titulo FROM cronograma_eventos WHERE materia_id = ?',
      args: [materiaId]
    });
    for (const fila of yaCron.rows) existentesCron.add(`${materiaId}|${fila.fecha}|${fila.titulo}`);
  }

  const fechasDetalle = await describirActualizacionFechas({
    db,
    tareas: tareas.fechasActualizar,
    parciales: tareas.fechasParcialesActualizar,
    nombresPorId
  });

  const complemento = await aplicarComplementoCampus({
    db,
    detectado: tareas,
    alumnoId,
    alumnoNombre,
    materiaIds
  });

  const eventosInsertadosAvisos = 0;
  const eventosAvisos: ItemEventoCampus[] = [];

  const vistosCron = new Set<string>();
  const cronogramaNuevo: ItemEventoCampus[] = [];
  const cronogramaYa: ItemEventoCampus[] = [];
  const eventosCampus = ((tareas.eventosCalendario || []) as ItemEventoCampus[])
    .filter((item) => item.materiaId && materiaIds.includes(item.materiaId));
  for (const item of [...eventosCampus, ...eventosAvisos].map(conNombreMateria)) {
    const clave = claveEvento(item);
    if (!item.titulo || vistosCron.has(clave)) continue;
    vistosCron.add(clave);
    if (existentesCron.has(clave)) cronogramaYa.push(item);
    else cronogramaNuevo.push(item);
  }

  let resumen = agruparResumenSync({
    nuevas: faltantes,
    yaEstaban: [],
    cronogramaNuevo,
    cronogramaYa: []
  }) as ResumenMateriaSync[];
  resumen = anexarLineasResumenSync(resumen, { campo: 'fechasActualizadas', items: fechasDetalle }) as ResumenMateriaSync[];
  const parcialesInsertados = (parcialesResultado.insertadasItems || []) as Array<{ materiaNombre?: string; nombre?: string }>;
  const parcialesCronograma = (complemento.parcialesDesdeCronogramaItems || []) as Array<{ materiaId?: string; nombre?: string }>;
  resumen = anexarLineasResumenSync(
    resumen,
    {
      campo: 'parcialesNuevos',
      items: [
        ...parcialesInsertados.map((item) => ({
          materiaNombre: item.materiaNombre,
          texto: item.nombre
        })),
        ...parcialesCronograma.map((item) => ({
          materiaNombre: nombresPorId.get(item.materiaId || '') || '',
          texto: item.nombre ? `${item.nombre} (cronograma)` : ''
        })).filter((item) => item.texto)
      ]
    }
  ) as ResumenMateriaSync[];
  const orden = new Map([...nombresPorId.values()].map((nombre, indice) => [nombre, indice]));
  resumen.sort((a, b) => (orden.get(a.materia) ?? 99) - (orden.get(b.materia) ?? 99));

  const vistas = new Set<string>();
  const notasCargadas: NotaCampusInforme[] = [...(notasTardias.cargadas || []), ...(complemento.notasCargadas || [])]
    .filter((item): item is NotaCampusInforme => {
      const clave = `${item.nombre}|${item.nota}`;
      if (!item?.nombre || !item?.nota || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
  const cargadasPorNombre = new Set(notasCargadas.map((item) => String(item.nombre).toLowerCase()));
  const notasNoLeidas = (notasTardias.noLeidas || []).filter((item) => item?.nombre && !cargadasPorNombre.has(String(item.nombre).toLowerCase()));
  const pendientesEntrega = [
    ...(notasTardias.pendientesEntrega || []),
    ...((complemento.pendientesEntrega || []) as Array<{ materia?: string; nombre?: string }>)
  ].filter((item, indice, lista) => {
    const clave = String(item.nombre || '').toLowerCase();
    return clave && !cargadasPorNombre.has(clave) && lista.findIndex((otro) => String(otro.nombre).toLowerCase() === clave) === indice;
  });
  const anexar = (materia: string | undefined, campo: 'notasCargadas' | 'notasNoLeidas' | 'pendientesEntrega', textoLinea: string) => {
    if (!textoLinea) return;
    const nombreMateria = materia || resumen[0]?.materia || 'Cursada';
    let fila = resumen.find((item) => item.materia === nombreMateria);
    if (!fila) {
      fila = { materia: nombreMateria, nuevas: [], yaEstaban: [], cronogramaNuevo: [], cronogramaYa: [] };
      resumen.push(fila);
    }
    const lista = fila[campo] || [];
    if (!lista.includes(textoLinea)) lista.push(textoLinea);
    fila[campo] = lista;
  };
  for (const item of notasCargadas.filter((n) => !n.yaEstaba)) anexar(item.materia, 'notasCargadas', `${item.nombre}: ${item.nota}`);
  for (const item of pendientesEntrega) anexar(item.materia, 'pendientesEntrega', String(item.nombre));
  for (const item of notasNoLeidas) anexar(item.materia, 'notasNoLeidas', String(item.nombre));

  const resumenParaInforme = [...resumen];
  resumen = resumen.filter(filaTieneCambios);

  const materiasCount = materiasEnCursada ?? nombresPorId.size;
  const lineasInforme = construirLineasInformeSync({
    notasCampus: notasCargadas,
    resumen: resumenParaInforme,
    parcialesNuevos: parcialesResultado.insertadas,
    eventos: eventosInsertadosAvisos + complemento.eventos,
    horarios: complemento.horarios,
    fechas: complemento.fechas,
    fechasDetalle,
    condiciones: Number(tareas.condicionesActualizadas || 0),
    pendientesEntrega,
    notasNoLeidas
  });

  return {
    resumen,
    materiasInscriptas: [],
    notasCampus: notasCargadas,
    lineasInforme,
    mensaje: mensajeDesdeInforme(lineasInforme, materiasCount),
    materiaIds
  };
}

function fusionarResultadosSync(...partes: ResultadoSyncUgr[]): ResultadoSyncUgr {
  let resumen: ResumenMateriaSync[] = [];
  let lineasInforme: string[] = [];
  let notasCampus: NotaCampusInforme[] = [];
  let materiasInscriptas: MateriaInscriptaSync[] = [];
  let materiaIds: string[] = [];
  for (const parte of partes) {
    resumen = fusionarResumenSync(resumen, parte.resumen);
    lineasInforme = fusionarLineasInforme(lineasInforme, parte.lineasInforme);
    notasCampus = [...notasCampus, ...parte.notasCampus];
    if (parte.materiasInscriptas.length) materiasInscriptas = parte.materiasInscriptas;
    if (parte.materiaIds?.length) materiaIds = parte.materiaIds;
  }
  const materiasCount = Math.max(materiaIds.length, materiasInscriptas.length, 1);
  return {
    resumen,
    lineasInforme,
    notasCampus,
    materiasInscriptas,
    materiaIds,
    mensaje: mensajeDesdeInforme(lineasInforme, materiasCount)
  };
}

export async function sincronizarCursadaDelAlumno({
  alumnoId,
  alumnoNombre,
  cliente,
  fase = 'completa',
  materiaIds: materiaIdsPasada
}: {
  alumnoId: string;
  alumnoNombre: string;
  cliente: unknown;
  fase?: FaseSyncUgrCursada;
  materiaIds?: string[];
}): Promise<ResultadoSyncUgr> {
  if (fase === 'preparar') {
    return prepararCursadaCampusDelAlumno({ alumnoId, cliente });
  }
  if (fase === 'avisos') {
    return sincronizarAvisosCampusDelAlumno({ alumnoId, cliente, materiaIds: materiaIdsPasada });
  }
  if (fase === 'materias') {
    if (!materiaIdsPasada?.length) {
      throw new Error('Indicá qué materias sincronizar en esta pasada.');
    }
    const periodoId = await periodoDeCursada();
    const { materiaIds: todas } = await nombresMateriasInscriptas(alumnoId, periodoId);
    return sincronizarLoteMateriasDelAlumno({
      alumnoId,
      alumnoNombre,
      cliente,
      materiaIds: materiaIdsPasada,
      materiasEnCursada: todas.length
    });
  }
  if (fase === 'nucleo') {
    const prep = await prepararCursadaCampusDelAlumno({ alumnoId, cliente });
    const ids = prep.materiaIds || [];
    const lote = await sincronizarLoteMateriasDelAlumno({
      alumnoId,
      alumnoNombre,
      cliente,
      materiaIds: ids,
      materiasEnCursada: ids.length
    });
    return fusionarResultadosSync(prep, lote);
  }
  const prep = await prepararCursadaCampusDelAlumno({ alumnoId, cliente });
  const ids = prep.materiaIds || [];
  const lote = await sincronizarLoteMateriasDelAlumno({
    alumnoId,
    alumnoNombre,
    cliente,
    materiaIds: ids,
    materiasEnCursada: ids.length
  });
  const avisos = await sincronizarAvisosCampusDelAlumno({ alumnoId, cliente, materiaIds: ids });
  return fusionarResultadosSync(prep, lote, avisos);
}

// Cada alumno trae su cursada del período actual. Las materias, tareas,
// parciales y eventos se guardan una sola vez: el siguiente de la misma
// materia los ve. DNI y clave de UGR no se persisten.
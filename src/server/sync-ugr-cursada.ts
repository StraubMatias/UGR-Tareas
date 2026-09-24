import { db } from '../app/turso';
import { PLAN_DE_ESTUDIO } from '../app/plan-utils';
import type { ResumenMateriaSync } from '../app/actions/types';
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
  armarMensajeCursada
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
  armarMensajeCursada: (opciones: {
    materias?: Array<{ nombre: string } | string>;
    tareasNuevas?: number;
    tareasYa?: number;
    extras?: string[];
  }) => string;
}): string {
  const nuevas = resumen.reduce((total, fila) => total + fila.nuevas.length, 0);
  const ya = resumen.reduce((total, fila) => total + fila.yaEstaban.length, 0);
  const extras: string[] = [];
  const cronNuevo = resumen.reduce((total, fila) => total + (fila.cronogramaNuevo?.length || 0), 0);
  const cronYa = resumen.reduce((total, fila) => total + (fila.cronogramaYa?.length || 0), 0);
  if (cronNuevo) extras.push(`Se cargaron ${cronNuevo} fecha(s) de cronograma.`);
  else if (cronYa) extras.push('El cronograma ya estaba cargado.');
  if (parciales) extras.push(`Se cargaron ${parciales} parcial(es).`);
  if (!cronNuevo && eventos) extras.push(`Se cargaron ${eventos} evento(s).`);
  if (horarios) extras.push(`Se cargaron ${horarios} horario(s).`);
  if (fechas) extras.push(`Se actualizaron ${fechas} fecha(s) que el campus había cambiado.`);
  if (condiciones) extras.push(`Se cargó cómo se cursa y se promociona en ${condiciones} materia(s).`);
  const avisosNota: string[] = [];
  const nuevasNotas = notasCargadas.filter((item) => item?.nombre && !item.yaEstaba);
  if (nuevasNotas.length === 1) {
    avisosNota.push(`Se cargó la nota ${nuevasNotas[0].nota} en «${nuevasNotas[0].nombre}».`);
  } else if (nuevasNotas.length > 1) {
    avisosNota.push(`Se cargaron ${nuevasNotas.length} notas: ${nuevasNotas.map((item) => `«${item.nombre}» (${item.nota})`).join(', ')}.`);
  }
  for (const item of pendientesEntrega) {
    if (item?.nombre) avisosNota.push(`Entregá «${item.nombre}» para cargarle la nota.`);
  }
  for (const item of notasNoLeidas) {
    if (item?.nombre) avisosNota.push(`No pude leer la nota de «${item.nombre}».`);
  }
  const base = armarMensajeCursada({ materias, tareasNuevas: nuevas, tareasYa: ya, extras });
  return avisosNota.length ? `${avisosNota.join(' ')} ${base}` : base;
}

type ItemTareaCampus = {
  materiaId?: string;
  materiaNombre?: string;
  nombre?: string;
  fin?: string;
  url?: string;
};

export async function sincronizarCursadaDelAlumno({
  alumnoId,
  alumnoNombre,
  cliente
}: {
  alumnoId: string;
  alumnoNombre: string;
  cliente: unknown;
}): Promise<{ mensaje: string; resumen: ResumenMateriaSync[] }> {
  const {
    listarCursosDelCampus,
    asegurarMateriasDeLaCursada,
    detectarTareasNuevas,
    detectarAvisosMoodle,
    filtrarTareasDuplicadas,
    agruparResumenSync,
    armarMensajeCursada,
    limpiarTextoParaBusqueda,
    insertarTareasDetectadas,
    insertarParcialesSiFaltan,
    actualizarUrlsTareas,
    actualizarUrlsParciales,
    insertarEventosCronograma,
    aplicarComplementoCampus,
    cargarNotasDesdeEnlaces
  } = await import('../../ugr-sync/lib/sync-core.mjs');

  // 1) Materias de la carrera que esta cuenta está cursando (las extras
  //    también: Criptografía, Conceptos de Desarrollo, etc.). Lo que no está
  //    en el plan (Mi Carrera, espacios) se descarta.
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
  const { mapeos, materiaIds, nombresPorId, nombresNuevos } = cursada;
  await inscribirAlumnoEnPeriodo(alumnoId, periodoId, materiaIds);

  const tareas = await detectarTareasNuevas({ db, cliente, cursos, periodoId, alumnoId, mapeos });
  const detectadas = (tareas.detectadas || []) as ItemTareaCampus[];
  const propias = detectadas.filter((item) => item.materiaId && materiaIds.includes(item.materiaId));
  const yaCargadas = ((tareas.yaCargadas || []) as ItemTareaCampus[])
    .filter((item) => item.materiaId && materiaIds.includes(item.materiaId));
  const { nuevas: faltantes, duplicadas } = filtrarTareasDuplicadas(propias, yaCargadas);
  await insertarTareasDetectadas({ db, detectadas: faltantes });
  const parcialesFuente = ((tareas.parcialesDetectados || []) as ItemTareaCampus[])
    .filter((item) => item.materiaId && materiaIds.includes(item.materiaId) && item.nombre && item.fin);
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

  const complemento = await aplicarComplementoCampus({
    db,
    detectado: tareas,
    alumnoId,
    alumnoNombre
  });

  const avisos = await detectarAvisosMoodle({
    db,
    cliente,
    mapeos
  });
  const eventosAvisos = ((avisos.eventosSugeridos || []) as ItemEventoCampus[]).filter((evento) => {
    return !!evento.materiaId && materiaIds.includes(evento.materiaId);
  });
  const eventosInsertados = await insertarEventosCronograma({
    db,
    eventos: eventosAvisos
  });

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

  const resumen = agruparResumenSync({
    nuevas: faltantes,
    yaEstaban: [...yaCargadas, ...duplicadas],
    cronogramaNuevo,
    cronogramaYa
  }) as ResumenMateriaSync[];
  for (const nombre of nombresPorId.values()) {
    if (!resumen.some((fila) => fila.materia === nombre)) {
      resumen.push({ materia: nombre, nuevas: [], yaEstaban: [], cronogramaNuevo: [], cronogramaYa: [] });
    }
  }
  for (const fila of resumen) {
    const clave = limpiarTextoParaBusqueda(fila.materia);
    if (clave && nombresNuevos.has(clave)) fila.materiaNueva = true;
  }
  const orden = new Map([...nombresPorId.values()].map((nombre, indice) => [nombre, indice]));
  resumen.sort((a, b) => (orden.get(a.materia) ?? 99) - (orden.get(b.materia) ?? 99));

  const vistas = new Set<string>();
  const notasCargadas = [...(notasTardias.cargadas || []), ...((complemento.notasCargadas || []) as Array<{ materia?: string; nombre?: string; nota?: string; yaEstaba?: boolean }>)]
    .filter((item) => {
      const clave = `${item.nombre}|${item.nota}`;
      if (!item.nombre || !item.nota || vistas.has(clave)) return false;
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

  return {
    resumen,
    mensaje: armarMensajeSync({
      materias: [...nombresPorId.entries()].map(([, nombre]) => ({ nombre })),
      resumen,
      parciales: parcialesResultado.insertadas,
      eventos: eventosInsertados + complemento.eventos,
      horarios: complemento.horarios,
      notasCargadas,
      notasNoLeidas,
      pendientesEntrega,
      fechas: complemento.fechas,
      condiciones: Number(tareas.condicionesActualizadas || 0),
      armarMensajeCursada
    })
  };
}

// Cada alumno trae su cursada del período actual. Las materias, tareas,
// parciales y eventos se guardan una sola vez: el siguiente de la misma
// materia los ve. DNI y clave de UGR no se persisten.
// Núcleo de sincronización UGR Virtual (CLI + server actions).
// Módulos extraídos: ./sync/* (conexión, cursos, avisos, cronograma DB, pool, env).
// Mapa completo: ugr-sync/docs/GUIA-SINCRONIZACION.md
import { randomUUID } from 'node:crypto';
import { extraerConsignasDeCurso, extraerFechasActividad, extraerNotasDeLibreta, extraerProgresoDeActividad, priorizarNotaDeUltimoIntento, urlDeUltimaRevision } from './tareas.mjs';
import { debeOmitirSyncHitosAssign, priorizarYFiltrarRevisionCampus } from './sync-optimizacion.mjs';
import {
  claveTareaParaEmparejar,
  coincidirActividadMoodle,
  coincidirMateria,
  coincidirNombreTarea,
  coincidirParcial,
  emparejarCursosConMaterias,
  filtrarTareasDuplicadas,
  formatearNotaParaMostrar,
  formatearFechaTablero,
  fechasACorregir,
  agruparResumenSync,
  anexarLineasResumenSync,
  armarMensajeCursada,
  inferirTipoTarea,
  limpiarTextoParaBusqueda,
  fechaDeEvaluacion,
  pareceEvaluacion,
  pareceParcialCuatrimestre,
  esExamenFinalDelCronograma,
  parcialYaSeRindio,
  esNombreConsignaValido,
  normalizarNombre,
  separarEvaluaciones
} from './normalizar.mjs';

export {
  emparejarCursosConMaterias,
  filtrarTareasDuplicadas,
  agruparResumenSync,
  anexarLineasResumenSync,
  armarMensajeCursada,
  limpiarTextoParaBusqueda,
  separarEvaluaciones,
  describirActualizacionFechas
};
import { conectarUGR, conectarUGRCon } from './sync/conexion.mjs';
import { conPool } from './sync/pool.mjs';
import { listarCursosDelCampus, mapeosInscripcionesCampus, asegurarMateriasDeLaCursada } from './sync/cursos-campus.mjs';
import { detectarAvisosMoodle } from './sync/avisos-detectar.mjs';
import { insertarAvisosDetectados, aprobarAvisos, rechazarAvisos } from './sync/avisos-db.mjs';
import { insertarEventosCronograma } from './sync/cronograma-db.mjs';

export {
  conectarUGR,
  conectarUGRCon,
  conPool,
  listarCursosDelCampus,
  mapeosInscripcionesCampus,
  asegurarMateriasDeLaCursada,
  detectarAvisosMoodle,
  insertarAvisosDetectados,
  aprobarAvisos,
  rechazarAvisos,
  insertarEventosCronograma
};

import { ajustarClasesAlHorario, clasificarEventosCalendario, extraerEventosCalendario, timestampsDeMesesDelPeriodo } from './calendario.mjs';
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';
import { cabeceraCookies } from './autenticar.mjs';
import { extraerEnlacesDeCursada, interpretarCondiciones, textoDeArchivoCampus, urlArchivoDeRecurso } from './metodologia.mjs';
import {
  esTareaBuzonEntregasMultiples,
  esUrlAssign,
  listarTareasAssignConUrl,
  quitarHitosAssignDeTareasSimples,
  sincronizarEntregasAssignDesdeHtml
} from './assign-entregas.mjs';

async function notaDePagina(cliente, html) {
  if (!html) return { nota: null, entregada: false };
  const progreso = extraerProgresoDeActividad(html);
  if (progreso.nota != null) return progreso;
  const revision = urlDeUltimaRevision(html);
  if (!revision) return progreso;
  const detalle = await cliente.pedir(revision);
  if (!detalle?.html || detalle.es_requiere_login) return progreso;
  const deRevision = extraerProgresoDeActividad(detalle.html);
  return {
    nota: deRevision.nota,
    entregada: progreso.entregada || deRevision.entregada
  };
}

// Evita pedir el HTML de cada actividad en cada sync: el índice alcanza si las
// fechas coinciden y el cierre no está en la ventana reciente.
function actividadNecesitaDetalleFechas(existente, tarea) {
  const parcheIndice = fechasACorregir(existente, tarea);
  if (parcheIndice.inicio || parcheIndice.fin) return true;
  const inicio = existente?.inicio;
  if (!inicio || inicio === 'Sin fecha') return true;
  const fin = existente?.fin;
  if (!fin || fin === 'Sin fecha') return true;
  const cierre = new Date(
    String(fin).includes('T') ? fin : `${fin}T23:59:59.999-03:00`
  ).getTime();
  if (!Number.isFinite(cierre)) return true;
  const ahora = Date.now();
  const hace7 = 7 * 24 * 60 * 60 * 1000;
  const dentro30 = 30 * 24 * 60 * 60 * 1000;
  return cierre >= ahora - hace7 && cierre <= ahora + dentro30;
}

async function fechasDeDetalle({ cliente, tarea }) {
  try {
    if (!tarea?.url) return { inicio: null, fin: null, notaIntento: null, entregada: false };
    const pagina = await cliente.pedir(tarea.url);
    if (!pagina?.html || pagina.es_requiere_login) return { inicio: null, fin: null, notaIntento: null, entregada: false };
    const progreso = await notaDePagina(cliente, pagina.html);
    return {
      ...extraerFechasActividad(pagina.html),
      notaIntento: progreso.nota,
      entregada: progreso.entregada
    };
  } catch {
    return { inicio: null, fin: null, notaIntento: null, entregada: false };
  }
}

function pareceCuestionarioHecho(html) {
  return /quizreviewsummary|\/mod\/quiz\/review\.php|intento\s+\d+/i.test(html || '');
}

// La nota no está en el índice del curso: está en la página de cada actividad
// («Ver en UGR»). Se abre con la sesión de quien sincroniza. Los cuestionarios
// van primero y, si se pide, cada nota se guarda en cuanto se lee.
async function leerNotasDeEnlaces({
  cliente,
  db,
  materiaIds,
  alumnoId,
  alumnoNombre,
  guardar = false,
  procesarEntregasAssign = true
}) {
  if (!cliente || !materiaIds?.length) return { notas: [], cargadas: [], noLeidas: [], pendientesEntrega: [] };
  const marcas = materiaIds.map(() => '?').join(', ');
  const tareas = await db.execute({
    sql: `SELECT t.id, t.materia_id, t.nombre, t.url, t.con_nota, m.nombre AS materia,
                 nt.nota AS nota_guardada, nt.cargada_en AS nota_cargada_en, nt.cerrada AS nota_cerrada,
                 c.completada_en AS completada_en
          FROM tareas t JOIN materias m ON m.id = t.materia_id
          LEFT JOIN notas_tareas nt ON nt.tarea_id = t.id AND (nt.alumno_id = ? OR LOWER(nt.alumno) = LOWER(?))
          LEFT JOIN completadas c ON c.tarea_id = t.id AND (c.alumno_id = ? OR LOWER(c.alumno) = LOWER(?))
          WHERE t.materia_id IN (${marcas}) AND TRIM(COALESCE(t.url, '')) != ''
            AND (COALESCE(t.tipo, '') != 'foro' OR t.con_nota = 1)`,
    args: [alumnoId || '', alumnoNombre || '', alumnoId || '', alumnoNombre || '', ...materiaIds]
  });
  const parciales = await db.execute({
    sql: `SELECT p.id, p.materia_id, p.nombre, p.url, p.fecha, m.nombre AS materia,
                 np.nota AS nota_guardada, np.cerrada AS nota_cerrada
          FROM parciales p JOIN materias m ON m.id = p.materia_id
          LEFT JOIN notas_parciales np ON np.parcial_id = p.id AND (np.alumno_id = ? OR LOWER(np.alumno) = LOWER(?))
          WHERE p.materia_id IN (${marcas}) AND TRIM(COALESCE(p.url, '')) != ''`,
    args: [alumnoId || '', alumnoNombre || '', ...materiaIds]
  });
  const lista = [
    ...tareas.rows.map((fila) => ({
      ...fila,
      tabla: 'tareas',
      fecha: null,
      esBuzonMulti: esUrlAssign(fila.url) && esTareaBuzonEntregasMultiples(fila.nombre)
    })),
    ...parciales.rows.map((fila) => ({ ...fila, tabla: 'parciales', esBuzonMulti: false }))
  ];

  const { consultar: aConsultar } = priorizarYFiltrarRevisionCampus(lista, {
    omitirBuzonMulti: !procesarEntregasAssign
  });

  const notas = [];
  const cargadas = [];
  const noLeidas = [];
  const pendientesEntrega = [];
  await conPool(aConsultar, 4, async (fila) => {
    try {
      if (esUrlAssign(fila.url) && esTareaBuzonEntregasMultiples(fila.nombre) && !procesarEntregasAssign) {
        return;
      }
      const pagina = await cliente.pedir(fila.url);
      const esQuiz = /\/mod\/quiz\//.test(String(fila.url));
      if (!pagina?.html || pagina.es_requiere_login) {
        if (esQuiz) noLeidas.push({ materia: fila.materia, nombre: fila.nombre });
        return;
      }
      const esAssign = esUrlAssign(fila.url);
      let resumenEntregas = null;
      if (esAssign && guardar && alumnoId && procesarEntregasAssign) {
        const syncEnt = await sincronizarEntregasAssignDesdeHtml({
          cliente,
          db,
          tareaId: fila.id,
          alumnoId,
          alumnoNombre,
          html: pagina.html,
          baseUrl: UGR_BASE_URL
        });
        resumenEntregas = syncEnt.resumen;
      }
      let progreso;
      if (esAssign && resumenEntregas) {
        progreso = {
          nota: resumenEntregas.notaParaTablero ?? null,
          entregada: resumenEntregas.entregada
        };
      } else {
        progreso = await notaDePagina(cliente, pagina.html);
      }
      if (progreso.nota == null && !progreso.entregada && !resumenEntregas) {
        if (esQuiz && pareceCuestionarioHecho(pagina.html)) noLeidas.push({ materia: fila.materia, nombre: fila.nombre });
        return;
      }
      const item = {
        materiaId: fila.materia_id,
        materiaNombre: fila.materia,
        nombre: fila.nombre,
        id: fila.id,
        tabla: fila.tabla,
        fecha: fila.fecha || null,
        nota: progreso.nota,
        entregada: progreso.entregada,
        forzar: guardar && progreso.nota != null
      };
      notas.push(item);
      if (guardar && alumnoId && item.nota != null) {
        const escrito = await aplicarProgresoCampus({ db, progreso: [item], alumnoId, alumnoNombre });
        cargadas.push(...escrito.cargadas);
        pendientesEntrega.push(...(escrito.pendientesEntrega || []));
      } else if (guardar && alumnoId && item.entregada && item.nota == null) {
        const escrito = await aplicarProgresoCampus({ db, progreso: [item], alumnoId, alumnoNombre });
        pendientesEntrega.push(...(escrito.pendientesEntrega || []));
      }
    } catch (error) {
      if (esUrlAssign(fila.url)) {
        noLeidas.push({ materia: fila.materia, nombre: fila.nombre, error: String(error?.message || 'assign') });
      } else if (/\/mod\/quiz\//.test(String(fila.url))) {
        noLeidas.push({ materia: fila.materia, nombre: fila.nombre });
      }
    }
  });
  return { notas, cargadas, noLeidas, pendientesEntrega };
}

export async function cargarNotasDesdeEnlaces({
  cliente,
  db,
  materiaIds,
  alumnoId,
  alumnoNombre,
  procesarEntregasAssign = true
}) {
  return leerNotasDeEnlaces({
    cliente,
    db,
    materiaIds,
    alumnoId,
    alumnoNombre,
    guardar: true,
    procesarEntregasAssign
  });
}

async function fingerprintEntregasAssign(db, tareaId, alumnoId) {
  const res = await db.execute({
    sql: `SELECT numero, indice_entrega, es_activa, estado, nota FROM tareas_entregas
          WHERE tarea_id = ? AND alumno_id = ? ORDER BY numero ASC`,
    args: [tareaId, alumnoId]
  });
  return JSON.stringify(
    (res.rows || []).map((r) => [r.numero, r.indice_entrega, r.es_activa, r.estado, r.nota])
  );
}

/** Corre primero en cada lote de materias: entregas múltiples + devoluciones Word. */
export async function sincronizarHitosAssignEnMaterias({
  cliente,
  db,
  materiaIds,
  alumnoId,
  alumnoNombre
}) {
  await quitarHitosAssignDeTareasSimples(db, materiaIds);
  const filas = await listarTareasAssignConUrl(db, materiaIds);
  const lineasInforme = [];
  const notasCargadas = [];
  const tareasEntregasActualizadas = [];
  if (!filas.length || !alumnoId) return { lineasInforme, notasCargadas, tareas: 0, tareasEntregasActualizadas };

  await conPool(filas, 1, async (fila) => {
    try {
      const entregasDb = await db.execute({
        sql: 'SELECT es_activa, nota, sincronizado_en FROM tareas_entregas WHERE tarea_id = ? AND alumno_id = ?',
        args: [fila.id, alumnoId]
      });
      if (debeOmitirSyncHitosAssign(entregasDb.rows)) return;

      const huellaAntes = await fingerprintEntregasAssign(db, fila.id, alumnoId);
      const pagina = await cliente.pedir(fila.url);
      if (!pagina?.html || pagina.es_requiere_login) {
        lineasInforme.push(`No se pudo abrir el buzón «${fila.nombre}» en UGR Virtual.`);
        return;
      }
      const syncEnt = await sincronizarEntregasAssignDesdeHtml({
        cliente,
        db,
        tareaId: fila.id,
        alumnoId,
        alumnoNombre,
        html: pagina.html,
        baseUrl: UGR_BASE_URL
      });
      const { resumen, entregas } = syncEnt;
      const huellaDespues = await fingerprintEntregasAssign(db, fila.id, alumnoId);
      const huboCambioEntregas = huellaAntes !== huellaDespues;
      if (!entregas?.length) {
        if (huboCambioEntregas) {
          lineasInforme.push(`«${fila.nombre}»: sin hitos de entrega legibles en el campus.`);
        }
        return;
      }
      if (huboCambioEntregas) tareasEntregasActualizadas.push(fila.id);
      const partes = entregas
        .filter((e) => e.indiceEntrega != null)
        .map((e) => {
          const etiqueta = `entrega ${e.indiceEntrega}`;
          if (e.nota != null && !e.esActiva) return `${etiqueta}: nota ${e.nota}`;
          if (e.pendiente || e.esActiva) return `${etiqueta}: pendiente`;
          return etiqueta;
        });
      if (huboCambioEntregas && partes.length) {
        lineasInforme.push(`«${fila.nombre}» (${fila.materia}): ${partes.join('; ')}.`);
      }
      const sinNotaConDevolucion = entregas.some(
        (e) => e.indiceEntrega === 1 && !e.esActiva && e.nota == null
          && (e.archivos?.length || (e.comentarioProf?.length > 15))
      );
      if (huboCambioEntregas && sinNotaConDevolucion) {
        lineasInforme.push(
          `«${fila.nombre}»: entrega 1 con devolución en campus; si no ves la nota, abrí la devolución en UGR y volvé a sincronizar.`
        );
      }
      if (resumen?.notaParaTablero != null && resumen.entregada) {
        const item = {
          tareaId: fila.id,
          materia: fila.materia,
          nombre: fila.nombre,
          nota: String(resumen.notaParaTablero),
          yaEstaba: false
        };
        try {
          const escrito = await aplicarProgresoCampus({
            db,
            progreso: [{
              materiaId: fila.materia_id,
              materiaNombre: fila.materia,
              nombre: fila.nombre,
              id: fila.id,
              tabla: 'tareas',
              nota: resumen.notaParaTablero,
              entregada: true,
              forzar: true
            }],
            alumnoId,
            alumnoNombre
          });
          const cargada = escrito.cargadas?.[0];
          if (cargada) item.yaEstaba = Boolean(cargada.yaEstaba);
          notasCargadas.push(item);
        } catch (errorNota) {
          const detalle = String(errorNota?.message || 'nota').slice(0, 80);
          lineasInforme.push(`«${fila.nombre}»: entregas guardadas; no pudimos escribir la nota en el tablero (${detalle}).`);
        }
      } else if (resumen?.notaParaTablero != null && !resumen.entregada) {
        await db.execute({
          sql: `DELETE FROM notas_tareas WHERE tarea_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))`,
          args: [fila.id, alumnoId, alumnoNombre || '']
        });
      }
    } catch (error) {
      const detalle = String(error?.message || 'error').slice(0, 100);
      lineasInforme.push(`Error al leer entregas de «${fila.nombre}» (${detalle}).`);
    }
  });

  return { lineasInforme, notasCargadas, tareas: filas.length, tareasEntregasActualizadas };
}


// Recorre los cursos del campus, los mapea contra las materias locales y
// devuelve las tareas nuevas que todavía no existen en la base.
export async function detectarTareasNuevas({ db, cliente, cursos: cursosDados, periodoId, alumnoId, mapeos: mapeosDados } = {}) {
  // 1) Materias locales (destino). Un período acota el match a esa cursada.
  const resMaterias = periodoId
    ? await db.execute({ sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre', args: [periodoId] })
    : await db.execute('SELECT id, nombre FROM materias ORDER BY nombre');
  const materiasLocales = resMaterias.rows;

  // 2) Cursos del campus. Si el llamador ya armó el mapeo (las materias de la
  // carrera que cursa esa cuenta), no se vuelve a adivinar: se carga eso.
  const cursos = cursosDados || await listarCursosDelCampus(cliente);
  const mapeos = Array.isArray(mapeosDados) && mapeosDados.length > 0
    ? mapeosDados.filter((item) => item?.curso && item?.coincidencia?.materia?.id)
    : cursos.flatMap((curso) => {
      const coincidencia = coincidirMateria(curso.nombre, materiasLocales);
      return coincidencia ? [{ curso, coincidencia }] : [];
    });

  await moverTareasQueSonParciales({
    db,
    materiaIds: [...new Set(mapeos.map((item) => item.coincidencia.materia.id).filter(Boolean))]
  });

  // 3) Tareas de cada curso mapeado y detección de faltantes.
  const detectadas = [];
  const yaCargadas = [];
  // Tareas locales que ya existen pero quedaron sin enlace: las cargamos en
  // esta misma pasada (backfill de la columna `url`).
  const urlsActualizar = [];
  // Parciales ya cargados que también quedaron sin enlace (los que se cargan
  // desde el cronograma no traen URL de UGR): se completan acá mismo.
  const urlsParcialesActualizar = [];
  // La fecha en que se toma cada parcial: el día que abre, en el horario de
  // clase. El cierre del campus es el mismo día y no se guarda aparte.
  const fechasTomaParciales = [];
  const fechasTareasRevisar = [];
  const notasIntento = [];

  // Los overviews de todos los cursos se piden en paralelo (concurrencia 4) y el
  // detalle de fechas se lee SOLO para las actividades que todavía no existen en
  // la base: un sync sin novedades no encadena un pedido HTTP por tarea (ese era
  // el motivo principal de la lentitud cuando no había nada nuevo que importar).
  const cursosConActividades = await conPool(mapeos, 4, async ({ curso, coincidencia }) => {
    try {
      const actividades = await extraerConsignasDeCurso(cliente, curso.id, { baseUrl: UGR_BASE_URL, rutas: UGR_RUTAS });
      return { curso, coincidencia, actividades };
    } catch {
      return null;
    }
  });

  await conPool(cursosConActividades, 4, async (resultado) => {
    if (!resultado) return;
    const { curso, coincidencia, actividades } = resultado;
    const tareasUnicas = (actividades || []).filter((t) => t?.id);

    // Las tareas ya importadas no se vuelven a insertar; pero las de antes de
    // que existiera la columna `url` quedaron sin enlace, así que los
    // aprovechamos para completarlos con el link real a UGR Virtual. La clave
    // ignora el sufijo «(FORO)» que el usuario agrega a mano a los foros, y el
    // match por nombre tolera sufijos explicativos («(Video 5m)»), para que el
    // backfill también alcance a las actividades cargadas a mano.
    const resExistentes = await db.execute({
      sql: 'SELECT id, nombre, url, inicio, fin FROM tareas WHERE materia_id = ?',
      args: [coincidencia.materia.id]
    });
    const existentesPorClave = new Map(
      resExistentes.rows.map((t) => [claveTareaParaEmparejar(t.nombre), t])
    );
    const filaExistente = (nombreFinal, tareaCampus) => {
      const clave = claveTareaParaEmparejar(nombreFinal);
      const porClave = existentesPorClave.get(clave);
      if (porClave) return porClave;
      const campus = { materiaId: coincidencia.materia.id, nombre: nombreFinal, url: tareaCampus?.url || '', id: tareaCampus?.id };
      return resExistentes.rows.find((t) => coincidirActividadMoodle(
        { materiaId: coincidencia.materia.id, nombre: t.nombre, url: t.url, id: t.id },
        campus
      )) || null;
    };

    // Exámenes ya cargados como parcial en VistaParciales: no son tareas a
    // insertar de nuevo. Moodle suele etiquetar el examen con la fecha del
    // anuncio («martes 9 de Junio …») que puede no ser la fecha real del evento
    // (martes 10 de Noviembre); y los parciales cargados por cronograma suelen
    // tener otro nombre que la actividad de Moodle. coincidirParcial() cubre
    // ambos casos (núcleo del nombre y misma fecha de fin en la misma materia).
    const resParciales = await db.execute({
      sql: 'SELECT id, nombre, fecha, url FROM parciales WHERE materia_id = ?',
      args: [coincidencia.materia.id]
    });
    let resHorarios = { rows: [] };
    try {
      resHorarios = await db.execute({
        sql: 'SELECT dia FROM horarios WHERE materia_id = ? AND alumno_id IS NULL',
        args: [coincidencia.materia.id]
      });
    } catch {
      resHorarios = { rows: [] };
    }

    // Lo ya cargado se vuelve a mirar: el profesor puede correr un vencimiento
    // o corregir una fecha. La actividad dice la fecha posta; los foros, que
    // no tienen plazo, se comparan con lo que traiga el índice.
    const candidatas = [];
    const aRevisar = [];
    for (const tarea of tareasUnicas) {
      if (!esNombreConsignaValido(tarea.nombre)) continue;
      const nombreFinal = normalizarNombre({ nombre: tarea.nombre, cursoNombre: curso.nombre });
      if (!esNombreConsignaValido(nombreFinal)) continue;
      const existente = filaExistente(nombreFinal, tarea);
      if (existente) {
        yaCargadas.push({
          materiaId: coincidencia.materia.id,
          materiaNombre: coincidencia.materia.nombre,
          nombre: nombreFinal
        });
        if (tarea.url) {
          const sinUrl = !String(existente.url || '').trim();
          const mejoraAssign = esUrlAssign(tarea.url) && !esUrlAssign(existente.url);
          if (sinUrl || mejoraAssign) {
            urlsActualizar.push({ id: existente.id, url: tarea.url, forzar: mejoraAssign });
          }
        }
        // La página de la actividad es la fecha que editó el profesor. El índice
        // a veces no trae la apertura, así que no alcanza para dar por buena
        // la que ya teníamos guardada.
        if (tarea.url && tarea.tipo !== 'foro') {
          const parcheIndice = fechasACorregir(existente, tarea);
          if (parcheIndice.inicio || parcheIndice.fin) {
            fechasTareasRevisar.push({
              id: existente.id,
              nombre: nombreFinal,
              materiaId: coincidencia.materia.id,
              materiaNombre: coincidencia.materia.nombre,
              ...parcheIndice
            });
          }
          if (actividadNecesitaDetalleFechas(existente, tarea)) {
            aRevisar.push({ tarea, nombreFinal, existente });
          }
        } else {
          const parche = fechasACorregir(existente, tarea);
          if (parche.inicio || parche.fin) {
            fechasTareasRevisar.push({
              id: existente.id,
              nombre: nombreFinal,
              materiaId: coincidencia.materia.id,
              materiaNombre: coincidencia.materia.nombre,
              ...parche
            });
          }
          if (alumnoId && tarea.notaCampus != null) {
            notasIntento.push({
              materiaId: coincidencia.materia.id,
              materiaNombre: coincidencia.materia.nombre,
              nombre: nombreFinal,
              id: existente.id,
              tabla: 'tareas',
              nota: tarea.notaCampus,
              entregada: true,
              forzar: true
            });
          }
        }
        continue;
      }
      candidatas.push({ tarea, nombreFinal });
    }

    // La apertura no viene en el índice: se lee del detalle de cada candidata,
    // en paralelo (concurrencia 4).
    const conFechas = await conPool([...candidatas, ...aRevisar], 4, async ({ tarea, nombreFinal, existente }) => {
      const fechas = await fechasDeDetalle({ cliente, tarea });
      const inicio = fechas.inicio || (tarea.inicio && tarea.inicio !== 'Sin fecha' ? tarea.inicio : 'Sin fecha');
      const fin = fechas.fin || (tarea.fin && tarea.fin !== 'Sin fecha' ? tarea.fin : 'Sin fecha');
      return { tarea, nombreFinal, existente, inicio, fin, notaIntento: fechas.notaIntento, entregada: fechas.entregada };
    });

    for (const { tarea, nombreFinal, existente, inicio, fin, notaIntento, entregada } of conFechas) {
      if (alumnoId && (notaIntento != null || entregada || tarea.entregada || tarea.notaCampus != null)) {
        const notaCampus = notaIntento != null ? notaIntento : tarea.notaCampus ?? null;
        notasIntento.push({
          materiaId: coincidencia.materia.id,
          materiaNombre: coincidencia.materia.nombre,
          nombre: nombreFinal,
          id: existente?.id || null,
          tabla: existente ? 'tareas' : 'nueva',
          nota: notaCampus,
          entregada: true,
          forzar: notaCampus != null
        });
      }
      if (existente) {
        const parche = fechasACorregir(existente, { inicio, fin });
        if (parche.inicio || parche.fin) {
          fechasTareasRevisar.push({
            id: existente.id,
            nombre: nombreFinal,
            materiaId: coincidencia.materia.id,
            materiaNombre: coincidencia.materia.nombre,
            ...parche
          });
        }
        continue;
      }
      // Ya está resuelto como parcial en VistaParciales: no se ofrece como tarea
      // nueva ni se intenta insertar. Además, si ese parcial quedó sin enlace
      // (los cargados por cronograma no traen URL), aprovechamos para completarlo
      // con el link real a UGR Virtual. El match es por núcleo del nombre (cubre
      // el «Examen PARCIAL …» con la fecha del anuncio en el rótulo) o, si no,
      // por la misma fecha de fin en la misma materia (cubre los parcialitos
      // cargados desde el cronograma con otro nombre, como el «Avance de medio
      // cursado» de Gestión de Activos).
      const fechaToma = fechaDeEvaluacion({ inicio, fin }, resHorarios.rows);
      const parcial = coincidirParcial({
        parciales: resParciales.rows,
        nombre: nombreFinal,
        fin: fechaToma || fin
      });
      if (parcial || (pareceEvaluacion(nombreFinal) && fechaToma)) {
        if (parcial) {
          if (!parcial.url && tarea.url) {
            urlsParcialesActualizar.push({ id: parcial.id, url: tarea.url });
          }
          if (fechaToma && parcial.fecha !== fechaToma) {
            fechasTomaParciales.push({ id: parcial.id, fin: fechaToma });
          }
        } else {
          detectadas.push({
            materiaId: coincidencia.materia.id,
            materiaNombre: coincidencia.materia.nombre,
            cursoNombre: curso.nombre,
            idMoodle: `moodle_${curso.id}_${tarea.id}`,
            nombre: nombreFinal,
            inicio: fechaToma,
            fin: fechaToma,
            unidad: tarea.unidad ?? null,
            conNota: tarea.conNota,
            tipo: tarea.tipo || inferirTipoTarea(nombreFinal),
            url: tarea.url || '',
            detalles: 'Importada desde UGR Virtual'
          });
        }
        continue;
      }
      detectadas.push({
        materiaId: coincidencia.materia.id,
        materiaNombre: coincidencia.materia.nombre,
        cursoNombre: curso.nombre,
        idMoodle: `moodle_${curso.id}_${tarea.id}`,
        nombre: nombreFinal,
        inicio,
        fin,
        unidad: tarea.unidad ?? null,
        conNota: tarea.conNota,
        tipo: tarea.tipo || inferirTipoTarea(nombreFinal),
        url: tarea.url || '',
        detalles: 'Importada desde UGR Virtual'
      });
    }
  });
  const ordenMaterias = new Map(mapeos.map((m, i) => [m.coincidencia.materia.id, i]));
  detectadas.sort((a, b) => ordenMaterias.get(a.materiaId) - ordenMaterias.get(b.materiaId));
  const separado = separarEvaluaciones(detectadas);

  const calendario = await completarDesdeCalendario({ cliente, db, mapeos, detectadas: separado.tareas, periodoId });
  const progreso = alumnoId
    ? await leerProgresoCampus({ cliente, db, mapeos, detectadas: [...separado.tareas, ...separado.parciales], alumnoId })
    : { progresoAlumno: [] };
  progreso.progresoAlumno = priorizarNotaDeUltimoIntento(progreso.progresoAlumno, notasIntento);

  const condicionesActualizadas = await completarCondicionesCampus({ db, cliente, mapeos });
  const fechasCalendario = (calendario.fechasParcialesActualizar || [])
    .filter((fila) => !fechasTomaParciales.some((toma) => toma.id === fila.id));
  const fechasTareas = new Map();
  for (const fila of calendario.fechasActualizar || []) {
    if (fila?.id) fechasTareas.set(fila.id, { ...fila });
  }
  for (const fila of fechasTareasRevisar) {
    const previa = fechasTareas.get(fila.id) || { id: fila.id };
    fechasTareas.set(fila.id, { ...previa, ...fila });
  }
  return {
    materiasLocales,
    cursos,
    mapeos,
    detectadas: separado.tareas,
    parcialesDetectados: separado.parciales,
    yaCargadas,
    urlsActualizar,
    urlsParcialesActualizar,
    ...calendario,
    fechasActualizar: [...fechasTareas.values()],
    fechasParcialesActualizar: [...fechasCalendario, ...fechasTomaParciales],
    condicionesActualizadas,
    ...progreso
  };
}

// El calendario del curso trae las clases y los vencimientos que el overview no
// muestra. Completa fechas vacías o distintas y arma el cronograma que falta.
export async function moverTareasQueSonParciales({ db, materiaIds }) {
  let movidas = 0;
  for (const materiaId of [...new Set((materiaIds || []).filter(Boolean))]) {
    const tareas = await db.execute({
      sql: 'SELECT id, nombre, inicio, fin, url, detalles FROM tareas WHERE materia_id = ?',
      args: [materiaId]
    });
    const parciales = await db.execute({
      sql: 'SELECT id, nombre, fecha, url FROM parciales WHERE materia_id = ?',
      args: [materiaId]
    });
    let horarios = { rows: [] };
    try {
      horarios = await db.execute({
        sql: 'SELECT dia FROM horarios WHERE materia_id = ? AND alumno_id IS NULL',
        args: [materiaId]
      });
    } catch {
      horarios = { rows: [] };
    }
    for (const tarea of tareas.rows) {
      if (!pareceEvaluacion(tarea.nombre)) continue;
      const fecha = fechaDeEvaluacion(tarea, horarios.rows);
      if (!fecha) continue;
      let parcial = coincidirParcial({ parciales: parciales.rows, nombre: tarea.nombre, fin: fecha });
      if (!parcial) {
        const id = `parcial_${randomUUID()}`;
        await db.execute({
          sql: 'INSERT INTO parciales (id, materia_id, nombre, fecha, detalles, url) VALUES (?, ?, ?, ?, ?, ?)',
          args: [id, materiaId, String(tarea.nombre).slice(0, 100), fecha, tarea.detalles || 'Importada desde UGR Virtual', tarea.url || '']
        });
        parcial = { id, nombre: tarea.nombre, fecha };
        parciales.rows.push(parcial);
      }
      const notas = await db.execute({
        sql: 'SELECT alumno_id, alumno, nota FROM notas_tareas WHERE tarea_id = ?',
        args: [tarea.id]
      });
      for (const nota of notas.rows) {
        const existe = await db.execute({
          sql: 'SELECT id FROM notas_parciales WHERE parcial_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))',
          args: [parcial.id, nota.alumno_id || '', nota.alumno || '']
        });
        if (existe.rows.length > 0) continue;
        await db.execute({
          sql: 'INSERT INTO notas_parciales (id, parcial_id, alumno_id, alumno, nota) VALUES (?, ?, ?, ?, ?)',
          args: [`nota_${parcial.id}_${nota.alumno_id || nota.alumno}`, parcial.id, nota.alumno_id || '', nota.alumno || '', nota.nota]
        });
      }
      await db.execute({ sql: 'DELETE FROM completadas WHERE tarea_id = ?', args: [tarea.id] });
      await db.execute({ sql: 'DELETE FROM notas_tareas WHERE tarea_id = ?', args: [tarea.id] });
      for (const sql of [
        'DELETE FROM integrantes_tareas WHERE tarea_id = ?',
        'DELETE FROM grupos_tareas WHERE tarea_id = ?'
      ]) {
        try {
          await db.execute({ sql, args: [tarea.id] });
        } catch {
          // La tarea puede no tener grupo.
        }
      }
      await db.execute({ sql: 'DELETE FROM tareas WHERE id = ?', args: [tarea.id] });
      movidas += 1;
    }
  }
  return movidas;
}

// Si la materia todavía no dice cómo se regulariza y cómo se promociona, se lee
// la metodología del aula. Lo que ya estaba cargado no se pisa.
export async function completarCondicionesCampus({ db, cliente, mapeos }) {
  const pendientes = [];
  for (const mapeo of mapeos || []) {
    const materiaId = mapeo?.coincidencia?.materia?.id;
    const cursoId = mapeo?.curso?.id;
    if (!materiaId || !cursoId) continue;
    const fila = await db.execute({
      sql: 'SELECT condiciones FROM materias WHERE id = ?',
      args: [materiaId]
    });
    if (String(fila.rows[0]?.condiciones || '').trim()) continue;
    pendientes.push({ materiaId, cursoId });
  }
  const hechas = [];
  await conPool(pendientes, 4, async ({ materiaId, cursoId }) => {
    try {
      const condiciones = await leerCondicionesDeCurso(cliente, cursoId);
      if (!condiciones) return;
      const resultado = await db.execute({
        sql: `UPDATE materias
              SET condiciones = ?,
                  regla_promocion = ?,
                  nota_minima_regularizar = COALESCE(?, nota_minima_regularizar),
                  nota_minima_promocionar = COALESCE(?, nota_minima_promocionar)
              WHERE id = ? AND (condiciones IS NULL OR TRIM(condiciones) = '')`,
        args: [condiciones.condiciones, condiciones.regla, condiciones.regularizar, condiciones.promocionar, materiaId]
      });
      if (Number(resultado.rowsAffected || 0) > 0) hechas.push(materiaId);
    } catch {
      // Una metodología ilegible no frena el resto de la sincronización.
    }
  });
  return hechas.length;
}

async function leerCondicionesDeCurso(cliente, cursoId) {
  const pagina = await cliente.pedir(UGR_RUTAS.curso(cursoId));
  const enlaces = extraerEnlacesDeCursada(pagina.html);
  const orden = [
    ...enlaces.filter((enlace) => enlace.tipo === 'metodologia'),
    ...enlaces.filter((enlace) => enlace.tipo === 'programa')
  ];
  for (const enlace of orden) {
    const recurso = await cliente.pedir(enlace.href);
    const archivo = urlArchivoDeRecurso(recurso.html);
    if (!archivo) continue;
    const respuesta = await fetch(archivo, {
      headers: {
        Cookie: cabeceraCookies(cliente.jar),
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)'
      }
    });
    if (!respuesta.ok) continue;
    const texto = textoDeArchivoCampus(Buffer.from(await respuesta.arrayBuffer()));
    const condiciones = interpretarCondiciones(texto);
    if (condiciones) return condiciones;
  }
  return null;
}

async function completarDesdeCalendario({ cliente, db, mapeos, detectadas, periodoId }) {
  const pendientes = [];
  for (const mapeo of mapeos) {
    const materiaId = mapeo?.coincidencia?.materia?.id;
    if (!materiaId) continue;
    const ya = await db.execute({
      sql: "SELECT 1 FROM cronograma_eventos WHERE materia_id = ? AND origen IN ('manual', 'oficial') LIMIT 1",
      args: [materiaId]
    });
    if (ya.rows.length > 0) continue;
    pendientes.push(mapeo);
  }
  const paginas = await conPool(pendientes, 4, async ({ curso, coincidencia }) => {
    try {
      const proximos = await cliente.pedir(UGR_RUTAS.calendarioCurso(curso.id));
      const eventos = extraerEventosCalendario(proximos.html);
      const periodo = periodoId ? await db.execute({ sql: 'SELECT anio, cuatrimestre FROM periodos WHERE id = ?', args: [periodoId] }) : { rows: [] };
      const anio = Number(periodo.rows[0]?.anio) || new Date().getFullYear();
      const cuatrimestre = Number(periodo.rows[0]?.cuatrimestre) || 2;
      const meses = await conPool(timestampsDeMesesDelPeriodo(anio, cuatrimestre), 4, async (time) => {
        const pagina = await cliente.pedir(UGR_RUTAS.calendarioMes(curso.id, time));
        return extraerEventosCalendario(pagina.html);
      });
      for (const extra of meses.flat()) eventos.push(extra);
      return { materiaId: coincidencia.materia.id, eventos };
    } catch {
      return null;
    }
  });

  const eventosCalendario = [];
  const horariosNuevos = [];
  const parchesTareas = new Map();
  const parchesParciales = new Map();

  for (const pagina of paginas) {
    if (!pagina) continue;
    const tareas = await db.execute({
      sql: 'SELECT id, nombre, inicio, fin FROM tareas WHERE materia_id = ?',
      args: [pagina.materiaId]
    });
    const parciales = await db.execute({
      sql: 'SELECT id, nombre, fecha FROM parciales WHERE materia_id = ?',
      args: [pagina.materiaId]
    });
    const actividades = [
      ...tareas.rows.map((fila) => ({ id: fila.id, nombre: fila.nombre, tabla: 'tareas', inicio: fila.inicio, fin: fila.fin })),
      ...parciales.rows.map((fila) => ({ id: fila.id, nombre: fila.nombre, tabla: 'parciales', fin: fila.fecha })),
      ...detectadas.filter((item) => item.materiaId === pagina.materiaId).map((item) => ({
        id: item.idMoodle, nombre: item.nombre, tabla: 'nueva', inicio: item.inicio, fin: item.fin
      }))
    ];
    const clasificado = clasificarEventosCalendario({
      eventos: pagina.eventos,
      actividades,
      materiaId: pagina.materiaId
    });
    const guardados = await db.execute({
      sql: `SELECT dia, hora_inicio AS horaInicio, hora_fin AS horaFin
            FROM horarios WHERE materia_id = ? AND alumno_id IS NULL`,
      args: [pagina.materiaId]
    });
    const horariosDeLaMateria = [
      ...guardados.rows.map((fila) => ({
        dia: Number(fila.dia),
        horaInicio: String(fila.horaInicio),
        horaFin: String(fila.horaFin)
      })),
      ...clasificado.horarios
    ];
    eventosCalendario.push(...ajustarClasesAlHorario(clasificado.cronograma, horariosDeLaMateria));
    horariosNuevos.push(...clasificado.horarios);
    for (const fecha of clasificado.fechas) {
      if (fecha.tabla === 'nueva') {
        const nueva = detectadas.find((item) => item.idMoodle === fecha.id);
        if (!nueva) continue;
        if (fecha.campo === 'inicio' && (!nueva.inicio || nueva.inicio === 'Sin fecha')) nueva.inicio = fecha.fecha;
        if (fecha.campo === 'fin' && (!nueva.fin || nueva.fin === 'Sin fecha')) nueva.fin = fecha.fecha;
        continue;
      }
      if (fecha.tabla === 'parciales' && fecha.campo !== 'inicio') continue;
      const destino = fecha.tabla === 'parciales' ? parchesParciales : parchesTareas;
      const actual = destino.get(fecha.id) || { id: fecha.id };
      const guardada = actividades.find((item) => item.id === fecha.id);
      const previa = fecha.campo === 'inicio' && fecha.tabla !== 'parciales'
        ? guardada?.inicio
        : guardada?.fin;
      if (fecha.fecha && previa !== fecha.fecha) {
        const campo = fecha.tabla === 'parciales' ? 'fin' : (fecha.campo === 'inicio' ? 'inicio' : 'fin');
        actual[campo] = fecha.fecha;
        destino.set(fecha.id, actual);
      }
    }
  }

  return {
    eventosCalendario,
    horariosNuevos,
    fechasActualizar: [...parchesTareas.values()],
    fechasParcialesActualizar: [...parchesParciales.values()]
  };
}

async function leerProgresoCampus({ cliente, db, mapeos, detectadas, alumnoId }) {
  const nombreMateriaPorId = new Map(
    mapeos.map((m) => [m.coincidencia.materia.id, m.coincidencia.materia.nombre || ''])
  );
  const libretas = await conPool(mapeos, 4, async ({ curso, coincidencia }) => {
    const materiaId = coincidencia.materia.id;
    try {
      const pagina = await cliente.pedir(UGR_RUTAS.libreta(curso.id));
      return { materiaId, notas: extraerNotasDeLibreta(pagina.html) };
    } catch {
      return { materiaId, notas: [] };
    }
  });
  const progresoAlumno = [];
  for (const libreta of libretas) {
    const tareas = await db.execute({ sql: 'SELECT id, nombre FROM tareas WHERE materia_id = ?', args: [libreta.materiaId] });
    const parciales = await db.execute({ sql: 'SELECT id, nombre, fecha FROM parciales WHERE materia_id = ?', args: [libreta.materiaId] });
    for (const item of libreta.notas) {
      const tarea = tareas.rows.find((fila) => coincidirNombreTarea(fila.nombre, item.nombre))
        || detectadas.find((fila) => fila.materiaId === libreta.materiaId && coincidirNombreTarea(fila.nombre, item.nombre));
      const parcial = parciales.rows.find((fila) => coincidirNombreTarea(fila.nombre, item.nombre));
      if (tarea) {
        progresoAlumno.push({
          alumnoId,
          materiaId: libreta.materiaId,
          materiaNombre: item.materiaNombre,
          nombre: item.nombre,
          tabla: tarea.id ? 'tareas' : 'nueva',
          id: tarea.id || tarea.idMoodle,
          nota: item.nota,
          entregada: true,
          // La libreta ya implica corrección; los foros no pasan por «entregada» en completadas.
          forzar: item.nota != null
        });
      }
      if (parcial) {
        progresoAlumno.push({
          alumnoId,
          materiaId: libreta.materiaId,
          materiaNombre: item.materiaNombre || nombreMateriaPorId.get(libreta.materiaId) || '',
          nombre: item.nombre,
          tabla: 'parciales',
          id: parcial.id,
          fecha: parcial.fecha,
          nota: item.nota,
          entregada: true,
          forzar: item.nota != null
        });
      }
    }
  }
  return { progresoAlumno };
}

// Inserta las tareas detectadas en la base. Si otra sync ya cargó la misma
// consigna en esa materia, se omite: no se duplica. Devuelve cuántas insertó.
export async function insertarTareasDetectadas({ db, detectadas }) {
  const lista = Array.isArray(detectadas) ? detectadas : [];
  if (lista.length === 0) return 0;
  const materiaIds = [...new Set(lista.map((tarea) => tarea.materiaId).filter(Boolean))];
  const existentes = [];
  for (const materiaId of materiaIds) {
    const res = await db.execute({
      sql: 'SELECT materia_id, nombre, url FROM tareas WHERE materia_id = ?',
      args: [materiaId]
    });
    for (const fila of res.rows) {
      existentes.push({ materiaId: fila.materia_id, nombre: fila.nombre, url: fila.url || '' });
    }
  }
  const { nuevas } = filtrarTareasDuplicadas(lista, existentes);
  const inserts = nuevas.map((t) => ({
    sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      `t_${randomUUID()}`,
      t.materiaId,
      t.nombre,
      t.inicio || 'Sin fecha',
      t.fin || 'Sin fecha',
      t.detalles || 'Importada desde UGR Virtual',
      t.unidad ?? null,
      t.conNota ? 1 : 0,
      t.tipo || 'actividad',
      t.url || ''
    ]
  }));

  if (inserts.length === 0) return 0;
  await db.batch(inserts, 'write');
  return inserts.length;
}

function esEventoCronogramaParcial(evento) {
  const tipo = String(evento?.tipo || '').toLowerCase();
  const titulo = String(evento?.titulo || '').trim();
  if (!titulo || tipo === 'sin_clases' || tipo === 'examen_final') return false;
  if (tipo === 'clase' || tipo === 'consulta' || tipo === 'entrega' || tipo === 'exposición') return false;
  if (esExamenFinalDelCronograma(titulo)) return false;
  if (/parcial\s*\(\s*opcional/i.test(titulo)) return false;
  if (tipo !== 'examen') return false;
  return true;
}

function nombreParcialDesdeEventoCronograma(evento) {
  const titulo = String(evento?.titulo || '').trim();
  if (titulo) return titulo.slice(0, 100);
  return 'Parcial';
}

/** Crea filas en `parciales` a partir del plan (cronograma_eventos tipo examen) cuando Moodle no tiene la actividad. */
export async function promoverParcialesDesdeCronograma({ db, materiaIds }) {
  const ids = [...new Set((materiaIds || []).filter(Boolean))];
  if (!ids.length) return { insertadas: 0, insertadasItems: [] };
  const insertadasItems = [];
  let insertadas = 0;

  for (const materiaId of ids) {
    const eventos = await db.execute({
      sql: 'SELECT fecha, titulo, detalles, url, tipo FROM cronograma_eventos WHERE materia_id = ?',
      args: [materiaId]
    });
    const parciales = await db.execute({
      sql: 'SELECT id, nombre, fecha, url FROM parciales WHERE materia_id = ?',
      args: [materiaId]
    });
    const listaParciales = [...parciales.rows];

    for (const evento of eventos.rows) {
      if (!esEventoCronogramaParcial(evento)) continue;
      const fecha = String(evento.fecha || '').slice(0, 10);
      if (!fecha) continue;
      const nombre = nombreParcialDesdeEventoCronograma(evento);
      if (coincidirParcial({ parciales: listaParciales, nombre, fin: fecha })) continue;

      const id = `parcial_${randomUUID()}`;
      const detalles = String(evento.detalles || '').trim()
        || 'Fecha del cronograma académico (sin actividad equivalente en UGR Virtual).';
      await db.execute({
        sql: 'INSERT INTO parciales (id, materia_id, nombre, fecha, detalles, url) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, materiaId, nombre, fecha, detalles.slice(0, 500), evento.url || '']
      });
      listaParciales.push({ id, nombre, fecha, url: evento.url || '' });
      insertadas += 1;
      insertadasItems.push({ materiaId, nombre, fecha });
    }
  }

  return { insertadas, insertadasItems };
}

export async function insertarParcialesSiFaltan({ db, detectadas }) {
  const lista = Array.isArray(detectadas) ? detectadas : [];
  const escrituras = [];
  const omitidas = [];
  const vistas = [];
  const insertadasItems = [];
  for (const item of lista) {
    if (!item?.materiaId || !item?.nombre || !item?.fin) continue;
    const res = await db.execute({
      sql: 'SELECT id, nombre, fecha FROM parciales WHERE materia_id = ?',
      args: [item.materiaId]
    });
    const existentes = [...res.rows, ...vistas.filter((fila) => fila.materia_id === item.materiaId)];
    if (coincidirParcial({ parciales: existentes, nombre: item.nombre, fin: item.fin })) {
      omitidas.push(item);
      continue;
    }
    const id = `parcial_${randomUUID()}`;
    escrituras.push({
      sql: 'INSERT INTO parciales (id, materia_id, nombre, fecha, detalles, url) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, item.materiaId, String(item.nombre).slice(0, 100), item.fin, item.detalles || 'Importada desde UGR Virtual', item.url || '']
    });
    vistas.push({ materia_id: item.materiaId, nombre: item.nombre, fecha: item.fin });
    insertadasItems.push({
      materiaId: item.materiaId,
      materiaNombre: item.materiaNombre || '',
      nombre: item.nombre
    });
  }
  if (escrituras.length > 0) await db.batch(escrituras, 'write');
  return { insertadas: escrituras.length, omitidas, insertadasItems };
}

// Completa la columna `url` de tareas que ya existían en la base (por ejemplo,
// importadas con una versión anterior que todavía no guardaba el enlace).
// Acepta una lista de { id, url } y devuelve cuántas actualizó.
export async function actualizarUrlsTareas({ db, urlsActualizar }) {
  if (!Array.isArray(urlsActualizar) || urlsActualizar.length === 0) return 0;
  const updates = urlsActualizar
    .filter(({ id, url }) => id && url)
    .map(({ id, url, forzar }) => (
      forzar
        ? { sql: 'UPDATE tareas SET url = ? WHERE id = ?', args: [url, id] }
        : { sql: 'UPDATE tareas SET url = ? WHERE id = ? AND (url IS NULL OR TRIM(url) = ?)', args: [url, id, ''] }
    ));
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}

// Completa la columna `url` de parciales que ya existían en la base. Los
// parciales que se cargan desde el cronograma nacen sin enlace a UGR; el sync
// los detecta cuando la misma actividad aparece en Moodle y completa el link
// para que «Ver en UGR» funcione también en Parciales y en Estado por Alumno.
// Acepta una lista de { id, url } y devuelve cuántas actualizó.
export async function aplicarComplementoCampus({ db, detectado, alumnoId, alumnoNombre, materiaIds } = {}) {
  if (!detectado) return { eventos: 0, horarios: 0, fechas: 0, notas: 0, notasCargadas: [], pendientesEntrega: [], parcialesDesdeCronograma: 0 };
  const eventos = await insertarEventosCronograma({ db, eventos: detectado.eventosCalendario || [] });
  const horarios = await insertarHorariosDetectados({ db, horarios: detectado.horariosNuevos || [] });
  const fechas = await actualizarFechasCampus({
    db,
    tareas: detectado.fechasActualizar,
    parciales: detectado.fechasParcialesActualizar
  });
  const idsMaterias = [...new Set([
    ...(materiaIds || []),
    ...(detectado.materiaIds || []),
    ...(detectado.eventosCalendario || []).map((e) => e.materiaId),
    ...(detectado.parcialesDetectados || []).map((p) => p.materiaId)
  ].filter(Boolean))];
  const parcialesCron = await promoverParcialesDesdeCronograma({ db, materiaIds: idsMaterias });
  const progreso = alumnoId
    ? await aplicarProgresoCampus({ db, progreso: detectado.progresoAlumno, alumnoId, alumnoNombre })
    : { cantidad: 0, cargadas: [], pendientesEntrega: [] };
  return {
    eventos,
    horarios,
    fechas,
    notas: progreso.cantidad,
    notasCargadas: progreso.cargadas,
    pendientesEntrega: progreso.pendientesEntrega,
    parcialesDesdeCronograma: parcialesCron.insertadas,
    parcialesDesdeCronogramaItems: parcialesCron.insertadasItems
  };
}

async function filaPorNombre(db, cache, tabla, materiaId, nombre) {
  if (!materiaId || !nombre) return null;
  const clave = `${tabla}|${materiaId}`;
  if (!cache.has(clave)) {
    const sql = tabla === 'parciales'
      ? 'SELECT id, nombre, fecha FROM parciales WHERE materia_id = ?'
      : 'SELECT id, nombre FROM tareas WHERE materia_id = ?';
    cache.set(clave, (await db.execute({ sql, args: [materiaId] })).rows);
  }
  return cache.get(clave).find((fila) => coincidirNombreTarea(fila.nombre, nombre)) || null;
}

function mismaNota(anterior, nueva) {
  const a = Number(String(anterior ?? '').replace(',', '.'));
  const b = Number(String(nueva ?? '').replace(',', '.'));
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.001;
}

function notaNumerica(valor) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** El campus a veces muestra un intento viejo (5) y la devolución buena (8): no pisar con la menor. */
function debeAplicarNotaCampus(anterior, nueva) {
  if (mismaNota(anterior, nueva)) return false;
  const a = notaNumerica(anterior);
  const b = notaNumerica(nueva);
  if (a == null) return true;
  if (b == null) return false;
  return b >= a;
}

function textoNota(nota) {
  return formatearNotaParaMostrar(nota);
}

async function aplicarProgresoCampus({ db, progreso, alumnoId, alumnoNombre }) {
  if (!Array.isArray(progreso) || progreso.length === 0 || !alumnoId) {
    return { cantidad: 0, cargadas: [], pendientesEntrega: [] };
  }
  const cache = new Map();
  const escrituras = [];
  const cargadas = [];
  const pendientesEntrega = [];
  for (const item of progreso) {
    let tabla = item?.tabla;
    let id = item?.id;
    const esNueva = !id || tabla === 'nueva' || String(id).startsWith('moodle_');
    if (esNueva) {
      const tarea = await filaPorNombre(db, cache, 'tareas', item.materiaId, item.nombre);
      const parcial = tarea ? null : await filaPorNombre(db, cache, 'parciales', item.materiaId, item.nombre);
      if (tarea) {
        tabla = 'tareas';
        id = tarea.id;
      } else if (parcial) {
        tabla = 'parciales';
        id = parcial.id;
        item.fecha = item.fecha || parcial.fecha;
      } else {
        continue;
      }
    }
    if (!id) continue;
    if (tabla === 'tareas') {
      const entrega = await db.execute({
        sql: `SELECT 1 FROM completadas
              WHERE tarea_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))`,
        args: [id, alumnoId, alumnoNombre || '']
      });
      let entregadaAca = entrega.rows.length > 0;
      if (item.nota != null && !entregadaAca && item.forzar && item.entregada) {
        escrituras.push({
          sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(tarea_id, alumno) DO UPDATE SET
                  alumno_id = excluded.alumno_id,
                  completada_en = CASE
                    WHEN completadas.completada_en IS NOT NULL AND TRIM(completadas.completada_en) != ''
                    THEN completadas.completada_en
                    ELSE excluded.completada_en
                  END`,
          args: [id, alumnoId, alumnoNombre || '']
        });
        entregadaAca = true;
      }
      if (item.nota != null && !entregadaAca && !item.forzar) {
        pendientesEntrega.push({ materia: item.materiaNombre || '', nombre: item.nombre });
        continue;
      }
      if (item.nota != null && (entregadaAca || item.forzar)) {
        const notaGuardar = textoNota(item.nota);
        const previa = await db.execute({
          sql: 'SELECT nota FROM notas_tareas WHERE tarea_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))',
          args: [id, alumnoId, alumnoNombre || '']
        });
        const notaPrevia = previa.rows[0]?.nota;
        if (item.forzar && !debeAplicarNotaCampus(notaPrevia, notaGuardar)) {
          continue;
        }
        cargadas.push({
          tareaId: id,
          materia: item.materiaNombre || '',
          nombre: item.nombre,
          nota: notaGuardar,
          yaEstaba: previa.rows.length > 0 && mismaNota(notaPrevia, notaGuardar)
        });
        const guardaCerrada = item.forzar ? '' : 'WHERE notas_tareas.cerrada = 0';
        escrituras.push({
          sql: `INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en, cerrada)
                VALUES (?, ?, ?, ?, ?, datetime('now'), 1)
                ON CONFLICT(tarea_id, alumno) DO UPDATE SET
                  alumno_id = excluded.alumno_id,
                  nota = excluded.nota,
                  cargada_en = excluded.cargada_en,
                  cerrada = 1
                ${guardaCerrada}`,
          args: [`nota_tarea_${id}_${alumnoId}`, id, alumnoId, alumnoNombre || '', notaGuardar]
        });
      }
    }
    if (tabla === 'parciales' && item.nota != null) {
      if (!parcialYaSeRindio(item.fecha)) continue;
      const existe = await db.execute({
        sql: 'SELECT id, cerrada FROM notas_parciales WHERE parcial_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))',
        args: [id, alumnoId, alumnoNombre || '']
      });
      if (Number(existe.rows[0]?.cerrada) === 1 && !item.forzar) continue;
      const previaNota = await db.execute({
        sql: 'SELECT nota FROM notas_parciales WHERE parcial_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))',
        args: [id, alumnoId, alumnoNombre || '']
      });
      cargadas.push({
        materia: item.materiaNombre || '',
        nombre: item.nombre,
        nota: textoNota(item.nota),
        yaEstaba: existe.rows.length > 0 && mismaNota(previaNota.rows[0]?.nota, item.nota)
      });
      if (existe.rows.length > 0) {
        escrituras.push({
          sql: `UPDATE notas_parciales SET nota = ?, alumno_id = ?, alumno = ?, cerrada = 1 WHERE id = ?${item.forzar ? '' : ' AND cerrada = 0'}`,
          args: [item.nota, alumnoId, alumnoNombre || '', existe.rows[0].id]
        });
      } else {
        escrituras.push({
          sql: 'INSERT INTO notas_parciales (id, parcial_id, alumno_id, alumno, nota, cerrada) VALUES (?, ?, ?, ?, ?, 1)',
          args: [`nota_${id}_${alumnoId}`, id, alumnoId, alumnoNombre || '', item.nota]
        });
      }
    }
  }
  if (escrituras.length === 0) return { cantidad: 0, cargadas, pendientesEntrega };
  await db.batch(escrituras, 'write');
  return { cantidad: escrituras.length, cargadas, pendientesEntrega };
}

async function insertarHorariosDetectados({ db, horarios }) {
  if (!Array.isArray(horarios) || horarios.length === 0) return 0;
  const inserts = [];
  let cambios = 0;
  for (const horario of horarios) {
    if (!horario?.materiaId || !horario.dia || !horario.horaInicio) continue;
    const existe = await db.execute({
      sql: `SELECT id, hora_fin FROM horarios
            WHERE materia_id = ? AND CAST(dia AS INTEGER) = ? AND hora_inicio = ?
              AND alumno_id IS NULL`,
      args: [horario.materiaId, Number(horario.dia), horario.horaInicio]
    });
    if (existe.rows.length > 0) {
      if (String(existe.rows[0].hora_fin || '') !== String(horario.horaFin || '')) {
        await db.execute({
          sql: 'UPDATE horarios SET hora_fin = ? WHERE id = ?',
          args: [horario.horaFin || horario.horaInicio, existe.rows[0].id]
        });
        cambios += 1;
      }
    } else {
      await db.execute({
        sql: `DELETE FROM horarios
              WHERE materia_id = ? AND CAST(dia AS INTEGER) = ? AND hora_inicio = ?
                AND alumno_id IS NOT NULL`,
        args: [horario.materiaId, Number(horario.dia), horario.horaInicio]
      });
      inserts.push({
        sql: 'INSERT INTO horarios (id, materia_id, dia, hora_inicio, hora_fin, aula, alumno_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [`h_${randomUUID()}`, horario.materiaId, String(horario.dia), horario.horaInicio, horario.horaFin || horario.horaInicio, horario.aula || 'Virtual', null]
      });
    }
    const borrados = await db.execute({
      sql: `DELETE FROM horarios
            WHERE materia_id = ? AND CAST(dia AS INTEGER) = ?
              AND hora_inicio != ? AND alumno_id IS NULL`,
      args: [horario.materiaId, Number(horario.dia), horario.horaInicio]
    });
    cambios += Number(borrados.rowsAffected || 0);
  }
  if (inserts.length > 0) await db.batch(inserts, 'write');
  return inserts.length + cambios;
}

function celdaTexto(valor) {
  return valor == null ? '' : String(valor);
}

// Antes de escribir en la base, arma líneas legibles para el resumen de sync.
async function describirActualizacionFechas({ db, tareas, parciales, nombresPorId } = {}) {
  const mapaMaterias = nombresPorId instanceof Map ? nombresPorId : new Map();
  const lineas = [];
  const etiquetaCampo = (campo) => (campo === 'fin' ? 'entrega' : 'inicio');

  for (const fila of tareas || []) {
    if (!fila?.id || (!fila.inicio && !fila.fin)) continue;
    let nombre = fila.nombre;
    let materiaNombre = fila.materiaNombre;
    const res = await db.execute({
      sql: 'SELECT nombre, materia_id, inicio, fin FROM tareas WHERE id = ?',
      args: [fila.id]
    });
    const guardada = res.rows[0];
    if (!guardada) continue;
    if (!nombre) nombre = celdaTexto(guardada.nombre);
    if (!materiaNombre) materiaNombre = mapaMaterias.get(celdaTexto(guardada.materia_id)) || '';
    const partes = [];
    for (const campo of ['inicio', 'fin']) {
      if (!fila[campo]) continue;
      const antes = celdaTexto(guardada[campo]);
      partes.push(`${etiquetaCampo(campo)} ${formatearFechaTablero(antes)} → ${formatearFechaTablero(fila[campo])}`);
    }
    if (partes.length === 0) continue;
    lineas.push({
      materiaNombre,
      texto: `«${nombre}»: ${partes.join('; ')}`
    });
  }

  for (const fila of parciales || []) {
    if (!fila?.id || !fila.fin) continue;
    let nombre = fila.nombre;
    let materiaNombre = fila.materiaNombre;
    const res = await db.execute({
      sql: 'SELECT nombre, materia_id, fecha FROM parciales WHERE id = ?',
      args: [fila.id]
    });
    const guardada = res.rows[0];
    if (!guardada) continue;
    if (!nombre) nombre = celdaTexto(guardada.nombre);
    if (!materiaNombre) materiaNombre = mapaMaterias.get(celdaTexto(guardada.materia_id)) || '';
    const antes = celdaTexto(guardada.fecha);
    lineas.push({
      materiaNombre,
      texto: `«${nombre}»: fecha ${formatearFechaTablero(antes)} → ${formatearFechaTablero(fila.fin)}`
    });
  }

  return lineas;
}

async function actualizarFechasCampus({ db, tareas, parciales }) {
  const updates = [];
  for (const fila of tareas || []) {
    if (!fila?.id || (!fila.inicio && !fila.fin)) continue;
    updates.push({
      sql: `UPDATE tareas
            SET inicio = CASE WHEN ? != '' THEN ? ELSE inicio END,
                fin = CASE WHEN ? != '' THEN ? ELSE fin END
            WHERE id = ?`,
      args: [fila.inicio || '', fila.inicio || '', fila.fin || '', fila.fin || '', fila.id]
    });
  }
  for (const fila of parciales || []) {
    if (!fila?.id || !fila.fin) continue;
    updates.push({
      sql: 'UPDATE parciales SET fecha = ? WHERE id = ?',
      args: [fila.fin, fila.id]
    });
  }
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}

export async function actualizarUrlsParciales({ db, urlsParcialesActualizar }) {
  if (!Array.isArray(urlsParcialesActualizar) || urlsParcialesActualizar.length === 0) return 0;
  const updates = urlsParcialesActualizar
    .filter(({ id, url }) => id && url)
    .map(({ id, url }) => ({
      sql: 'UPDATE parciales SET url = ? WHERE id = ? AND url = ?',
      args: [url, id, '']
    }));
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}




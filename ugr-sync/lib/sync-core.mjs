// Núcleo de la sincronización con UGR Virtual, compartido entre el CLI
// (ugr-sync/scripts/sync.mjs) y la acción de servidor del panel (src/app/actions.js).
// Toda la lógica de descubrimiento de cursos, mapeo a materias locales y
// detección de tareas nuevas vive acá; las inserciones en la base se hacen con
// el objeto `db` que cada llamador provee (libsql client o wrapper de turso).
import { randomUUID } from 'node:crypto';
import { crearCliente } from './red.mjs';
import { optimizarLecturas } from './lecturas.mjs';
import { autorEsEquipoDocente, esEquipoDocente, extraerDocentesDeCurso, normalizarNombrePersona } from './docentes.mjs';
import { extraerCursos, extraerNombreCursoDesdePagina } from './materias.mjs';
import { extraerFechasActividad, extraerActividadesOverview, extraerNotasDeLibreta } from './tareas.mjs';
import {
  analizarAvisosParaCronograma,
  DIAS_HACIA_ATRAS,
  avisoEsRelevante,
  extraerDiscusionesDeForo,
  extraerForosDelIndice,
  extraerPostsDeHilo,
  fechaHoyLocal,
  filtrarEventosDeAviso,
  sumarDias
} from './avisos.mjs';
import {
  claveTareaParaEmparejar,
  coincidirMateria,
  coincidirNombreTarea,
  coincidirParcial,
  emparejarCursosConMaterias,
  filtrarTareasDuplicadas,
  agruparResumenSync,
  inferirTipoTarea,
  normalizarNombre,
  separarEvaluaciones
} from './normalizar.mjs';

export { emparejarCursosConMaterias, filtrarTareasDuplicadas, agruparResumenSync, separarEvaluaciones };
import { clasificarEventosCalendario, extraerEventosCalendario, timestampsDeMesesDelPeriodo } from './calendario.mjs';
import { MODULOS_CONSIGNA, UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';

// Credenciales de UGR: se leen en el momento de conectar directamente de
// process.env, igual que las variables TURSO_* en src/app/turso.js. Por lo
// tanto funcionan donde quiera que corra la app:
//   * en Vercel / plataformas: llegan solas por las Environment Variables que
//     el despliegue inyecta en process.env; no hace falta ningún archivo;
//   * en desarrollo local: Next las carga de .env.local al iniciar; si el
//     proceso arrancó antes de que existieran, justo antes de conectar se
//     recarga el archivo con ruta absoluta (idempotente y barato si las claves
//     ya están cargadas), sin depender del cwd ni del momento del arranque.
// La lectura es dinámica — process.env[nombre] con el nombre en una variable —
// a propósito: Turbopack no puede «inlinar» ese acceso en el bundle, así que en
// el runtime siempre se consulta el entorno real.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let candidatasEnvLocalCacheadas = null;
let rutaCredencialesUGR = null;
let ultimoArchivoEnvLocal = null;

// Nombres de archivos de entorno probados, en orden de prioridad. En Vercel u
// otras plataformas no existe ninguno: las variables llegan solas por
// process.env (igual que TURSO_*). El listado es solo el respaldo para
// desarrollo local y para `vercel dev` (que escribe .vercel/.env.*).
const NOMBRES_ARCHIVOS_ENV = [
  '.env.local',
  '.env',
  '.env.production.local',
  '.env.production',
  '.vercel/.env.production.local',
  '.vercel/.env.development.local'
];

// Lista de ubicaciones plausibles para los .env*: primero el directorio de
// trabajo actual (caso normal) y después subiendo desde el módulo compilado
// hacia la raíz del proyecto (cubre un server lanzado desde otro cwd o un
// bundle compilado dentro de .next/). Se deduplica con un Set.
function candidatosEnvLocal() {
  if (!candidatasEnvLocalCacheadas) {
    const lista = new Set();
    const agregarDesde = (directorio) => {
      for (const nombre of NOMBRES_ARCHIVOS_ENV) {
        lista.add(join(/*turbopackIgnore: true*/ directorio, nombre));
      }
    };
    agregarDesde(process.cwd());
    try {
      let directorio = dirname(fileURLToPath(import.meta.url));
      for (let nivel = 0; nivel < 10; nivel += 1) {
        agregarDesde(directorio);
        if (existsSync(join(directorio, 'package.json'))) break;
        directorio = dirname(directorio);
      }
    } catch {
      // import.meta.url no resoluble: nos quedamos con las rutas del cwd.
    }
    candidatasEnvLocalCacheadas = [...lista];
  }
  return candidatasEnvLocalCacheadas;
}

// Parser mínimo de KEY=VALOR: ignora vacíos y comentarios, y quita comillas
// simples o dobles simples. Suficiente para .env.local del proyecto.
function parsearEnvLocal(texto) {
  const campos = new Map();
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const igual = limpia.indexOf('=');
    if (igual <= 0) continue;
    let valor = limpia.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    campos.set(limpia.slice(0, igual).trim(), valor);
  }
  return campos;
}

function aplicarVariables(mapa) {
  for (const [clave, valor] of mapa) {
    // El archivo nunca pisa variables que ya vienen del entorno real.
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

// Indirección a propósito: `process.env[nombre]` con el nombre en una variable
// de runtime no puede ser reemplazado por el bundler en compilación, así la
// lectura ocurre siempre contra el entorno real.
function variableEntorno(nombre) {
  // Trim como en turso.js, para tolerar espacios accidentales al pegar valores.
  return (process.env[nombre] || '').trim();
}

// Recarga las credenciales en el momento de usarlas. Si ya están en el
// entorno, no toca nada. Prueba los candidatos en orden y usa el primero que
// exista Y traiga las claves: si el .env.local más cercano no las tiene
// (p. ej. un cwd con un archivo suelto sin UGRVIRTUAL_*), sigue con el de la
// raíz del proyecto en lugar de rendirse.
function cargarCredencialesUGR() {
  if (tieneCredencialesUGR()) return;
  for (const ruta of candidatosEnvLocal()) {
    if (!existsSync(/* turbopackIgnore: true */ ruta)) continue;
    ultimoArchivoEnvLocal = ruta;
    if (cargarVariablesDe(ruta)) return;
  }
}

function tieneCredencialesUGR() {
  return Boolean(variableEntorno('UGRVIRTUAL_USER') && variableEntorno('UGRVIRTUAL_PASSWORD'));
}

// Carga un .env.local concreto: primero con process.loadEnvFile (Node >= 20.12)
// y, si falta o falla, parseando el archivo a mano. Devuelve true cuando las
// credenciales UGR quedaron disponibles tras ese archivo.
function cargarVariablesDe(ruta) {
  try {
    if (typeof process.loadEnvFile === 'function') process.loadEnvFile(/* turbopackIgnore: true */ ruta);
  } catch {
    // Parseo manual por debajo si loadEnvFile falla o no existe.
  }
  if (tieneCredencialesUGR()) {
    rutaCredencialesUGR = ruta;
    return true;
  }
  try {
    aplicarVariables(parsearEnvLocal(readFileSync(/* turbopackIgnore: true */ ruta, 'utf8')));
  } catch {
    return false;
  }
  if (tieneCredencialesUGR()) {
    rutaCredencialesUGR = ruta;
    return true;
  }
  return false;
}

// También al importar el módulo (por ejemplo para el CLI y para arranques en
// los que .env.local ya está presente), por delante de cualquier uso.
cargarCredencialesUGR();

// Crea el cliente HTTP con las credenciales del entorno.
export async function conectarUGR() {
  cargarCredencialesUGR();
  const usuario = variableEntorno('UGRVIRTUAL_USER');
  const contrasena = variableEntorno('UGRVIRTUAL_PASSWORD');
  if (!usuario || !contrasena) {
    if (process.env.VERCEL === '1') {
      // En Vercel no hay .env.local en el despliegue: las credenciales tienen
      // que estar en el panel y llegar por process.env, como las de Turso.
      throw new Error(
        'Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en el entorno de Vercel ' +
        '(las variables de entorno no llegaron al proceso del server). ' +
        'Añadí ambas en Vercel → Project Settings → Environment Variables ' +
        '(entorno Production) y hacé un nuevo deploy.'
      );
    }
    const fuente = rutaCredencialesUGR || ultimoArchivoEnvLocal || 'ningún .env.local encontrado';
    throw new Error(
      `Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD (revisé ${fuente}). ` +
      'Agregalas a .env.local en la raíz del proyecto y reiniciá `npm run dev`.'
    );
  }
  return optimizarLecturas(await crearCliente({ usuario, contrasena }));
}

// Sesión propia del alumno. No usa ni pisa la cookie del sincronizador de la comisión.
export async function conectarUGRCon({ usuario, contrasena, rutaSesion }) {
  if (!usuario || !contrasena) {
    throw new Error('Faltan las credenciales de UGR Virtual de esta cuenta.');
  }
  return optimizarLecturas(await crearCliente({ usuario, contrasena, rutaSesion }));
}

async function fechasDeDetalle({ cliente, tarea }) {
  try {
    if (!tarea?.url) return { inicio: null, fin: null };
    const pagina = await cliente.pedir(tarea.url);
    return extraerFechasActividad(pagina.html);
  } catch {
    return { inicio: null, fin: null };
  }
}

// Cursos visibles para la sesión actual, con el nombre completo cuando Moodle
// lo trunca en el listado. No escribe materias ni tareas.
export async function listarCursosDelCampus(cliente) {
  const pageCursos = await cliente.pedir(UGR_RUTAS.cursos);
  const cursos = extraerCursos(pageCursos.html);
  await conPool(cursos, 4, async (curso) => {
    if (!curso.nombreIncompleto) return;
    try {
      const paginaCurso = await cliente.pedir(UGR_RUTAS.curso(curso.id));
      const nombreCompleto = extraerNombreCursoDesdePagina(paginaCurso.html, curso.id);
      if (nombreCompleto) curso.nombre = nombreCompleto;
    } catch {
      // Si falla la resolución, nos quedamos con el nombre parcial.
    }
  });
  return cursos;
}

// Recorre los cursos del campus, los mapea contra las materias locales y
// devuelve las tareas nuevas que todavía no existen en la base.
export async function detectarTareasNuevas({ db, cliente, cursos: cursosDados, periodoId, alumnoId } = {}) {
  // 1) Materias locales (destino). Un período acota el match a esa cursada.
  const resMaterias = periodoId
    ? await db.execute({ sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre', args: [periodoId] })
    : await db.execute('SELECT id, nombre FROM materias ORDER BY nombre');
  const materiasLocales = resMaterias.rows;

  // 2) Cursos del campus y mapeo contra las materias locales.
  // Moodle a veces sirve nombres truncados dentro de los selects (terminan en
  // "...") aunque el prefijo de versión «(V.TUCS.1.07.2)» ya sea visible.
  const cursos = cursosDados || await listarCursosDelCampus(cliente);
  const mapeos = [];
  for (const curso of cursos) {
    const coincidencia = coincidirMateria(curso.nombre, materiasLocales);
    if (coincidencia) mapeos.push({ curso, coincidencia });
  }

  // 3) Tareas de cada curso mapeado y detección de faltantes.
  const detectadas = [];
  const yaCargadas = [];
  // Tareas locales que ya existen pero quedaron sin enlace: las cargamos en
  // esta misma pasada (backfill de la columna `url`).
  const urlsActualizar = [];
  // Parciales ya cargados que también quedaron sin enlace (los que se cargan
  // desde el cronograma no traen URL de UGR): se completan acá mismo.
  const urlsParcialesActualizar = [];

  // Los overviews de todos los cursos se piden en paralelo (concurrencia 4) y el
  // detalle de fechas se lee SOLO para las actividades que todavía no existen en
  // la base: un sync sin novedades no encadena un pedido HTTP por tarea (ese era
  // el motivo principal de la lentitud cuando no había nada nuevo que importar).
  const overviews = await conPool(mapeos, 4, async ({ curso, coincidencia }) => {
    try {
      // Vista unificada de Moodle 4.5: /course/overview.php agrupa por tipo los
      // módulos del curso (assigns, foros, cuestionarios, feedback, …). Se piden
      // todos los tipos «consigna» de una sola vez y se parsean juntos; así un
      // sync alcanza también los quizzes/formation que antes solo vivían en
      // páginas que ni siquiera miramos (/mod/quiz/index.php, /mod/feedback/…).
      const pagina = await cliente.pedir(UGR_RUTAS.overviewCurso(curso.id, MODULOS_CONSIGNA));
      return { curso, coincidencia, html: pagina.html };
    } catch {
      return null;
    }
  });

  await conPool(overviews, 4, async (resultado) => {
    if (!resultado) return;
    const { curso, coincidencia, html } = resultado;
    const tareas = extraerActividadesOverview(html, UGR_BASE_URL);
    const idsVistos = new Set();
    const tareasUnicas = tareas.filter((t) => {
      if (!t.id || idsVistos.has(t.id)) return false;
      idsVistos.add(t.id);
      return true;
    });

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

    // Solo las candidatas que todavía no existen necesitan el detalle
    // (apertura/vencimiento): las ya importadas se resuelven sin pedidos HTTP.
    const candidatas = [];
    for (const tarea of tareasUnicas) {
      const nombreFinal = normalizarNombre({ nombre: tarea.nombre, cursoNombre: curso.nombre });
      const clave = claveTareaParaEmparejar(nombreFinal);
      const existente = existentesPorClave.get(clave)
        || resExistentes.rows.find((t) => coincidirNombreTarea(t.nombre, nombreFinal));
      if (existente) {
        yaCargadas.push({
          materiaId: coincidencia.materia.id,
          materiaNombre: coincidencia.materia.nombre,
          nombre: nombreFinal
        });
        if (!existente.url && tarea.url) {
          urlsActualizar.push({ id: existente.id, url: tarea.url });
        }
        continue;
      }
      candidatas.push({ tarea, nombreFinal });
    }

    // La apertura no viene en el índice: se lee del detalle de cada candidata,
    // en paralelo (concurrencia 4).
    const conFechas = await conPool(candidatas, 4, async ({ tarea, nombreFinal }) => {
      const fechas = await fechasDeDetalle({ cliente, tarea });
      const inicio = fechas.inicio || (tarea.inicio && tarea.inicio !== 'Sin fecha' ? tarea.inicio : 'Sin fecha');
      const fin = fechas.fin || (tarea.fin && tarea.fin !== 'Sin fecha' ? tarea.fin : 'Sin fecha');
      return { tarea, nombreFinal, inicio, fin };
    });

    for (const { tarea, nombreFinal, inicio, fin } of conFechas) {
      // Ya está resuelto como parcial en VistaParciales: no se ofrece como tarea
      // nueva ni se intenta insertar. Además, si ese parcial quedó sin enlace
      // (los cargados por cronograma no traen URL), aprovechamos para completarlo
      // con el link real a UGR Virtual. El match es por núcleo del nombre (cubre
      // el «Examen PARCIAL …» con la fecha del anuncio en el rótulo) o, si no,
      // por la misma fecha de fin en la misma materia (cubre los parcialitos
      // cargados desde el cronograma con otro nombre, como el «Avance de medio
      // cursado» de Gestión de Activos).
      const parcial = coincidirParcial({ parciales: resParciales.rows, nombre: nombreFinal, fin });
      if (parcial) {
        if (!parcial.url && tarea.url) {
          urlsParcialesActualizar.push({ id: parcial.id, url: tarea.url });
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

  const calendario = await completarDesdeCalendario({ cliente, db, mapeos, detectadas, periodoId });
  const progreso = alumnoId
    ? await leerProgresoCampus({ cliente, db, mapeos, detectadas, alumnoId })
    : { progresoAlumno: [] };

  return { materiasLocales, cursos, mapeos, detectadas, yaCargadas, urlsActualizar, urlsParcialesActualizar, ...calendario, ...progreso };
}

// El calendario del curso trae las clases y los vencimientos que el overview no
// muestra. Completa fechas vacías o distintas y arma el cronograma que falta.
async function completarDesdeCalendario({ cliente, db, mapeos, detectadas, periodoId }) {
  const paginas = await conPool(mapeos, 4, async ({ curso, coincidencia }) => {
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
    eventosCalendario.push(...clasificado.cronograma);
    horariosNuevos.push(...clasificado.horarios);
    for (const fecha of clasificado.fechas) {
      if (fecha.tabla === 'nueva') {
        const nueva = detectadas.find((item) => item.idMoodle === fecha.id);
        if (!nueva) continue;
        if (fecha.campo === 'inicio' && (!nueva.inicio || nueva.inicio === 'Sin fecha')) nueva.inicio = fecha.fecha;
        if (fecha.campo === 'fin' && (!nueva.fin || nueva.fin === 'Sin fecha')) nueva.fin = fecha.fecha;
        continue;
      }
      const destino = fecha.tabla === 'parciales' ? parchesParciales : parchesTareas;
      const actual = destino.get(fecha.id) || { id: fecha.id };
      const guardada = actividades.find((item) => item.id === fecha.id);
      const previa = fecha.campo === 'inicio' ? guardada?.inicio : (fecha.tabla === 'parciales' ? guardada?.fin : guardada?.fin);
      if (fecha.fecha && previa !== fecha.fecha) {
        actual[fecha.campo === 'inicio' ? 'inicio' : 'fin'] = fecha.fecha;
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
  const libretas = await conPool(mapeos, 4, async ({ curso, coincidencia }) => {
    try {
      const pagina = await cliente.pedir(UGR_RUTAS.libreta(curso.id));
      return { materiaId: coincidencia.materia.id, notas: extraerNotasDeLibreta(pagina.html) };
    } catch {
      return { materiaId: coincidencia.materia.id, notas: [] };
    }
  });
  const progresoAlumno = [];
  for (const libreta of libretas) {
    const tareas = await db.execute({ sql: 'SELECT id, nombre FROM tareas WHERE materia_id = ?', args: [libreta.materiaId] });
    const parciales = await db.execute({ sql: 'SELECT id, nombre FROM parciales WHERE materia_id = ?', args: [libreta.materiaId] });
    for (const item of libreta.notas) {
      const tarea = tareas.rows.find((fila) => coincidirNombreTarea(fila.nombre, item.nombre))
        || detectadas.find((fila) => fila.materiaId === libreta.materiaId && coincidirNombreTarea(fila.nombre, item.nombre));
      const parcial = parciales.rows.find((fila) => coincidirNombreTarea(fila.nombre, item.nombre));
      if (tarea) {
        progresoAlumno.push({
          alumnoId,
          tabla: tarea.id ? 'tareas' : 'nueva',
          id: tarea.id || tarea.idMoodle,
          nota: item.nota,
          entregada: true
        });
      }
      if (parcial) {
        progresoAlumno.push({ alumnoId, tabla: 'parciales', id: parcial.id, nota: item.nota, entregada: true });
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
      sql: 'SELECT materia_id, nombre FROM tareas WHERE materia_id = ?',
      args: [materiaId]
    });
    for (const fila of res.rows) existentes.push({ materiaId: fila.materia_id, nombre: fila.nombre });
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

export async function insertarParcialesSiFaltan({ db, detectadas }) {
  const lista = Array.isArray(detectadas) ? detectadas : [];
  const escrituras = [];
  const omitidas = [];
  const vistas = [];
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
  }
  if (escrituras.length > 0) await db.batch(escrituras, 'write');
  return { insertadas: escrituras.length, omitidas };
}

// Completa la columna `url` de tareas que ya existían en la base (por ejemplo,
// importadas con una versión anterior que todavía no guardaba el enlace).
// Acepta una lista de { id, url } y devuelve cuántas actualizó.
export async function actualizarUrlsTareas({ db, urlsActualizar }) {
  if (!Array.isArray(urlsActualizar) || urlsActualizar.length === 0) return 0;
  const updates = urlsActualizar
    .filter(({ id, url }) => id && url)
    .map(({ id, url }) => ({
      sql: 'UPDATE tareas SET url = ? WHERE id = ? AND url = ?',
      args: [url, id, '']
    }));
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}

// Completa la columna `url` de parciales que ya existían en la base. Los
// parciales que se cargan desde el cronograma nacen sin enlace a UGR; el sync
// los detecta cuando la misma actividad aparece en Moodle y completa el link
// para que «Ver en UGR» funcione también en Parciales y en Estado por Alumno.
// Acepta una lista de { id, url } y devuelve cuántas actualizó.
export async function aplicarComplementoCampus({ db, detectado, alumnoId, alumnoNombre } = {}) {
  if (!detectado) return { eventos: 0, horarios: 0, fechas: 0, notas: 0 };
  const eventos = await insertarEventosCronograma({ db, eventos: detectado.eventosCalendario || [] });
  const horarios = await insertarHorariosDetectados({ db, horarios: detectado.horariosNuevos || [], alumnoId });
  const fechas = await actualizarFechasCampus({
    db,
    tareas: detectado.fechasActualizar,
    parciales: detectado.fechasParcialesActualizar
  });
  const notas = alumnoId
    ? await aplicarProgresoCampus({ db, progreso: detectado.progresoAlumno, alumnoId, alumnoNombre })
    : 0;
  return { eventos, horarios, fechas, notas };
}

async function aplicarProgresoCampus({ db, progreso, alumnoId, alumnoNombre }) {
  if (!Array.isArray(progreso) || progreso.length === 0 || !alumnoId) return 0;
  const escrituras = [];
  for (const item of progreso) {
    if (!item?.id || item.tabla === 'nueva') continue;
    if (item.tabla === 'tareas') {
      if (item.entregada) {
        escrituras.push({
          sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(tarea_id, alumno) DO UPDATE SET alumno_id = excluded.alumno_id`,
          args: [item.id, alumnoId, alumnoNombre || '']
        });
      }
      if (item.nota != null) {
        escrituras.push({
          sql: `INSERT INTO notas_tareas (id, tarea_id, alumno_id, alumno, nota, cargada_en)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(tarea_id, alumno) DO UPDATE SET
                  alumno_id = excluded.alumno_id,
                  nota = excluded.nota,
                  cargada_en = excluded.cargada_en`,
          args: [`nota_tarea_${item.id}_${alumnoId}`, item.id, alumnoId, alumnoNombre || '', item.nota]
        });
      }
    }
    if (item.tabla === 'parciales' && item.nota != null) {
      const existe = await db.execute({
        sql: 'SELECT id FROM notas_parciales WHERE parcial_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))',
        args: [item.id, alumnoId, alumnoNombre || '']
      });
      if (existe.rows.length > 0) {
        escrituras.push({
          sql: 'UPDATE notas_parciales SET nota = ?, alumno_id = ?, alumno = ? WHERE id = ?',
          args: [item.nota, alumnoId, alumnoNombre || '', existe.rows[0].id]
        });
      } else {
        escrituras.push({
          sql: 'INSERT INTO notas_parciales (id, parcial_id, alumno_id, alumno, nota) VALUES (?, ?, ?, ?, ?)',
          args: [`nota_${item.id}_${alumnoId}`, item.id, alumnoId, alumnoNombre || '', item.nota]
        });
      }
    }
  }
  if (escrituras.length === 0) return 0;
  await db.batch(escrituras, 'write');
  return escrituras.length;
}

async function insertarHorariosDetectados({ db, horarios, alumnoId }) {
  if (!Array.isArray(horarios) || horarios.length === 0) return 0;
  const inserts = [];
  for (const horario of horarios) {
    if (!horario?.materiaId || !horario.dia || !horario.horaInicio) continue;
    const existe = await db.execute({
      sql: `SELECT 1 FROM horarios
            WHERE materia_id = ? AND CAST(dia AS INTEGER) = ? AND hora_inicio = ?
              AND (alumno_id IS NULL OR alumno_id = ?)`,
      args: [horario.materiaId, Number(horario.dia), horario.horaInicio, alumnoId || null]
    });
    if (existe.rows.length > 0) continue;
    inserts.push({
      sql: 'INSERT INTO horarios (id, materia_id, dia, hora_inicio, hora_fin, aula, alumno_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [`h_${randomUUID()}`, horario.materiaId, String(horario.dia), horario.horaInicio, horario.horaFin || horario.horaInicio, horario.aula || 'Virtual', alumnoId || null]
    });
  }
  if (inserts.length === 0) return 0;
  await db.batch(inserts, 'write');
  return inserts.length;
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

// Ejecuta `fn` sobre `items` respetando un máximo de `concurrency` llamadas
// simultáneas. Mantiene el orden de los resultados. Útil para las decenas de
// pedidos HTTP del sync de avisos sin saturar el campus.
export async function conPool(items, concurrency = 4, fn) {
  const resultados = new Array(items.length);
  let indice = 0;
  async function trabajador() {
    for (;;) {
      const actual = indice;
      indice += 1;
      if (actual >= items.length) return;
      resultados[actual] = await fn(items[actual], actual);
    }
  }
  const hilos = Math.max(1, Math.min(Number(concurrency) || 1, items.length));
  await Promise.all(Array.from({ length: hilos }, () => trabajador()));
  return resultados;
}

// Recorre los foros de avisos de los cursos mapeados y extrae los hilos nuevos
// publicados desde DIAS_HACIA_ATRAS días hacia atrás en adelante (el típico
// aviso del jueves que anuncia un encuentro del martes siguiente entra en la
// ventana). Devuelve { avisosDetectados, eventosSugeridos }; nada se inserta
// acá.
export async function detectarAvisosMoodle({ db, cliente, mapeos, hoy, diasAtras = DIAS_HACIA_ATRAS }) {
  const fechaBase = hoy || fechaHoyLocal();
  const diasVentana = Math.max(1, Number(diasAtras) || DIAS_HACIA_ATRAS);
  // Los hilos publicados antes de la ventana ya fueron procesados (o no
  // anuncian nada del día actual en adelante) y no se vuelven a proponer:
  // avisos_moodle guarda el histórico por curso + hilo.
  const fechaMinima = sumarDias(fechaBase, -diasVentana);

  // La vista previa persiste pendientes. Deben reaparecer al confirmar o
  // reabrir el modal; solo una decisión definitiva excluye el hilo.
  const resConocidos = await db.execute("SELECT curso_id, hilo_id FROM avisos_moodle WHERE estado IN ('aceptado', 'rechazado')");
  const conocidos = new Set(
    resConocidos.rows.map((fila) => `${fila.curso_id}:${fila.hilo_id}`)
  );

  const avisosDetectados = [];
  const eventosSugeridos = [];
  // Cache de la comprobación «¿el autor es del equipo docente?» por
  // (curso, autorId): evita volver a pedir el perfil de un mismo autor en
  // varios hilos detectados en el mismo sync.
  const cachePerfilDocente = new Map();

  // 1) Índice de foros de todos los cursos en paralelo (concurrencia 4) y,
  // dentro de cada curso, las páginas de los foros «de avisos» (Avisos,
  // Consultas, …) con la misma concurrencia. Antes se encadenaba un pedido por
  // curso y luego otro por foro: ese ida-y-vuelta era gran parte de la lentitud.
  // En el mismo worker se baja la página del curso para identificar al equipo
  // docente (los avisos que llegan a la campana son solo del profesorado).
  const cursosConForos = await conPool(mapeos || [], 4, async ({ curso, coincidencia }) => {
    try {
      const [paginaForos, paginaCurso] = await Promise.all([
        cliente.pedir(UGR_RUTAS.forosDeCurso(curso.id)).catch(() => null),
        cliente.pedir(UGR_RUTAS.curso(curso.id)).catch(() => null)
      ]);
      const docentes = paginaCurso
        ? extraerDocentesDeCurso(paginaCurso.html, UGR_BASE_URL)
        : [];
      const foros = extraerForosDelIndice(paginaForos?.html || '', UGR_BASE_URL)
        .filter((foro) => foro.esAvisos);
      const conDiscusiones = await conPool(foros, 4, async (foro) => {
        try {
          const paginaForo = await cliente.pedir(foro.url);
          return { foro, discusiones: extraerDiscusionesDeForo(paginaForo.html, UGR_BASE_URL) };
        } catch {
          return { foro, discusiones: [] };
        }
      });
      return {
        curso,
        coincidencia,
        docentes,
        foros: conDiscusiones.filter(({ discusiones }) => discusiones.length > 0)
      };
    } catch {
      return null;
    }
  });

  for (const resultado of cursosConForos) {
    if (!resultado) continue;
    const { curso, coincidencia, foros, docentes } = resultado;

    for (const { foro, discusiones } of foros) {
      // 2) Hilos nuevos dentro de la ventana: los ya conocidos no se vuelven a
      // proponer, y los que no se actualizaron en los últimos `diasVentana`
      // días no se leen siquiera (evita pedir el post de hilos viejos la
      // primera vez que corre el sync).
      const nuevas = discusiones.filter((d) =>
        !conocidos.has(`${curso.id}:${d.id}`)
        && (!d.actualizado || d.actualizado >= fechaMinima)
      );

      // 3) Primer post de cada hilo nuevo, en paralelo (concurrencia 4).
      const posts = await conPool(nuevas, 4, async (d) => {
        try {
          const pagina = await cliente.pedir(d.url);
          return extraerPostsDeHilo(pagina.html, UGR_BASE_URL);
        } catch {
          return [];
        }
      });

      for (let i = 0; i < nuevas.length; i += 1) {
        const discusion = nuevas[i];
        const delHilo = posts[i] || [];
        // El anuncio puede ser el post que abre el hilo o un recordatorio
        // posterior del docente. Se queda el primero de la ventana que sea
        // suyo y que le sirva a la cursada.
        let post = null;
        let analisis = [];
        for (const candidato of delHilo) {
          if (!candidato.fecha || candidato.fecha < fechaMinima) continue;
          const esDeDocente = await autorEsEquipoDocente({
            autor: candidato.autor,
            autorId: candidato.autorId,
            cursoId: curso.id,
            docentes,
            cliente,
            cache: cachePerfilDocente
          });
          if (!esDeDocente) continue;
          const eventos = filtrarEventosDeAviso(candidato, analizarAvisosParaCronograma({
            titulo: candidato.titulo,
            contenido: candidato.contenido,
            materiaNombre: coincidencia.materia.nombre,
            hoy: fechaBase,
            fechaPublicacion: candidato.fecha
          }));
          if (eventos.length === 0 && !avisoEsRelevante(candidato)) continue;
          post = candidato;
          analisis = eventos;
          break;
        }
        if (!post) continue;
        const id = `aviso_${curso.id}_${discusion.id}`;

        avisosDetectados.push({
          id,
          idMoodle: `moodle_avisos_${curso.id}_${discusion.id}`,
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          materiaId: coincidencia.materia.id,
          materiaNombre: coincidencia.materia.nombre,
          foroId: foro.id,
          foroNombre: foro.nombre,
          hiloId: discusion.id,
          titulo: post.titulo,
          autor: post.autor,
          fecha: post.fecha,
          contenido: post.contenido,
          contenidoHtml: post.contenidoHtml,
          url: post.urlHilo || discusion.url
        });

        for (const analizado of analisis) {
          eventosSugeridos.push({
            avisoId: id,
            avisoIdMoodle: `moodle_avisos_${curso.id}_${discusion.id}`,
            materiaId: coincidencia.materia.id,
            url: post.urlHilo || discusion.url,
            ...analizado
          });
        }
      }
    }
  }

  return { avisosDetectados, eventosSugeridos };
}

// Registra las sugerencias de avisos (estado 'pendiente'). No se publican
// solas: solo el admin las aprueba. Si un hilo ya existía (aceptado o
// rechazado) no se re-sugiere ni se le cambia el estado.
export async function insertarAvisosDetectados({ db, avisos }) {
  if (!Array.isArray(avisos) || avisos.length === 0) return 0;
  const insertar = avisos.map((a) => ({
    sql: `INSERT INTO avisos_moodle
          (id, curso_id, curso_nombre, materia_id, materia_nombre, foro_id, foro_nombre, hilo_id, titulo, autor, fecha, contenido, url, estado, creado_en)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', datetime('now'))
          ON CONFLICT(curso_id, hilo_id) DO UPDATE SET
            titulo = excluded.titulo,
            autor = excluded.autor,
            contenido = excluded.contenido,
            fecha = excluded.fecha,
            url = excluded.url`,
    args: [
      a.id,
      a.cursoId,
      a.cursoNombre,
      a.materiaId || null,
      a.materiaNombre || '',
      a.foroId,
      a.foroNombre,
      a.hiloId,
      a.titulo,
      a.autor || '',
      a.fecha,
      a.contenido || '',
      a.url || ''
    ]
  }));
  await db.batch(insertar, 'write');
  return insertar.length;
}

// Aprueba avisos (estado 'pendiente' → 'aceptado'). Solo después de esto el
// aviso se muestra en la campana de notificaciones.
export async function aprobarAvisos({ db, ids }) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const updates = ids
    .filter(Boolean)
    .map((id) => ({
      sql: "UPDATE avisos_moodle SET estado = 'aceptado' WHERE id = ?",
      args: [id]
    }));
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}

// Rechaza avisos sugeridos (no se publican y no se vuelven a proponer).
export async function rechazarAvisos({ db, ids }) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const updates = ids
    .filter(Boolean)
    .map((id) => ({
      sql: "UPDATE avisos_moodle SET estado = 'rechazado' WHERE id = ?",
      args: [id]
    }));
  if (updates.length === 0) return 0;
  await db.batch(updates, 'write');
  return updates.length;
}

// Agrega eventos sugeridos al cronograma (origen 'ugr', con el enlace al hilo
// para «Ver en UGR»). INSERT OR IGNORE: no duplica por (materia, fecha, titulo).
export async function insertarEventosCronograma({ db, eventos }) {
  if (!Array.isArray(eventos) || eventos.length === 0) return 0;
  const inserts = eventos
    .filter((e) => e && e.materiaId && e.fecha && e.titulo)
    .map((e) => ({
      sql: `INSERT OR IGNORE INTO cronograma_eventos
            (id, materia_id, fecha, modalidad, tipo, titulo, detalles, url, origen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ugr')`,
      args: [
        `cronograma_${e.materiaId}_${e.fecha}_${String(e.titulo).slice(0, 60)}_${randomUUID().slice(0, 8)}`,
        e.materiaId,
        e.fecha,
        e.modalidad || 'sincrónico',
        e.tipo || 'clase',
        String(e.titulo).slice(0, 200),
        e.detalles || '',
        e.url || ''
      ]
    }));
  if (inserts.length === 0) return 0;
  await db.batch(inserts, 'write');
  return inserts.length;
}
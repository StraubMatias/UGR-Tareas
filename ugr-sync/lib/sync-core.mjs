// Núcleo de la sincronización con UGR Virtual, compartido entre el CLI
// (ugr-sync/scripts/sync.mjs) y la acción de servidor del panel (src/app/actions.js).
// Toda la lógica de descubrimiento de cursos, mapeo a materias locales y
// detección de tareas nuevas vive acá; las inserciones en la base se hacen con
// el objeto `db` que cada llamador provee (libsql client o wrapper de turso).
import { randomUUID } from 'node:crypto';
import { crearCliente } from './red.mjs';
import { optimizarLecturas } from './lecturas.mjs';
import { autorEsEquipoDocente, esEquipoDocente, extraerDocentesDeCurso, normalizarNombrePersona } from './docentes.mjs';
import { extraerCursos, extraerCursosDeAjax, extraerNombreCursoDesdePagina, extraerSesskey, extraerUserid, esCursoOrganizativo } from './materias.mjs';
import { extraerConsignasDeCurso, extraerFechasActividad, extraerNotasDeLibreta, extraerProgresoDeActividad, priorizarNotaDeUltimoIntento, urlDeUltimaRevision } from './tareas.mjs';
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
import { ajustarClasesAlHorario, clasificarEventosCalendario, extraerEventosCalendario, timestampsDeMesesDelPeriodo } from './calendario.mjs';
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';
import { cabeceraCookies } from './autenticar.mjs';
import { extraerEnlacesDeCursada, interpretarCondiciones, textoDeArchivoCampus, urlArchivoDeRecurso } from './metodologia.mjs';

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

function esNotaEstable(notaGuardada, cargadaEn, diasEstable = 7) {
  if (notaGuardada == null || String(notaGuardada).trim() === '') return false;
  if (!cargadaEn) return false;
  const tiempo = new Date(cargadaEn).getTime();
  if (!Number.isFinite(tiempo)) return false;
  return (Date.now() - tiempo) > diasEstable * 24 * 60 * 60 * 1000;
}

// La nota no está en el índice del curso: está en la página de cada actividad
// («Ver en UGR»). Se abre con la sesión de quien sincroniza. Los cuestionarios
// van primero y, si se pide, cada nota se guarda en cuanto se lee.
// Para no sobrecargar Moodle ni demorar el sync a fin de cuatrimestre, las notas
// que ya se cargaron hace más de 7 días se consideran estables y se omiten.
async function leerNotasDeEnlaces({ cliente, db, materiaIds, alumnoId, alumnoNombre, guardar = false }) {
  if (!cliente || !materiaIds?.length) return { notas: [], cargadas: [], noLeidas: [], pendientesEntrega: [] };
  const marcas = materiaIds.map(() => '?').join(', ');
  const tareas = await db.execute({
    sql: `SELECT t.id, t.materia_id, t.nombre, t.url, m.nombre AS materia,
                 nt.nota AS nota_guardada, nt.cargada_en AS nota_cargada_en, nt.cerrada AS nota_cerrada
          FROM tareas t JOIN materias m ON m.id = t.materia_id
          LEFT JOIN notas_tareas nt ON nt.tarea_id = t.id AND (nt.alumno_id = ? OR LOWER(nt.alumno) = LOWER(?))
          WHERE t.materia_id IN (${marcas}) AND TRIM(COALESCE(t.url, '')) != '' AND COALESCE(t.tipo, '') != 'foro'`,
    args: [alumnoId || '', alumnoNombre || '', ...materiaIds]
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
    ...tareas.rows.map((fila) => ({ ...fila, tabla: 'tareas', fecha: null })),
    ...parciales.rows.map((fila) => ({ ...fila, tabla: 'parciales' }))
  ].sort((a, b) => Number(!/\/mod\/quiz\//.test(String(a.url))) - Number(!/\/mod\/quiz\//.test(String(b.url))));

  const aConsultar = lista.filter((fila) => {
    if (fila.tabla === 'tareas') {
      if (esNotaEstable(fila.nota_guardada, fila.nota_cargada_en, 7)) return false;
    }
    if (fila.tabla === 'parciales') {
      if (fila.nota_guardada != null && String(fila.nota_guardada).trim() !== '') {
        if (fila.fecha) {
          const fechaParcial = new Date(fila.fecha).getTime();
          if (Number.isFinite(fechaParcial) && (Date.now() - fechaParcial) > 7 * 24 * 60 * 60 * 1000) return false;
        }
      }
    }
    return true;
  });

  const notas = [];
  const cargadas = [];
  const noLeidas = [];
  const pendientesEntrega = [];
  await conPool(aConsultar, 4, async (fila) => {
    try {
      const pagina = await cliente.pedir(fila.url);
      const esQuiz = /\/mod\/quiz\//.test(String(fila.url));
      if (!pagina?.html || pagina.es_requiere_login) {
        if (esQuiz) noLeidas.push({ materia: fila.materia, nombre: fila.nombre });
        return;
      }
      const progreso = await notaDePagina(cliente, pagina.html);
      if (progreso.nota == null && !progreso.entregada) {
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
        entregada: true,
        forzar: progreso.nota != null
      };
      notas.push(item);
      if (guardar && alumnoId) {
        const escrito = await aplicarProgresoCampus({ db, progreso: [item], alumnoId, alumnoNombre });
        cargadas.push(...escrito.cargadas);
        pendientesEntrega.push(...(escrito.pendientesEntrega || []));
      }
    } catch {
      if (/\/mod\/quiz\//.test(String(fila.url))) noLeidas.push({ materia: fila.materia, nombre: fila.nombre });
    }
  });
  return { notas, cargadas, noLeidas, pendientesEntrega };
}

export async function cargarNotasDesdeEnlaces({ cliente, db, materiaIds, alumnoId, alumnoNombre }) {
  return leerNotasDeEnlaces({ cliente, db, materiaIds, alumnoId, alumnoNombre, guardar: true });
}

// Cursos en los que el alumno está inscripto ahora. El índice clásico y el
// calendario suelen listar solo las 5 de la comisión; las extras de la carrera
// (otro cuatrimestre, electivas) viven en «Mis cursos» y en el AJAX de Moodle 4.
const VENTANA_CURSADA_SEG = 240 * 24 * 3600;

function pareceCursandoTodavia(curso, ahoraSeg) {
  const acceso = Number(curso?.timeaccess || 0);
  const fin = Number(curso?.enddate || 0);
  if (acceso && acceso >= ahoraSeg - VENTANA_CURSADA_SEG) return true;
  if (fin && fin >= ahoraSeg - VENTANA_CURSADA_SEG) return true;
  if (!acceso && !fin) return true;
  return false;
}

export async function listarCursosDelCampus(cliente) {
  const paginas = [];
  for (const ruta of [UGR_RUTAS.cursos, UGR_RUTAS.misCursos, UGR_RUTAS.dashboard]) {
    try {
      paginas.push(await cliente.pedir(ruta));
    } catch {
      // Una de las vistas puede faltar según el tema; las otras alcanzan.
    }
  }
  const porId = new Map();
  const incorporar = (lista, { soloRecientes } = {}) => {
    const ahoraSeg = Math.floor(Date.now() / 1000);
    for (const curso of lista || []) {
      if (!curso?.id || esCursoOrganizativo(curso.nombre)) continue;
      const id = String(curso.id);
      if (soloRecientes && !porId.has(id) && !pareceCursandoTodavia(curso, ahoraSeg)) continue;
      const existente = porId.get(id);
      if (existente && !(existente.nombreIncompleto && !curso.nombreIncompleto)) continue;
      porId.set(id, curso);
    }
  };
  for (const pagina of paginas) incorporar(extraerCursos(pagina?.html));

  const sesskey = paginas.map((pagina) => extraerSesskey(pagina?.html)).find(Boolean);
  const userid = paginas.map((pagina) => extraerUserid(pagina?.html)).find(Boolean);
  if (sesskey && userid) {
    try {
      const cuerpo = JSON.stringify([{
        index: 0,
        methodname: 'core_enrol_get_users_courses',
        args: { userid: Number(userid), returnusercount: false }
      }]);
      const pagina = await cliente.pedir(UGR_RUTAS.ajax(sesskey), {
        method: 'POST',
        cuerpo,
        tipoCuerpo: 'application/json'
      });
      incorporar(extraerCursosDeAjax(JSON.parse(pagina.html || '[]')));
    } catch {
      // Si este webservice no está, quedan Mis cursos y el timeline.
    }
    try {
      const cuerpo = JSON.stringify([{
        index: 0,
        methodname: 'core_course_get_recent_courses',
        args: { userid: Number(userid), limit: 20 }
      }]);
      const pagina = await cliente.pedir(UGR_RUTAS.ajax(sesskey), {
        method: 'POST',
        cuerpo,
        tipoCuerpo: 'application/json'
      });
      incorporar(extraerCursosDeAjax(JSON.parse(pagina.html || '[]')));
    } catch {
      // Los cursos recientes son un respaldo: el timeline sigue valiendo.
    }
  }
  if (sesskey) {
    const ajax = await conPool(['inprogress', 'future', 'past'], 4, async (classification) => {
      try {
        const cuerpo = JSON.stringify([{
          index: 0,
          methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
          args: {
            offset: 0,
            limit: 0,
            classification,
            sort: 'fullname',
            customfieldname: '',
            customfieldvalue: '',
            searchvalue: ''
          }
        }]);
        const pagina = await cliente.pedir(UGR_RUTAS.ajax(sesskey), {
          method: 'POST',
          cuerpo,
          tipoCuerpo: 'application/json'
        });
        return { classification, cursos: extraerCursosDeAjax(JSON.parse(pagina.html || '[]')) };
      } catch {
        return { classification, cursos: [] };
      }
    });
    for (const { classification, cursos: extra } of ajax) {
      incorporar(extra, { soloRecientes: classification === 'past' });
    }
  }

  const cursos = [...porId.values()];
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
  return cursos.filter((curso) => !esCursoOrganizativo(curso.nombre));
}

// Crea en el período actual las materias de la carrera que el campus muestra
// y que todavía no existían (una extra de otro cuatrimestre, por ejemplo) y
// devuelve el mapeo curso → materia para cargarles las tareas.
export async function asegurarMateriasDeLaCursada({ db, cursos, materias = [], plan = [], periodoId } = {}) {
  const cursando = emparejarCursosConMaterias(cursos, materias, plan);
  const altas = [];
  const nombresNuevos = new Set();
  for (const item of cursando) {
    if (!item.nueva || !periodoId) continue;
    const nombre = String(item.nombre || '').toUpperCase();
    const clave = limpiarTextoParaBusqueda(nombre);
    if (!clave || nombresNuevos.has(clave)) continue;
    if (materias.some((materia) => limpiarTextoParaBusqueda(materia?.nombre) === clave)) continue;
    nombresNuevos.add(clave);
    altas.push({
      sql: 'INSERT INTO materias (id, nombre, periodo_id) VALUES (?, ?, ?)',
      args: [`m_${randomUUID()}`, nombre, periodoId]
    });
  }
  if (altas.length > 0) await db.batch(altas, 'write');

  const vigentes = periodoId
    ? await db.execute({ sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre', args: [periodoId] })
    : { rows: materias };
  const mapeos = [];
  const materiaIds = [];
  const nombresPorId = new Map();
  for (const item of cursando) {
    const clave = limpiarTextoParaBusqueda(item.nombre);
    const fila = (vigentes.rows || []).find((materia) => {
      if (item.materiaId && String(materia.id) === String(item.materiaId)) return true;
      return clave && limpiarTextoParaBusqueda(materia.nombre) === clave;
    });
    const materiaId = fila?.id ? String(fila.id) : '';
    if (!materiaId) continue;
    const nombre = String(fila.nombre || item.nombre);
    if (!materiaIds.includes(materiaId)) {
      materiaIds.push(materiaId);
      nombresPorId.set(materiaId, nombre);
    }
    mapeos.push({
      curso: item.curso,
      coincidencia: { materia: { id: materiaId, nombre }, score: 100 }
    });
  }
  return { cursando, mapeos, materiaIds, nombresPorId, materiasNuevas: altas.length, nombresNuevos };
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
        if (!existente.url && tarea.url) {
          urlsActualizar.push({ id: existente.id, url: tarea.url });
        }
        // La página de la actividad es la fecha que editó el profesor. El índice
        // a veces no trae la apertura, así que no alcanza para dar por buena
        // la que ya teníamos guardada.
        if (tarea.url && tarea.tipo !== 'foro') {
          aRevisar.push({ tarea, nombreFinal, existente });
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
        notasIntento.push({
          materiaId: coincidencia.materia.id,
          materiaNombre: coincidencia.materia.nombre,
          nombre: nombreFinal,
          id: existente?.id || null,
          tabla: existente ? 'tareas' : 'nueva',
          nota: notaIntento != null ? notaIntento : tarea.notaCampus ?? null,
          entregada: true
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

async function libretaYaCerrada({ db, materiaId, alumnoId }) {
  try {
    const tareas = await db.execute({
      sql: `SELECT t.id FROM tareas t
            WHERE t.materia_id = ? AND t.con_nota = 1
              AND NOT EXISTS (
                SELECT 1 FROM notas_tareas n
                WHERE n.tarea_id = t.id AND n.alumno_id = ? AND n.cerrada = 1
              )`,
      args: [materiaId, alumnoId]
    });
    if (tareas.rows.length > 0) return false;
    const parciales = await db.execute({
      sql: `SELECT p.id FROM parciales p
            WHERE p.materia_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM notas_parciales n
                WHERE n.parcial_id = p.id AND n.alumno_id = ? AND n.cerrada = 1
              )`,
      args: [materiaId, alumnoId]
    });
    const hayCalificables = tareas.rows.length + parciales.rows.length;
    if (hayCalificables > 0) return false;
    const totales = await db.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM tareas WHERE materia_id = ? AND con_nota = 1) AS tareas,
              (SELECT COUNT(*) FROM parciales WHERE materia_id = ?) AS parciales`,
      args: [materiaId, materiaId]
    });
    return Number(totales.rows[0]?.tareas || 0) + Number(totales.rows[0]?.parciales || 0) > 0;
  } catch {
    return false;
  }
}

async function completarDesdeCalendario({ cliente, db, mapeos, detectadas, periodoId }) {
  const pendientes = [];
  for (const mapeo of mapeos) {
    const materiaId = mapeo?.coincidencia?.materia?.id;
    if (!materiaId) continue;
    const ya = await db.execute({
      sql: 'SELECT 1 FROM cronograma_eventos WHERE materia_id = ? LIMIT 1',
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
  const libretas = await conPool(mapeos, 4, async ({ curso, coincidencia }) => {
    const materiaId = coincidencia.materia.id;
    const hayNuevas = detectadas.some((item) => item.materiaId === materiaId);
    if (!hayNuevas && await libretaYaCerrada({ db, materiaId, alumnoId })) {
      return { materiaId, notas: [] };
    }
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
          nombre: item.nombre,
          tabla: tarea.id ? 'tareas' : 'nueva',
          id: tarea.id || tarea.idMoodle,
          nota: item.nota,
          entregada: true
        });
      }
      if (parcial) {
        progresoAlumno.push({
          alumnoId,
          materiaId: libreta.materiaId,
          nombre: item.nombre,
          tabla: 'parciales',
          id: parcial.id,
          fecha: parcial.fecha,
          nota: item.nota,
          entregada: true
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
  if (!detectado) return { eventos: 0, horarios: 0, fechas: 0, notas: 0, notasCargadas: [], pendientesEntrega: [] };
  const eventos = await insertarEventosCronograma({ db, eventos: detectado.eventosCalendario || [] });
  const horarios = await insertarHorariosDetectados({ db, horarios: detectado.horariosNuevos || [] });
  const fechas = await actualizarFechasCampus({
    db,
    tareas: detectado.fechasActualizar,
    parciales: detectado.fechasParcialesActualizar
  });
  const progreso = alumnoId
    ? await aplicarProgresoCampus({ db, progreso: detectado.progresoAlumno, alumnoId, alumnoNombre })
    : { cantidad: 0, cargadas: [], pendientesEntrega: [] };
  return {
    eventos,
    horarios,
    fechas,
    notas: progreso.cantidad,
    notasCargadas: progreso.cargadas,
    pendientesEntrega: progreso.pendientesEntrega
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
      if (item.nota != null && !entregadaAca && item.forzar) {
        escrituras.push({
          sql: `INSERT INTO completadas (tarea_id, alumno_id, alumno, completada_en) VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(tarea_id, alumno) DO NOTHING`,
          args: [id, alumnoId, alumnoNombre || '']
        });
        entregadaAca = true;
      }
      if (item.nota != null && !entregadaAca) {
        pendientesEntrega.push({ materia: item.materiaNombre || '', nombre: item.nombre });
        continue;
      }
      if (item.nota != null && entregadaAca) {
        const notaGuardar = textoNota(item.nota);
        const previa = await db.execute({
          sql: 'SELECT nota FROM notas_tareas WHERE tarea_id = ? AND (alumno_id = ? OR LOWER(alumno) = LOWER(?))',
          args: [id, alumnoId, alumnoNombre || '']
        });
        cargadas.push({
          materia: item.materiaNombre || '',
          nombre: item.nombre,
          nota: notaGuardar,
          yaEstaba: mismaNota(previa.rows[0]?.nota, notaGuardar)
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
        yaEstaba: mismaNota(previaNota.rows[0]?.nota, item.nota)
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
  for (const materiaId of materiaIds) {
    const res = await db.execute({
      sql: 'SELECT id, fecha, titulo FROM cronograma_eventos WHERE materia_id = ?',
      args: [materiaId]
    });
    for (const fila of res.rows) {
      exactos.add(`${materiaId}|${fila.fecha}|${fila.titulo}`);
      porBase.set(`${materiaId}|${fila.fecha}|${tituloSinRango(fila.titulo)}`, fila);
    }
  }
  const cambios = [];
  for (const e of validos) {
    const titulo = String(e.titulo).slice(0, 200);
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
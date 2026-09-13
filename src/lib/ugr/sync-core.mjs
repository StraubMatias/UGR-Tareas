// Núcleo de la sincronización con UGR Virtual, compartido entre el CLI
// (scripts/ugr-sync.mjs) y la acción de servidor del panel (src/app/actions.js).
// Toda la lógica de descubrimiento de cursos, mapeo a materias locales y
// detección de tareas nuevas vive acá; las inserciones en la base se hacen con
// el objeto `db` que cada llamador provee (libsql client o wrapper de turso).
import { randomUUID } from 'node:crypto';
import { crearCliente } from './red.mjs';
import { extraerCursos, extraerNombreCursoDesdePagina } from './materias.mjs';
import { extraerFechasActividad, extraerTareas } from './tareas.mjs';
import {
  coincidirMateria,
  inferirTipoTarea,
  limpiarTextoParaBusqueda,
  normalizarNombre
} from './normalizar.mjs';
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';

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
        lista.add(join(directorio, nombre));
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
  return crearCliente({ usuario, contrasena });
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

// Recorre los cursos del campus, los mapea contra las materias locales y
// devuelve las tareas nuevas que todavía no existen en la base.
export async function detectarTareasNuevas({ db, cliente }) {
  // 1) Materias locales (destino).
  const resMaterias = await db.execute('SELECT id, nombre FROM materias ORDER BY nombre');
  const materiasLocales = resMaterias.rows;

  // 2) Cursos del campus y mapeo contra las materias locales.
  const pageCursos = await cliente.pedir(UGR_RUTAS.cursos);
  const cursos = extraerCursos(pageCursos.html);

  // Moodle a veces sirve nombres truncados dentro de los selects (terminan en
  // "...") aunque el prefijo de versión «(V.TUCS.1.07.2)» ya sea visible.
  // El nombre completo está en la página del curso: lo resolvemos antes de
  // mapear contra las materias locales.
  const mapeos = [];
  for (const curso of cursos) {
    if (curso.nombreIncompleto) {
      try {
        const paginaCurso = await cliente.pedir(UGR_RUTAS.curso(curso.id));
        const nombreCompleto = extraerNombreCursoDesdePagina(paginaCurso.html, curso.id);
        if (nombreCompleto) curso.nombre = nombreCompleto;
      } catch {
        // Si falla la resolución, nos quedamos con el nombre parcial.
      }
    }
    const coincidencia = coincidirMateria(curso.nombre, materiasLocales);
    if (coincidencia) mapeos.push({ curso, coincidencia });
  }

  // 3) Tareas de cada curso mapeado y detección de faltantes.
  const detectadas = [];
  for (const { curso, coincidencia } of mapeos) {
    const pagina = await cliente.pedir(UGR_RUTAS.tareasDeCurso(curso.id));
    const tareas = extraerTareas(pagina.html, UGR_BASE_URL);

    const resExistentes = await db.execute({
      sql: 'SELECT nombre FROM tareas WHERE materia_id = ?',
      args: [coincidencia.materia.id]
    });
    const nombresExistentes = new Set(resExistentes.rows.map((t) => limpiarTextoParaBusqueda(t.nombre)));

    for (const tarea of tareas) {
      // La apertura no viene en el índice: se lee del detalle de la tarea.
      const fechas = await fechasDeDetalle({ cliente, tarea });
      const inicio = fechas.inicio || (tarea.inicio && tarea.inicio !== 'Sin fecha' ? tarea.inicio : 'Sin fecha');
      const fin = fechas.fin || (tarea.fin && tarea.fin !== 'Sin fecha' ? tarea.fin : 'Sin fecha');

      const nombreFinal = normalizarNombre({ nombre: tarea.nombre, cursoNombre: curso.nombre });
      const clave = limpiarTextoParaBusqueda(nombreFinal);
      if (nombresExistentes.has(clave)) continue;
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
        tipo: inferirTipoTarea(nombreFinal),
        url: tarea.url || '',
        detalles: 'Importada desde UGR Virtual'
      });
    }
  }

  return { materiasLocales, cursos, mapeos, detectadas };
}

// Inserta las tareas detectadas en la base. Devuelve cuántas insertó.
export async function insertarTareasDetectadas({ db, detectadas }) {
  const inserts = detectadas.map((t) => ({
    sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      `t_${randomUUID()}`,
      t.materiaId,
      t.nombre,
      t.inicio || 'Sin fecha',
      t.fin || 'Sin fecha',
      t.detalles || 'Importada desde UGR Virtual',
      t.unidad ?? null,
      t.conNota ? 1 : 0,
      t.tipo || 'actividad'
    ]
  }));

  if (inserts.length === 0) return 0;
  await db.batch(inserts, 'write');
  return inserts.length;
}
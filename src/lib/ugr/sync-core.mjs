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

// Credenciales de UGR: si el proceso de Next arranca antes de que existan
// UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en .env.local, Node no las carga en
// process.env (los `.env*` se leen al iniciar) y quedan ausentes aunque después
// se agreguen al archivo. Además Turbopack reemplaza `process.env.VARIABLE` por
// su valor al compilar y cachea. Por eso:
//   * la lectura es dinámica, vía process.env[nombre] con el nombre en una
//     variable de runtime (imposible de «inlinar» en el bundle);
//   * justo antes de conectar se recarga .env.local con ruta absoluta, sin
//     depender del directorio de trabajo ni del momento en que arrancó el
//     proceso (idempotente y barato si las claves ya están cargadas).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let rutaEnvLocalCacheada = null;

// Ubica .env.local: primero relativo al cwd (arranque normal) y como respaldo
// subiendo desde el módulo compilado hacia la raíz del proyecto (cubre un
// server lanzado con otro directorio de trabajo).
function rutaEnvLocal() {
  if (rutaEnvLocalCacheada) return rutaEnvLocalCacheada;
  const candidatas = [join(process.cwd(), '.env.local')];
  try {
    let directorio = dirname(fileURLToPath(import.meta.url));
    for (let nivel = 0; nivel < 10; nivel += 1) {
      candidatas.push(join(directorio, '.env.local'));
      if (existsSync(join(directorio, 'package.json'))) break;
      directorio = dirname(directorio);
    }
  } catch {
    // import.meta.url no resoluble: nos quedamos con la ruta del cwd.
  }
  for (const ruta of candidatas) {
    if (existsSync(/* turbopackIgnore: true */ ruta)) {
      rutaEnvLocalCacheada = ruta;
      return ruta;
    }
  }
  return null;
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
  return process.env[nombre] || '';
}

// Recarga las credenciales en el momento de usarlas. Si ya están en el entorno,
// no toca nada. Primero intenta con process.loadEnvFile (Node >= 20.12) y, si
// falta o falla, parsea el archivo a mano y lo aplica en process.env.
function cargarCredencialesUGR() {
  if (variableEntorno('UGRVIRTUAL_USER') && variableEntorno('UGRVIRTUAL_PASSWORD')) return;
  const ruta = rutaEnvLocal();
  if (!ruta) return;
  try {
    if (typeof process.loadEnvFile === 'function') process.loadEnvFile(ruta);
  } catch {
    // Parseo manual por debajo si loadEnvFile falla o no existe.
  }
  if (variableEntorno('UGRVIRTUAL_USER') && variableEntorno('UGRVIRTUAL_PASSWORD')) return;
  try {
    aplicarVariables(parsearEnvLocal(readFileSync(/* turbopackIgnore: true */ ruta, 'utf8')));
  } catch {
    // Sin credenciales disponibles: conectarUGR dará su mensaje claro.
  }
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
    throw new Error('Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en .env.local.');
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
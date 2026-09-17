// Núcleo de la sincronización con UGR Virtual, compartido entre el CLI
// (ugr-sync/scripts/sync.mjs) y la acción de servidor del panel (src/app/actions.js).
// Toda la lógica de descubrimiento de cursos, mapeo a materias locales y
// detección de tareas nuevas vive acá; las inserciones en la base se hacen con
// el objeto `db` que cada llamador provee (libsql client o wrapper de turso).
import { randomUUID } from 'node:crypto';
import { crearCliente } from './red.mjs';
import { autorEsEquipoDocente, esEquipoDocente, extraerDocentesDeCurso, normalizarNombrePersona } from './docentes.mjs';
import { extraerCursos, extraerNombreCursoDesdePagina } from './materias.mjs';
import { extraerFechasActividad, extraerActividadesOverview } from './tareas.mjs';
import {
  analizarAvisosParaCronograma,
  DIAS_HACIA_ATRAS,
  extraerDiscusionesDeForo,
  extraerForosDelIndice,
  extraerPrimerPostDeHilo,
  fechaHoyLocal,
  sumarDias
} from './avisos.mjs';
import {
  claveTareaParaEmparejar,
  coincidirMateria,
  coincidirNombreTarea,
  coincidirParcial,
  inferirTipoTarea,
  normalizarNombre
} from './normalizar.mjs';
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
  // La resolución del nombre completo es independiente por curso: se hace en
  // paralelo (concurrencia 4) en vez de encadenar un pedido HTTP por curso.
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
  for (const curso of cursos) {
    const coincidencia = coincidirMateria(curso.nombre, materiasLocales);
    if (coincidencia) mapeos.push({ curso, coincidencia });
  }

  // 3) Tareas de cada curso mapeado y detección de faltantes.
  const detectadas = [];
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

  for (const resultado of overviews) {
    if (!resultado) continue;
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
      sql: 'SELECT id, nombre, url FROM tareas WHERE materia_id = ?',
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
  }

  return { materiasLocales, cursos, mapeos, detectadas, urlsActualizar, urlsParcialesActualizar };
}

// Inserta las tareas detectadas en la base. Devuelve cuántas insertó.
export async function insertarTareasDetectadas({ db, detectadas }) {
  const inserts = detectadas.map((t) => ({
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
          return extraerPrimerPostDeHilo(pagina.html, UGR_BASE_URL);
        } catch {
          return null;
        }
      });

      for (let i = 0; i < nuevas.length; i += 1) {
        const discusion = nuevas[i];
        const post = posts[i];
        if (!post) continue;
        // Regla confirmada: solo avisos publicados dentro de la ventana (desde
        // `fechaMinima` hacia adelante); los más viejos se descartan.
        if (!post.fecha || post.fecha < fechaMinima) continue;
        // Regla confirmada: solo anuncios del equipo docente. Las preguntas y
        // comentarios de compañeros no llegan a la campana ni al cronograma.
        const esDeDocente = await autorEsEquipoDocente({
          autor: post.autor,
          autorId: post.autorId,
          cursoId: curso.id,
          docentes,
          cliente,
          cache: cachePerfilDocente
        });
        if (!esDeDocente) continue;

        const analisis = analizarAvisosParaCronograma({
          titulo: post.titulo,
          contenido: post.contenido,
          materiaNombre: coincidencia.materia.nombre,
          hoy: fechaBase,
          fechaPublicacion: post.fecha
        });
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
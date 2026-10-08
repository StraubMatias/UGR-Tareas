// Carga UGRVIRTUAL_* desde process.env o desde .env.local (desarrollo / Vercel dev).
// Se importa al arrancar el núcleo de sync para que el CLI no dependa del cwd.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let candidatasEnvLocalCacheadas = null;
let rutaCredencialesUGR = null;
let ultimoArchivoEnvLocal = null;

const NOMBRES_ARCHIVOS_ENV = [
  '.env.local',
  '.env',
  '.env.production.local',
  '.env.production',
  '.vercel/.env.production.local',
  '.vercel/.env.development.local'
];

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
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

/** Lectura dinámica para que el bundler de Next no inlinee las claves. */
export function variableEntorno(nombre) {
  return (process.env[nombre] || '').trim();
}

function tieneCredencialesUGR() {
  return Boolean(variableEntorno('UGRVIRTUAL_USER') && variableEntorno('UGRVIRTUAL_PASSWORD'));
}

function cargarVariablesDe(ruta) {
  try {
    if (typeof process.loadEnvFile === 'function') process.loadEnvFile(ruta);
  } catch {
    // Parseo manual si loadEnvFile falla.
  }
  if (tieneCredencialesUGR()) {
    rutaCredencialesUGR = ruta;
    return true;
  }
  try {
    aplicarVariables(parsearEnvLocal(readFileSync(ruta, 'utf8')));
  } catch {
    return false;
  }
  if (tieneCredencialesUGR()) {
    rutaCredencialesUGR = ruta;
    return true;
  }
  return false;
}

/** Recarga credenciales UGR si aún no están en process.env. */
export function cargarCredencialesUGR() {
  if (tieneCredencialesUGR()) return;
  for (const ruta of candidatosEnvLocal()) {
    if (!existsSync(ruta)) continue;
    ultimoArchivoEnvLocal = ruta;
    if (cargarVariablesDe(ruta)) return;
  }
}

export function mensajeFaltaCredencialesUGR() {
  if (process.env.VERCEL === '1') {
    return (
      'Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en el entorno de Vercel ' +
      '(las variables de entorno no llegaron al proceso del server). ' +
      'Añadí ambas en Vercel → Project Settings → Environment Variables ' +
      '(entorno Production) y hacé un nuevo deploy.'
    );
  }
  const fuente = rutaCredencialesUGR || ultimoArchivoEnvLocal || 'ningún .env.local encontrado';
  return (
    `Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD (revisé ${fuente}). ` +
    'Agregalas a .env.local en la raíz del proyecto y reiniciá `npm run dev`.'
  );
}

cargarCredencialesUGR();

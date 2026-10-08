// Solo para el CLI ugr:sync: busca .env en cwd y carpetas padre si loadEnvFile no alcanzó.
// No importar desde código que empaqueta Next/Vercel (ver env.mjs).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOMBRES_ARCHIVOS_ENV = [
  '.env.local',
  '.env',
  '.env.production.local',
  '.env.production',
  '.vercel/.env.production.local',
  '.vercel/.env.development.local'
];

function candidatosEnvLocal() {
  const lista = new Set();
  const agregarDesde = (directorio) => {
    for (const nombre of NOMBRES_ARCHIVOS_ENV) {
      lista.add(join(/* turbopackIgnore: true */ directorio, nombre));
    }
  };
  agregarDesde(process.cwd());
  try {
    let directorio = dirname(fileURLToPath(import.meta.url));
    for (let nivel = 0; nivel < 10; nivel += 1) {
      agregarDesde(directorio);
      if (existsSync(join(/* turbopackIgnore: true */ directorio, 'package.json'))) break;
      directorio = dirname(directorio);
    }
  } catch {
    // import.meta.url no resoluble.
  }
  return [...lista];
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

function tieneCredencialesUGR() {
  return Boolean(
    (process.env.UGRVIRTUAL_USER || '').trim() && (process.env.UGRVIRTUAL_PASSWORD || '').trim()
  );
}

function cargarVariablesDe(ruta) {
  try {
    if (typeof process.loadEnvFile === 'function') process.loadEnvFile(ruta);
  } catch {
    // Parseo manual si loadEnvFile falla.
  }
  if (tieneCredencialesUGR()) return true;
  try {
    aplicarVariables(parsearEnvLocal(readFileSync(ruta, 'utf8')));
  } catch {
    return false;
  }
  return tieneCredencialesUGR();
}

export function cargarCredencialesUGRDesdeArchivos() {
  if (tieneCredencialesUGR()) return;
  for (const ruta of candidatosEnvLocal()) {
    if (!existsSync(ruta)) continue;
    if (cargarVariablesDe(ruta)) return;
  }
}

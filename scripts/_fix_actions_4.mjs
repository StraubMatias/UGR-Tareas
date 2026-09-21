import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/matute/tareasUGR/src/app/actions.tsx';
let src = readFileSync(path, 'utf8');

// Expand RespuestaAction
src = src.replace(
  /export interface RespuestaAction \{\n  exito: boolean;\n  mensaje\?: string;\n\}/,
  `export interface RespuestaAction {
  exito: boolean;
  mensaje?: string;
  usuario?: string;
  rol?: string;
  valor?: string | null;
}`
);

// Helper: ensure function param types for common untyped helpers
const replacements = [
  ['function crearId(prefijo)', 'function crearId(prefijo: string)'],
  ['function esIPPrivada(ip)', 'function esIPPrivada(ip: string | null | undefined)'],
  ['async function accionEscrituraEstaBloqueada(userInfo)', 'async function accionEscrituraEstaBloqueada(userInfo: string | null)'],
  ['async function registrarAccionEscritura(userInfo)', 'async function registrarAccionEscritura(userInfo: string | null)'],
  ['async function verificarRateLimitEscritura(userInfo)', 'async function verificarRateLimitEscritura(userInfo: string | null)'],
  ['function validarFecha(fecha)', 'function validarFecha(fecha: string | null | undefined)'],
  ['function validarLongitud(texto, maximo, campo)', 'function validarLongitud(texto: string | null | undefined, maximo: number, campo: string)'],
  ['async function loginEstaBloqueado(claves)', 'async function loginEstaBloqueado(claves: { clave: string; limite: number }[])'],
  ['async function registrarFalloLogin(claves)', 'async function registrarFalloLogin(claves: { clave: string; limite: number }[])'],
  ['async function limpiarIntentosLogin(claves)', 'async function limpiarIntentosLogin(claves: { clave: string; limite: number }[])'],
  ['function firmarSesion(payload)', 'function firmarSesion(payload: string)'],
  ['function crearValorSesion(userInfo, versionSesion)', 'function crearValorSesion(userInfo: string, versionSesion: number)'],
  ['function leerValorSesion(valor)', 'function leerValorSesion(valor: string | undefined): SesionDatos | null'],
  ['async function establecerSesion(userInfo, versionSesion)', 'async function establecerSesion(userInfo: string, versionSesion: number)'],
  ['function consultaPeriodo(periodoId, sqlConPeriodo, sqlSinPeriodo)', 'function consultaPeriodo(periodoId: string | null | undefined, sqlConPeriodo: string, sqlSinPeriodo: string)'],
];

for (const [from, to] of replacements) src = src.replace(from, to);

// Fix null usuario refs
src = src.replace(
  "const claves = [`accion:ip:${ip}`, `accion:user:${usuario.toLowerCase()}`];",
  "const claves = [`accion:ip:${ip}`, `accion:user:${usuario?.toLowerCase() || ''}`];"
);
src = src.replace(
  "clave: `accion:user:${usuario.toLowerCase()}`",
  "clave: `accion:user:${usuario?.toLowerCase() || ''}`"
);
src = src.replace(
  "if (await accionEscrituraEstaBloqueada(userInfo))",
  "if (await accionEscrituraEstaBloqueada(userInfo || 'anonimo'))"
);
src = src.replace(
  "await registrarAccionEscritura(userInfo);",
  "await registrarAccionEscritura(userInfo || 'anonimo');"
);

// Fix getAlumno return type
src = src.replace(
  "return resultado.rows[0] || null;",
  "const fila = resultado.rows[0] as { id: string; nombre: string } | undefined | null;\n  if (!fila) return null;\n  return { id: fila.id, nombre: fila.nombre };"
);

// Fix password usage
src = src.replace(
  "const credencialesValidas = await verificarPassword(passClean, String(userDataDB.password || ''));",
  "const credencialesValidas = await verificarPassword(passClean, String(userDataDB.password || ''));"
);
src = src.replace(
  "await establecerSesion(userDataDB.nombre, Number(userDataDB.sesion_version) || 1);",
  "await establecerSesion(String(userDataDB.nombre || ''), Number(userDataDB.sesion_version || 1));"
);
src = src.replace(
  "return { exito: true, usuario: String(userDataDB.nombre), rol: String(userDataDB.rol || 'alumno') };",
  "return { exito: true, usuario: String(userDataDB.nombre || ''), rol: String(userDataDB.rol || 'alumno') };"
);
src = src.replace(
  "await registrarAuditoria({ accion: 'login', usuario: String(userDataDB.nombre), detalle: 'Inicio de sesson exitoso', ip: await obtenerIPReal() });",
  "await registrarAuditoria({ accion: 'login', usuario: String(userDataDB.nombre || ''), detalle: 'Inicio de sesson exitoso', ip: await obtenerIPReal() });"
);

writeFileSync(path, src);
console.log('step4 done');
import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/matute/tareasUGR/src/app/actions.tsx';
let src = readFileSync(path, 'utf8');

// Fix function signatures for common untyped helpers
const replacements = [
  ['async function accionEscrituraEstaBloqueada(userInfo)', 'async function accionEscrituraEstaBloqueada(userInfo: string | null)'],
  ['async function registrarAccionEscritura(userInfo)', 'async function registrarAccionEscritura(userInfo: string | null)'],
  ['async function verificarRateLimitEscritura(userInfo)', 'async function verificarRateLimitEscritura(userInfo: string | null)'],
  ['function crearValorSesion(userInfo, versionSesion)', 'function crearValorSesion(userInfo: string, versionSesion: number)'],
  ['async function establecerSesion(userInfo, versionSesion)', 'async function establecerSesion(userInfo: string, versionSesion: number)'],
];

for (const [from, to] of replacements) src = src.replace(from, to);

// Fix null usuario refs
src = src.replace(
  "const claves = [`accion:ip:${ip}`, `accion:user:${usuario?.toLowerCase() || ''}`];",
  "const claves = [`accion:ip:${ip}`, `accion:user:${userInfo?.toLowerCase() || ''}`];"
);
src = src.replace(
  "clave: `accion:user:${usuario?.toLowerCase() || ''}`",
  "clave: `accion:user:${userInfo?.toLowerCase() || ''}`"
);
src = src.replace(
  "if (await accionEscrituraEstaBloqueada(userInfo))",
  "if (await accionEscrituraEstaBloqueada(userInfo || 'anonimo'))"
);
src = src.replace(
  "await registrarAccionEscritura(userInfo);",
  "await registrarAccionEscritura(userInfo || 'anonimo');"
);

// Fix getAlumno return type cast
src = src.replace(
  "const fila = resultado.rows[0] as { id: string; nombre: string } | undefined | null;",
  "const fila = resultado.rows[0] as unknown as { id: string; nombre: string } | undefined | null;"
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

// Fix getPeriodos return type
src = src.replace(
  "const res = await db.execute('SELECT id, anio, cuatrimestre, nombre, activo FROM periodos ORDER BY anio DESC, cuatrimestre DESC');",
  "const res = await db.execute('SELECT id, anio, cuatrimestre, nombre, activo FROM periodos ORDER BY anio DESC, cuatrimestre DESC');\n  const periodos: { id: string; anio: number; cuatrimestre: number; nombre: string; activo: number }[] = res.rows as unknown as any[];"
);

// Fix crearAlumno return type
src = src.replace(
  "const nombreFormateado = validacionNombre.valor;",
  "const nombreFormateado = validacionNombre.valor || '';"
);

// Fix validarLongitud return type for use in RespuestaAction
src = src.replace(
  "if (!validacionNombre.valida) return validacionNombre;",
  "if (!validacionNombre.valida) return convertirValidacion(validacionNombre);"
);

// Fix validarLongitud return type for use in RespuestaAction
src = src.replace(
  "if (!validacionDetalles.valida) return convertirValidacion(validacionDetalles);",
  "if (!validacionDetalles.valida) return convertirValidacion(validacionDetalles);"
);

writeFileSync(path, src);
console.log('step5 done');
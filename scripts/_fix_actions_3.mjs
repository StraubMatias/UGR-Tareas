import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/matute/tareasUGR/src/app/actions.tsx';
let src = readFileSync(path, 'utf8');

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
  "if (await accionEscrituraEstaBloqueada(usuario))",
  "if (await accionEscrituraEstaBloqueada(usuario || 'anonimo'))"
);
src = src.replace(
  "await registrarAccionEscritura(usuario);",
  "await registrarAccionEscritura(usuario || 'anonimo');"
);

// Fix getRows result handling
src = src.replace(
  "const fila = resultado.rows[0];\n  if (!fila) return null;\n  return { id: String(fila.id), nombre: String(fila.nombre) };",
  "const fila = resultado.rows[0] as { id: string; nombre: string } | undefined | null;\n  if (!fila) return null;\n  return { id: fila.id, nombre: fila.nombre };"
);

// Fix password usage
src = src.replace(
  "const credencialesValidas = await verificarPassword(passClean, String(usuarioDB.password || ''));",
  "const credencialesValidas = await verificarPassword(passClean, String(usuarioDB.password || ''));"
);
src = src.replace(
  "await establecerSesion(usuarioDB.nombre, Number(usuarioDB.sesion_version) || 1);",
  "await establecerSesion(String(usuarioDB.nombre || ''), Number(usuarioDB.sesion_version || 1));"
);
src = src.replace(
  "return { exito: true, usuario: String(usuarioDB.nombre), rol: String(usuarioDB.rol || 'alumno') };",
  "return { exito: true, usuario: String(usuarioDB.nombre || ''), rol: String(usuarioDB.rol || 'alumno') };"
);
src = src.replace(
  "await registrarAuditoria({ accion: 'login', usuario: String(usuarioDB.nombre), detalle: 'Inicio de sesión exitoso', ip: await obtenerIPReal() });",
  "await registrarAuditoria({ accion: 'login', usuario: String(usuarioDB.nombre || ''), detalle: 'Inicio de sesión exitoso', ip: await obtenerIPReal() });"
);

writeFileSync(path, src);
console.log('step3 done');

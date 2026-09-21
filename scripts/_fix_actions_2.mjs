import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/matute/tareasUGR/src/app/actions.tsx';
let src = readFileSync(path, 'utf8');

const replacements = [
  ['function crearId(prefijo)', 'function crearId(prefijo: string)'],
  ['function esIPPrivada(ip)', 'function esIPPrivada(ip: string | null | undefined)'],
  ['async function accionEscrituraEstaBloqueada(usuario)', 'async function accionEscrituraEstaBloqueada(usuario: string | null)'],
  ['async function registrarAccionEscritura(usuario)', 'async function registrarAccionEscritura(usuario: string | null)'],
  ['async function verificarRateLimitEscritura(usuario)', 'async function verificarRateLimitEscritura(usuario: string | null)'],
  ['function validarFecha(fecha)', 'function validarFecha(fecha: string | null | undefined)'],
  ['function validarLongitud(texto, maximo, campo)', 'function validarLongitud(texto: string | null | undefined, maximo: number, campo: string)'],
  ['async function loginEstaBloqueado(claves)', 'async function loginEstaBloqueado(claves: { clave: string; limite: number }[])'],
  ['async function registrarFalloLogin(claves)', 'async function registrarFalloLogin(claves: { clave: string; limite: number }[])'],
  ['async function limpiarIntentosLogin(claves)', 'async function limpiarIntentosLogin(claves: { clave: string; limite: number }[])'],
  ['function firmarSesion(payload)', 'function firmarSesion(payload: string)'],
  ['function crearValorSesion(usuario, versionSesion)', 'function crearValorSesion(usuario: string, versionSesion: number)'],
  ['function leerValorSesion(valor)', 'function leerValorSesion(valor: string | undefined): SesionDatos | null'],
  ['async function establecerSesion(usuario, versionSesion)', 'async function establecerSesion(usuario: string, versionSesion: number)'],
  ['function consultaPeriodo(periodoId, sqlConPeriodo, sqlSinPeriodo)', 'function consultaPeriodo(periodoId: string | null | undefined, sqlConPeriodo: string, sqlSinPeriodo: string)'],
];

for (const [from, to] of replacements) src = src.replace(from, to);

src = src.replace(
  'export async function eliminarMateriaAction(id)',
  'export async function eliminarMateriaAction(id: string)'
);
src = src.replace(
  'export async function renombrarMateriaAction(id, nuevoNombre)',
  'export async function renombrarMateriaAction(id: string, nuevoNombre: string)'
);
src = src.replace(
  'export async function eliminarTareaAction(id)',
  'export async function eliminarTareaAction(id: string)'
);
src = src.replace(
  'export async function obtenerEstadoCompleto(periodoIdSolicitado = null)',
  'export async function obtenerEstadoCompleto(periodoIdSolicitado: string | null = null)'
);
src = src.replace(
  'export async function obtenerDatos(periodoId = null)',
  'export async function obtenerDatos(periodoId: string | null = null)'
);

src = src.replace(
  'export async function editarCondicionesMateriaAction({ id, condiciones, notaMinimaRegularizar, notaMinimaPromocionar, reglaPromocion, usuario })',
  `export async function editarCondicionesMateriaAction({ id, condiciones, notaMinimaRegularizar, notaMinimaPromocionar, reglaPromocion, usuario }: {
  id: string;
  condiciones: string;
  notaMinimaRegularizar: string | number;
  notaMinimaPromocionar: string | number;
  reglaPromocion: string;
  usuario?: string;
})`
);

src = src.replace(
  'export async function crearMateriaAction({ nombre, anio, cuatrimestre })',
  'export async function crearMateriaAction({ nombre, anio, cuatrimestre }: { nombre: string; anio: number | string; cuatrimestre: number | string })'
);

src = src.replace(
  /interface AuditoriaParams \{\n  accion: string;\n  usuario: string;\n  detalle: string;\n  ip: string;\n\}/,
  `interface AuditoriaParams {
  accion: string;
  usuario: string | null;
  detalle: string;
  ip: string;
}`
);

src = src.replace(
  /if \(!([a-zA-Z]+)\.valida\) return \1;/g,
  'if (!$1.valida) return convertirValidacion($1);'
);

writeFileSync(path, src);
console.log('step2 done');

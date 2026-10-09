/** Plazo sin login o sin sync UGR: se borra la cuenta (salvo admin). */
export const DIAS_SIN_LOGIN = 7;
export const DIAS_SIN_SYNC_UGR = 7;
/** @deprecated usar DIAS_SIN_LOGIN / DIAS_SIN_SYNC_UGR */
export const DIAS_PARA_SINCRONIZAR = DIAS_SIN_SYNC_UGR;
export const DIAS_INACTIVIDAD_CUENTA = DIAS_SIN_LOGIN;
export const MAX_CUENTAS_POR_IP = 2;

export function ipPermiteOtraCuenta(cuentasExistentes: number, maximo = MAX_CUENTAS_POR_IP): boolean {
  return cuentasExistentes < maximo;
}

export interface Sentencia {
  sql: string;
  args: string[];
}

// Borra la cuenta y lo que es de esa persona. Las materias, tareas y horarios
// compartidos se quedan: no tienen alumno_id.
export function sentenciasBorrarAlumno(id: string, nombre: string): Sentencia[] {
  const usuario = nombre.toLowerCase();
  return [
    { sql: 'DELETE FROM tareas_entregas WHERE alumno_id = ?', args: [id] },
    { sql: 'DELETE FROM invitaciones_grupo WHERE de_alumno_id = ? OR para_alumno_id = ?', args: [id, id] },
    { sql: 'DELETE FROM preferencias_tarea_alumno WHERE alumno_id = ?', args: [id] },
    { sql: 'DELETE FROM integrantes_tareas WHERE alumno_id = ?', args: [id] },
    { sql: 'DELETE FROM completadas WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [id, nombre] },
    { sql: 'DELETE FROM notas_parciales WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [id, nombre] },
    { sql: 'DELETE FROM notas_tareas WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [id, nombre] },
    { sql: 'DELETE FROM progreso_materias WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [id, nombre] },
    { sql: 'DELETE FROM inscripciones WHERE alumno_id = ?', args: [id] },
    { sql: 'DELETE FROM horarios WHERE alumno_id = ?', args: [id] },
    { sql: 'DELETE FROM auditoria WHERE LOWER(usuario) = LOWER(?)', args: [nombre] },
    {
      sql: 'DELETE FROM login_intentos WHERE clave IN (?, ?, ?)',
      args: [`user:${usuario}`, `accion:user:${usuario}`, `ugr:${usuario}`]
    },
    { sql: 'DELETE FROM alumnos WHERE id = ?', args: [id] }
  ];
}

export function nombreDeUsuarioValido(nombre: string): string | null {
  const limpio = String(nombre || '').trim();
  if (limpio.length < 3 || limpio.length > 100) {
    return 'El usuario tiene que tener entre 3 y 100 caracteres.';
  }
  return null;
}

// El id no cambia. Se actualiza el nombre donde quedó copiado como texto.
export function sentenciasRenombrarAlumno(id: string, nombreAnterior: string, nombreNuevo: string): Sentencia[] {
  const anterior = nombreAnterior.toLowerCase();
  const nuevo = nombreNuevo.toLowerCase();
  return [
    { sql: 'UPDATE alumnos SET nombre = ?, sesion_version = COALESCE(sesion_version, 1) + 1 WHERE id = ?', args: [nombreNuevo, id] },
    { sql: 'UPDATE completadas SET alumno = ? WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [nombreNuevo, id, nombreAnterior] },
    { sql: 'UPDATE notas_parciales SET alumno = ? WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [nombreNuevo, id, nombreAnterior] },
    { sql: 'UPDATE notas_tareas SET alumno = ? WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [nombreNuevo, id, nombreAnterior] },
    { sql: 'UPDATE progreso_materias SET alumno = ? WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)', args: [nombreNuevo, id, nombreAnterior] },
    { sql: 'UPDATE auditoria SET usuario = ? WHERE LOWER(usuario) = LOWER(?)', args: [nombreNuevo, nombreAnterior] },
    { sql: 'UPDATE OR IGNORE login_intentos SET clave = ? WHERE clave = ?', args: [`user:${nuevo}`, `user:${anterior}`] },
    { sql: 'UPDATE OR IGNORE login_intentos SET clave = ? WHERE clave = ?', args: [`accion:user:${nuevo}`, `accion:user:${anterior}`] },
    { sql: 'UPDATE OR IGNORE login_intentos SET clave = ? WHERE clave = ?', args: [`ugr:${nuevo}`, `ugr:${anterior}`] }
  ];
}

export function sentenciaLimpiarGruposVacios(): Sentencia {
  return {
    sql: 'DELETE FROM grupos_tareas WHERE NOT EXISTS (SELECT 1 FROM integrantes_tareas WHERE grupo_id = grupos_tareas.id)',
    args: []
  };
}
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function instanteActividad(valor: string | null | undefined): number {
  const texto = String(valor || '').trim();
  if (!texto) return Number.NaN;
  const normalizado = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(texto)
    ? `${texto.replace(' ', 'T')}Z`
    : texto;
  return Date.parse(normalizado);
}

export interface CuentaAlumnoLimpieza {
  origen?: string | null;
  rol?: string | null;
  creadoEn?: string | null;
  sincronizadoEn?: string | null;
  ultimoAcceso?: string | null;
}

function plazoVencido(desde: number, dias: number, ahora: number): boolean {
  return ahora - desde >= dias * MS_POR_DIA;
}

/** Desde cuándo corre el plazo de 7 días (no se mira inactividad anterior). Override: `POLITICA_CUENTAS_DESDE`. */
export const POLITICA_CUENTAS_VIGENTE_DESDE = '2026-10-09T18:00:00.000Z';

export function instantePoliticaCuentas(): number {
  const desdeEntorno =
    typeof process !== 'undefined' ? String(process.env.POLITICA_CUENTAS_DESDE || '').trim() : '';
  const parseado = instanteActividad(desdeEntorno || POLITICA_CUENTAS_VIGENTE_DESDE);
  return Number.isFinite(parseado) ? parseado : Date.parse(POLITICA_CUENTAS_VIGENTE_DESDE);
}

function referenciaTrasPolitica(
  valor: string | null | undefined,
  creadoEn: string | null | undefined,
  politicaDesde: number
): number {
  const candidatos = [instanteActividad(valor), instanteActividad(creadoEn)].filter(Number.isFinite);
  const ultima = candidatos.length ? Math.max(...candidatos) : politicaDesde;
  return Math.max(ultima, politicaDesde);
}

/** Sin entrar al tablero en 7 días (desde último acceso o desde el alta). */
export function cuentaSinLoginReciente(
  cuenta: CuentaAlumnoLimpieza,
  ahora = Date.now(),
  politicaDesde?: number
): boolean {
  const politica = Number.isFinite(politicaDesde) ? politicaDesde! : instantePoliticaCuentas();
  if (ahora < politica) return false;
  const referencia = referenciaTrasPolitica(cuenta.ultimoAcceso, cuenta.creadoEn, politica);
  return plazoVencido(referencia, DIAS_SIN_LOGIN, ahora);
}

/** Sin sync UGR en 7 días (desde última sync o desde el alta si nunca sincronizó). */
export function cuentaSinSyncReciente(
  cuenta: CuentaAlumnoLimpieza,
  ahora = Date.now(),
  politicaDesde?: number
): boolean {
  const politica = Number.isFinite(politicaDesde) ? politicaDesde! : instantePoliticaCuentas();
  if (ahora < politica) return false;
  const referencia = referenciaTrasPolitica(cuenta.sincronizadoEn, cuenta.creadoEn, politica);
  return plazoVencido(referencia, DIAS_SIN_SYNC_UGR, ahora);
}

/** Solo cuentas `propio` (alta pública), excepto admin. Comisión no se borra automáticamente. */
export function cuentaAlumnoDebeBorrarse(
  cuenta: CuentaAlumnoLimpieza,
  ahora = Date.now(),
  politicaDesde?: number
): boolean {
  if (String(cuenta.rol || 'alumno') === 'admin') return false;
  if (String(cuenta.origen || 'comision') !== 'propio') return false;
  const politica = Number.isFinite(politicaDesde) ? politicaDesde! : instantePoliticaCuentas();
  if (ahora < politica) return false;
  return cuentaSinLoginReciente(cuenta, ahora, politica) || cuentaSinSyncReciente(cuenta, ahora, politica);
}

/** @deprecated usar cuentaAlumnoDebeBorrarse */
export function cuentaPropiaVencida(
  cuenta: CuentaAlumnoLimpieza & { inscripciones?: number },
  ahora = Date.now()
): boolean {
  return cuentaSinSyncReciente(cuenta, ahora) && !String(cuenta.sincronizadoEn || '').trim();
}

/** @deprecated usar cuentaSinLoginReciente */
export function cuentaPropiaInactiva(cuenta: CuentaAlumnoLimpieza, ahora = Date.now()): boolean {
  return cuentaSinLoginReciente(cuenta, ahora);
}

/** @deprecated usar cuentaAlumnoDebeBorrarse */
export function cuentaPropiaDebeBorrarse(cuenta: CuentaAlumnoLimpieza, ahora = Date.now()): boolean {
  return cuentaAlumnoDebeBorrarse(cuenta, ahora);
}

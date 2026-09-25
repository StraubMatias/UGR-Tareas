/** Plazo para borrar cuentas propias sin sincronizar o sin entrar al tablero. */
export const DIAS_PARA_SINCRONIZAR = 7;
export const DIAS_INACTIVIDAD_CUENTA = DIAS_PARA_SINCRONIZAR;
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

// Cuenta propia sin sincronizar: se borra a los 7 días desde el alta.
// Si ya sincronizó o tiene cursada: se borra tras 7 días sin entrar (ver cuentaPropiaInactiva).
export function cuentaPropiaVencida(
  cuenta: {
    origen?: string | null;
    creadoEn?: string | null;
    sincronizadoEn?: string | null;
    inscripciones?: number;
  },
  ahora = Date.now()
): boolean {
  if (String(cuenta.origen || '') !== 'propio') return false;
  if (String(cuenta.sincronizadoEn || '').trim()) return false;
  if (Number(cuenta.inscripciones || 0) > 0) return false;
  const creado = instanteActividad(cuenta.creadoEn);
  if (!Number.isFinite(creado)) return false;
  return ahora - creado >= DIAS_PARA_SINCRONIZAR * MS_POR_DIA;
}

function ultimaActividadCuenta(cuenta: {
  ultimoAcceso?: string | null;
  sincronizadoEn?: string | null;
  creadoEn?: string | null;
}): number {
  const candidatos = [cuenta.ultimoAcceso, cuenta.sincronizadoEn, cuenta.creadoEn]
    .map(instanteActividad)
    .filter(Number.isFinite);
  return candidatos.length ? Math.max(...candidatos) : Number.NaN;
}

// Cuenta propia que ya sincronizó o tiene cursada, pero no entra hace 7+ días.
export function cuentaPropiaInactiva(
  cuenta: {
    origen?: string | null;
    rol?: string | null;
    creadoEn?: string | null;
    sincronizadoEn?: string | null;
    ultimoAcceso?: string | null;
    inscripciones?: number;
  },
  ahora = Date.now()
): boolean {
  if (String(cuenta.origen || '') !== 'propio') return false;
  if (String(cuenta.rol || 'alumno') === 'admin') return false;
  const sincronizo = Boolean(String(cuenta.sincronizadoEn || '').trim());
  const inscripto = Number(cuenta.inscripciones || 0) > 0;
  if (!sincronizo && !inscripto) return false;
  const ultima = ultimaActividadCuenta(cuenta);
  if (!Number.isFinite(ultima)) return false;
  return ahora - ultima >= DIAS_INACTIVIDAD_CUENTA * MS_POR_DIA;
}

export function cuentaPropiaDebeBorrarse(
  cuenta: {
    origen?: string | null;
    rol?: string | null;
    creadoEn?: string | null;
    sincronizadoEn?: string | null;
    ultimoAcceso?: string | null;
    inscripciones?: number;
  },
  ahora = Date.now()
): boolean {
  return cuentaPropiaVencida(cuenta, ahora) || cuentaPropiaInactiva(cuenta, ahora);
}

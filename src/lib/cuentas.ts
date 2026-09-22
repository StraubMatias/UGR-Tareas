export const DIAS_PARA_SINCRONIZAR = 7;
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

export function sentenciaLimpiarGruposVacios(): Sentencia {
  return {
    sql: 'DELETE FROM grupos_tareas WHERE NOT EXISTS (SELECT 1 FROM integrantes_tareas WHERE grupo_id = grupos_tareas.id)',
    args: []
  };
}
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function instante(valor: string | null | undefined): number {
  const texto = String(valor || '').trim();
  if (!texto) return Number.NaN;
  const normalizado = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(texto)
    ? `${texto.replace(' ', 'T')}Z`
    : texto;
  return Date.parse(normalizado);
}

// Una cuenta propia se borra si pasaron 7 días y nunca sincronizó.
// Quien ya sincronizó, o quien cursa alguna materia, se queda.
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
  const creado = instante(cuenta.creadoEn);
  if (!Number.isFinite(creado)) return false;
  return ahora - creado >= DIAS_PARA_SINCRONIZAR * MS_POR_DIA;
}

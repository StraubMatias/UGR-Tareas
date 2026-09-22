export const DIAS_PARA_SINCRONIZAR = 7;
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

/**
 * Constancias de SIU Guaraní que el alumno ya tiene y siguen vigentes.
 * El listado de SIU trae la fecha de vencimiento de cada comprobante; con eso
 * se puede evitar pedir de nuevo una constancia que ya se tiene.
 */

export interface SolicitudConstancia {
  constancia: string;
  fecha: string;
  presentar: string;
  solicitadoEn: string;
  copias: string;
  estado: string;
  vencimiento: string;
  comprobante: string;
}

/** Convierte la fecha de SIU (dd/mm/aaaa) a Date local. */
export function parsearFechaSiu(fecha: string | null | undefined): Date | null {
  const texto = String(fecha || '').trim();
  const coincidencia = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!coincidencia) return null;
  const dia = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const anio = Number(coincidencia[3]);
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(anio)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const resultado = new Date(anio, mes - 1, dia);
  if (
    resultado.getFullYear() !== anio
    || resultado.getMonth() !== mes - 1
    || resultado.getDate() !== dia
  ) {
    return null;
  }
  return resultado;
}

/** ¿Sigue vigente? Sin fecha de vencimiento no se puede probar que venció. */
export function esConstanciaVigente(
  solicitud: Pick<SolicitudConstancia, 'vencimiento'>,
  hoy: Date = new Date()
): boolean {
  const vencimiento = parsearFechaSiu(solicitud.vencimiento);
  if (!vencimiento) return true;
  // El día del vencimiento todavía sirve.
  const finDelDia = new Date(
    vencimiento.getFullYear(),
    vencimiento.getMonth(),
    vencimiento.getDate(),
    23,
    59,
    59,
    999
  );
  return finDelDia.getTime() >= hoy.getTime();
}

/** Todas las constancias que el alumno ya tiene y le sirven hoy. */
export function filtrarConstanciasVigentes(
  solicitudes: SolicitudConstancia[],
  hoy: Date = new Date()
): SolicitudConstancia[] {
  return (solicitudes || []).filter((solicitud) => esConstanciaVigente(solicitud, hoy));
}

/** Días que le quedan de validez (null si no tiene fecha de vencimiento). */
export function diasDeValidez(
  solicitud: Pick<SolicitudConstancia, 'vencimiento'>,
  hoy: Date = new Date()
): number | null {
  const vencimiento = parsearFechaSiu(solicitud.vencimiento);
  if (!vencimiento) return null;
  const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const fin = new Date(vencimiento.getFullYear(), vencimiento.getMonth(), vencimiento.getDate());
  return Math.round((fin.getTime() - hoyMedianoche.getTime()) / 86400000);
}

/** Etiqueta corta de la vigencia, para mostrar junto a la constancia. */
export function etiquetaVigencia(
  solicitud: Pick<SolicitudConstancia, 'vencimiento'>,
  hoy: Date = new Date()
): string {
  const dias = diasDeValidez(solicitud, hoy);
  if (dias === null) return 'Sin fecha de vencimiento';
  if (dias < 0) return 'Vencida';
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  if (dias <= 30) return `Vence en ${dias} días`;
  return `Vence el ${solicitud.vencimiento}`;
}

/** Convierte el nombre que muestra SIU a una clave comparable. */
export function normalizarNombreConstancia(nombre: string): string {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\bconstancia de\b/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Clave del tipo de constancia a partir del nombre de SIU
 * («Constancia de Alumno Regular» → `alumno_regular`).
 * Si no reconoce el nombre, devuelve null.
 */
export function claveTipoDesdeNombreSiu(nombre: string): string | null {
  const normalizado = normalizarNombreConstancia(nombre);
  if (!normalizado) return null;
  if (normalizado.includes('alumno_regular')) return 'alumno_regular';
  if (normalizado.includes('examen_final')) return 'examen_final';
  if (normalizado.includes('sin_aplazos')) return 'promedio_sin_aplazos';
  if (normalizado.includes('promedio')) return 'promedio_academico';
  return null;
}

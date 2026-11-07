/**
 * @template {{ fecha_desde: string; fecha_hasta: string }} TEvento
 * @param {string} claveDia
 * @param {TEvento[]} eventos
 * @returns {TEvento[]}
 */
export function eventosAcademicosParaFecha(claveDia, eventos) {
  return eventos.filter((evento) => evento.fecha_desde <= claveDia && evento.fecha_hasta >= claveDia);
}

/** @param {Date} fecha */
export function esRecesoDeEnero(fecha) {
  return fecha.getMonth() === 0;
}

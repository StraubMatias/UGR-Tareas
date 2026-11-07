export interface EventoCalendarioAcademicoRango {
  fecha_desde: string;
  fecha_hasta: string;
}

export function eventosAcademicosParaFecha<TEvento extends EventoCalendarioAcademicoRango>(
  claveDia: string,
  eventos: TEvento[]
): TEvento[];

export function esRecesoDeEnero(fecha: Date): boolean;

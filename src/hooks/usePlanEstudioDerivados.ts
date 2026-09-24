import { useMemo } from 'react';
import { calcularDerivadosPlanEstudio, type RegistroProgresoPlan } from '../lib/plan-estudio-derivados';

export function usePlanEstudioDerivados(
  progresoPlan: RegistroProgresoPlan[],
  usuarioActual: string | null,
  materiasSimuladas: string[],
  cuatrimestreSimulado: string
) {
  return useMemo(
    () => calcularDerivadosPlanEstudio(progresoPlan, usuarioActual, materiasSimuladas, cuatrimestreSimulado),
    [progresoPlan, usuarioActual, materiasSimuladas, cuatrimestreSimulado]
  );
}

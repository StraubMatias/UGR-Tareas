export interface RespuestaAction {
  exito: boolean;
  mensaje?: string;
  usuario?: string;
  rol?: string;
}

export function convertirValidacion(res: { valida: boolean; mensaje?: string }): RespuestaAction {
  return { exito: res.valida, mensaje: res.mensaje || 'Error de validación' };
}


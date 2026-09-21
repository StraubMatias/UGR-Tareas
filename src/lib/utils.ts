export interface RespuestaAction {
  exito: boolean;
  mensaje?: string;
}

export function convertirValidacion(res: any): RespuestaAction {
  return { exito: res.valida, mensaje: res.mensaje || 'Error de validación' };
}

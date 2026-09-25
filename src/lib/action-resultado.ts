import type { RespuestaAction } from '../app/actions/types';

export function mensajeErrorAction(resultado: unknown, fallback: string) {
  if (resultado && typeof resultado === 'object' && 'exito' in resultado && !(resultado as RespuestaAction).exito) {
    return (resultado as RespuestaAction).mensaje || fallback;
  }
  return null;
}

export async function conRecargaTablero(
  ejecutar: () => Promise<unknown>,
  recargar: (mostrarCarga?: boolean) => Promise<boolean>,
  opts?: { mensajeError?: string; mostrarCarga?: boolean }
): Promise<boolean> {
  const resultado = await ejecutar();
  const mensaje = opts?.mensajeError ? mensajeErrorAction(resultado, opts.mensajeError) : mensajeErrorAction(resultado, 'No se pudo completar la operación.');
  if (mensaje) {
    alert(mensaje);
    return false;
  }
  await recargar(opts?.mostrarCarga);
  return true;
}

import { randomBytes } from 'node:crypto';

export const LONGITUD_MINIMA_SESSION_SECRET = 32;

export function generarClaveTemporal(longitud = 18): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(longitud);
  let clave = '';
  for (let i = 0; i < longitud; i += 1) {
    clave += alfabeto[bytes[i] % alfabeto.length];
  }
  return clave;
}

export function validarHoraReloj(valor: string | null | undefined): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor || '').trim());
}

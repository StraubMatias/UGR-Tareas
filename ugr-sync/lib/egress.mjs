import { UGR_BASE_URL } from './constantes.mjs';

const HOST_UGR = new URL(UGR_BASE_URL).hostname;

/** Solo permite salida HTTP al campus UGR (evita seguir redirects a terceros). */
export function urlEgressCampusPermitida(url, base = UGR_BASE_URL) {
  try {
    const destino = new URL(String(url), String(base));
    if (destino.protocol !== 'https:' && destino.protocol !== 'http:') return null;
    if (destino.hostname !== HOST_UGR) return null;
    return destino.toString();
  } catch {
    return null;
  }
}

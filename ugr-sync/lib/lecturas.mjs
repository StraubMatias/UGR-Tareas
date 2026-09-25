import { UGR_BASE_URL } from './constantes.mjs';

// Una instancia por sync: comparte también promesas en vuelo. No conserva
// páginas entre búsquedas, ni cachea errores, login o solicitudes de escritura.
export function optimizarLecturas(cliente) {
  const cache = new Map();
  let activos = 0;
  const cola = [];
  async function limitar(fn) {
    if (activos >= 4) await new Promise((resolve) => cola.push(resolve));
    else activos++;
    try {
      return await fn();
    } finally {
      const siguiente = cola.shift();
      if (siguiente) siguiente();
      else activos--;
    }
  }
  return {
    ...cliente,
    pedir(ruta, opciones = {}) {
      if ((opciones.method || 'GET') !== 'GET' || opciones.cuerpo) {
        return limitar(() => cliente.pedir(ruta, opciones));
      }
      const clave = new URL(ruta, UGR_BASE_URL).toString();
      if (!cache.has(clave)) {
        const pendiente = limitar(() => cliente.pedir(ruta, opciones)).then((pagina) => {
          if (pagina.es_requiere_login || !pagina.status || pagina.status >= 300) cache.delete(clave);
          return pagina;
        }).catch((error) => {
          cache.delete(clave);
          throw error;
        });
        cache.set(clave, pendiente);
      }
      return cache.get(clave);
    }
  };
}

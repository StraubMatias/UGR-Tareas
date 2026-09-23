// SIU Guaraní 网络客户端
import { SIU_BASE_URL } from './constantes.mjs';
import {
  cabeceraCookies,
  cargarSesion,
  combinarJar,
  crearJarCookies,
  guardarSesion,
  iniciarSesion,
  detectarMantenimientoCampus,
  RUTA_SESION_SIU
} from './autenticar.mjs';

const TOPE_PEDIDO_MS = 8000;

function fetchConTope(url, opciones) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TOPE_PEDIDO_MS);
  return fetch(url, { ...opciones, signal: control.signal }).finally(() => clearTimeout(timer));
}

export async function crearClienteSIU({ usuario, contrasena, baseUrl = SIU_BASE_URL, rutaSesion = RUTA_SESION_SIU } = {}) {
  const jar = await cargarSesion(rutaSesion);
  let sesionIntentada = false;

  async function pedirSinAutenticar(ruta, { method = 'GET', cuerpo, tipoCuerpo } = {}) {
    const url = new URL(ruta, baseUrl).toString();
    let actual = url;
    let respuesta = null;
    try {
      for (let salto = 0; salto < 5; salto += 1) {
        respuesta = await fetchConTope(actual, {
          method: salto === 0 ? method : 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)',
            ...(jar.size > 0 ? { Cookie: cabeceraCookies(jar) } : {}),
            ...(salto === 0 && cuerpo ? { 'Content-Type': tipoCuerpo || 'application/x-www-form-urlencoded' } : {}),
            'X-Requested-With': 'XMLHttpRequest'
          },
          ...(salto === 0 && cuerpo ? { body: cuerpo } : {}),
          redirect: 'manual'
        });
        const setCookie = respuesta.headers.getSetCookie?.() || [];
        const cruda = setCookie.length > 0 ? setCookie : [respuesta.headers.get('set-cookie')].filter(Boolean);
        if (cruda.length > 0) combinarJar(jar, crearJarCookies(cruda).entries());

      // Después de un POST con redirect (302), la siguiente petición debe ser GET
        // (igual que curl -L transforma POST→GET en el redirect)
        const esRedirectPost = salto === 0 && respuesta.status >= 300 && respuesta.status < 400;
        if (respuesta.status < 300 || respuesta.status >= 400) break;
        const destino = respuesta.headers.get('location');
        if (!destino) break;
        const urlDestino = new URL(destino, actual);
        actual = urlDestino.toString();
        // Si era POST y hubo redirect, la siguiente iteración usa GET
        if (esRedirectPost) {
          method = 'GET';
        }
      }

      const html = await respuesta.text();
      const mantenimiento = detectarMantenimientoCampus(html, respuesta.status);
      if (mantenimiento) {
        throw new Error(mantenimiento);
      }
      await guardarSesion(jar, rutaSesion);
      return { url: actual, html, status: respuesta.status };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { url: actual, html: '', status: 0 };
      }
      throw error;
    }
  }

  async function autenticar() {
    const resultado = await iniciarSesion({ usuario, contrasena, baseUrl, jar });
    await guardarSesion(resultado.jar, rutaSesion);
    sesionIntentada = true;
    return resultado;
  }

  async function pedir(ruta, opciones) {
    let resultado = await pedirSinAutenticar(ruta, opciones);
    // 如果返回的是登录页，说明会话过期，重新登录
    if (resultado.url.includes('/acceso/login') && !sesionIntentada) {
      await autenticar();
      resultado = await pedirSinAutenticar(ruta, opciones);
    }
    return resultado;
  }

  return { pedir, autenticar, jar };
}

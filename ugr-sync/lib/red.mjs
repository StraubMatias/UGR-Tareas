// Cliente HTTP con sesión de Moodle: reutiliza las cookies guardadas,
// detecta cuando la sesión expiró (redirección a /login/index.php) y
// vuelve a autenticar automáticamente con las credenciales del entorno.
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';
import {
  cabeceraCookies,
  cargarSesion,
  combinarJar,
  crearJarCookies,
  detectarMantenimientoCampus,
  esPaginaDeLogin,
  guardarSesion,
  iniciarSesion
} from './autenticar.mjs';

export function pedidoEsDeLogin(url) {
  return typeof url === 'string' && url.includes('/login/index.php');
}

const TOPE_PEDIDO_MS = 8000;

function fetchConTope(url, opciones) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TOPE_PEDIDO_MS);
  return fetch(url, { ...opciones, signal: control.signal }).finally(() => clearTimeout(timer));
}

export async function crearCliente({ usuario, contrasena, baseUrl = UGR_BASE_URL, rutaSesion } = {}) {
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
          ...(salto === 0 && cuerpo ? { 'Content-Type': tipoCuerpo || 'application/x-www-form-urlencoded' } : {})
        },
        ...(salto === 0 && cuerpo ? { body: cuerpo } : {}),
        redirect: 'manual'
      });
      const setCookie = respuesta.headers.getSetCookie?.() || [];
      const cruda = setCookie.length > 0 ? setCookie : [respuesta.headers.get('set-cookie')].filter(Boolean);
      if (cruda.length > 0) combinarJar(jar, crearJarCookies(cruda).entries());

      if (respuesta.status < 300 || respuesta.status >= 400) break;
      const destino = respuesta.headers.get('location');
      if (!destino) break;
      const urlDestino = new URL(destino, actual);
      if (urlDestino.pathname.includes('/login/index.php')) {
        await guardarSesion(jar, rutaSesion);
        return { url: urlDestino.toString(), html: '', es_requiere_login: true, status: respuesta.status };
      }
      actual = urlDestino.toString();
    }

    const html = await respuesta.text();
    const mantenimiento = detectarMantenimientoCampus(html, respuesta.status);
    if (mantenimiento) {
      throw new Error(mantenimiento);
    }
    const requiereLogin = esPaginaDeLogin(html) && /form[^>]*id="login"/i.test(html);
    await guardarSesion(jar, rutaSesion);
    return { url: actual, html, es_requiere_login: requiereLogin, status: respuesta.status };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { url: actual, html: '', es_requiere_login: false, status: 0 };
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
    const resultado = await pedirSinAutenticar(ruta, opciones);
    if (resultado.es_requiere_login && !sesionIntentada) {
      await autenticar();
      return pedirSinAutenticar(ruta, opciones);
    }
    return resultado;
  }

  return { pedir, autenticar, jar };
}
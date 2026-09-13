// Cliente HTTP con sesión de Moodle: reutiliza las cookies guardadas,
// detecta cuando la sesión expiró (redirección a /login/index.php) y
// vuelve a autenticar automáticamente con las credenciales del entorno.
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';
import {
  cabeceraCookies,
  cargarSesion,
  combinarJar,
  crearJarCookies,
  esPaginaDeLogin,
  guardarSesion,
  iniciarSesion
} from './autenticar.mjs';

export function pedidoEsDeLogin(url) {
  return typeof url === 'string' && url.includes('/login/index.php');
}

export async function crearCliente({ usuario, contrasena, baseUrl = UGR_BASE_URL, rutaSesion } = {}) {
  const jar = await cargarSesion(rutaSesion);
  let sesionIntentada = false;

  async function pedirSinAutenticar(ruta, { method = 'GET', cuerpo } = {}) {
    const url = new URL(ruta, baseUrl).toString();
    const esLogin = pedidoEsDeLogin(url);
    const respuesta = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)',
        ...(jar.size > 0 ? { Cookie: cabeceraCookies(jar) } : {}),
        ...(cuerpo ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
      },
      ...(cuerpo ? { body: cuerpo } : {}),
      redirect: 'manual'
    });
    const setCookie = respuesta.headers.get('set-cookie');
    if (setCookie) combinarJar(jar, crearJarCookies([setCookie]).entries());

    // Redirección a otro lado (normalmente Moodle redirige a la página final).
    if (!esLogin && respuesta.status >= 300 && respuesta.status < 400) {
      const destino = respuesta.headers.get('location');
      if (destino) {
        const urlDestino = new URL(destino, baseUrl);
        if (urlDestino.pathname.includes('/login/index.php')) {
          // Sesión caducada: forzamos re-login más abajo.
          await guardarSesion(jar, rutaSesion);
          return { url: urlDestino.toString(), html: '', es_requiere_login: true };
        }
        const final = await fetch(urlDestino.toString(), {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)', Cookie: cabeceraCookies(jar) },
          redirect: 'manual'
        });
        const setCookieFinal = final.headers.get('set-cookie');
        if (setCookieFinal) combinarJar(jar, crearJarCookies([setCookieFinal]).entries());
        const htmlFinal = await final.text();
        await guardarSesion(jar, rutaSesion);
        return {
          url: urlDestino.toString(),
          html: htmlFinal,
          es_requiere_login: esPaginaDeLogin(htmlFinal)
        };
      }
    }

    const html = await respuesta.text();
    const requiereLogin = esPaginaDeLogin(html) && /form[^>]*id="login"/i.test(html);
    await guardarSesion(jar, rutaSesion);
    return { url, html, es_requiere_login: requiereLogin, status: respuesta.status };
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
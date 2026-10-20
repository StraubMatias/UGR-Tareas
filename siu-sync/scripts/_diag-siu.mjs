import { SIU_BASE_URL, SIU_RUTAS } from '../lib/constantes.mjs';
import { cabeceraCookies, combinarJar, crearJarCookies } from '../lib/autenticar.mjs';

process.loadEnvFile?.('.env.local');

function cookiesDesdeRespuesta(respuesta) {
  const setCookie = respuesta.headers.getSetCookie?.() || [];
  const cruda = setCookie.length > 0 ? setCookie : [respuesta.headers.get('set-cookie')].filter(Boolean);
  return crearJarCookies(cruda);
}

function resumen(cuerpo) {
  let json = null;
  try { json = JSON.parse(cuerpo); } catch { json = null; }
  return {
    length: String(cuerpo || '').length,
    recorte: String(cuerpo || '').slice(0, 500).replace(/\s+/g, ' '),
    jsonKeys: json && typeof json === 'object' ? Object.keys(json) : null,
    cod: json?.cod,
    contType: json ? typeof json.cont : undefined,
    inputs: [...String(cuerpo || '').matchAll(/name="([^"]+)"/gi)].map((m) => m[1]).slice(0, 20)
  };
}

async function pedir(url, { method = 'GET', jar, cuerpo } = {}) {
  const respuesta = await fetch(url, {
    method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ...(jar.size ? { Cookie: cabeceraCookies(jar) } : {}),
      ...(cuerpo ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01'
      } : {})
    },
    ...(cuerpo ? { body: cuerpo } : {}),
    redirect: 'manual'
  });
  combinarJar(jar, cookiesDesdeRespuesta(respuesta).entries());
  const text = await respuesta.text();
  return { status: respuesta.status, location: respuesta.headers.get('location'), url: respuesta.url, text };
}

async function main() {
  const usuario = process.env.SIU_USER;
  const contrasena = process.env.SIU_PASSWORD;
  const baseUrl = SIU_BASE_URL;
  const jar = new Map();
  const urlLogin = new URL(SIU_RUTAS.login, baseUrl).toString();
  console.log('GET', urlLogin);
  const get = await pedir(urlLogin, { jar });
  console.log('get', { status: get.status, location: get.location, cookies: [...jar.keys()], ...resumen(get.text) });
  const pistas = [...get.text.matchAll(/action=["']([^"']+)["']|acceso\/login|name=["'](usuario|password|user|pass|clave)["']|toba_|ci=|auth=form|id=["']login["']/gi)]
    .map((m) => m[0])
    .slice(0, 40);
  console.log('pistas_get', pistas);
  const scripts = [...get.text.matchAll(/src=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 30);
  console.log('scripts', scripts);

  const formDefault = new URLSearchParams({
    usuario: String(usuario).trim(),
    password: String(contrasena)
  });
  const post = await pedir(urlLogin, { method: 'POST', jar, cuerpo: formDefault.toString() });
  console.log('POST usuario/password', {
    status: post.status,
    location: post.location,
    cookies: [...jar.keys()],
    ...resumen(post.text)
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

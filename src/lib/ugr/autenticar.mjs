// Autenticación contra el campus virtual UGR Virtual (Moodle).
// El login de Moodle usa un token CSRF (`logintoken`), cookies de sesión
// (`MoodleSession`) y un POST al mismo /login/index.php. Con solo `fetch`
// de Node seguimos redirecciones y conservamos las cookies de sesión.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';

const DIR_MODULO = path.dirname(fileURLToPath(import.meta.url));
export const RUTA_SESION = path.join(DIR_MODULO, '..', '..', '..', 'data', 'ugr-sesion.json');

// --- Parsers puros (fáciles de testear) ---

export function extraerLogintoken(html) {
  const m = html.match(/name="logintoken"\s+value="([^"]+)"/i);
  return m?.[1] ?? null;
}

export function extraerAccionLogin(html, baseUrl = UGR_BASE_URL) {
  const m = html.match(/<form[^>]*id="login"[^>]*action="([^"]+)"/i);
  const accion = m?.[1] ?? UGR_RUTAS.login;
  return new URL(accion, baseUrl).toString();
}

export function esPaginaDeLogin(html) {
  return /<form[^>]*id="login"/i.test(html) || /input[^>]*name="logintoken"/i.test(html);
}

export function erroresDeLogin(html) {
  const errores = [];
  const loginerrors = html.match(/<div[^>]*class="[^"]*loginerrors[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (loginerrors) {
    const textos = loginerrors[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    for (const li of textos) {
      errores.push(li.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    }
    if (errores.length === 0) {
      errores.push(loginerrors[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    }
  }
  return errores.filter(Boolean);
}

// --- Manejo de cookies (jar simple, suficiente para Moodle) ---

export function normalizarCookie(textoCookie) {
  const [par, ...resto] = textoCookie.split(';');
  const indiceIgual = par.indexOf('=');
  if (indiceIgual === -1) return null;
  const nombre = par.slice(0, indiceIgual).trim();
  if (!nombre) return null;
  const valor = par.slice(indiceIgual + 1).trim();
  const atributos = {};
  for (const r of resto) {
    const [k, ...v] = r.trim().split('=');
    if (k) atributos[k.trim().toLowerCase()] = v.join('=');
  }
  return { nombre, valor, atributos };
}

export function crearJarCookies(headerSetCookie = []) {
  return new Map(headerSetCookie
    .filter(Boolean)
    .flatMap((texto) => normalizarCookie(texto) || [])
    .filter((c) => !['moodle_session_test', 'moodlesessiontest'].includes(c.nombre.toLowerCase()))
    .map((c) => [c.nombre, c.valor]));
}

export function cabeceraCookies(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

export function combinarJar(base, extra) {
  for (const [k, v] of extra ?? []) base.set(k, v);
  return base;
}

export function cookiesAJSON(jar) {
  return { cookies: [...jar.entries()] };
}

export function cookiesDesdeJSON(json) {
  return new Map(json?.cookies ?? []);
}

// --- Login real vía HTTP ---

export async function iniciarSesion({ usuario, contrasena, baseUrl = UGR_BASE_URL, jar = new Map() } = {}) {
  if (!usuario || !contrasena) {
    throw new Error('Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en el entorno (.env.local).');
  }

  const urlLogin = new URL(UGR_RUTAS.login, baseUrl).toString();

  // 1) GET de la página de login: servimos la cookie de sesión inicial y pescamos el logintoken.
  const primera = await fetch(urlLogin, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)' },
    redirect: 'manual'
  });
  combinarJar(jar, crearJarCookies([primera.headers.get('set-cookie')]).entries());
  const htmlLogin = await primera.text();
  const logintoken = extraerLogintoken(htmlLogin);
  if (!logintoken) {
    throw new Error('No se encontró el logintoken en la página de login.');
  }

  // 2) POST del formulario con el token + credenciales.
  const accion = extraerAccionLogin(htmlLogin, baseUrl);
  const form = new URLSearchParams({
    username: usuario,
    password: contrasena,
    logintoken
  });

  const respuesta = await fetch(accion, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cabeceraCookies(jar)
    },
    body: form.toString(),
    redirect: 'manual'
  });
  combinarJar(jar, crearJarCookies([respuesta.headers.get('set-cookie')]).entries());

  // 3) Moodle responde con 303 See Other a /my/ o /login/index.php.
  const location = respuesta.headers.get('location');
  const cuerpoPost = await respuesta.text();

  const erroresPost = erroresDeLogin(cuerpoPost);
  if (esPaginaDeLogin(cuerpoPost) && erroresPost.length > 0) {
    throw new Error(`Login rechazado: ${erroresPost.join(' — ')}`);
  }

  if (respuesta.status === 303 && location) {
    const urlDestino = new URL(location, baseUrl);
    const pag = await fetch(urlDestino.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)', Cookie: cabeceraCookies(jar) },
      redirect: 'manual'
    });
    combinarJar(jar, crearJarCookies([pag.headers.get('set-cookie')]).entries());
    const htmlFinal = await pag.text();

    if (pag.status === 303 && pag.headers.get('location')) {
      const urlFinal = new URL(pag.headers.get('location'), baseUrl).toString();
      const pag2 = await fetch(urlFinal, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)', Cookie: cabeceraCookies(jar) },
        redirect: 'manual'
      });
      combinarJar(jar, crearJarCookies([pag2.headers.get('set-cookie')]).entries());
      const htmlFin = await pag2.text();
      const erroresFin = erroresDeLogin(htmlFin);
      if (esPaginaDeLogin(htmlFin) && erroresFin.length > 0) {
        throw new Error(`Login rechazado: ${erroresFin.join(' — ')}`);
      }
      return { jar, html: htmlFin, url: urlFinal };
    }

    const erroresFinal = erroresDeLogin(htmlFinal);
    if (esPaginaDeLogin(htmlFinal) && erroresFinal.length > 0) {
      throw new Error(`Login rechazado: ${erroresFinal.join(' — ')}`);
    }
    return { jar, html: htmlFinal, url: urlDestino.toString() };
  }

  if (esPaginaDeLogin(cuerpoPost)) {
    throw new Error('El inicio de sesión volvió a la página de login sin redirección (sesión no establecida).');
  }
  return { jar, html: cuerpoPost, url: accion };
}

export async function guardarSesion(jar, ruta = RUTA_SESION) {
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, JSON.stringify(cookiesAJSON(jar), null, 2), 'utf8');
}

export async function cargarSesion(ruta = RUTA_SESION) {
  try {
    const contenido = await readFile(ruta, 'utf8');
    return cookiesDesdeJSON(JSON.parse(contenido));
  } catch {
    return new Map();
  }
}
// SIU Guaraní 认证模块
// 处理登录、会话保持、登出
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIU_BASE_URL, SIU_RUTAS } from './constantes.mjs';

const DIR_MODULO = path.dirname(fileURLToPath(import.meta.url));

function calcularRutaSesion() {
  if (process.env.VERCEL === '1') {
    return path.join(process.env.TMPDIR || '/tmp', 'siu-sesion.json');
  }
  return path.join(DIR_MODULO, '..', '..', 'data', 'siu-sesion.json');
}

export const RUTA_SESION_SIU = calcularRutaSesion();

// --- Cookie 管理 ---

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

export async function guardarSesion(jar, ruta = RUTA_SESION_SIU) {
  if (!ruta) return;
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, JSON.stringify(cookiesAJSON(jar), null, 2), 'utf8');
}

export async function cargarSesion(ruta = RUTA_SESION_SIU) {
  if (!ruta) return new Map();
  try {
    const contenido = await readFile(ruta, 'utf8');
    return cookiesDesdeJSON(JSON.parse(contenido));
  } catch {
    return new Map();
  }
}

// --- 错误检测 ---

export function detectarErrorCredenciales(html) {
  const patronesError = [
    /usuario.*no.*existe/i,
    /contrase[añ]a.*incorrecta/i,
    /credenciales.*inv[aá]lidas/i,
    /error.*autenticaci[aó]n/i,
    /acceso.*denegado/i,
    /Datos incorrectos/i,
    /Usuario o contrase[Ff]a incorrectos/i,
  ];
  for (const patrón of patronesError) {
    if (patrón.test(html)) return true;
  }
  return false;
}

export function detectarMantenimientoCampus(html = '', status = 200) {
  if (status === 502 || status === 503 || status === 504) {
    return `SIU Guaraní no responde o está temporalmente saturado (código ${status}). Intentá de nuevo más tarde.`;
  }
  const texto = String(html || '').toLowerCase();
  if (
    texto.includes('mantenimiento') ||
    texto.includes('fuera de servicio') ||
    texto.includes('servicio no disponible') ||
    texto.includes('error de base de datos') ||
    texto.includes('database connection failed')
  ) {
    return 'SIU Guaraní se encuentra temporalmente en mantenimiento. Probá más tarde.';
  }
  return null;
}

// --- 登录 ---

const TOPE_LOGIN_MS = 10000;

function fetchConTope(url, opciones) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TOPE_LOGIN_MS);
  return fetch(url, { ...opciones, signal: control.signal }).finally(() => clearTimeout(timer));
}

export async function iniciarSesion({ usuario, contrasena, baseUrl = SIU_BASE_URL, jar = new Map() } = {}) {
  if (!usuario || !contrasena) {
    throw new Error('Faltan SIU_USER / SIU_PASSWORD en el entorno (.env.local).');
  }

  const urlLogin = new URL(SIU_RUTAS.login, baseUrl).toString();

  try {
    const primera = await fetchConTope(urlLogin, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)' },
      redirect: 'manual'
    });
    combinarJar(jar, crearJarCookies([primera.headers.get('set-cookie')]).entries());
    const htmlLogin = await primera.text();

    const mantenimientoInicial = detectarMantenimientoCampus(htmlLogin, primera.status);
    if (mantenimientoInicial) throw new Error(mantenimientoInicial);

    const form = new URLSearchParams({
      usuario: String(usuario).trim(),
      password: String(contrasena),
    });

    const respuesta = await fetchConTope(urlLogin, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cabeceraCookies(jar)
      },
      body: form.toString(),
      redirect: 'manual'
    });
    combinarJar(jar, crearJarCookies([respuesta.headers.get('set-cookie')]).entries());

    const cuerpoPost = await respuesta.text();
    const mantenimientoPost = detectarMantenimientoCampus(cuerpoPost, respuesta.status);
    if (mantenimientoPost) throw new Error(mantenimientoPost);

    const urlResultante = respuesta.headers.get('location')
      ? new URL(respuesta.headers.get('location'), baseUrl).toString()
      : urlLogin;

    const esExitoso = !urlResultante.includes('/acceso/login') && !detectarErrorCredenciales(cuerpoPost);

    if (!esExitoso) {
      throw new Error('Credenciales de SIU Guaraní incorrectas. Verificá tu usuario y contraseña.');
    }

    return { jar, exitoso: true, url: urlResultante };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('SIU Guaraní tardó demasiado en responder. Intentá de nuevo más tarde.');
    }
    throw error;
  }
}

export async function validarCredencialesSiu({ usuario, contrasena } = {}) {
  const user = String(usuario || '').trim();
  const pass = String(contrasena || '');
  if (!user || !pass) {
    throw new Error('Faltan el usuario y la contraseña de SIU Guaraní.');
  }
  const resultado = await iniciarSesion({ usuario: user, contrasena: pass, jar: new Map() });
  return { usuario: user, exitoso: resultado.exitoso };
}


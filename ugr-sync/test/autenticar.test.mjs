import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cabeceraCookies,
  cookiesAJSON,
  cookiesDesdeJSON,
  crearJarCookies,
  erroresDeLogin,
  esPaginaDeLogin,
  extraerAccionLogin,
  extraerLogintoken,
  normalizarCookie
} from '../lib/autenticar.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('extraerLogintoken obtiene el token del formulario real de UGR Virtual', async () => {
  const html = await readFile(path.join(DIR, 'login.html'), 'utf8');
  const token = extraerLogintoken(html);
  assert.ok(token && /^[A-Za-z0-9]{20,}$/.test(token), `token inválido: ${token}`);
});

test('esPaginaDeLogin detecta el formulario de login', async () => {
  const html = await readFile(path.join(DIR, 'login.html'), 'utf8');
  assert.equal(esPaginaDeLogin(html), true);
  assert.equal(esPaginaDeLogin('<html><body>Hola</body></html>'), false);
});

test('extraerAccionLogin devuelve la URL absoluta del form', async () => {
  const html = await readFile(path.join(DIR, 'login.html'), 'utf8');
  const accion = extraerAccionLogin(html);
  assert.ok(accion.startsWith('https://'));
  assert.ok(accion.includes('/login/index.php'));
});

test('erroresDeLogin no reporta errores en una página de login normal', async () => {
  const html = await readFile(path.join(DIR, 'login.html'), 'utf8');
  assert.deepEqual(erroresDeLogin(html), []);
});

test('erroresDeLogin captura mensajes de acceso denegado', () => {
  const html = '<div class="loginerrors"><div class="alert alert-danger"><ul><li>Acceso denegado</li><li>Credenciales incorrectas</li></ul></div></div>';
  assert.deepEqual(erroresDeLogin(html), ['Acceso denegado', 'Credenciales incorrectas']);
});

test('crearJarCookies arma un jar desde Set-Cookie', () => {
  const jar = crearJarCookies([
    'MoodleSession=x123; path=/; HttpOnly',
    'MoodleSessionTest=y; path=/; HttpOnly',
    'Idioma=es; path=/'
  ]);
  assert.equal(jar.get('MoodleSession'), 'x123');
  assert.equal(jar.get('Idioma'), 'es');
  assert.equal(jar.has('MoodleSessionTest'), false); // cookie de prueba del navegador
  assert.equal(cabeceraCookies(jar).includes('MoodleSession=x123'), true);
});

test('normalizarCookie descarta entradas sin nombre=valor', () => {
  assert.equal(normalizarCookie('sin-igual'), null);
  assert.equal(normalizarCookie(''), null);
  const c = normalizarCookie('MoodleSession=abc; path=/; HttpOnly');
  assert.deepEqual(c.nombre, 'MoodleSession');
  assert.deepEqual(c.valor, 'abc');
});

test('cookiesAJSON / cookiesDesdeJSON son ida y vuelta', () => {
  const jar = new Map([['A', '1'], ['B', '2']]);
  const vuelta = cookiesDesdeJSON(cookiesAJSON(jar));
  assert.equal(vuelta.get('A'), '1');
  assert.equal(vuelta.get('B'), '2');
});
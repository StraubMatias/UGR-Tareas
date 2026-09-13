import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { crearCliente } from '../lib/red.mjs';

function respuesta({ status = 200, body = '', setCookie = '', location = null }) {
  const headers = new Headers();
  if (setCookie) headers.set('set-cookie', setCookie);
  if (location) headers.set('location', location);
  return new Response(body, { status, headers });
}

const LOGIN_HTML = '<html><form id="login" action="https://virtual.ugr.edu.ar/login/index.php"><input type="hidden" name="logintoken" value="tok123"></form></html>';

// Fuerza el flujo real: /course/index.php responde 303 a /login/index.php si la
// request no trae cookie de sesión Moodle, y 200 directo si ya está logueado.
async function conLoginCaducado() {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, config) => {
    const s = String(url);
    const metodo = config?.method ?? 'GET';
    const tieneCookie = (config?.headers?.Cookie ?? '').includes('MoodleSession');
    if (s === 'https://virtual.ugr.edu.ar/login/index.php' && metodo === 'GET') {
      return respuesta({ body: LOGIN_HTML, setCookie: 'MoodleSession=aaa; Path=/' });
    }
    if (s === 'https://virtual.ugr.edu.ar/login/index.php' && metodo === 'POST') {
      return respuesta({ status: 303, location: 'https://virtual.ugr.edu.ar/my/', setCookie: 'MoodleSession=bbb; Path=/' });
    }
    if (s === 'https://virtual.ugr.edu.ar/my/' && metodo === 'GET') {
      return respuesta({ body: '<html>Dashboard</html>' });
    }
    if (s === 'https://virtual.ugr.edu.ar/course/index.php' && metodo === 'GET') {
      if (tieneCookie) return respuesta({ body: '<html>Lista de cursos</html>' });
      return respuesta({ status: 303, location: 'https://virtual.ugr.edu.ar/login/index.php' });
    }
    return respuesta({ body: '<html>otra</html>' });
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ugr-'));
  const cliente = await crearCliente({ usuario: 'u', contrasena: 'c', rutaSesion: path.join(dir, 'sesion.json') });
  return { cliente, reset: () => { globalThis.fetch = fetchOriginal; } };
}

test('red: sigue la redirección de Moodle y guarda la cookie de sesión', async (t) => {
  const { cliente, reset } = await conLoginCaducado();
  t.after(reset);

  // Sin sesión previa: /course/index.php 303 → login → re-login → reintento.
  const resultado = await cliente.pedir('/course/index.php');
  assert.equal(resultado.es_requiere_login, false);
  assert.ok(resultado.html.includes('Lista de cursos'));
  assert.equal(cliente.jar.get('MoodleSession'), 'bbb');
});

test('red: una sesión válida no requiere re-login', async (t) => {
  const { cliente, reset } = await conLoginCaducado();
  t.after(reset);
  cliente.jar.set('MoodleSession', 'valida-123');
  const resultado = await cliente.pedir('/course/index.php');
  assert.ok(resultado.html.includes('Lista de cursos'));
  assert.equal(resultado.es_requiere_login, false);
  // Si no se re-logueó, la cookie original queda intacta (no 'bbb').
  assert.equal(cliente.jar.get('MoodleSession'), 'valida-123');
});
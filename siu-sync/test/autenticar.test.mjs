import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCredencialesSiu } from '../lib/autenticar.mjs';

/**
 * SIU Guaraní 3W responde al login con JSON AJAX. Hay dos formas:
 *   - login OK:      {"cod":"-2","cont":{"url":".../inicio_alumno", ...}}
 *   - login fallido: {"cod":"1","cont":"<html>...formulario de login..."}
 * El "cod" NO es un codigo de error: "-2" es la redireccion al inicio de sesion.
 * Estos tests fijan ese comportamiento para que no se vuelva a invertir.
 */

const RESPUESTA_OK = JSON.stringify({
  cod: '-2',
  cont: { url: 'https://guarani.ugr.edu.ar:443/3w/inicio_alumno', tiene_mensaje: '' }
});

const RESPUESTA_FALLIDA = JSON.stringify({
  cod: '1',
  cont: '<div id="login" class="pagelet"></div>'
});

/** Intercepta el fetch global para simular la respuesta de Guaraní. */
function mockFetch(respuesta, { status = 200 } = {}) {
  const original = globalThis.fetch;
  const llamadas = [];
  globalThis.fetch = async (url, opciones = {}) => {
    llamadas.push({ url: String(url), opciones });
    const esPost = (opciones.method || 'GET').toUpperCase() === 'POST';
    return {
      status,
      headers: {
        get: (nombre) => (nombre.toLowerCase() === 'set-cookie' ? 'session=teste' : null),
        getSetCookie: () => ['session=teste']
      },
      text: async () => (esPost ? respuesta : '<html>formulario</html>')
    };
  };
  return {
    llamadas,
    restaurar: () => { globalThis.fetch = original; }
  };
}

test('validarCredencialesSiu acepta el login válido (cod -2 = redirección al inicio)', async () => {
  const mock = mockFetch(RESPUESTA_OK);
  try {
    const resultado = await validarCredencialesSiu({ usuario: '12345678', contrasena: 'secreta' });
    assert.equal(resultado.exitoso, true);
    assert.equal(resultado.usuario, '12345678');
  } finally {
    mock.restaurar();
  }
});

test('validarCredencialesSiu rechaza el login fallido (cod 1 = vuelve al formulario)', async () => {
  const mock = mockFetch(RESPUESTA_FALLIDA);
  try {
    await assert.rejects(
      () => validarCredencialesSiu({ usuario: '12345678', contrasena: 'mala' }),
      /incorrectas/i
    );
  } finally {
    mock.restaurar();
  }
});

test('validarCredencialesSiu pide usuario y contraseña', async () => {
  await assert.rejects(
    () => validarCredencialesSiu({ usuario: '', contrasena: '' }),
    /Faltan el usuario y la contraseña/i
  );
});

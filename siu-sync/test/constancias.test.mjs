import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extraerContSiu,
  listarMesasExamen,
  listarSolicitudesSiu,
  listarTiposConstancia,
  solicitarConstanciaSiu,
  TIPOS_CONSTANCIA
} from '../lib/constancias.mjs';

function clienteFalso(respuestas) {
  const pedidos = [];
  return {
    pedidos,
    async pedir(ruta, opciones = {}) {
      pedidos.push({ ruta, ...opciones });
      const respuesta = respuestas[ruta];
      if (typeof respuesta === 'function') {
        return { url: ruta, html: respuesta(opciones), status: 200 };
      }
      if (!respuesta) return { url: ruta, html: '', status: 404 };
      return { url: ruta, html: respuesta, status: 200 };
    }
  };
}

test('extraerContSiu desenvuelve el JSON de SIU y deja el HTML intacto', () => {
  assert.equal(extraerContSiu('{"cod":"1","cont":"<div>hola</div>"}'), '<div>hola</div>');
  assert.equal(extraerContSiu('<div>hola</div>'), '<div>hola</div>');
  assert.equal(extraerContSiu('no es json'), 'no es json');
});

test('listarTiposConstancia lee las copias de cada tipo', async () => {
  const copiasPorValor = { 1: 2, 7: 1, 2: 10, 3: 10 };
  const cliente = clienteFalso({
    'solicitudes/get_cantidad_copias': (opciones) => {
      const valor = new URLSearchParams(String(opciones.cuerpo || '')).get('constancia');
      return `{"cod":"1","copias":"${copiasPorValor[valor] ?? 1}"}`;
    }
  });

  const tipos = await listarTiposConstancia(cliente);
  assert.equal(tipos.length, 4);
  const regular = tipos.find((t) => t.clave === 'alumno_regular');
  assert.equal(regular.copias, 2);
  assert.equal(regular.formulario, '34000240');
  const examenFinal = tipos.find((t) => t.clave === 'examen_final');
  assert.equal(examenFinal.copias, 1);
});

test('listarSolicitudesSiu arma el listado con el comprobante de descarga', async () => {
  const cliente = clienteFalso({
    solicitudes: '{"cod":"1","cont":"<table><tbody><tr><td>Constancia de Alumno Regular</td><td>19/10/2026</td><td>Trabajo</td><td>Autogestión</td><td>1</td><td>Online</td><td>17/01/2027</td><td><a class=\\"btn descargar_cert\\" href=\\"/3w/solicitudes/descargar_comprobante/abc123\\">pdf</a></td></tr></tbody></table>"}'
  });

  const solicitudes = await listarSolicitudesSiu(cliente);
  assert.equal(solicitudes.length, 1);
  assert.equal(solicitudes[0].constancia, 'Constancia de Alumno Regular');
  assert.equal(solicitudes[0].presentar, 'Trabajo');
  assert.match(solicitudes[0].comprobante, /descargar_comprobante\/abc123/);
});

test('listarMesasExamen usa la clave llamado_mesa del campus', async () => {
  const cliente = clienteFalso({
    'solicitudes/get_llamado_examen': '{"cod":"1","llamado_examen":[{"llamado_mesa":"95568","nombre_llamado":"1° Llamado del Turno Julio-Agosto 2026","fecha":"2026-07-15"},{"llamado_mesa":"95554","nombre_llamado":"1° Llamado del Turno Julio-Agosto 2026","fecha":"2026-07-16"}]}'
  });

  const mesas = await listarMesasExamen(cliente, { anioAcademico: '2026', turnoExamen: '', actividad: '' });
  assert.equal(mesas.length, 2);
  assert.equal(mesas[0].valor, '95568');
  assert.match(mesas[0].etiqueta, /Julio-Agosto 2026/);
  assert.match(mesas[0].etiqueta, /2026-07-15/);
  assert.notEqual(mesas[0].valor, mesas[1].valor);
});

test('listarMesasExamen devuelve lista vacía si SIU responde con error', async () => {
  const cliente = clienteFalso({
    'solicitudes/get_llamado_examen': '{"cod":"-1","cont":"Ha ocurrido un error."}'
  });

  const mesas = await listarMesasExamen(cliente, { anioAcademico: '2026', turnoExamen: '', actividad: '' });
  assert.deepEqual(mesas, []);
});

test('solicitarConstanciaSiu manda el cuerpo con todos los campos del formulario', async () => {
  const cliente = clienteFalso({
    'solicitudes/nueva_solicitud': '{"cod":"-2","cont":{"url":"/3w/solicitudes","tiene_mensaje":""}}'
  });

  await solicitarConstanciaSiu(cliente, {
    tipoClave: 'alumno_regular',
    copias: 2,
    presentar: 'Trabajo',
    observaciones: 'para el}',
    filtro: null
  });

  const pedido = cliente.pedidos.find((p) => p.ruta === 'solicitudes/nueva_solicitud');
  const cuerpo = new URLSearchParams(pedido.cuerpo);
  assert.equal(cuerpo.get('constancia'), TIPOS_CONSTANCIA.alumno_regular.valor);
  assert.equal(cuerpo.get('copias'), '2');
  assert.equal(cuerpo.get('presentar'), 'Trabajo');
  assert.equal(cuerpo.get('observaciones'), 'para el}');
  assert.equal(cuerpo.get('formulario'), '34000240');
  assert.equal(cuerpo.get('formulario_campo'), '');
});

test('solicitarConstanciaSiu pasa el filtro de mesa para examen final', async () => {
  const cliente = clienteFalso({
    'solicitudes/nueva_solicitud': '{"cod":"-2","cont":{"url":"/3w/solicitudes","tiene_mensaje":""}}'
  });

  await solicitarConstanciaSiu(cliente, {
    tipoClave: 'examen_final',
    presentar: 'Facultad',
    filtro: { campo: 'llamado_mesa', valor: '999' }
  });

  const pedido = cliente.pedidos.find((p) => p.ruta === 'solicitudes/nueva_solicitud');
  const cuerpo = new URLSearchParams(pedido.cuerpo);
  assert.equal(cuerpo.get('constancia'), TIPOS_CONSTANCIA.examen_final.valor);
  assert.equal(cuerpo.get('formulario'), '34000236');
  assert.equal(cuerpo.get('formulario_campo'), 'llamado_mesa');
  assert.equal(cuerpo.get('formulario_valor'), '999');
});

test('solicitarConstanciaSiu exige a quién se presenta la constancia', async () => {
  const cliente = clienteFalso({});
  await assert.rejects(
    () => solicitarConstanciaSiu(cliente, { tipoClave: 'alumno_regular', presentar: '   ' }),
    /Indicá a quién se presenta/
  );
});

test('solicitarConstanciaSiu rechaza tipo desconocido', async () => {
  const cliente = clienteFalso({});
  await assert.rejects(
    () => solicitarConstanciaSiu(cliente, { tipoClave: 'inventada', presentar: 'Trabajo' }),
    /Tipo de constancia desconocido/
  );
});

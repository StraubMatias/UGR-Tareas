import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autorEsEquipoDocente,
  esEquipoDocente,
  extraerDocentesDeCurso
} from '../lib/docentes.mjs';
import { detectarAvisosMoodle } from '../lib/sync-core.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const leer = (nombre) => readFile(path.join(DIR, nombre), 'utf8');

// Cliente HTTP simulado: sirve HTML por ruta (sin el fragmento #…, que el
// protocolo descarta igual) y registra qué se pidió. Una ruta no mapeada
// lanza error, como un timeout de red real.
function crearClienteMock(paginas) {
  const pedidos = [];
  return {
    pedidos,
    async pedir(ruta) {
      const clave = String(ruta).split('#')[0];
      pedidos.push(clave);
      const html = paginas[clave];
      if (html === undefined) throw new Error(`Ruta no esperada en el mock: ${clave}`);
      return { html };
    }
  };
}

test('extraerDocentesDeCurso lista al equipo docente del resumen', async () => {
  const docentes = extraerDocentesDeCurso(await leer('curso-con-docentes.html'), 'https://virtual.ugr.edu.ar');
  assert.deepEqual(docentes, [
    { userId: '42', nombre: 'Juan Pérez' },
    { userId: '77', nombre: 'María López' }
  ]);
});

test('extraerDocentesDeCurso ignora páginas sin docentes', async () => {
  assert.deepEqual(extraerDocentesDeCurso(await leer('curso.html'), 'https://virtual.ugr.edu.ar'), []);
});

test('esEquipoDocente clasifica el bloque Roles del perfil', async () => {
  assert.equal(esEquipoDocente(await leer('perfil-profesor.html')), true);
  assert.equal(esEquipoDocente(await leer('perfil-estudiante.html')), false);
  assert.equal(esEquipoDocente(await leer('perfil-sin-roles.html')), null);
  assert.equal(esEquipoDocente('<html><body>sin perfil</body></html>'), null);
  assert.equal(esEquipoDocente(''), null);
});

test('autorEsEquipoDocente: autor en el resumen del curso es docente (sin pedir perfil)', async () => {
  const cliente = crearClienteMock({});
  const es = await autorEsEquipoDocente({
    autor: 'Juan Pérez',
    autorId: '42',
    cursoId: '1310',
    docentes: [{ userId: '42', nombre: 'Juan Pérez' }],
    cliente,
    cache: new Map()
  });
  assert.equal(es, true);
  assert.equal(cliente.pedidos.length, 0);
});

test('autorEsEquipoDocente: coincidencia por nombre sin id de perfil', async () => {
  const es = await autorEsEquipoDocente({
    autor: 'María López',
    autorId: '',
    cursoId: '1310',
    docentes: [{ userId: '77', nombre: 'María López' }],
    cliente: crearClienteMock({}),
    cache: new Map()
  });
  assert.equal(es, true);
});

test('autorEsEquipoDocente: perfil con rol docente acredita al autor', async () => {
  const cliente = crearClienteMock({ '/user/view.php?id=99&course=1310': await leer('perfil-profesor.html') });
  const es = await autorEsEquipoDocente({
    autor: 'Carlos Ruiz',
    autorId: '99',
    cursoId: '1310',
    docentes: [],
    cliente,
    cache: new Map()
  });
  assert.equal(es, true);
  assert.deepEqual(cliente.pedidos, ['/user/view.php?id=99&course=1310']);
});

test('autorEsEquipoDocente: perfil con rol de estudiante descarta al autor', async () => {
  const cliente = crearClienteMock({ '/user/view.php?id=55&course=1310': await leer('perfil-estudiante.html') });
  const es = await autorEsEquipoDocente({
    autor: 'Ana Gómez',
    autorId: '55',
    cursoId: '1310',
    docentes: [],
    cliente,
    cache: new Map()
  });
  assert.equal(es, false);
});

test('autorEsEquipoDocente: sin bloque Roles se permite (default inclusivo)', async () => {
  const cliente = crearClienteMock({ '/user/view.php?id=66&course=1310': await leer('perfil-sin-roles.html') });
  const es = await autorEsEquipoDocente({
    autor: 'Un Usuario',
    autorId: '66',
    cursoId: '1310',
    docentes: [],
    cliente,
    cache: new Map()
  });
  assert.equal(es, true);
});

test('autorEsEquipoDocente: perfil inaccesible no rompe (default inclusivo)', async () => {
  const cliente = crearClienteMock({});
  const es = await autorEsEquipoDocente({
    autor: 'X',
    autorId: '11',
    cursoId: '1310',
    docentes: [],
    cliente,
    cache: new Map()
  });
  assert.equal(es, true);
});

test('autorEsEquipoDocente: el cache evita re-pedir el perfil del mismo autor', async () => {
  const cliente = crearClienteMock({ '/user/view.php?id=99&course=1310': await leer('perfil-profesor.html') });
  const cache = new Map();
  const args = {
    autor: 'Carlos Ruiz',
    autorId: '99',
    cursoId: '1310',
    docentes: [],
    cliente,
    cache
  };
  assert.equal(await autorEsEquipoDocente(args), true);
  assert.equal(await autorEsEquipoDocente(args), true);
  assert.equal(cliente.pedidos.length, 1);
});

test('detectarAvisosMoodle publica solo hilos de docentes del resumen del curso', async () => {
  // Flujo real con fixtures: el foro «Avisos» (110427) tiene dos discusiones de
  // Juan Pérez (id 42), que figura en el resumen del curso → ambas deberían
  // proponerse. El hilo 991720 no tiene página correspondiente en el mock, así
  // que el sync lo descarta como post ilegible y queda solo el 991721.
  const paginas = {
    '/mod/forum/index.php?id=1310': await leer('foros.html'),
    '/course/view.php?id=1310': await leer('curso-con-docentes.html'),
    'https://virtual.ugr.edu.ar/mod/forum/view.php?id=110427': await leer('discusiones.html'),
    'https://virtual.ugr.edu.ar/mod/forum/discuss.php?d=991721': await leer('hilo.html')
  };
  const cliente = crearClienteMock(paginas);
  const db = { async execute() { return { rows: [] }; } };

  const { avisosDetectados, eventosSugeridos } = await detectarAvisosMoodle({
    db,
    cliente,
    mapeos: [{
      curso: { id: '1310', nombre: '(V.TUCS.1.07.2) AUDITORÍAS DE SEGURIDAD DE LA INFORMACIÓN' },
      coincidencia: { materia: { id: 'mat-1', nombre: 'Auditorías de Seguridad de la Información' } }
    }],
    hoy: '2026-09-15',
    diasAtras: 7
  });

  assert.equal(avisosDetectados.length, 1);
  const aviso = avisosDetectados[0];
  assert.equal(aviso.id, 'aviso_1310_991721');
  assert.equal(aviso.hiloId, '991721');
  assert.equal(aviso.titulo, 'Clase de consulta del lunes 21 de septiembre');
  assert.equal(aviso.autor, 'Juan Pérez');
  assert.equal(aviso.fecha, '2026-09-15');
  assert.equal(aviso.materiaNombre, 'Auditorías de Seguridad de la Información');

  assert.equal(eventosSugeridos.length, 1);
  assert.equal(eventosSugeridos[0].avisoId, 'aviso_1310_991721');
  assert.equal(eventosSugeridos[0].fecha, '2026-09-21');

  // El autor está en el resumen del curso: no hace falta pedir ningún perfil.
  assert.equal(cliente.pedidos.some((ruta) => ruta.includes('/user/view.php')), false);
});
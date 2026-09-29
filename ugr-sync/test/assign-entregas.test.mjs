import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createClient } from '@libsql/client';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import {
  extraerEntregasAssign,
  extraerNotaDeTextoDevolucion,
  enriquecerNotasDesdeDevoluciones,
  aplicarEntregasAssignEnDb,
  esTareaBuzonEntregasMultiples,
  resumirEntregasParaTablero
} from '../lib/assign-entregas.mjs';
import { textoDesdeDocx } from '../lib/docx-texto.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));

function crearDocxMinimo(textoPlano) {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${textoPlano}</w:t></w:r></w:p></w:body>
</w:document>`;
  const nombre = 'word/document.xml';
  const data = Buffer.from(xml, 'utf8');
  const comprimido = deflateSync(data);
  const nameBuf = Buffer.from(nombre, 'utf8');
  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comprimido.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  nameBuf.copy(local, 30);
  return Buffer.concat([local, comprimido]);
}

test('extraerNotaDeTextoDevolucion lee nota en comentarios o Word', () => {
  assert.equal(extraerNotaDeTextoDevolucion('La nota final es 8 de 10. Muy bien.'), 8);
  assert.equal(extraerNotaDeTextoDevolucion('Sin calificación numérica'), null);
});

test('textoDesdeDocx extrae texto y nota', () => {
  const docx = crearDocxMinimo('Devolución entrega 1. Calificación: 8/10');
  const texto = textoDesdeDocx(docx);
  assert.match(texto, /8\/10/);
  assert.equal(extraerNotaDeTextoDevolucion(texto), 8);
});

test('esTareaBuzonEntregasMultiples solo buzones «Entregas del trabajo» (SGSI)', () => {
  assert.equal(esTareaBuzonEntregasMultiples('Entregas del trabajo práctico- Análisis de un caso'), true);
  assert.equal(esTareaBuzonEntregasMultiples('Trabajo Práctico Final Primer Entrega DIS-A'), false);
  assert.equal(esTareaBuzonEntregasMultiples('Auditorías de SI, UII Tarea nro.1'), false);
});

test('extraerEntregasAssign parsea intentos y reabierto actual', async () => {
  const html = await readFile(join(DIR, 'fixtures/assign-entregas-sgsi.html'), 'utf8');
  const { entregas, intentoActual, requiereNuevaEntrega } = extraerEntregasAssign(html);
  assert.equal(intentoActual, 3);
  assert.equal(requiereNuevaEntrega, true);
  const intento2 = entregas.find((e) => e.numero === 2);
  assert.ok(intento2?.tieneDevolucion);
  assert.equal(intento2?.archivos?.length, 1);
  assert.equal(intento2?.indiceEntrega, 1);
  assert.ok(!entregas.some((e) => e.numero === 1), 'intento 1 sin devolución no se lista');
  const activa = entregas.find((e) => e.esActiva);
  assert.equal(activa?.numero, 3);
  assert.equal(activa?.indiceEntrega, 2);
  assert.equal(activa?.pendiente, true);
});

test('extraerEntregasAssign no mezcla el intento actual en intentos anteriores (Moodle 4)', async () => {
  const html = await readFile(join(DIR, 'fixtures/assign-entregas-sgsi-moodle4.html'), 'utf8');
  const { entregas, intentoActual } = extraerEntregasAssign(html);
  assert.equal(intentoActual, 3);
  const e1 = entregas.find((e) => e.indiceEntrega === 1);
  assert.ok(e1);
  assert.match(e1.estado, /reabierto/i);
  assert.ok(e1.comentarioProf?.includes('correcto'));
  assert.ok(!e1.estado.includes('Este es el intento 3'));
  const e2 = entregas.find((e) => e.esActiva);
  assert.equal(e2?.indiceEntrega, 2);
});

test('resumirEntregasParaTablero usa nota de entrega cerrada, no del intento activo', () => {
  const resumen = resumirEntregasParaTablero([
    { numero: 2, indiceEntrega: 1, esActiva: false, nota: 8, pendiente: false, estado: 'Reabierto' },
    { numero: 3, indiceEntrega: 2, esActiva: true, nota: 5, pendiente: true, estado: 'Reabierto' }
  ]);
  assert.equal(resumen.notaParaTablero, 8);
  assert.equal(resumen.entregada, false);
});

test('enriquecerNotasDesdeDevoluciones descarga docx y asigna nota', async () => {
  const docx = crearDocxMinimo('Entrega 1 — Nota: 8 de 10');
  const cliente = {
    jar: new Map(),
    async pedir() { return {}; }
  };
  global.fetch = async () => ({
    ok: true,
    arrayBuffer: async () => docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength)
  });
  const entregas = [{
    numero: 2,
    esActiva: false,
    indiceEntrega: 1,
    notaCampus: null,
    comentarioProf: '',
    archivos: [{ url: 'https://virtual.ugr.edu.ar/f.docx', nombre: 'Devolucion.docx' }],
    tieneDevolucion: true,
    estado: 'Reabierto'
  }];
  const enriquecidas = await enriquecerNotasDesdeDevoluciones(cliente, entregas);
  assert.equal(enriquecidas[0].nota, 8);
  assert.equal(enriquecidas[0].notaOrigen, 'devolucion_docx');
  delete global.fetch;
});

test('aplicarEntregasAssignEnDb destilda si el intento actual está reabierto', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ugr-entregas-'));
  const db = createClient({ url: `file:${join(dir, 'test.db')}` });
  try {
    await db.batch([
      `CREATE TABLE tareas_entregas (
        id TEXT PRIMARY KEY, tarea_id TEXT, alumno_id TEXT, numero INTEGER,
        indice_entrega INTEGER, es_activa INTEGER, estado TEXT, nota TEXT, nota_origen TEXT,
        comentario_prof TEXT, feedback_url TEXT, feedback_nombre TEXT, devolucion_texto TEXT,
        sincronizado_en TEXT, UNIQUE(tarea_id, alumno_id, numero)
      )`,
      'CREATE TABLE completadas (tarea_id TEXT, alumno_id TEXT, alumno TEXT, completada_en TEXT, UNIQUE(tarea_id, alumno))',
      "INSERT INTO completadas VALUES ('t1', 'alu', 'Ana', datetime('now'))"
    ], 'write');
    const resumen = await aplicarEntregasAssignEnDb({
      db,
      tareaId: 't1',
      alumnoId: 'alu',
      alumnoNombre: 'Ana',
      entregas: [
        {
          numero: 2,
          esActiva: false,
          indiceEntrega: 1,
          pendiente: false,
          estado: 'Calificado',
          nota: 8,
          comentarioProf: 'Ok',
          archivos: []
        },
        {
          numero: 3,
          esActiva: true,
          indiceEntrega: 2,
          pendiente: true,
          estado: 'Reabierto',
          nota: null,
          comentarioProf: '',
          archivos: []
        }
      ]
    });
    assert.equal(resumen.entregada, false);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM completadas')).rows[0].n, 0);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

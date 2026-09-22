import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import {
  clasificarMaterialDeCursada,
  extraerEnlacesDeCursada,
  interpretarCondiciones,
  textoDeOperadoresPdf,
  textoDePdf,
  urlArchivoDeRecurso
} from '../lib/metodologia.mjs';

test('clasificarMaterialDeCursada toma la metodología y el programa, no un archivo de Python', () => {
  assert.equal(clasificarMaterialDeCursada('Metodologia de Cursado'), 'metodologia');
  assert.equal(clasificarMaterialDeCursada('Metodología de trabajo'), 'metodologia');
  assert.equal(clasificarMaterialDeCursada('Programa de la asignatura'), 'programa');
  assert.equal(clasificarMaterialDeCursada('Programas en Python'), null);
  assert.equal(clasificarMaterialDeCursada('Evaluación y Gestión de Riesgos - Clase 1'), null);
});

test('extraerEnlacesDeCursada lee el archivo de metodología del aula', () => {
  const html = `
    <a href="https://virtual.ugr.edu.ar/mod/resource/view.php?id=163790">Metodologia de Cursado</a>
    <a href="https://virtual.ugr.edu.ar/mod/resource/view.php?id=171657">Programas en Python</a>
  `;
  const enlaces = extraerEnlacesDeCursada(html);
  assert.equal(enlaces.length, 1);
  assert.equal(enlaces[0].tipo, 'metodologia');
  assert.match(enlaces[0].href, /id=163790/);
});

test('urlArchivoDeRecurso apunta al PDF de la metodología', () => {
  const html = '<a href="https://virtual.ugr.edu.ar/pluginfile.php/396492/mod_resource/content/8/Metodologia.pdf">bajar</a>';
  assert.match(urlArchivoDeRecurso(html), /Metodologia\.pdf/);
});

test('textoDePdf lee la frase de regularización', () => {
  const contenido = 'BT (Para regularizar la materia con seis.) Tj (Promociona con ocho.) Tj ET';
  const stream = deflateSync(Buffer.from(contenido));
  const pdf = Buffer.concat([
    Buffer.from(`%PDF-1.4\n1 0 obj<</Length ${stream.length}/Filter/FlateDecode>>stream\n`),
    stream,
    Buffer.from('\nendstream\nendobj\n%%EOF')
  ]);
  assert.match(textoDePdf(pdf), /regularizar la materia/);
  assert.match(textoDeOperadoresPdf(contenido), /Promociona con ocho/);
});

test('interpretarCondiciones guarda la cursada y la promoción de criptografía', () => {
  const texto = `
    Bienvenidos.
    Para regularizar la materia es necesario:
    Haber obtenido una calificación de seis (6) o superior en cada trabajo práctico.
    Haber obtenido una calificación de seis (6) o superior en cada uno de los exámenes parciales.
    Promoción:
    Hayan obtenido una calificación de ocho (8) o superior en cada trabajo práctico.
    Hayan obtenido una calificación de ocho (8) o superior en cada uno de los exámenes parciales.
    Condición de libre:
    No hayan rendido alguno de los parciales.
  `;
  const condiciones = interpretarCondiciones(texto);
  assert.match(condiciones.condiciones, /Para regularizar/);
  assert.doesNotMatch(condiciones.condiciones, /Condición de libre/);
  assert.equal(condiciones.regularizar, 6);
  assert.equal(condiciones.promocionar, 8);
  assert.equal(condiciones.regla, 'metodologia');
});

test('interpretarCondiciones usa el porcentaje de actividades cuando la metodología lo dice', () => {
  const texto = `
    ¿Cómo se regulariza la materia?
    La regularidad se alcanza con al menos 75% de las actividades completas.
    ¿Cómo se promociona la materia?
    Obteniendo al menos el 90% de las actividades completas.
  `;
  const condiciones = interpretarCondiciones(texto);
  assert.equal(condiciones.regla, 'activos_porcentaje');
  assert.equal(condiciones.regularizar, 75);
  assert.equal(condiciones.promocionar, 90);
});

test('interpretarCondiciones de solo parciales usa la regla de los dos exámenes', () => {
  const texto = `
    Para regularizar y poder rendir el examen final, deberán aprobar con nota mínima de 6 ptos. los dos parciales.
    El estudiante que apruebe los parciales con una nota mínima de 8 ptos. en cada uno, promocionará la materia.
  `;
  const condiciones = interpretarCondiciones(texto);
  assert.equal(condiciones.regla, 'ciberdelitos_parciales');
  assert.equal(condiciones.regularizar, 6);
  assert.equal(condiciones.promocionar, 8);
});

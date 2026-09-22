// La metodología de cursado vive en un archivo del aula (PDF o Word), no en las
// tareas. De ahí salen la regularización y la promoción cuando la materia
// todavía no las tiene cargadas.
import { inflateSync } from 'node:zlib';
import { limpiarTextoParaBusqueda } from './normalizar.mjs';

const MAX_CONDICIONES = 1000;

export function clasificarMaterialDeCursada(nombre) {
  const n = limpiarTextoParaBusqueda(nombre);
  if (!n || /python|certificado|clase \d/.test(n)) return null;
  if (/^metodolog/.test(n)) return 'metodologia';
  if (/^programa\b/.test(n)) return 'programa';
  return null;
}

export function extraerEnlacesDeCursada(html) {
  const vistos = new Set();
  const enlaces = [];
  const re = /<a[^>]+href="([^"]*\/mod\/resource\/view\.php\?id=\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let coincidencia;
  while ((coincidencia = re.exec(html || ''))) {
    const texto = coincidencia[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const tipo = clasificarMaterialDeCursada(texto);
    if (!tipo) continue;
    const href = coincidencia[1].replace(/&amp;/g, '&');
    const clave = `${tipo}|${href}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    enlaces.push({ tipo, href, nombre: texto });
  }
  return enlaces;
}

export function urlArchivoDeRecurso(html) {
  const coincidencia = String(html || '').match(/(?:https:\/\/virtual\.ugr\.edu\.ar)?\/pluginfile\.php\/\d+\/mod_resource\/content\/[^"'\s]+/);
  if (!coincidencia) return null;
  const href = coincidencia[0].replace(/&amp;/g, '&');
  return href.startsWith('http') ? href : `https://virtual.ugr.edu.ar${href}`;
}

export function textoDePdf(buffer) {
  const raw = Buffer.from(buffer || '').toString('latin1');
  const mapas = mapasUnicodePorFuente(raw);
  let texto = '';
  for (const cuerpo of extraerStreams(raw)) {
    let plano = '';
    try {
      plano = inflateSync(cuerpo).toString('latin1');
    } catch {
      plano = cuerpo.toString('latin1');
    }
    if (!plano.includes('BT')) continue;
    texto += `${textoDeOperadoresPdf(plano, mapas)}\n`;
  }
  return texto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function textoDeOperadoresPdf(stream, mapas = new Map()) {
  const fuente = String(stream || '');
  const numero = '-?(?:\\d+\\.\\d+|\\d+|\\.\\d+)';
  const marcas = new RegExp(`\\bq\\b|\\bQ\\b|(?:${numero}\\s+){5}${numero}\\s+cm|BT[\\s\\S]*?ET`, 'g');
  const piezas = [];
  const pila = [{ x: 0, y: 0 }];
  let marca;
  while ((marca = marcas.exec(fuente))) {
    const token = marca[0];
    if (token === 'q') {
      pila.push({ ...pila.at(-1) });
      continue;
    }
    if (token === 'Q') {
      if (pila.length > 1) pila.pop();
      continue;
    }
    if (token.endsWith('cm')) {
      const nums = token.trim().split(/\s+/).map(Number);
      pila[pila.length - 1] = { x: nums[4], y: nums[5] };
      continue;
    }
    const texto = cadenasDeBloque(token, mapas);
    if (!texto) continue;
    const pos = posicionDeBloque(token);
    const grafico = pila.at(-1);
    const y = Math.abs(pos.y) >= 2 ? pos.y : (Math.abs(grafico.y) >= 2 ? grafico.y : pos.y);
    piezas.push({ x: pos.x || grafico.x, y, texto });
  }
  piezas.sort((a, b) => b.y - a.y || a.x - b.x);
  const lineas = [];
  for (const pieza of piezas) {
    const ultima = lineas.at(-1);
    if (ultima && Math.abs(ultima.y - pieza.y) < 2) ultima.partes.push(pieza);
    else lineas.push({ y: pieza.y, partes: [pieza] });
  }
  return lineas.map((linea) => linea.partes
    .sort((a, b) => a.x - b.x)
    .map((parte) => parte.texto)
    .join(''))
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function textoDeDocx(buffer) {
  const xml = extraerZip(Buffer.from(buffer || ''), 'word/document.xml');
  if (!xml) return '';
  return xml
    .replace(/<w:p[ >]/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCharCode(Number(codigo)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function textoDeArchivoCampus(buffer) {
  const datos = Buffer.from(buffer || '');
  if (datos.subarray(0, 4).toString() === '%PDF') return textoDePdf(datos);
  if (datos.subarray(0, 2).toString() === 'PK') return textoDeDocx(datos);
  return '';
}

export function recortarCondiciones(texto) {
  const limpio = String(texto || '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  const preferidas = [/condiciones para regularizar/i, /c[oó]mo se regulariza/i, /para regularizar/i];
  let marca = -1;
  for (const expresion of preferidas) {
    const indice = limpio.search(expresion);
    if (indice >= 0) {
      marca = indice;
      break;
    }
  }
  if (marca < 0) marca = limpio.search(/c[oó]mo ser[aá] la evaluaci[oó]n|evaluaci[oó]n/i);
  if (marca < 0) return '';
  let recorte = limpio.slice(marca);
  const cierre = recorte.search(/si tiene inconvenientes|condici[oó]n\s+de\s+libre|mesa\s+de\s+ayuda|el\s+equipo\s+les\s+desea|el\s+equipo\s/i);
  if (cierre > 40) recorte = recorte.slice(0, cierre);
  return recorte.replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CONDICIONES);
}

export function interpretarCondiciones(texto) {
  const condiciones = recortarCondiciones(texto);
  if (condiciones.length < 40) return null;
  const n = limpiarTextoParaBusqueda(condiciones);
  const porcentajes = [...condiciones.matchAll(/(\d{2,3})\s*%/g)].map((item) => Number(item[1]));
  if (porcentajes.includes(75) && porcentajes.some((valor) => valor >= 90)) {
    return { condiciones, regularizar: 75, promocionar: Math.max(...porcentajes.filter((valor) => valor >= 90)), regla: 'activos_porcentaje' };
  }
  const regularizar = notaDeTramo(n, 'regulariz', 'promocion');
  const promocionar = notaDeTramo(n, 'promocion', 'condicion de libre');
  const antesDePromocion = n.split('promocion')[0] || '';
  const despuesDePromocion = n.slice(Math.max(n.indexOf('promocion'), 0));
  const mencionaPracticos = (trozo) => /trabajos? practicos?|\btps?\b|actividades practicas/.test(trozo);
  const promoSoloParciales = /parcial/.test(n)
    && /parcial/.test(antesDePromocion)
    && !mencionaPracticos(antesDePromocion)
    && !mencionaPracticos(despuesDePromocion);
  if (promoSoloParciales && regularizar && promocionar) {
    return { condiciones, regularizar, promocionar, regla: 'ciberdelitos_parciales' };
  }
  if (!regularizar && !promocionar) return null;
  return {
    condiciones,
    regularizar: regularizar || null,
    promocionar: promocionar || null,
    regla: 'metodologia'
  };
}

function notaDeTramo(texto, desde, hasta) {
  const inicio = texto.indexOf(desde);
  if (inicio < 0) return null;
  const fin = texto.indexOf(hasta, inicio + desde.length);
  const tramo = texto.slice(inicio, fin > inicio ? fin : inicio + 700);
  const anterior = texto.slice(Math.max(0, inicio - 180), inicio);
  return primeraNota(tramo) ?? ultimaNota(anterior);
}

function posicionDeBloque(bloque) {
  const tm = bloque.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/);
  let x = tm ? Number(tm[5]) : 0;
  let y = tm ? Number(tm[6]) : 0;
  const td = bloque.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td/);
  if (td && Math.abs(y) < 2) {
    x = Number(td[1]);
    y = Number(td[2]);
  }
  return { x, y };
}

function cadenasDeBloque(bloque, mapas) {
  const fuente = (bloque.match(/\/(F\d+)\s+[\d.]+\s+Tf/) || [])[1] || '';
  const mapa = mapas.get(fuente) || null;
  let salida = '';
  let i = 0;
  while (i < bloque.length) {
    if (bloque[i] === '(') {
      const leido = leerCadenaPdf(bloque, i);
      salida += leido.texto;
      i = leido.fin;
      continue;
    }
    if (bloque[i] === '<' && bloque[i + 1] !== '<') {
      const fin = bloque.indexOf('>', i + 1);
      const hex = fin > i ? bloque.slice(i + 1, fin) : '';
      if (mapa && /^[0-9A-Fa-f\s]+$/.test(hex)) salida += decodificarHex(hex, mapa);
      i = fin > i ? fin + 1 : i + 1;
      continue;
    }
    i += 1;
  }
  return salida;
}

function leerCadenaPdf(bloque, inicio) {
  let j = inicio + 1;
  let fragmento = '';
  while (j < bloque.length) {
    if (bloque[j] === '\\') {
      const octal = bloque.slice(j + 1, j + 4).match(/^[0-7]{1,3}/);
      if (octal) {
        fragmento += String.fromCharCode(parseInt(octal[0], 8));
        j += 1 + octal[0].length;
        continue;
      }
      const mapa = { n: '\n', r: '\r', t: '\t' };
      fragmento += mapa[bloque[j + 1]] ?? bloque[j + 1] ?? '';
      j += 2;
      continue;
    }
    if (bloque[j] === ')') break;
    fragmento += bloque[j];
    j += 1;
  }
  return { texto: fragmento, fin: j + 1 };
}

function extraerStreams(raw) {
  const streams = [];
  const marcas = raw.matchAll(/>>\s*stream\r?\n/g);
  for (const marca of marcas) {
    const ventana = raw.slice(Math.max(0, marca.index - 400), marca.index);
    const largos = [...ventana.matchAll(/\/Length\s+(\d+)/g)];
    if (!largos.length) continue;
    const largo = Number(largos.at(-1)[1]);
    const inicio = marca.index + marca[0].length;
    streams.push(Buffer.from(raw.slice(inicio, inicio + largo), 'latin1'));
  }
  return streams;
}

function mapasUnicodePorFuente(raw) {
  const cmapaPorObjeto = new Map();
  const objetos = raw.matchAll(/(\d+)\s+0\s+obj\s*<<([^>]*)>>\s*stream\r?\n/g);
  for (const objeto of objetos) {
    const largos = [...objeto[2].matchAll(/\/Length\s+(\d+)/g)];
    if (!largos.length) continue;
    const inicio = objeto.index + objeto[0].length;
    const cuerpo = Buffer.from(raw.slice(inicio, inicio + Number(largos.at(-1)[1])), 'latin1');
    let plano = '';
    try {
      plano = inflateSync(cuerpo).toString('latin1');
    } catch {
      plano = cuerpo.toString('latin1');
    }
    if (!plano.includes('beginbfchar') && !plano.includes('beginbfrange')) continue;
    cmapaPorObjeto.set(objeto[1], mapaDeCmap(plano));
  }
  const unicodePorFuente = new Map();
  const fuentes = raw.matchAll(/(\d+)\s+0\s+obj\s*<<([^>]*\/ToUnicode\s+(\d+)\s+0\s+R[^>]*)>>/g);
  const tounicode = new Map();
  for (const fuente of fuentes) tounicode.set(fuente[1], cmapaPorObjeto.get(fuente[3]));
  const recursos = raw.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g);
  for (const recurso of recursos) {
    const mapa = tounicode.get(recurso[2]);
    if (mapa) unicodePorFuente.set(recurso[1], mapa);
  }
  return unicodePorFuente;
}

function mapaDeCmap(texto) {
  const mapa = new Map();
  for (const bloque of texto.match(/beginbfchar[\s\S]*?endbfchar/g) || []) {
    for (const par of bloque.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      mapa.set(normalizarCodigo(par[1]), unicodeDeHex(par[2]));
    }
  }
  for (const bloque of texto.match(/beginbfrange[\s\S]*?endbfrange/g) || []) {
    for (const rango of bloque.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const desde = parseInt(rango[1], 16);
      const hasta = parseInt(rango[2], 16);
      let destino = parseInt(rango[3], 16);
      const ancho = rango[1].length;
      for (let codigo = desde; codigo <= hasta && codigo - desde < 512; codigo += 1) {
        mapa.set(codigo.toString(16).toUpperCase().padStart(ancho, '0'), String.fromCodePoint(destino));
        destino += 1;
      }
    }
  }
  return mapa;
}

function normalizarCodigo(hex) {
  return hex.toUpperCase().padStart(hex.length % 2 === 0 ? hex.length : hex.length + 1, '0');
}

function unicodeDeHex(hex) {
  let salida = '';
  const limpio = hex.toUpperCase();
  for (let i = 0; i < limpio.length; i += 4) {
    salida += String.fromCodePoint(parseInt(limpio.slice(i, i + 4), 16));
  }
  return salida;
}

function decodificarHex(hex, mapa) {
  const limpio = hex.replace(/\s/g, '').toUpperCase();
  const ancho = [...mapa.keys()][0]?.length || 4;
  let salida = '';
  for (let i = 0; i < limpio.length; i += ancho) {
    salida += mapa.get(limpio.slice(i, i + ancho).padStart(ancho, '0')) || '';
  }
  return salida;
}

const NOTAS_ESCRITAS = [
  ['seis', 6], ['ocho', 8], ['siete', 7], ['cuatro', 4], ['cinco', 5], ['nueve', 9], ['diez', 10]
];

function primeraNota(ventana) {
  for (const [nombre, valor] of NOTAS_ESCRITAS) {
    if (ventana.includes(nombre)) return valor;
  }
  const numero = ventana.match(/\b(10|[4-9])\b/);
  if (numero) return Number(numero[1]);
  const porcentaje = ventana.match(/(\d{2,3})\s*%/);
  return porcentaje ? Number(porcentaje[1]) : null;
}

function ultimaNota(ventana) {
  let mejor = null;
  let posicion = -1;
  for (const [nombre, valor] of NOTAS_ESCRITAS) {
    const indice = ventana.lastIndexOf(nombre);
    if (indice > posicion) {
      posicion = indice;
      mejor = valor;
    }
  }
  for (const numero of ventana.matchAll(/\b(10|[4-9])\b/g)) {
    if (numero.index > posicion) {
      posicion = numero.index;
      mejor = Number(numero[1]);
    }
  }
  return mejor;
}

function extraerZip(buffer, nombreBuscado) {
  let offset = 0;
  while (offset + 30 < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const metodo = buffer.readUInt16LE(offset + 8);
    const tamano = buffer.readUInt32LE(offset + 18);
    const largoNombre = buffer.readUInt16LE(offset + 26);
    const largoExtra = buffer.readUInt16LE(offset + 28);
    const nombre = buffer.subarray(offset + 30, offset + 30 + largoNombre).toString();
    const datos = buffer.subarray(offset + 30 + largoNombre + largoExtra, offset + 30 + largoNombre + largoExtra + tamano);
    if (nombre === nombreBuscado) {
      if (metodo === 0) return datos.toString('utf8');
      if (metodo === 8) return inflateSync(datos).toString('utf8');
      return '';
    }
    offset += 30 + largoNombre + largoExtra + tamano;
  }
  return '';
}

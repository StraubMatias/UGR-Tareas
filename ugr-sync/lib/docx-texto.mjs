import { inflateSync } from 'node:zlib';

/** Lee entradas de un ZIP (DOCX) y devuelve un mapa nombre → Buffer. */
export function leerEntradasZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const archivos = new Map();
  let o = 0;
  while (o + 30 <= buf.length) {
    if (buf.readUInt32LE(o) !== 0x04034b50) break;
    const metodo = buf.readUInt16LE(o + 8);
    const compSize = buf.readUInt32LE(o + 18);
    const nameLen = buf.readUInt16LE(o + 26);
    const extraLen = buf.readUInt16LE(o + 28);
    const name = buf.toString('utf8', o + 30, o + 30 + nameLen);
    const dataStart = o + 30 + nameLen + extraLen;
    const comprimido = buf.subarray(dataStart, dataStart + compSize);
    o = dataStart + compSize;
    if (metodo === 0) archivos.set(name, Buffer.from(comprimido));
    else if (metodo === 8) archivos.set(name, inflateSync(comprimido));
  }
  return archivos;
}

export function textoPlanoDesdeXmlWord(xml) {
  if (!xml) return '';
  return String(xml)
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function textoDesdeDocx(buffer) {
  const entradas = leerEntradasZip(buffer);
  const xml = entradas.get('word/document.xml');
  if (!xml) return '';
  return textoPlanoDesdeXmlWord(xml.toString('utf8'));
}

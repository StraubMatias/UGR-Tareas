import { inflateSync } from 'node:zlib';

function leerEntradaLocal(buf, o) {
  if (o + 30 > buf.length || buf.readUInt32LE(o) !== 0x04034b50) return null;
  const metodo = buf.readUInt16LE(o + 8);
  const compSize = buf.readUInt32LE(o + 18);
  const nameLen = buf.readUInt16LE(o + 26);
  const extraLen = buf.readUInt16LE(o + 28);
  const name = buf.toString('utf8', o + 30, o + 30 + nameLen);
  const dataStart = o + 30 + nameLen + extraLen;
  const comprimido = buf.subarray(dataStart, dataStart + compSize);
  let datos = comprimido;
  if (metodo === 0) datos = Buffer.from(comprimido);
  else if (metodo === 8) datos = inflateSync(comprimido);
  else return { name, datos: null, next: dataStart + compSize };
  return { name, datos, next: dataStart + compSize };
}

/** Lee entradas de un ZIP (DOCX), incluyendo DOCX de Word con directorio central al final. */
export function leerEntradasZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const archivos = new Map();
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return archivos;

  let o = 0;
  while (o + 30 <= buf.length) {
    if (buf.readUInt32LE(o) !== 0x04034b50) break;
    const entrada = leerEntradaLocal(buf, o);
    if (!entrada) break;
    if (entrada.datos) archivos.set(entrada.name, entrada.datos);
    o = entrada.next;
  }

  if (!archivos.has('word/document.xml')) {
    for (let i = buf.length - 22; i >= 0; i -= 1) {
      if (buf.readUInt32LE(i) !== 0x06054b50) continue;
      const cdOffset = buf.readUInt32LE(i + 16);
      let p = cdOffset;
      while (p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50) {
        const metodo = buf.readUInt16LE(p + 10);
        const compSize = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const localOffset = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
        p += 46 + nameLen + extraLen + commentLen;
        if (archivos.has(name)) continue;
        const local = leerEntradaLocal(buf, localOffset);
        if (local?.datos) archivos.set(name, local.datos);
        else if (local && metodo === 8 && compSize > 0) {
          const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
          try {
            archivos.set(name, inflateSync(buf.subarray(dataStart, dataStart + compSize)));
          } catch {
            /* entrada ilegible */
          }
        }
      }
      break;
    }
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
  try {
    const entradas = leerEntradasZip(buffer);
    const xml = entradas.get('word/document.xml');
    if (!xml) return '';
    return textoPlanoDesdeXmlWord(xml.toString('utf8'));
  } catch {
    return '';
  }
}

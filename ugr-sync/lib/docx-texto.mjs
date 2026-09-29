import { inflateRawSync, inflateSync } from 'node:zlib';

function leerEntradaLocal(buf, o) {
  if (o + 30 > buf.length || buf.readUInt32LE(o) !== 0x04034b50) return null;
  const flags = buf.readUInt16LE(o + 6);
  const metodo = buf.readUInt16LE(o + 8);
  let compSize = buf.readUInt32LE(o + 18);
  let uncompSize = buf.readUInt32LE(o + 22);
  const nameLen = buf.readUInt16LE(o + 26);
  let extraLen = buf.readUInt16LE(o + 28);
  const name = buf.toString('utf8', o + 30, o + 30 + nameLen);
  let extraStart = o + 30 + nameLen;
  let extra = buf.subarray(extraStart, extraStart + extraLen);
  if (flags & 0x08 || compSize === 0 || uncompSize === 0) {
    let p = extraStart + extraLen;
    if (flags & 0x08) {
      while (p + 16 <= buf.length) {
        if (buf.readUInt32LE(p) === 0x08074b50) {
          compSize = buf.readUInt32LE(p + 8);
          uncompSize = buf.readUInt32LE(p + 12);
          p += 16;
          break;
        }
        p += 1;
      }
    }
    const zip64 = extra.indexOf(Buffer.from([0x01, 0x00]));
    if (zip64 >= 0 && zip64 + 24 <= extra.length) {
      uncompSize = Number(extra.readBigUInt64LE(zip64 + 4));
      compSize = Number(extra.readBigUInt64LE(zip64 + 12));
    }
  }
  const dataStart = extraStart + extraLen;
  const comprimido = buf.subarray(dataStart, dataStart + compSize);
  let datos = null;
  if (metodo === 0) datos = Buffer.from(comprimido);
  else if (metodo === 8) {
    try {
      datos = inflateRawSync(comprimido);
    } catch {
      try {
        datos = inflateSync(comprimido);
      } catch {
        datos = null;
      }
    }
  }
  return { name, datos, next: dataStart + compSize };
}

/** Lee entradas de un ZIP (DOCX), priorizando el directorio central (Word suele usar ZIP64). */
export function leerEntradasZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const archivos = new Map();
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return archivos;

  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) !== 0x06054b50) continue;
    const cdOffset = buf.readUInt32LE(i + 16);
    let p = cdOffset;
    while (p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50) {
      const metodo = buf.readUInt16LE(p + 10);
      let compSize = buf.readUInt32LE(p + 20);
      let uncompSize = buf.readUInt32LE(p + 24);
      const nameLen = buf.readUInt16LE(p + 28);
      const extraLen = buf.readUInt16LE(p + 30);
      const commentLen = buf.readUInt16LE(p + 32);
      const localOffset = buf.readUInt32LE(p + 42);
      const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
      const extra = buf.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
      const zip64 = extra.indexOf(Buffer.from([0x01, 0x00]));
      if (zip64 >= 0 && zip64 + 24 <= extra.length) {
        uncompSize = Number(extra.readBigUInt64LE(zip64 + 4));
        compSize = Number(extra.readBigUInt64LE(zip64 + 12));
      }
      p += 46 + nameLen + extraLen + commentLen;
      const local = leerEntradaLocal(buf, localOffset);
      if (local?.datos) archivos.set(name, local.datos);
      else if (metodo === 8 && compSize > 0) {
        const nl = buf.readUInt16LE(localOffset + 26);
        const el = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + nl + el;
        try {
          archivos.set(name, inflateRawSync(buf.subarray(dataStart, dataStart + compSize)));
        } catch {
          try {
            archivos.set(name, inflateSync(buf.subarray(dataStart, dataStart + compSize)));
          } catch {
            /* ilegible */
          }
        }
      }
    }
    break;
  }

  if (archivos.size === 0) {
    let o = 0;
    while (o + 30 <= buf.length) {
      if (buf.readUInt32LE(o) !== 0x04034b50) break;
      const entrada = leerEntradaLocal(buf, o);
      if (!entrada) break;
      if (entrada.datos) archivos.set(entrada.name, entrada.datos);
      o = entrada.next;
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

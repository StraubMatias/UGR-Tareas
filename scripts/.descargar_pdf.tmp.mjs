import { readFileSync, writeFileSync } from 'node:fs';
import { crearJarCookies, cookiesAJSON } from './ugr-sync/lib/autenticar.mjs';

process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');

const jar = crearJarCookies([]);
const archivo = '/home/matute/tareasUGR/data/ugr-sesion.json';
try {
  const guardado = JSON.parse(readFileSync(archivo, 'utf8'));
  for (const [k, v] of guardado.cookies ?? []) jar.set(k, v);
} catch {}

const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function getBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; tareasUGR-sync/0.1)', Cookie: cookie },
    redirect: 'follow'
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, finalUrl: res.url };
}

const pdfUrl = 'https://virtual.ugr.edu.ar/pluginfile.php/587856/mod_resource/content/2/396_22%20AUDITOR%C3%8DAS%20DE%20SEGURIDAD%20DE%20LA%20INFORMACI%C3%93N%201%C2%B0A%C3%91O%202%C2%B0cuatri%20TEC.CIBER.pdf';
const pdf = await getBuffer(pdfUrl);
writeFileSync('/tmp/programa_auditorias2.pdf', pdf.buf);
console.log('status', pdf.status, 'bytes', pdf.buf.length, 'head', pdf.buf.slice(0, 30).toString('latin1'));
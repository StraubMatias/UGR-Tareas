import { conectarUGR } from './ugr-sync/lib/sync-core.mjs';
import { writeFileSync } from 'node:fs';

process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const cliente = await conectarUGR();

const urls = [
  ['/tmp/metodologia_auditorias.docx', '/pluginfile.php/459683/mod_resource/content/1/Auditor%C3%ADas%20de%20SI%2C%20Metodolog%C3%ADa..docx'],
  ['/tmp/diagrama_contenidos.docx', '/pluginfile.php/621990/mod_resource/content/1/AUDITORIAS-Diagramaci%C3%B3n%20contenidos.%20MARTES%202026.docx']
];

for (const [destino, ruta] of urls) {
  const r = await cliente.pedir(ruta);
  console.log(destino, 'status', r.status, 'bytes', r.html.length, 'head', r.html.slice(0, 4));
  writeFileSync(destino, r.html);
}
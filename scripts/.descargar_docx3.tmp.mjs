import { writeFileSync } from 'node:fs';
import { crearCliente } from './ugr-sync/lib/red.mjs';
import { UGR_BASE_URL } from './ugr-sync/lib/constantes.mjs';
import { cabeceraCookies } from './ugr-sync/lib/autenticar.mjs';

process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');

const cliente = await crearCliente({
  usuario: process.env.UGRVIRTUAL_USER,
  contrasena: process.env.UGRVIRTUAL_PASSWORD
});

async function bajar(ruta, destino) {
  const url = new URL(ruta, UGR_BASE_URL).toString();
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (tareasUGR-sync/0.1)', Cookie: cabeceraCookies(cliente.jar) },
    redirect: 'manual'
  });
  const buf = Buffer.from(await resp.arrayBuffer());
  writeFileSync(destino, buf);
  console.log(destino, 'status', resp.status, 'bytes', buf.length, 'head', buf.slice(0, 4).toString('latin1'));
}

await bajar('/pluginfile.php/459683/mod_resource/content/1/Auditor%C3%ADas%20de%20SI%2C%20Metodolog%C3%ADa..docx', '/tmp/metodologia_auditorias.docx');
await bajar('/pluginfile.php/621990/mod_resource/content/1/AUDITORIAS-Diagramaci%C3%B3n%20contenidos.%20MARTES%202026.docx', '/tmp/diagrama_contenidos.docx');
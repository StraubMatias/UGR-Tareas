import { conectarUGR } from './ugr-sync/lib/sync-core.mjs';
import { writeFileSync } from 'node:fs';

process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const cliente = await conectarUGR();

for (const id of [341657, 341658, 344450, 337190]) {
  const r = await cliente.pedir(`/mod/url/view.php?id=${id}`);
  console.log(`\n== id=${id} status=${r.status} len=${r.html.length} login=${r.es_requiere_login}`);
  writeFileSync(`/tmp/url_${id}.html`, r.html);
  // buscar la url destino del recurso URL (dentro de mod/url, export o la url externa)
  const m = r.html.match(/<div class="url_link">[\s\S]*?<a[^>]*href="([^"]+)"|data-url="([^"]+)"|class="url_link[^"]*"[^>]*href="([^"]*)"/i);
  const m2 = r.html.match(/href="([^"]*?(?:meet|zoom|docs\.google|drive|youtube|calendar)[^"]*)"/i);
  console.log('destino url_link:', m ? (m[1] || m[2] || m[3]) : 'no encontrado');
  console.log('destino externo (meet/calendar):', m2 ? m2[1] : 'no encontrado');
}
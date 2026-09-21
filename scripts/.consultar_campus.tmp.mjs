import { conectarUGR } from './ugr-sync/lib/sync-core.mjs';
import { writeFileSync } from 'node:fs';

process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const cliente = await conectarUGR();

for (const id of [191643, 337263]) {
  const r = await cliente.pedir(`/mod/resource/view.php?id=${id}`);
  console.log(`\n== resource id=${id} status=${r.status} len=${r.html.length} login=${r.es_requiere_login}`);
  writeFileSync(`/tmp/resource_${id}.html`, r.html);
  const m = r.html.match(/href="([^"]*pluginfile[^"]*)"|<a[^>]*href="([^"]*)"[^>]*>Descargar/i);
  console.log('pluginfile:', m ? (m[1] || m[2]) : 'no');
}

// Export del calendario del curso en ICS
const r2 = await cliente.pedir('/calendar/export_execute.php?preset_what=course&preset_time=recentupcoming&course=1310');
console.log(`\n== calendar export status=${r2.status} len=${r2.html.length}`);
writeFileSync('/tmp/cal_export.ics', r2.html);
console.log(r2.html.slice(0, 600));
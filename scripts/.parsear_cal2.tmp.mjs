import { load } from 'cheerio';
import { readFileSync, writeFileSync } from 'node:fs';

for (const archivo of ['/tmp/calendario_auditorias_sep.html', '/tmp/auditorias_encuentros.html']) {
  const html = readFileSync(archivo, 'utf8');
  const $ = load(html);
  const eventos = [];
  $('[data-event-id]').each((_, el) => {
    const n = $(el);
    const titulo = n.attr('data-event-title') || n.find('.name, a').first().text().replace(/\s+/g, ' ').trim();
    const id = n.attr('data-event-id');
    const fechas = n.attr('data-event-times') || '';
    const cuando = n.attr('aria-label') || '';
    const cl = n.attr('class') || '';
    eventos.push({ id, titulo, fechas, cuando: cuando.slice(0, 200), cl });
  });
  writeFileSync(`${archivo}.eventos.json`, JSON.stringify(eventos, null, 2));
  console.log(`\n===== ${archivo}: ${eventos.length} data-event-id =====`);
  for (const e of eventos.slice(0, 80)) console.log('-', e.id, '|', e.titulo, '|', e.fechas, '|', e.cuando, '|', e.cl);
}
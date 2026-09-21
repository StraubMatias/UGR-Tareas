import { load } from 'cheerio';
import { readFileSync, writeFileSync } from 'node:fs';

for (const archivo of ['/tmp/calendario_auditorias_sep.html', '/tmp/auditorias_encuentros.html']) {
  const html = readFileSync(archivo, 'utf8');
  const $ = load(html);
  const resultado = [];
  $('.day, .day.hasevent, td.hasevent, tr.hasevent, [data-region="day-content"]').each((_, el) => {
    const n = $(el);
    const dia = n.attr('data-day');
    const ts = n.attr('data-day-timestamp');
    const tituloCelda = n.attr('data-title') || '';
    const eventosCelda = [];
    n.find('li[data-region="event-item"]').each((_, ev) => {
      const m = $(ev);
      const a = m.find('a[data-action="view-event"]').first();
      const title = a.attr('title') || a.attr('data-event-title') || a.text().replace(/\s+/g, ' ').trim();
      const url = a.attr('href') || '';
      const id = a.attr('data-event-id') || '';
      const component = m.attr('data-event-component') || '';
      const etype = m.attr('data-event-eventtype') || '';
      eventosCelda.push({ id, title, url, component, etype });
    });
    if (eventosCelda.length > 0 && dia) {
      resultado.push({ dia, ts, tituloCelda, eventos: eventosCelda });
    }
  });
  writeFileSync(`${archivo}.celdas.json`, JSON.stringify(resultado, null, 2));
  console.log(`\n===== ${archivo}: ${resultado.length} días con eventos =====`);
  for (const r of resultado) {
    console.log(`\nDIA ${r.dia} (${r.tituloCelda}):`);
    for (const e of r.eventos) console.log('   -', e.id || e.component, '|', e.title, '|', e.url);
  }
}
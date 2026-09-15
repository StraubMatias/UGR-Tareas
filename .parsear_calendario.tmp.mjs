import { load } from 'cheerio';
import { readFileSync } from 'node:fs';

const html = readFileSync('/tmp/calendario_auditorias_sep.html', 'utf8');
const $ = load(html);

// Buscar elementos con data-event-id / data-event-title
const eventos = [];
$('[data-event-id]').each((_, el) => {
  const titulo = $(el).attr('data-event-title') || $(el).find('.name, a').first().text().replace(/\s+/g, ' ').trim();
  const id = $(el).attr('data-event-id');
  const fechas = $(el).attr('data-event-times') || '';
  const cuando = $(el).attr('aria-label') || '';
  const clase = $(el).attr('class') || '';
  eventos.push({ id, titulo, fechas, cuando, clase });
});

console.log('EVENTOS data-event-id:', eventos.length);
for (const e of eventos.slice(0, 60)) {
  console.log('-', e.id, '|', e.titulo, '|', e.fechas, '|', e.cuando.slice(0, 120), '|', e.clase);
}

// Alternativa: los eventos se renderizan como <a> con href a view.php?view=day&event_id
const links = [];
$('a[href*="event_id="], a[href*="view=day"]').each((_, el) => {
  const h = $(el).attr('href') || '';
  const t = $(el).text().replace(/\s+/g, ' ').trim();
  const m = h.match(/event_id=(\d+)/);
  if (m && t) links.push({ id: m[1], t, h });
});
console.log('\nLINKS a eventos:', links.length);
for (const l of links.slice(0, 60)) console.log('-', l.id, '|', l.t, '|', l.h);
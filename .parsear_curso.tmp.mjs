import { load } from 'cheerio';
import { readFileSync } from 'node:fs';

const html = readFileSync('/tmp/curso_auditorias.html', 'utf8');
const $ = load(html);

console.log('== CUALQUIER enlace con .doc/.docx/.xls ==');
$('a[href*="pluginfile"], a[href*="mod/resource"]').each((_, el) => {
  const href = $(el).attr('href') || '';
  const texto = $(el).text().replace(/\s+/g, ' ').trim();
  if (/\.(docx?|xlsx?|pptx?|pdf)/i.test(href)) console.log('-', texto, '=>', href);
});

console.log('\n== Secciones del curso ==');
$('.sectionname, .section-title, [data-region="section"] h3').each((_, el) => {
  const t = $(el).text().replace(/\s+/g, ' ').trim();
  if (t) console.log('-', t);
});
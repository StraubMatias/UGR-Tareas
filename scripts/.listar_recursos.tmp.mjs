import { load } from 'cheerio';
import { readFileSync } from 'node:fs';

const html = readFileSync('/tmp/curso_auditorias.html', 'utf8');
const $ = load(html);

console.log('== TODOS los enlaces mod del curso ==');
$('a[href*="/mod/"]').each((_, el) => {
  const href = $(el).attr('href') || '';
  const texto = $(el).text().replace(/\s+/g, ' ').trim();
  console.log(`- [${texto}] => ${href}`);
});
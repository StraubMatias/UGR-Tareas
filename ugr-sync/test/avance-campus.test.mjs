import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerItemsAvanceCampusDeHtml, urlNormalizadaCampus } from '../lib/avance-campus.mjs';

test('extraerItemsAvanceCampusDeHtml detecta recurso y finalización manual', () => {
  const html = `
    <div class="course-content">
      <li class="activity modtype_resource" data-id="100">
        <a class="activityname" href="/mod/resource/view.php?id=100">
          <span class="instancename">Teoría unidad 1</span>
        </a>
        <button type="button" aria-label="Marcar Teoría unidad 1 como hecho">○</button>
      </li>
      <li class="activity modtype_page" data-id="101">
        <a class="aalink" href="/mod/page/view.php?id=101"><span class="instancename">Guía</span></a>
        <button type="button" aria-label="Guía completado">✓</button>
      </li>
    </div>`;
  const items = extraerItemsAvanceCampusDeHtml(html, 'https://virtual.ugr.edu.ar');
  assert.equal(items.length, 2);
  assert.equal(items[0].cmid, '100');
  assert.equal(items[0].completada, false);
  assert.equal(items[1].completada, true);
});

test('urlNormalizadaCampus extrae cmid', () => {
  assert.equal(
    urlNormalizadaCampus('https://virtual.ugr.edu.ar/mod/resource/view.php?id=42'),
    'cmid:42'
  );
});

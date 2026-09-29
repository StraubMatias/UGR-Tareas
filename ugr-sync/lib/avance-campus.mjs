// Lecturas y recursos del curso con seguimiento de finalización (marcar como hecho en Moodle).
import { load } from 'cheerio';
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';
import { idsSeccionesDeCurso } from './tareas.mjs';
import { limpiarTextoParaBusqueda, parsearUnidadMoodle } from './normalizar.mjs';

const MODULOS_IGNORADOS = new Set(['label', 'subsection']);

function limpiarTexto(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function completarUrl(href, baseUrl) {
  if (!href) return '';
  try {
    return new URL(href, baseUrl || undefined).toString();
  } catch {
    return href;
  }
}

function tituloDeEnlace($, enlace) {
  const $a = $(enlace);
  const instancia = $a.find('.instancename').first();
  if (instancia.length) {
    return limpiarTexto(instancia.clone().children('.accesshide').remove().end().text());
  }
  return limpiarTexto($a.text());
}

function completadaEnActividad($, actividad) {
  const $act = $(actividad);
  if ($act.find('.completion-auto-yes, .autocompletion .fa-check, i.fa-check.text-success').length) return true;
  if ($act.find('[data-completion-state="1"], [data-completion="1"]').length) return true;
  const btn = $act
    .find(
      'button[data-action="toggle-manual-completion"], [data-action="toggle-manual-completion"], form.togglecompletion button, button[aria-label]'
    )
    .first();
  const label = `${btn.attr('aria-label') || ''} ${btn.attr('title') || ''}`.toLowerCase();
  if (/marcar\b[\s\S]*\bcomo\b|sin marcar|no completad/.test(label)) return false;
  if ((/completad|hech|realizad/.test(label) || /\bcompletado\b|\bhecho\b/.test(label)) && !/no completad/.test(label)) {
    return true;
  }
  const img = $act.find('img[alt*="Complet"], img[alt*="complet"]').attr('alt') || '';
  if (/completad|hech/i.test(img) && !/no completad/i.test(img)) return true;
  return false;
}

function unidadDeContenedor($, contenedor) {
  const seccion = $(contenedor).closest('[data-section], .course-section, .section');
  const titulo = limpiarTexto(
    seccion.find('.sectionname, [data-region="section-title"]').first().text()
  );
  return parsearUnidadMoodle(titulo);
}

/** Parsea li.activity / .activity-item de una página de curso o sección. */
export function extraerItemsAvanceCampusDeHtml(html, baseUrl = UGR_BASE_URL) {
  if (!html) return [];
  const $ = load(html);
  const items = [];
  const vistos = new Set();

  const registrar = (contenedor, enlace, orden) => {
    const href = $(enlace).attr('href') || '';
    const match = href.match(/\/mod\/([^/]+)\/view\.php\?id=(\d+)/i);
    if (!match) return;
    const modulo = match[1].toLowerCase();
    if (MODULOS_IGNORADOS.has(modulo)) return;
    const cmid = match[2];
    if (vistos.has(cmid)) return;
    vistos.add(cmid);
    const titulo = tituloDeEnlace($, enlace);
    if (!titulo || titulo.length < 2) return;
    items.push({
      cmid,
      modulo,
      titulo,
      url: completarUrl(href, baseUrl),
      completada: completadaEnActividad($, contenedor),
      orden,
      unidad: unidadDeContenedor($, contenedor)
    });
  };

  let orden = 0;
  $('li.activity, .activity-item').each((_, el) => {
    const link = $(el).find('a.activityname[href*="/mod/"], a.aalink[href*="/mod/"]').first();
    if (!link.length) return;
    if ($(el).closest('nav, .footer, [role="navigation"]').length) return;
    registrar(el, link.get(0), orden);
    orden += 1;
  });

  return items;
}

function fusionarItems(listas) {
  const porCmid = new Map();
  for (const lista of listas) {
    for (const item of lista || []) {
      const prev = porCmid.get(item.cmid);
      if (!prev || item.orden < prev.orden) porCmid.set(item.cmid, item);
      else if (item.completada) {
        porCmid.set(item.cmid, { ...prev, completada: true });
      }
    }
  }
  return [...porCmid.values()].sort((a, b) => a.orden - b.orden);
}

async function pedirHtml(cliente, ruta) {
  try {
    const pagina = await cliente.pedir(ruta);
    if (!pagina?.html || pagina.es_requiere_login) return '';
    return pagina.html;
  } catch {
    return '';
  }
}

export async function recolectarItemsAvanceCampusDeCurso(cliente, cursoId) {
  if (!cliente || !cursoId) return [];
  const rutaBase = UGR_RUTAS.curso(cursoId);
  const htmlMain = await pedirHtml(cliente, rutaBase);
  let items = extraerItemsAvanceCampusDeHtml(htmlMain);
  const secciones = idsSeccionesDeCurso(htmlMain).slice(0, 14);
  if (secciones.length) {
    const htmls = await Promise.all(
      secciones.map((seccion) => pedirHtml(cliente, `${rutaBase}&section=${seccion}`))
    );
    items = fusionarItems([items, ...htmls.map((html) => extraerItemsAvanceCampusDeHtml(html))]);
  }
  return items;
}

export async function sincronizarAvanceCampusEnMaterias({ cliente, db, mapeos, alumnoId }) {
  if (!cliente || !db || !alumnoId || !mapeos?.length) return { items: 0 };
  const ahora = new Date().toISOString();
  let total = 0;
  for (const { curso, coincidencia } of mapeos) {
    const materiaId = coincidencia?.materia?.id;
    const cursoId = curso?.id;
    if (!materiaId || !cursoId) continue;
    const items = await recolectarItemsAvanceCampusDeCurso(cliente, cursoId);
    for (const item of items) {
      const id = `ac_${alumnoId}_${materiaId}_${item.cmid}`;
      await db.execute({
        sql: `INSERT INTO avance_campus_recursos (
                id, alumno_id, materia_id, cmid, modulo, titulo, url, unidad, orden, completada, sincronizado_en
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(alumno_id, materia_id, cmid) DO UPDATE SET
                modulo = excluded.modulo,
                titulo = excluded.titulo,
                url = excluded.url,
                unidad = excluded.unidad,
                orden = excluded.orden,
                completada = excluded.completada,
                sincronizado_en = excluded.sincronizado_en`,
        args: [
          id,
          alumnoId,
          materiaId,
          item.cmid,
          item.modulo,
          item.titulo,
          item.url,
          item.unidad == null ? null : String(item.unidad),
          item.orden,
          item.completada ? 1 : 0,
          ahora
        ]
      });
      total += 1;
    }
  }
  return { items: total };
}

/** Normaliza URL para comparar con tareas del tablero. */
export function urlNormalizadaCampus(url) {
  const crudo = String(url || '');
  const match = crudo.match(/view\.php\?id=(\d+)/i);
  if (match) return `cmid:${match[1]}`;
  return limpiarTextoParaBusqueda(crudo);
}

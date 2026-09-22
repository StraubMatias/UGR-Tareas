// Parser de la lista de cursos/materias del usuario en Moodle.
// Los cursos aparecen en dos lugares:
//   1. Como enlaces a /course/view.php?id=N (visión clásica de /course/index.php
//      o del bloque "Mis cursos").
//   2. Como <option value="ID"> dentro de los selects de filtro de cursos del
//      tema (p. ej. el filtro del calendario). En ese caso Moodle puede servir
//      el nombre truncado (termina en "...") — ver extraerNombreCursoDesdePagina.
import { load } from 'cheerio';
import { UGR_BASE_URL } from './constantes.mjs';

const TITULOS_NO_CURSOS = ['mis cursos', 'todos los cursos', 'dashboard', 'panel'];

export function extraerSesskey(html) {
  const texto = String(html || '');
  const cfg = texto.match(/["']sesskey["']\s*:\s*["']([^"']+)["']/);
  if (cfg) return cfg[1];
  const input = texto.match(/name="sesskey"[^>]*value="([^"]+)"/i) || texto.match(/value="([^"]+)"[^>]*name="sesskey"/i);
  return input?.[1] || null;
}

export function extraerUserid(html) {
  const texto = String(html || '');
  const cfg = texto.match(/["']userid["']\s*:\s*(\d+)/);
  return cfg?.[1] && cfg[1] !== '0' && cfg[1] !== '1' ? cfg[1] : null;
}

export function esCursoOrganizativo(nombre) {
  const n = String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n) return true;
  if (TITULOS_NO_CURSOS.some((titulo) => n === titulo || n.includes(titulo))) return true;
  if (n.includes('mi carrera')) return true;
  if (n.includes('espacio de')) return true;
  if (/^ingreso\b/.test(n)) return true;
  return false;
}

export function extraerCursosDeAjax(payload) {
  const bloques = Array.isArray(payload) ? payload : [payload];
  const cursos = [];
  for (const bloque of bloques) {
    if (bloque?.error) continue;
    const data = bloque?.data;
    const lista = Array.isArray(data?.courses)
      ? data.courses
      : Array.isArray(data)
        ? data
        : Array.isArray(bloque?.courses)
          ? bloque.courses
          : [];
    for (const curso of lista) {
      const id = String(curso?.id || '');
      const nombre = String(curso?.fullname || curso?.shortname || '').replace(/\s+/g, ' ').trim();
      if (!id || !/^\d+$/.test(id) || id === '1' || !nombre || esCursoOrganizativo(nombre)) continue;
      cursos.push({
        id,
        nombre,
        nombreIncompleto: esNombreIncompleto(nombre),
        url: curso.viewurl || `/course/view.php?id=${id}`,
        enddate: Number(curso.enddate || 0) || 0,
        timeaccess: Number(curso.timeaccess || 0) || 0
      });
    }
  }
  return cursos;
}

function esNombreIncompleto(nombre) {
  return /\.\.\.$|…$/.test(String(nombre).trim());
}

function completarUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

export function extraerCursos(html, baseUrl = UGR_BASE_URL) {
  const $ = load(html);
  const cursos = [];
  const porId = new Map();

  function agregar(curso) {
    const existente = porId.get(curso.id);
    if (existente) {
      // Si el duplicado trae nombre completo y el que ya teníamos no, lo reemplazamos.
      if (existente.nombreIncompleto && !curso.nombreIncompleto) {
        porId.set(curso.id, curso);
        cursos[existente.indice] = curso;
      }
      return;
    }
    porId.set(curso.id, { ...curso, indice: cursos.length });
    cursos.push(curso);
  }

  // 1) Enlaces directos a la vista del curso.
  $('a[href*="course/view.php?id="]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/[?&]id=(\d+)/);
    if (!m) return;
    const id = m[1];

    const nombre = (
      $(el).attr('title')
      || $(el).attr('aria-label')
      || $(el).find('span').first().text()
      || $(el).text()
    ).replace(/\s+/g, ' ').trim();

    if (!nombre || esCursoOrganizativo(nombre)) return;

    agregar({ id, nombre, nombreIncompleto: esNombreIncompleto(nombre), url: completarUrl(href, baseUrl) });
  });

  // Moodle 4: tarjetas de «Mis cursos» / dashboard (`data-course-id`).
  $('[data-course-id]').each((_, el) => {
    const id = String($(el).attr('data-course-id') || '');
    if (!/^\d+$/.test(id) || id === '1') return;
    const nombre = (
      $(el).find('.coursename, .multiline, .course-title, [data-region="name"]').first().text()
      || $(el).attr('data-course-name')
      || $(el).find('a[href*="course/view.php"]').first().text()
      || $(el).text()
    ).replace(/\s+/g, ' ').trim();
    if (!nombre || esCursoOrganizativo(nombre)) return;
    agregar({ id, nombre, nombreIncompleto: esNombreIncompleto(nombre), url: completarUrl(`/course/view.php?id=${id}`, baseUrl) });
  });

  // 2) Selectores de cursos del tema (p. ej. el filtro del calendario):
  //    options cuyo value es el id del curso (numérico, no "1" ni categorías).
  $('option').each((_, el) => {
    const value = $(el).attr('value') || '';
    if (!/^\d+$/.test(value) || value === '1') return;
    const nombre = $(el).text().replace(/\s+/g, ' ').trim();
    if (!nombre || esCursoOrganizativo(nombre)) return;
    const id = value;
    if (porId.has(id)) return; // ya vino por enlace directo (mejor nombre)
    agregar({
      id,
      nombre,
      nombreIncompleto: esNombreIncompleto(nombre),
      url: completarUrl(`/course/view.php?id=${id}`, baseUrl)
    });
  });

  return cursos;
}

// Extrae el nombre completo de un curso desde su página (/course/view.php?id=N).
// Moodle sirve ahí el nombre sin truncar, en el breadcrumb (title del enlace al
// propio curso) o en <title>/og:title con formato «Sección | Nombre | Sitio».
// Como la página tiene varios enlaces al propio curso (botón "Este curso",
// unidades, breadcrumb), elegimos el title más largo e informativo.
export function extraerNombreCursoDesdePagina(html, cursoId) {
  if (!html) return '';

  const $ = load(html);
  const basura = TITULOS_NO_CURSOS.concat(['este curso', 'curso', 'ver curso']);

  // Breadcrumb u otros enlaces al curso con atributo title.
  let mejor = '';
  $(`a[href*="course/view.php?id=${cursoId}"]`).each((_, el) => {
    const titulo = ($(el).attr('title') || '').replace(/\s+/g, ' ').trim();
    if (!titulo) return;
    const tl = titulo.toLowerCase();
    if (basura.some((b) => tl === b || tl.startsWith(`${b} `))) return;
    if (titulo.length > mejor.length) mejor = titulo;
  });
  if (mejor) return mejor;

  // Fallback: <title> u og:title → «Sección | NOMBRE DEL CURSO | Sitio».
  const titulo = $(`meta[property="og:title"]`).attr('content')
    || $(`meta[name="twitter:title"]`).attr('value')
    || $('title').text();
  const partes = String(titulo).split('|').map((p) => p.trim()).filter(Boolean);
  if (partes.length >= 2) return partes[partes.length - 2];
  return String(titulo).trim();
}
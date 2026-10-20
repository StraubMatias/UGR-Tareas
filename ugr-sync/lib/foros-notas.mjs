/**
 * Notas de foros calificados de UGR Virtual.
 *
 * Los foros con calificación (ej. «Hallazgos de la Semana» de Gestión de Activos)
 * no muestran la nota en el índice del foro: cada publicación se califica por
 * separado y Moodle la publica en `span.ratingaggregate` dentro del post, junto
 * a «Calificación máxima». La tarea del tablero apunta al índice
 * (`/mod/forum/view.php?id=N`), así que hay que:
 *   1. abrir el índice y localizar las discusiones;
 *   2. abrir la discusión donde publicó el alumno;
 *   3. tomar la nota de su publicación, identificándolo por su id de usuario.
 *
 * El id de usuario sale de la sesión del campus (`data-userid` en la barra
 * superior), que es el mismo para el alumno que sincroniza y para el admin.
 */
import { load } from 'cheerio';

const RE_FORO_INDEX = /\/mod\/forum\/view\.php\?id=(\d+)/i;
const RE_DISCUSION = /\/mod\/forum\/discuss\.php\?d=(\d+)/i;

function limpiarTexto(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function idDeUsuario(href) {
  return (String(href || '').match(/[?&]id=(\d+)/)?.[1]) || null;
}

function normalizarNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Id de usuario de la sesión con la que se está mirando el foro. */
export function extraerIdDeUsuarioSesion(html) {
  const $ = load(html || '');
  const candidatos = [
    $('[data-userid]').first().attr('data-userid'),
    $('body').attr('data-userid')
  ].filter(Boolean);
  for (const valor of candidatos) {
    const id = String(valor).trim();
    if (/^\d+$/.test(id) && id !== '0') return id;
  }
  const delTexto = String(html || '').match(/"userid"\s*:\s*"?(\d+)"?/);
  return delTexto?.[1] || null;
}

/** Discusiones del foro con su autor: [{ id, titulo, autor, autorId }]. */
export function extraerDiscusionesConAutor(html) {
  const $ = load(html || '');
  const discusiones = [];
  const vistos = new Set();
  $('a[href*="mod/forum/discuss.php"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const id = (href.match(RE_DISCUSION) || [])[1];
    if (!id || vistos.has(id)) return;
    const titulo = limpiarTexto($(el).text()) || limpiarTexto($(el).attr('title') || '');
    if (!titulo) return;
    const fila = $(el).closest('tr, .discussion');
    const enlaceAutor = fila.find('td.author a, .author a, [data-region="author-name"], a[href*="user/view.php"]').first();
    const autorId = idDeUsuario(enlaceAutor.attr('href'));
    const autor = limpiarTexto(enlaceAutor.text());
    vistos.add(id);
    discusiones.push({ id, titulo, autor: autor || null, autorId });
  });
  return discusiones;
}

/**
 * Notas publicadas de una discusión.
 * Solo cuentan las publicaciones con nota: un `span.ratingaggregate` vacío
 * (respuesta del profesor, o post sin calificar) no es una nota.
 * @returns Array<{ postId, autor, autorId, nota }>
 */
export function extraerNotasDePublicaciones(html) {
  const $ = load(html || '');
  const notas = [];
  const vistos = new Set();
  $('article.forum-post-container, .forumpost[data-post-id]').each((_, post) => {
    const postId = String($(post).attr('data-post-id') || '').trim();
    const clave = postId || `texto:${limpiarTexto($(post).text()).slice(0, 80)}`;
    if (vistos.has(clave)) return;
    const rating = $(post).find('.ratingaggregate').first();
    const textoRating = limpiarTexto(rating.text());
    if (!textoRating) return;
    const nota = Number(textoRating.replace(',', '.'));
    if (!Number.isFinite(nota)) return;
    const enlaceAutor = $(post).find('a[href*="user/view.php"]').first();
    const autorId = idDeUsuario(enlaceAutor.attr('href'));
    const autor = limpiarTexto(enlaceAutor.text());
    vistos.add(clave);
    notas.push({ postId: postId || null, autor: autor || null, autorId, nota });
  });
  return notas;
}

/** ¿La URL del tablero es el índice de un foro? */
export function esIndiceDeForo(url) {
  return RE_FORO_INDEX.test(String(url || ''));
}

/**
 * Nota del alumno en un foro calificado.
 * Recorre las discusiones del foro buscando la publicación del alumno.
 * @param {object} opciones
 * @param {string} opciones.url Índice del foro (/mod/forum/view.php?id=N)
 * @param {number|string|null} opciones.autorId id de usuario en el campus
 * @param {string|null} opciones.autor nombre visible del alumno
 */
export async function buscarNotaEnForo(cliente, { url, autorId = null, autor = null, maxDiscusiones = 60 } = {}) {
  const vacio = { nota: null, postId: null, titulo: '', discusionId: null };
  if (!cliente || !url) return vacio;
  const idForo = (String(url).match(RE_FORO_INDEX) || [])[1];
  if (!idForo) return vacio;

  const indice = await cliente.pedir(url);
  if (!indice?.html || indice.es_requiere_login) return vacio;

  const idSesion = autorId || extraerIdDeUsuarioSesion(indice.html);
  const discusiones = extraerDiscusionesConAutor(indice.html);
  if (discusiones.length === 0) return vacio;

  // Primero las discusiones donde el alumno es el autor del hilo.
  const propias = discusiones.filter((d) => {
    if (idSesion && d.autorId) return String(d.autorId) === String(idSesion);
    if (autor && d.autor) return normalizarNombre(d.autor) === normalizarNombre(autor);
    return false;
  });
  const candidatas = [...propias, ...discusiones].slice(0, Math.max(1, maxDiscusiones));

  for (const discusion of candidatas) {
    let pagina;
    try {
      pagina = await cliente.pedir(`/mod/forum/discuss.php?d=${discusion.id}`);
    } catch {
      continue;
    }
    if (!pagina?.html) continue;
    const notas = extraerNotasDePublicaciones(pagina.html);
    if (notas.length === 0) continue;
    const propia = notas.find((n) => {
      if (idSesion && n.autorId) return String(n.autorId) === String(idSesion);
      if (autor && n.autor) return normalizarNombre(n.autor) === normalizarNombre(autor);
      return false;
    });
    if (propia) {
      return {
        nota: propia.nota,
        postId: propia.postId,
        titulo: discusion.titulo,
        discusionId: discusion.id
      };
    }
  }

  return vacio;
}

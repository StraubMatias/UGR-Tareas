// Detección del equipo docente de un curso para el sync de avisos.
// El sync publica SOLO anuncios del profesorado (nunca preguntas ni comentarios
// de compañeros). El autor de un hilo es «docente» si su nombre aparece en el
// resumen de la página del curso (extraerDocentesDeCurso) o si el rol de su
// perfil en el curso lo acredita (esEquipoDocente).
import { load } from 'cheerio';
import { limpiarTextoParaBusqueda } from './normalizar.mjs';

// Roles docentes tal como los renderiza UGR Virtual en el perfil del usuario
// (bloque «Roles»): Profesor Titular, Profesor Adjunto, JTP, Adscripto a la
// docencia, Tutor/a de Prácticas, Equipo de gestión, …
const PATRONES_ROL_DOCENTE = [
  /profesor/,
  /adjunto/,
  /titular/,
  /jtp/,
  /adscripto/,
  /docente/,
  /tutor/,
  /equipo de gesti/,
  /coordinador/
];

// Roles de estudiantado / no docentes: si el perfil muestra SOLO estos, el autor
// no es del equipo docente.
const PATRONES_ROL_ALUMNO = [
  /estudiante/,
  /alumno/,
  /invitado/,
  /usuario identificado/
];

export function normalizarNombrePersona(nombre) {
  return limpiarTextoParaBusqueda(nombre);
}

// Extrae el equipo docente que la página del curso (course/view.php) lista en el
// resumen de la primera sección: enlaces a user/view.php dentro de summarytext.
// Devuelve [{ userId, nombre }] sin duplicados.
export function extraerDocentesDeCurso(html, baseUrl = '') {
  const $ = load(html || '');
  const docentes = [];
  const vistos = new Set();

  const selector =
    '[data-for="sectioninfo"] a[href*="user/view.php"], ' +
    '.summarytext a[href*="user/view.php"], ' +
    '[data-section="0"] a[href*="user/view.php"]';
  $(selector).each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const matchId = href.match(/[?&]id=(\d+)/);
    const userId = matchId ? matchId[1] : '';
    const nombre = String($a.text()).replace(/\s+/g, ' ').trim();
    if (nombre.length < 3) return; // sin texto (avatar decorativo) o vacío.

    const clave = userId || normalizarNombrePersona(nombre);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    docentes.push({ userId, nombre });
  });

  return docentes;
}

// ¿El perfil (user/view.php) de un usuario corresponde al equipo docente del
// curso? Usa el bloque «Roles» del perfil. Devuelve true/false, o null si la
// página no trae ese bloque (no se puede afirmar nada).
export function esEquipoDocente(html) {
  const $ = load(html || '');
  const dt = $('dt')
    .filter((_, el) => limpiarTextoParaBusqueda($(el).text()) === 'roles')
    .first();
  const dd = dt.next('dd');
  if (!dd.length) return null;

  const roles = limpiarTextoParaBusqueda(dd.text());
  if (PATRONES_ROL_DOCENTE.some((p) => p.test(roles))) return true;
  if (PATRONES_ROL_ALUMNO.some((p) => p.test(roles))) return false;
  return null; // roles sin clasificar (p. ej. solo «Invitado» con contexto raro).
}
// Detección de avisos en los foros informativos del campus (Avisos, Novedades,
// Consultas…) y análisis del texto de cada hilo para sugerir eventos espontáneos
// (clases de consulta, exámenes, entregas, exposiciones) al cronograma.
// El sync SOLO propone: cada aviso queda 'pendiente' y pasa a la campana y al
// cronograma únicamente cuando el admin lo aprueba en el modal de sincronización.
//
// Regla de negocio confirmada: se procesan avisos publicados desde hace
// DIAS_HACIA_ATRAS días hacia adelante (DIAS_HACIA_ATRAS = 7), es decir los que
// anuncian cosas del día actual o en adelante. Los hilos más viejos y los
// eventos cuya fecha ya pasó se ignoran.
import { load } from 'cheerio';
import {
  limpiarTextoParaBusqueda,
  parsearFechaMoodle,
  parsearUnidadMoodle
} from './normalizar.mjs';

// Ventana de publicación del sync de avisos: se procesan los hilos publicados
// desde esta cantidad de días atrás hacia adelante. El caso típico es un aviso
// del jueves que anuncia un encuentro/entrega del martes siguiente.
export const DIAS_HACIA_ATRAS = 7;

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

// Foros «informativos»: son justamente los que interesa escudriñar en busca de
// avisos (es el complemento de esForoInformativo de tareas.mjs, que los descarta
// como consignas para el tablero de tareas).
const PATRONES_FORO_DE_AVISOS = [
  /^(avisos?|novedades?|noticias?|anuncios?|comunicados?)$/,
  /consulta(s)?/,
  /^foro\s+(general|principal)$/,
  // Avisos de organización: horarios de clases sincrónicas, encuentros, etc.
  /encuentr[oa]s?\s*(sincr|virtual)/,
  /horari[oa]\s+(de\s+)?encuentro/
];

export function esForoDeAvisos(nombre) {
  const n = limpiarTextoParaBusqueda(nombre);
  return PATRONES_FORO_DE_AVISOS.some((patron) => patron.test(n));
}

// Parser del índice de foros de un curso (/mod/forum/index.php?id=ID o la sección
// «Foros» del overview con expand[]=forum). Moodle renderiza una fila por foro
// con el enlace activityname a /mod/forum/view.php?id=N y la sección en `.small`.
// Devuelve todos los foros (con esAvisos) para que el caller decida cuáles leer.
export function extraerForosDelIndice(html, baseUrl = '') {
  const $ = load(html);
  const foros = [];
  const porId = new Map();

  $('tr[data-mdl-overview-cmid], tr').each((_, fila) => {
    const enlace = $(fila).find('a[href*="mod/forum/view.php"]').first();
    if (!enlace.length) return;
    const href = $(enlace).attr('href') || '';
    const matchId = href.match(/[?&]id=(\d+)/) || [null, $(fila).attr('data-mdl-overview-cmid')];
    if (!matchId[1] || porId.has(matchId[1])) return;
    porId.set(matchId[1], true);

    const celdaNombre = $(fila).find('td[data-mdl-overview-item="name"], td.cell.c0').first();
    const nombre = limpiarTexto($(enlace).text())
      || $(celdaNombre).attr('data-mdl-overview-value')
      || 'Foro sin nombre';

    let unidad = null;
    if (celdaNombre.length) {
      unidad = parsearUnidadMoodle(limpiarTexto($(celdaNombre).find('.small').first().text()));
    }

    foros.push({
      id: matchId[1],
      nombre,
      url: completarUrl(href, baseUrl) || completarUrl(`/mod/forum/view.php?id=${matchId[1]}`, baseUrl),
      unidad,
      esAvisos: esForoDeAvisos(nombre)
    });
  });

  return foros;
}

// Parser de la página de un foro (/mod/forum/view.php?id=N): lista las
// discusiones (hilos). Cubre la tabla clásica `discussionlist` y la lista de
// Moodle 4.x con filas `.discussion`, buscando enlaces a discuss.php.
export function extraerDiscusionesDeForo(html, baseUrl = '') {
  const $ = load(html);
  const discusiones = [];
  const vistos = new Set();

  $('a[href*="mod/forum/discuss.php"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const matchD = href.match(/[?&]d=(\d+)/);
    if (!matchD) return;
    const id = matchD[1];
    if (vistos.has(id)) return;
    vistos.add(id);

    const titulo = limpiarTexto($el.text()) || limpiarTexto($el.attr('title') || '');
    if (!titulo) return;

    const fila = $el.closest('tr, .discussion');
    const autor = limpiarTexto(
      fila.find('td.author a, .author a, [data-region="author-name"]').first().text()
    );
    const actualizado = limpiarTexto(fila.find('time[datetime]').first().attr('datetime') || '');

    discusiones.push({
      id,
      titulo,
      url: completarUrl(href, baseUrl),
      autor,
      actualizado: parsearFechaMoodle(actualizado) || null
    });
  });

  return discusiones;
}

// Parser de la página de una discusión (/mod/forum/discuss.php?d=N). El primer
// post del DOM es el que abre el hilo (el anuncio del profesor). Cada hilo = un
// aviso, así que se devuelve un solo post.
export function extraerPrimerPostDeHilo(html, baseUrl = '') {
  const $ = load(html);
  const post = $('article.forum-post-container, article.forumpost, .forum-post-container, [data-post-id], .forumpost').first();
  if (!post.length) return null;

  const id = post.attr('data-post-id') || '';
  const titulo = limpiarTexto(
    post.find('[data-region="post-subject"], [data-region-content="forum-post-core-subject"], h3[class*="subject"] a, .discussionname').first().text()
    || post.find('.subject a').first().text()
    || post.find('.subject').text()
    || post.find('h3').first().text()
  );
  const autor = limpiarTexto(
    post.find('[data-region="author-name"], [data-region-content="forum-post-core-subject"] ~ [data-region-content="author-name"], .author a').first().text()
    || post.find('a[href*="user/view.php"]').first().text()
    || post.find('.author').text()
  );
  // Id del perfil del autor (user/view.php?id=N): permite validar el rol del
  // autor contra su perfil cuando el autor no está en el resumen del curso.
  const enlaceAutor = post.find('a[href*="user/view.php"]').first();
  const matchAutorId = (enlaceAutor.attr('href') || '').match(/[?&]id=(\d+)/);
  const autorId = matchAutorId ? matchAutorId[1] : '';
  const fechaTexto = post.find('time[datetime]').first().attr('datetime')
    || limpiarTexto(post.find('time').first().text());
  // Cubre el layout clásico de Moodle y el de Moodle 4.5+ (class
  // `post-content-container` / data-region-content="forum-post-core").
  const bloqueContenido = post.find(
    '.post-content-container, [data-region="post-content"], [data-region-content="forum-post-core"], .posting, .content, .post-content'
  ).first();
  const contenido = limpiarTexto(bloqueContenido.text());
  const contenidoHtml = bloqueContenido.html() || '';
  const urlHilo = completarUrl(post.find('a[href*="discuss.php"]').first().attr('href'), baseUrl);

  if (!titulo && !contenido) return null;
  return {
    id,
    titulo,
    autor,
    autorId,
    fecha: parsearFechaMoodle(fechaTexto) || null,
    contenido,
    contenidoHtml,
    urlHilo
  };
}

// --- Análisis del texto de un aviso para sugerir un evento al cronograma ---

const MESES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12'
};

// Mapeo alineado con Date.getDay() de JavaScript (0=domingo).
const DIAS_SEMANA = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6
};

function hoyISO() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

export function sumarDias(fechaISO, cantidad) {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + cantidad);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// Recolecta TODAS las fechas de evento que menciona el texto, desde hoy hacia
// adelante (nunca del pasado), con la confianza según cómo viene escrita:
//   * «mañana» / «hoy» (confianza alta);
//   * día + mes [+ año] («21 de septiembre [de 2026]») o fecha numérica
//     («30/11/2026») (alta/media);
//   * día de la semana + número («el próximo viernes 18», «el martes 15») o día
//     de la semana a secas («el lunes que viene») (media).
// Devuelve [{ fecha, confianza, span, contexto }] ordenado por fecha. `span` es
// el fragmento de texto que disparó la fecha y `contexto` la ventana de texto
// que lo rodea: sirven para clasificar el tipo de evento por contexto.
function encontrarFechasPotenciales(texto, hoy) {
  // Limpieza que conserva los separadores numéricos (/ y -): a diferencia de
  // limpiarTextoParaBusqueda (que los convierte en espacios), acá preservamos
  // el formato «30/11/2026» para poder matchearlo.
  const limpiar = (t) => String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bde\s+el\b/g, 'del')
    .replace(/[^a-z0-9\-\/\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const textoLimpio = limpiar(texto);
  const anioActual = hoy.slice(0, 4);
  const hoyMedio = new Date(`${hoy}T12:00:00`);
  const resultados = [];
  const agregar = (fecha, confianza, span) => {
    if (fecha < hoy) return; // cosas ya pasadas: nunca se sugieren.
    if (resultados.some((r) => r.fecha === fecha)) return; // sin duplicados.
    // Contexto = ventana de texto alrededor de la fecha mencionada (los
    // avisos de Moodle suelen ser un párrafo largo sin oraciones separadas por
    // punto, así que la ventana local es más fiable para clasificar el tipo).
    const contexto = span
      ? (() => {
        const idx = textoLimpio.indexOf(span);
        if (idx < 0) return textoLimpio;
        const inicio = Math.max(0, idx - 50);
        const fin = Math.min(textoLimpio.length, idx + span.length + 60);
        return textoLimpio.slice(inicio, fin);
      })()
      : textoLimpio;
    resultados.push({ fecha, confianza, span: span || '', contexto });
  };

  let trabajar = textoLimpio;

  // «21 de septiembre [de 2026]» / «21 de septiembre»
  let porNombre;
  while ((porNombre = trabajar.match(/(?:el\s+)?(\d{1,2})\s+de\s+(?:del?\s+)?([a-z]+)(?:\s+de\s+(\d{4}))?/))) {
    const mes = MESES[porNombre[2]];
    if (mes) {
      agregar(`${porNombre[3] || anioActual}-${mes}-${porNombre[1].padStart(2, '0')}`, porNombre[3] ? 'alta' : 'media', porNombre[0]);
    }
    trabajar = trabajar.replace(porNombre[0], ' ');
  }

  // «30/11/2026» / «21-09-2026» / «21/09»
  let porNumero;
  while ((porNumero = trabajar.match(/(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?/))) {
    const dia = porNumero[1].padStart(2, '0');
    const mes = porNumero[2].padStart(2, '0');
    if (Number(porNumero[1]) >= 1 && Number(porNumero[1]) <= 31 && Number(porNumero[2]) >= 1 && Number(porNumero[2]) <= 12) {
      let anio = porNumero[3];
      if (anio && anio.length === 2) anio = `20${anio}`;
      agregar(`${anio || anioActual}-${mes}-${dia}`, porNumero[3] ? 'alta' : 'media', porNumero[0]);
    }
    trabajar = trabajar.replace(porNumero[0], ' ');
  }

  // «el próximo viernes 18», «el martes 15 a las 20:00», «este domingo 27»: el
  // número es el día del mes. Más preciso que solo el día de la semana cuando
  // el texto lo incluye. Si el día ya pasó en el mes actual, se interpreta como
  // del mes siguiente. («31 de febrero» es inválido: se descarta.)
  let diaConNumero;
  while ((diaConNumero = trabajar.match(/\b(?:el\s+|este\s+|proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d{1,2})\b/))) {
    const diaMes = Number(diaConNumero[2]);
    if (diaMes >= 1 && diaMes <= 31) {
      const candidato = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1, diaMes, 12, 0, 0);
      const valido = candidato.getDate() === diaMes;
      if (valido && candidato.getTime() < hoyMedio.getTime()) candidato.setMonth(candidato.getMonth() + 1);
      if (valido) {
        agregar(
          `${candidato.getFullYear()}-${String(candidato.getMonth() + 1).padStart(2, '0')}-${String(candidato.getDate()).padStart(2, '0')}`,
          'media',
          diaConNumero[0]
        );
      }
    }
    trabajar = trabajar.replace(diaConNumero[0], ' ');
  }

  // «el lunes que viene»: día de la semana a secas (próxima ocurrencia). Los
  // tramos «día + número» ya se retiraron del texto, así que no se duplica.
  const dia = trabajar.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (dia) {
    const objetivo = DIAS_SEMANA[dia[1]];
    const hoyDia = hoyMedio.getDay();
    let distancia = (objetivo - hoyDia + 7) % 7;
    if (distancia === 0) distancia = 7; // «el lunes» publicado un lunes = próximo lunes
    agregar(sumarDias(hoy, distancia), 'media', dia[0]);
  }

  // «mañana» / «hoy».
  const limpio = limpiarTextoParaBusqueda(texto);
  if (/\b(?:manana|maniana)\b/.test(limpio)) agregar(sumarDias(hoy, 1), 'alta', 'manana');
  if (/\bhoy\b/.test(limpio)) agregar(hoy, 'alta', 'hoy');

  return resultados.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Devuelve la fecha actual en formato ISO local (YYYY-MM-DD).
export function fechaHoyLocal() {
  return hoyISO();
}
const TIPOS_EVENTO = [
  // Orden de prioridad: lo específico antes que lo genérico.
  { tipo: 'examen', patrones: [/parcial/, /examen/, /parcialito/, /recuperatorio/, /final\b/, /coloquio/, /integrador/] },
  { tipo: 'entrega', patrones: [/entrega/, /entregar/, /vencimiento/, /present[ao]\s+(?:del?\s+)?(?:tp|trabajo)/] },
  { tipo: 'consulta', patrones: [/consulta/] },
  { tipo: 'exposición', patrones: [/exposici[oó]n/, /presentaci[oó]n/] },
  { tipo: 'sin_clases', patrones: [/sin\s+clases/, /no\s+hay\s+clases/, /no\s+habr[áa]\s+clases/] },
  { tipo: 'clase', patrones: [/clase/, /encuentro/, /zoom/, /meet/] }
];

function detectarTipoEvento(texto) {
  const limpio = limpiarTextoParaBusqueda(texto);
  for (const regla of TIPOS_EVENTO) {
    if (regla.patrones.some((patron) => patron.test(limpio))) return regla.tipo;
  }
  return null;
}

function formatoLegible(fechaISO) {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [, mes, dia] = fechaISO.split('-');
  return `${Number(dia)} de ${meses[Number(mes) - 1]}`;
}

// Analiza un aviso y, si el texto anuncia un evento con fecha desde hoy en
// adelante, devuelve la sugerencia para el cronograma. Si no hay fecha o el
// evento ya pasó, devuelve null (el aviso igual puede aprobarse como aviso).
// Analiza un aviso y, si su texto anuncia evento(s) con fecha desde hoy en
// adelante, devuelve las sugerencias para el cronograma (una por fecha
// mencionada, ordenadas de la más próxima a la más lejana; por defecto hasta 4).
// El tipo de cada evento se clasifica según la oración que menciona la fecha
// (p. ej. «…la entrega del TP vence el próximo viernes 18» → entrega del 18 y
// «…el martes 15 a las 20:00 tendremos un encuentro…» → consulta del 15). Si no
// hay fechas o son del pasado, devuelve [] (el aviso igual puede publicarse
// como aviso en la campana).
export function analizarAvisosParaCronograma({ titulo, contenido, materiaNombre, hoy, maxEventos = 4 }) {
  const fechaBase = hoy || hoyISO();
  const texto = `${titulo || ''} ${contenido || ''}`;
  const candidatos = encontrarFechasPotenciales(texto, fechaBase)
    .filter((c) => c.fecha >= fechaBase)
    .slice(0, Math.max(1, Number(maxEventos) || 4));

  const eventos = [];
  for (const candidato of candidatos) {
    // Tipo según el contexto local de la fecha (ventana de texto alrededor de
    // la mención), con caída al texto completo.
    const tipoEvento = detectarTipoEvento(candidato.contexto || texto);
    if (!tipoEvento) continue;

    const limpio = limpiarTexto((candidato.contexto || texto).replace(/\b(?:el|la|los|las)\b/gi, ' '));
    const fragmento = limpio
      .replace(/\b(?:hoy|manana|maniana|mañana)\b/gi, ' ')
      .replace(/\b(?:a\s+las\s+\d{1,2}(?::\d{2})?\s*(?:hs\.?|horas?)?)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    const tituloEvento = fragmento || limpiarTexto(titulo || 'Aviso del campus').slice(0, 80);
    const modalidad = /\basincr[oó]nic|\ba\s+distancia\b/.test(limpiarTextoParaBusqueda(texto))
      ? 'asincrónico'
      : 'sincrónico';

    const detalles = limpiarTexto(contenido || '').slice(0, 200);

    eventos.push({
      tipo: tipoEvento,
      fecha: candidato.fecha,
      modalidad,
      titulo: tituloEvento,
      detalles: `Aviso del foro (${formatoLegible(candidato.fecha)})${detalles ? ` — ${detalles}` : ''}`.slice(0, 250),
      confianza: candidato.confianza,
      materiaNombre
    });
  }
  return eventos;
}

// Versión de una sola sugerencia (compatibilidad): devuelve el primer evento
// sugerido o null.
export function analizarAvisoParaCronograma(args) {
  return analizarAvisosParaCronograma({ maxEventos: 1, ...args })[0] || null;
}
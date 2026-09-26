import type { EventoCronograma, Horario, Parcial } from '../core/cursada';

/** Títulos del campus que solo repiten el enlace/turno de Zoom, sin contenido del plan. */
export function esTituloClaseGenericaDelCampus(titulo: string) {
  const t = String(titulo || '').trim();
  if (!t) return true;
  if (/^(se abre|se cierra)\b/i.test(t)) return true;
  if (/^vencimiento de\b/i.test(t)) return false;
  if (/^link de clase\b/i.test(t)) return true;
  if (/^clases sincr[oó]nicas\s*-/i.test(t)) return true;
  if (/^enlace a la clase sincr[oó]nica/i.test(t)) return true;
  if (/^clase sincr[oó]nica semanal/i.test(t)) return true;
  return false;
}

export function esDetalleSoloHorario(detalles: string) {
  const d = String(detalles || '').trim();
  if (!d) return true;
  if (/^clase de \d{1,2}:\d{2} a \d{1,2}:\d{2}\.?$/i.test(d)) return true;
  if (/^horario del campus:/i.test(d)) return true;
  return false;
}

function claveTituloCronograma(titulo: string) {
  return String(titulo || '')
    .replace(/\s*\(\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\)\s*$/i, '')
    .replace(/\s*\(\d{1,2}:\d{2}\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

function puntajeEvento(evento: EventoCronograma) {
  let puntaje = 0;
  if (evento.origen === 'manual') puntaje += 200;
  if (evento.url) puntaje += 30;
  if (!esDetalleSoloHorario(evento.detalles)) puntaje += Math.min(evento.detalles.length, 80);
  if (!esTituloClaseGenericaDelCampus(evento.titulo)) puntaje += Math.min(evento.titulo.length, 80);
  return puntaje;
}

export interface CronogramaDiaPresentacion {
  eventos: EventoCronograma[];
  /** Primer enlace UGR/Zoom de una clase genérica filtrada, por materia. */
  enlaceClasePorMateria: Map<string, string>;
}

/**
 * Deja en pantalla lo que aporta el plan de la materia; el turno fijo ya sale en «Cursada».
 * Los recordatorios Se abre/Se cierra no se muestran (las fechas viven en tareas/parciales).
 */
function nombreDeVencimiento(titulo: string) {
  return String(titulo || '')
    .replace(/^vencimiento de\s+/i, '')
    .trim()
    .toLowerCase();
}

export function presentarCronogramaDelDia(
  eventos: EventoCronograma[],
  horariosDelDia: Horario[],
  parcialesDelDia: Parcial[],
  tareasDelDia: Array<{ nombre: string }> = []
): CronogramaDiaPresentacion {
  const materiasConCursada = new Set(horariosDelDia.map((h) => h.materia_id));
  const enlaceClasePorMateria = new Map<string, string>();

  const candidatos: EventoCronograma[] = [];

  for (const evento of eventos) {
    if (evento.tipo === 'sin_clases' || evento.modalidad === 'sin_clases') {
      candidatos.push(evento);
      continue;
    }

    if (/^(se abre|se cierra)\b/i.test(String(evento.titulo || '').trim())) {
      continue;
    }

    if (/^vencimiento de\b/i.test(String(evento.titulo || '').trim())) {
      const nombre = nombreDeVencimiento(evento.titulo);
      const cubierto = parcialesDelDia.some((p) => p.nombre.toLowerCase().includes(nombre) || nombre.includes(p.nombre.toLowerCase()))
        || tareasDelDia.some((t) => t.nombre.toLowerCase().includes(nombre) || nombre.includes(t.nombre.toLowerCase()));
      if (cubierto) continue;
    }

    const generica = esTituloClaseGenericaDelCampus(evento.titulo);
    const hayCursada = materiasConCursada.has(evento.materia_id);

    if (generica && hayCursada) {
      if (evento.url && !enlaceClasePorMateria.has(evento.materia_id)) {
        enlaceClasePorMateria.set(evento.materia_id, evento.url);
      }
      continue;
    }

    if (generica && esDetalleSoloHorario(evento.detalles) && hayCursada) {
      if (evento.url && !enlaceClasePorMateria.has(evento.materia_id)) {
        enlaceClasePorMateria.set(evento.materia_id, evento.url);
      }
      continue;
    }

    candidatos.push(evento);
  }

  const mejorPorClave = new Map<string, EventoCronograma>();
  for (const evento of candidatos) {
    const clave = `${evento.materia_id}|${claveTituloCronograma(evento.titulo)}`;
    const previo = mejorPorClave.get(clave);
    if (!previo || puntajeEvento(evento) > puntajeEvento(previo)) {
      mejorPorClave.set(clave, evento);
    }
  }

  const visibles = [...mejorPorClave.values()].sort((a, b) => {
    const ordenTipo = (e: EventoCronograma) => (e.tipo === 'sin_clases' ? 0 : e.tipo === 'examen' ? 1 : 2);
    return ordenTipo(a) - ordenTipo(b)
      || String(a.titulo).localeCompare(String(b.titulo), 'es');
  });

  return { eventos: visibles, enlaceClasePorMateria };
}

export function tituloDestacadoCronograma(evento: EventoCronograma) {
  if (evento.tipo === 'sin_clases') return evento.titulo || 'Sin clases';
  if (esTituloClaseGenericaDelCampus(evento.titulo)) return evento.titulo;
  return evento.titulo;
}

export function mostrarEtiquetaTipoCronograma(evento: EventoCronograma) {
  if (evento.tipo === 'sin_clases' || evento.modalidad === 'sin_clases') return false;
  if (!esTituloClaseGenericaDelCampus(evento.titulo) && evento.tipo === 'clase') return false;
  return true;
}

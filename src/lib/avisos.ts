interface AvisoParaNotificacion {
  titulo: string;
  url?: string | null;
  materia_id?: string | null;
  fecha?: string | null;
  contenido?: string | null;
}

interface EventoCronograma {
  origen?: string | null;
  url?: string | null;
  materia_id?: string | null;
  tipo?: string | null;
  fecha: string;
}

// Usa eventos persistidos y aprobados, nunca vuelve a interpretar texto del campus.
export function nombreNotificacionAviso(
  aviso: AvisoParaNotificacion,
  cronograma: EventoCronograma[] = []
): string {
  const sinFragmento = (url: string | null | undefined) => String(url || '').split('#')[0];
  const eventos = cronograma.filter((evento) =>
    aviso.url && evento.origen === 'ugr'
    && sinFragmento(evento.url) === sinFragmento(aviso.url)
    && evento.materia_id === aviso.materia_id
    && evento.tipo === 'sin_clases'
  ).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!eventos.length) return aviso.titulo;
  const fechas = [...new Set(eventos.map((evento) => evento.fecha))];
  return fechas.map((fecha) => {
    const dia = new Date(`${fecha}T12:00:00Z`);
    const semana = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' }).format(dia);
    const [, mes, numero] = fecha.split('-');
    return `${semana} ${numero}/${mes}/${fecha.slice(0, 4)}: no hay clases`;
  }).join(' · ');
}

function sinFragmentoUrl(url: string | null | undefined) {
  return String(url || '').split('#')[0];
}

function diasHastaFechaCalendario(fechaStr: string): number | null {
  const partes = String(fechaStr || '').slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
  const limite = new Date(partes[0], partes[1] - 1, partes[2]);
  limite.setHours(0, 0, 0, 0);
  if (Number.isNaN(limite.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export function eventosSinClasesDelAviso(
  aviso: AvisoParaNotificacion,
  cronograma: EventoCronograma[] = []
) {
  return cronograma.filter((evento) =>
    Boolean(aviso.url)
    && evento.origen === 'ugr'
    && sinFragmentoUrl(evento.url) === sinFragmentoUrl(aviso.url)
    && evento.materia_id === aviso.materia_id
    && evento.tipo === 'sin_clases'
  );
}

/** Días transcurridos desde la publicación del hilo (0 = hoy). */
export function diasDesdePublicacionAviso(fechaStr: string | null | undefined): number | null {
  const texto = String(fechaStr || '').trim();
  if (!texto) return null;
  const iso = texto.slice(0, 10);
  const partes = iso.split('-').map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
  const publicado = new Date(partes[0], partes[1] - 1, partes[2]);
  publicado.setHours(0, 0, 0, 0);
  if (Number.isNaN(publicado.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy.getTime() - publicado.getTime()) / (1000 * 60 * 60 * 24));
}

/** El aviso del campus deja de mostrarse cuando ya no aplica (fechas pasadas o publicación vieja). */
export function avisoVigenteEnCampana(
  aviso: AvisoParaNotificacion,
  cronograma: EventoCronograma[] = []
): boolean {
  const sinClases = eventosSinClasesDelAviso(aviso, cronograma);
  if (sinClases.length > 0) {
    return sinClases.some((evento) => {
      const dias = diasHastaFechaCalendario(evento.fecha);
      return dias === 0 || dias === 1;
    });
  }

  const edad = diasDesdePublicacionAviso(aviso.fecha);
  if (edad === null) return false;

  const texto = `${aviso.titulo || ''} ${aviso.contenido || ''}`.toLowerCase();
  if (/\b(mañana|hoy)\b/.test(texto)) return edad <= 1;
  if (/\bencuentro sincr[oó]nico\b/.test(texto) && /\b(hoy|mañana)\b/.test(texto)) return edad <= 1;
  return edad <= 5;
}

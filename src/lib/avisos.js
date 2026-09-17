// Usa eventos persistidos y aprobados, nunca vuelve a interpretar texto del campus.
export function nombreNotificacionAviso(aviso, cronograma = []) {
  const sinFragmento = (url) => String(url || '').split('#')[0];
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

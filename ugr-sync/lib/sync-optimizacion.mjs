import { parcialYaSeRindio } from './normalizar.mjs';

/** Tras esta ventana, no volvemos a abrir la página en UGR si la nota ya está cerrada en el tablero. */
export const DIAS_OMITIR_REVISION_CAMPO = 7;

export function diasDesdeIso(iso, ahoraMs = Date.now()) {
  if (!iso) return 0;
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return 0;
  return (ahoraMs - t) / (24 * 3600 * 1000);
}

function tieneNotaGuardada(fila) {
  const n = fila?.nota_guardada;
  return n != null && String(n).trim() !== '';
}

function notaCerradaEnTablero(fila) {
  return Number(fila?.nota_cerrada) === 1;
}

/**
 * Decide si conviene volver a pedir la URL del campus para este alumno.
 * prioridad: menor = antes en la cola (pendientes de nota primero).
 */
export function evaluarFilaRevisionCampus(fila, opciones = {}) {
  const dias = opciones.diasEnfriar ?? DIAS_OMITIR_REVISION_CAMPO;
  const ahoraMs = opciones.ahoraMs ?? Date.now();
  const hoy = opciones.hoy ?? new Date(ahoraMs).toISOString().slice(0, 10);

  if (fila?.esBuzonMulti && opciones.omitirBuzonMulti) {
    return { omitir: true, prioridad: 99 };
  }

  const conNotaEnTablero = tieneNotaGuardada(fila);
  const cerrada = notaCerradaEnTablero(fila);
  const cargadaEn = fila?.nota_cargada_en;
  const completadaEn = fila?.completada_en;
  const requiereNota = Number(fila?.con_nota) === 1;

  if (fila?.tabla === 'parciales') {
    if (conNotaEnTablero && cerrada && parcialYaSeRindio(fila.fecha, hoy)) {
      const diasDesdeParcial = diasDesdeIso(`${fila.fecha}T12:00:00.000Z`, ahoraMs);
      if (diasDesdeParcial >= dias) return { omitir: true, prioridad: 99 };
    }
    if (!conNotaEnTablero && parcialYaSeRindio(fila.fecha, hoy)) return { omitir: false, prioridad: 0 };
    if (!conNotaEnTablero) return { omitir: false, prioridad: 2 };
    return { omitir: false, prioridad: 4 };
  }

  if (!requiereNota && completadaEn && diasDesdeIso(completadaEn, ahoraMs) >= dias) {
    return { omitir: true, prioridad: 99 };
  }

  if (requiereNota && conNotaEnTablero && cerrada) {
    return { omitir: true, prioridad: 99 };
  }

  if (requiereNota && !conNotaEnTablero) return { omitir: false, prioridad: 0 };
  if (!completadaEn && !conNotaEnTablero) return { omitir: false, prioridad: 1 };
  if (requiereNota && conNotaEnTablero && !cerrada) return { omitir: false, prioridad: 2 };
  return { omitir: false, prioridad: 5 };
}

export function priorizarYFiltrarRevisionCampus(filas, opciones = {}) {
  const enriquecidas = (filas || []).map((fila) => {
    const { omitir, prioridad } = evaluarFilaRevisionCampus(fila, opciones);
    return { fila, omitir, prioridad };
  });
  const activas = enriquecidas.filter((x) => !x.omitir);
  activas.sort(
    (a, b) => a.prioridad - b.prioridad
      || String(a.fila.materia || '').localeCompare(String(b.fila.materia || ''))
      || String(a.fila.nombre || '').localeCompare(String(b.fila.nombre || ''))
  );
  return {
    consultar: activas.map((x) => x.fila),
    omitidas: enriquecidas.filter((x) => x.omitir).length
  };
}

/** Buzón assign: todas las entregas cerradas con nota y sin cambios recientes. */
export function debeOmitirSyncHitosAssign(entregas, opciones = {}) {
  const dias = opciones.diasEnfriar ?? DIAS_OMITIR_REVISION_CAMPO;
  const ahoraMs = opciones.ahoraMs ?? Date.now();
  if (!entregas?.length) return false;
  if (entregas.some((e) => Number(e.es_activa) === 1)) return false;
  if (entregas.some((e) => (e.nota == null || String(e.nota).trim() === '') && !Number(e.es_activa))) {
    return false;
  }
  const fechas = entregas.map((e) => e.sincronizado_en).filter(Boolean);
  if (!fechas.length) return false;
  const ultima = Math.max(...fechas.map((f) => Date.parse(f)));
  if (!Number.isFinite(ultima)) return false;
  return diasDesdeIso(new Date(ultima).toISOString(), ahoraMs) >= dias;
}

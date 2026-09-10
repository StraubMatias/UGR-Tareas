// Validaciones compartidas entre cliente y servidor.
// Este archivo no lleva 'use client' ni 'use server': se importa desde ambos lados.
// Mantenerlo sin dependencias externas permite usarlo en los tests (node --test).

export function parcialHabilitado(fecha) {
  if (!fecha || fecha === 'Sin fecha') return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaParcial = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaParcial.getTime()) && fechaParcial <= hoy;
}

export function tareaHabilitada(fecha) {
  if (!fecha || fecha === 'Sin fecha') return true;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaInicio.getTime()) && fechaInicio <= hoy;
}

export function tareaDentroDelPlazo(fecha) {
  if (!fecha || fecha === 'Sin fecha') return true;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaCierre = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaCierre.getTime()) && hoy < fechaCierre;
}

export function validarNota(nota) {
  const notaLimpia = typeof nota === 'string' ? nota.trim().replace(',', '.') : String(nota ?? '').trim();
  if (!notaLimpia) return { valida: false, vacia: true, valor: '' };

  const valor = Number(notaLimpia);
  return {
    valida: Number.isFinite(valor) && valor >= 1 && valor <= 10,
    vacia: false,
    valor: notaLimpia
  };
}

export function normalizarUnidad(unidad) {
  const unidadLimpia = unidad === null || unidad === undefined ? '' : String(unidad).trim();
  if (!unidadLimpia) return { valida: true, valor: null };
  if (!/^\d+$/.test(unidadLimpia) || Number(unidadLimpia) < 1) {
    return { valida: false, valor: null };
  }
  return { valida: true, valor: Number(unidadLimpia) };
}

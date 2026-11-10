export function evaluarOportunidadPromocion(notas, materiaNombre) {
  const oportunidad = {
    debeRendir: false,
    razon: ''
  };

  const nombreLower = String(materiaNombre || '').toLowerCase();
  const esCiber = nombreLower.includes('ciber') || nombreLower.includes('ciberdelitos');

  if (esCiber) {
    const p1 = Number(notas?.parcial1 ?? 0);
    const p2 = Number(notas?.parcial2 ?? 0);
    if (p1 >= 8 && Math.abs(p2 - 7.5) < 0.01) {
      oportunidad.debeRendir = true;
      oportunidad.razon = `Tienes ${p1} en el 1er parcial y ${p2} en el 2do. Puedes rendir recuperatorio para alcanzar el 8 y promocionar.`;
    } else if (p2 >= 7.5 && p2 < 8 && p1 >= 6) {
      oportunidad.debeRendir = true;
      oportunidad.razon = `Tienes ${p2} en el 2do parcial. Puedes rendir recuperatorio para mejorar tu nota.`;
    }
  }

  return oportunidad;
}


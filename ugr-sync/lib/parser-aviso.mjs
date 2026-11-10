// Módulo para analizar avisos y extraer fechas, eventos y grupos
// usando reglas de lenguaje natural.

export function parsearAviso(texto, gruposUsuario = []) {
  const info = {
    esEvento: false,
    fecha: null,
    hora: null,
    grupoDestino: null,
    prioridad: 'baja'
  };

  const textoLower = texto.toLowerCase();
  const gruposArray = Array.isArray(gruposUsuario) ? gruposUsuario : [gruposUsuario].filter(Boolean);

  // 1. Detectar fechas (formato DD/MM o DD/MM/AAAA)
  const fechaRegex = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/;
  const matchFecha = texto.match(fechaRegex);
  if (matchFecha) {
    info.esEvento = true;
    const dia = matchFecha[1].padStart(2, '0');
    const mes = matchFecha[2].padStart(2, '0');
    const anio = matchFecha[3] || '2026';
    info.fecha = `${dia}/${mes}/${anio}`;
  }

  // 2. Detectar grupos por número
  const grupoNumRegex = /(?:grupo|g)\s*(\d+)/i;
  const matchGrupoNum = texto.match(grupoNumRegex);
  if (matchGrupoNum) {
    info.grupoDestino = matchGrupoNum[1];
    if (gruposArray.some(g => String(g).toLowerCase().includes(info.grupoDestino))) {
      info.prioridad = 'alta';
    }
  }

  // 2b. Detectar grupos por nombre
  const grupoNombreRegex = /(?:grupo|g)\s*[:\-]?\s*([^\n\.]+)/i;
  const matchGrupoNombre = texto.match(grupoNombreRegex);
  if (matchGrupoNombre && !info.grupoDestino) {
    const nombreDetectado = matchGrupoNombre[1].trim();
    if (gruposArray.some(g => g.toLowerCase().includes(nombreDetectado.toLowerCase()) || nombreDetectado.toLowerCase().includes(String(g).toLowerCase()))) {
      info.prioridad = 'alta';
    }
  }

  // 3. Detectar recuperatorios (solo si la palabra aparece claramente)
  if (textoLower.includes('recuperatorio') || /\brecu\b/.test(textoLower)) {
    info.esEvento = true;
    info.prioridad = info.prioridad === 'alta' ? 'alta' : 'media';
    info.esRecuperatorio = true;
  } else if (textoLower.includes('examen') || textoLower.includes('parcial')) {
    info.esEvento = true;
    info.esExamen = true;
  }

  // 4. Detectar exposiciones
  if (textoLower.includes('exponer') || textoLower.includes('exposición') || textoLower.includes('exposicion')) {
    info.esEvento = true;
    info.esExposicion = true;
    if (info.prioridad !== 'alta') info.prioridad = 'media';
  }

  return info;
}

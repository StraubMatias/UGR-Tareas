/** Elegir el enlace Zoom que coincide con el horario semanal de cursada. */

const DIAS_TITULO = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 7
};

export function minutosDesdeHora(hora) {
  const m = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutosAHora(minutos) {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return null;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function sinAcento(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Horario inferido del título del módulo Zoom en el campus. */
export function inferirHorarioDesdeTituloZoom(titulo) {
  const norm = sinAcento(titulo);
  let dia = null;
  for (const [nombre, num] of Object.entries(DIAS_TITULO)) {
    if (norm.includes(nombre)) {
      dia = num;
      break;
    }
  }

  let inicio = null;
  let fin = null;

  const rango = norm.match(/(\d{1,2})\s*(?:hs?|h)\s*\.?\s*a\s*(\d{1,2})\s*(?:[:\.]\s*(\d{2}))?\s*(?:hs?|h)?/);
  if (rango) {
    inicio = minutosDesdeHora(`${rango[1]}:${rango[3] || '00'}`);
    fin = minutosDesdeHora(`${rango[2]}:${rango[3] || '00'}`);
  }

  const aLas = norm.match(/(?:a\s+las|a)\s+(\d{1,2})\s*(?:hs?|h)\b/);
  if (aLas && inicio === null) {
    inicio = minutosDesdeHora(`${aLas[1]}:00`);
  }

  const hhmm = norm.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hhmm && inicio === null) {
    inicio = minutosDesdeHora(`${hhmm[1]}:${hhmm[2]}`);
  }

  return {
    dia,
    inicio,
    fin,
    horaInicio: minutosAHora(inicio),
    horaFin: minutosAHora(fin)
  };
}

/** Horario desde la página view.php de Zoom (Moodle) o texto plano. */
export function inferirHorarioDesdeHtmlZoom(html, titulo = '') {
  const texto = String(html || '').replace(/\s+/g, ' ');
  const desdeTitulo = inferirHorarioDesdeTituloZoom(titulo);
  let dia = desdeTitulo.dia;
  let inicio = desdeTitulo.inicio;
  let fin = desdeTitulo.fin;

  const horas = [...texto.matchAll(/\b(\d{1,2}):(\d{2})\b/g)].map((m) => minutosDesdeHora(`${m[1]}:${m[2]}`)).filter((n) => n !== null);
  if (horas.length >= 1 && inicio === null) inicio = horas[0];
  if (horas.length >= 2 && fin === null) fin = horas[1];

  const norm = sinAcento(texto);
  for (const [nombre, num] of Object.entries(DIAS_TITULO)) {
    if (norm.includes(nombre)) {
      dia = dia ?? num;
      break;
    }
  }

  const duracion = norm.match(/duraci[oó]n[:\s]+(\d+)\s*(?:min|minutos)/);
  if (duracion && inicio !== null && fin === null) {
    fin = inicio + Number(duracion[1]);
  }

  return {
    dia,
    inicio,
    fin,
    horaInicio: minutosAHora(inicio),
    horaFin: minutosAHora(fin)
  };
}

export function horarioReferenciaCursada(filasHorario) {
  const slots = (filasHorario || [])
    .map((fila) => ({
      dia: Number(fila.dia),
      inicio: minutosDesdeHora(fila.hora_inicio),
      fin: minutosDesdeHora(fila.hora_fin || fila.hora_inicio)
    }))
    .filter((s) => s.dia >= 1 && s.dia <= 7 && s.inicio !== null);
  if (slots.length === 0) return null;

  const conteo = new Map();
  for (const s of slots) {
    const clave = `${s.dia}|${s.inicio}`;
    conteo.set(clave, (conteo.get(clave) || 0) + 1);
  }
  let elegido = slots[0];
  let max = 0;
  for (const s of slots) {
    const n = conteo.get(`${s.dia}|${s.inicio}`) || 0;
    if (n > max) {
      max = n;
      elegido = s;
    }
  }
  return elegido;
}

export function puntuarEnlaceZoomContraCursada(enlace, referencia) {
  if (!enlace?.urlJoin) return -1;
  if (!referencia) return enlace.urlJoin ? 1 : -1;

  let puntaje = 0;
  const desdeTitulo = inferirHorarioDesdeTituloZoom(enlace.titulo || '');
  const dia = enlace.dia ?? desdeTitulo.dia;
  const inicio = minutosDesdeHora(enlace.horaInicio) ?? enlace.inicio ?? desdeTitulo.inicio;
  const fin = minutosDesdeHora(enlace.horaFin) ?? enlace.fin ?? desdeTitulo.fin;

  if (dia && dia === referencia.dia) puntaje += 150;
  if (inicio !== null && referencia.inicio !== null) {
    const diffClase = Math.abs(inicio - referencia.inicio);
    const diffApertura = Math.abs(inicio - (referencia.inicio - 10));
    if (diffClase <= 15) puntaje += 120;
    else if (diffApertura <= 12) puntaje += 100;
    else puntaje += Math.max(0, 80 - diffClase);
  }
  if (fin !== null && referencia.fin !== null && Math.abs(fin - referencia.fin) <= 25) {
    puntaje += 50;
  }
  if (/zoom\.us\/j\//i.test(enlace.urlJoin)) puntaje += 15;
  if (/pwd=/i.test(enlace.urlJoin)) puntaje += 5;
  return puntaje;
}

function referenciaDesdeFilaHorario(fila) {
  const dia = Number(fila?.dia);
  const inicio = minutosDesdeHora(fila?.hora_inicio);
  const fin = minutosDesdeHora(fila?.hora_fin || fila?.hora_inicio);
  if (dia < 1 || dia > 7 || inicio === null) return null;
  return { dia, inicio, fin };
}

/** Mejor enlace para una fila concreta de horario (p. ej. mié 19 vs jue 20:30). */
export function elegirEnlaceZoomParaFilaHorario(enlaces, filaHorario) {
  const candidatos = (enlaces || []).filter((e) => e?.urlJoin);
  if (candidatos.length === 0) return '';
  if (candidatos.length === 1) return candidatos[0].urlJoin;

  const referencia = referenciaDesdeFilaHorario(filaHorario);
  if (!referencia) return elegirEnlaceZoomParaHorarios(enlaces, [filaHorario]);

  let mejor = candidatos[0];
  let mejorPuntaje = puntuarEnlaceZoomContraCursada(mejor, referencia);
  for (const enlace of candidatos.slice(1)) {
    const p = puntuarEnlaceZoomContraCursada(enlace, referencia);
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = enlace;
    }
  }
  if (mejorPuntaje < 40) {
    const porDia = candidatos.find((e) => {
      const d = e.dia ?? inferirHorarioDesdeTituloZoom(e.titulo || '').dia;
      return d === referencia.dia;
    });
    if (porDia?.urlJoin) return porDia.urlJoin;
  }
  return mejor.urlJoin || '';
}

/** Un solo join URL para todos los horarios de la materia (misma franja repetida). */
export function elegirEnlaceZoomParaHorarios(enlaces, filasHorario) {
  const candidatos = (enlaces || []).filter((e) => e?.urlJoin);
  if (candidatos.length === 0) return '';
  if (candidatos.length === 1) return candidatos[0].urlJoin;

  const referencia = horarioReferenciaCursada(filasHorario);
  let mejor = candidatos[0];
  let mejorPuntaje = puntuarEnlaceZoomContraCursada(mejor, referencia);
  for (const enlace of candidatos.slice(1)) {
    const p = puntuarEnlaceZoomContraCursada(enlace, referencia);
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = enlace;
    }
  }
  if (mejorPuntaje < 40 && referencia) {
    const porDia = candidatos.find((e) => {
      const d = e.dia ?? inferirHorarioDesdeTituloZoom(e.titulo || '').dia;
      return d === referencia.dia;
    });
    if (porDia?.urlJoin) return porDia.urlJoin;
  }
  return mejor.urlJoin || '';
}

// Normalización de los datos que llegan de Moodle al formato que usa la app.
// Incluye: parseo de fechas, inferencia del tipo de tarea y matcheo
// (case/acentos-insensitive) de los nombres de curso de Moodle contra las
// materias cargadas en la base local.

const MESES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
};

export function limpiarTextoParaBusqueda(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Igual que limpiarTextoParaBusqueda pero además elimina los prefijos de
// versión que Moodle antepone al nombre de la materia en el título del curso,
// p. ej. «(V.TUCS.1.07.2) AUDITORÍAS DE SEGURIDAD…» → «auditorias de seguridad…».
export function limpiarNombreCursoParaBusqueda(texto) {
  const t = String(texto || '');
  const sinVersion = t
    // "(V.TUCS.1.07.2)" / "(V.1.7.2)" / "(V 1.7.2)"
    .replace(/\(\s*V\s*\.?\s*(?:TUCS|T.U.C.S.)?\s*[\d.]+\s*\)/gi, ' ')
    // "V.TUCS.1.7.2" / "V.1.7.2" / "V 1.7.2" / "V1.7.2" sin paréntesis
    .replace(/\bV\s*\.?\s*(?:TUCS|T.U.C.S.)?\s*[\d.]+\b/gi, ' ')
    // "versión 1.7.2"
    .replace(/\bversi[oó]n\s+[\d.]+\b/gi, ' ');
  return limpiarTextoParaBusqueda(sinVersion);
}

// Convierte el texto de fecha de Moodle a 'YYYY-MM-DD' (formato que usa la app).
// Acepta ISO ('2026-09-25T23:55:00+00:00' o '2026-09-25') y texto en español
// («jueves, 25 de septiembre de 2026, 23:55»).
export function parsearFechaMoodle(texto) {
  const textoLimpio = String(texto || '').trim();
  if (!textoLimpio || textoLimpio === 'Sin fecha') return null;

  // ISO 8601 (datetime de <time datetime="...">).
  const iso = textoLimpio.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Texto en español: "jueves, 25 de septiembre de 2026, 23:55"
  const porMes = textoLimpio.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i);
  if (porMes) {
    const dia = porMes[1].padStart(2, '0');
    const mes = MESES[porMes[2].toLowerCase()];
    if (mes) return `${porMes[3]}-${mes}-${dia}`;
  }

  // DD/MM/YYYY
  const porBarra = textoLimpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (porBarra) return `${porBarra[3]}-${porBarra[2].padStart(2, '0')}-${porBarra[1].padStart(2, '0')}`;

  return null;
}

export function parsearTimestampMoodle(timestampMs) {
  if (!timestampMs && timestampMs !== 0) return null;
  const numero = Number(timestampMs);
  if (Number.isNaN(numero)) return null;
  // Moodle suele mandar el timestamp en segundos; la app usa milisegundos.
  const ms = numero < 1e11 ? numero * 1000 : numero;
  const fecha = new Date(ms);
  if (Number.isNaN(fecha.getTime())) return null;
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

const NUMEROS_ROMANOS = { i: 1, v: 5, x: 10 };

function romanoANumero(texto) {
  let total = 0;
  let previo = 0;
  for (let i = texto.length - 1; i >= 0; i -= 1) {
    const valor = NUMEROS_ROMANOS[texto[i].toLowerCase()] ?? 0;
    if (valor < previo) total -= valor;
    else total += valor;
    previo = valor;
  }
  return total >= 1 ? total : null;
}

// Convierte el rótulo de unidad que usa Moodle a un número de unidad.
// Acepta «Unidad 2», «Unidad nro. 2», «Unidad II», «UII», «U. II»…
export function parsearUnidadMoodle(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;

  // «Unidad 2», «Unidad nro. 2», «Unidad nº 2», «Unidad numero 2»
  const arabigo = t.match(/unidad\s*(?:num(?:ero)?\.?\s*|nro\.?\s*|n[º°o]?\.?\s*)?(\d{1,2})\b/i);
  if (arabigo) return Number(arabigo[1]) >= 1 ? Number(arabigo[1]) : null;

  // «Unidad II», «Unidad IV»…
  const romana = t.match(/unidad\s*(?:num(?:ero)?\.?\s*|nro\.?\s*|n[º°o]?\.?\s*)?([ivx]{1,5})\b/i);
  if (romana) return romanoANumero(romana[1]);

  // «UII», «U. II», «UII.» (forma compacta que usa Moodle en nombres de tareas)
  const corta = t.match(/(?:^|[\s(,])(U\s*\.?\s*[IVX]{1,5})/i);
  if (corta) return romanoANumero(corta[1].replace(/[^ivx]/gi, ''));

  return null;
}

// Inferir el tipo de tarea según el nombre, igual que hace la app
// (actividad | foro | trabajo_practico).
export function inferirTipoTarea(nombre) {
  const n = limpiarTextoParaBusqueda(nombre);
  if (n.includes('foro')) return 'foro';
  if (/(^|\s)(tp|t\.p|trabajo|trabajos|entrega)/.test(n) || n.includes('trabajo practico')) return 'trabajo_practico';
  return 'actividad';
}

// Ajusta el nombre para la base: recorta largos y evita repeticiones.
export function normalizarNombre({ nombre, cursoNombre }) {
  let salida = String(nombre || '').replace(/\s+/g, ' ').trim();
  if (!salida) salida = String(cursoNombre || 'Tarea').trim();
  if (salida.length > 200) salida = `${salida.slice(0, 197)}...`;
  return salida;
}

// Dice si un nombre de curso de Moodle corresponde a una materia local.
// Devuelve { materia, score } o null.
export function coincidirMateria(nombreCurso, materias) {
  const cursoLim = limpiarNombreCursoParaBusqueda(nombreCurso);
  if (!cursoLim) return null;

  let mejor = null;
  for (const materia of materias) {
    const materiaLim = limpiarTextoParaBusqueda(materia.nombre);
    if (!materiaLim) continue;

    let score = 0;
    if (cursoLim === materiaLim) {
      score = 100;
    } else if (cursoLim.includes(materiaLim)) {
      // El curso de Moodle suele incluir el nombre de la materia + extras
      // (tecn. universitaria → Gestión de Activos).
      score = 90 - Math.max(0, cursoLim.length - materiaLim.length);
    } else if (materiaLim.includes(cursoLim)) {
      score = 85;
    } else {
      // Solape de palabras relevantes.
      const palabrasCurso = new Set(cursoLim.split(' ').filter((p) => p.length > 2));
      const palabrasMateria = new Set(materiaLim.split(' ').filter((p) => p.length > 2));
      if (palabrasCurso.size === 0 || palabrasMateria.size === 0) continue;
      let comunes = 0;
      for (const palabra of palabrasMateria) {
        if (palabrasCurso.has(palabra)) comunes += 1;
      }
      score = Math.round((comunes / palabrasMateria.size) * 70);
    }

    if (score >= 60 && (!mejor || score > mejor.score)) {
      mejor = { materia, score };
    }
  }

  return mejor;
}
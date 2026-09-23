// SIU Guaraní 同步核心逻辑
import { SIU_BASE_URL, SIU_RUTAS } from './constantes.mjs';
import { crearClienteSIU } from './red.mjs';

export async function conectarSIU() {
  const usuario = process.env.SIU_USER;
  const contrasena = process.env.SIU_PASSWORD;
  if (!usuario || !contrasena) {
    throw new Error('Faltan SIU_USER y SIU_PASSWORD en el entorno');
  }
  return crearClienteSIU({ usuario, contrasena });
}

// --- 解析函数 ---

export function parsearHistoriaAcademica(html) {
  const materias = [];

  // If HTML is actually a JSON response from the AJAX endpoint, extract the cont field
  let parsedHtml = html;
  if (html.trim().startsWith('{')) {
    try {
      const json = JSON.parse(html);
      parsedHtml = json.cont || '';
    } catch {
      return materias;
    }
  }

  // Skip if empty or not HTML
  if (!parsedHtml || !parsedHtml.includes('<tr')) return materias;

  // Extract all rows from the table
  const rows = parsedHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rows) {
    const cleanText = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Skip header rows and empty rows
    if (!cleanText || cleanText.length < 3) continue;
    if (/código|nombre|estado|nota|año|cuatrimestre|asignatura|materia/i.test(cleanText) && cleanText.length < 40) continue;
    if (/filtrar|buscar|todos|ninguno/i.test(cleanText) && cleanText.length < 30) continue;

    // Try to detect material codes (numeric like "1001" or alphanumeric like "INF-100", "MAT-200")
    const codigoMatch = cleanText.match(/\b((?:[A-Z]{2,4}[-.]?\d{3,4})|\d{3,5})\b/i);
    const codigo = codigoMatch ? codigoMatch[1].replace(/[-.]/, '') : null;

    // Detect status - check for SIU-specific status words (order matters: specific before generic)
    let estado = null;
    if (/PROMOCIONADO|PROMOCIONADA|PROMOCION\b/i.test(cleanText)) {
      estado = 'aprobada';
    } else if (/DESAPROBADO|DESAPROBADA/i.test(cleanText)) {
      estado = 'desaprobada';
    } else if (/APROBADO|APROBADA/i.test(cleanText)) {
      estado = 'aprobada';
    } else if (/REGULARIZADO|REGULARIZADA|REGULAR\b/i.test(cleanText)) {
      estado = 'regularizada';
    } else if (/CURSANDO|EN CURSO|EN_CURSO|ACTIVA|EN_CURSO/i.test(cleanText)) {
      estado = 'cursando';
    } else if (/INSCRIBIDO|INSCRIBIDA|INSCRITA|INSCRIPTO|INSCRIPTA/i.test(cleanText)) {
      estado = 'inscripta';
    } else if (/LIBRE|AUSENTE/i.test(cleanText)) {
      estado = 'libre';
    }

    // Extract from individual table cells for better accuracy
    const tdMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    let nombre = null;
    let nota = null;

    if (tdMatches.length >= 2) {
      // First TD often has code, second has name
      const firstTd = tdMatches[0]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const secondTd = tdMatches[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      // Try to find the name (longer text, not a code)
      for (const td of tdMatches) {
        const tdText = td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (tdText.length > 3 && tdText.length < 100) {
          // Skip if it looks like a code or number
          if (!/^\d+$/.test(tdText) && !/^[A-Z]{2,4}[-.]?\d{3,4}$/.test(tdText.toUpperCase()) && !/^\d{3,5}$/.test(tdText)) {
            nombre = tdText;
            break;
          }
        }
      }

      // Try to find a grade (number between 1 and 10)
      for (const td of tdMatches) {
        const tdText = td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const notaMatch = tdText.match(/\b(10|9\.?\d?|8\.?\d?|7\.?\d?|6\.?\d?|5\.?\d?|4\.?\d?|3\.?\d?|2\.?\d?|1\.?\d?|0\.?\d?)\b/);
        if (notaMatch) {
          nota = parseFloat(notaMatch[1]);
          break;
        }
      }
    }

    // Also try to find name and grade from the full row text
    if (!nombre) {
      const betweenMatch = cleanText.match(/((?:[A-Z]{2,4}[-.]?\d{3,4})|\d{3,5})\s+(.+?)\s+(?:PROMOCIONADO|PROMOCIONADA|PROMOCION|DESAPROBADO|DESAPROBADA|APROBADO|APROBADA|REGULARIZADO|REGULARIZADA|REGULAR|CURSANDO|DESAPROBADO|DESAPROBADA|INSCRIBIDO|INSCRITA|LIBRE|AUSENTE)/i);
      if (betweenMatch) {
        nombre = betweenMatch[2].trim();
      }
    }

    if (!nota) {
      const notaMatch = cleanText.match(/\b(10|9\.?\d?|8\.?\d?|7\.?\d?|6\.?\d?|5\.?\d?|4\.?\d?|3\.?\d?|2\.?\d?|1\.?\d?|0\.?\d?)\s*(?:\/\s*10)?\b/);
      if (notaMatch) {
        nota = parseFloat(notaMatch[1]);
      }
    }

    // Only include if we found meaningful data
    if (codigo || estado || nota !== null) {
      materias.push({
        codigoMateria: codigo || `materia_${materias.length + 1}`,
        nombreMateria: nombre || cleanText.substring(0, 100),
        estado: estado || 'cursando',
        nota: nota
      });
    }
  }

  // Remove duplicates by code
  const seen = new Set();
  return materias.filter(m => {
    if (seen.has(m.codigoMateria)) return false;
    seen.add(m.codigoMateria);
    return true;
  });
}

export function parsearInformeNotas(html) {
  const notas = [];
  // TODO: 根据实际页面结构调整
  return notas;
}

export function parsearInscripcionesExamenes(html) {
  const inscripciones = [];
  // TODO: 根据实际页面结构调整
  return inscripciones;
}

// --- 主同步函数 ---

export async function sincronizarSIU({ db, cliente } = {}) {
  if (!cliente) {
    cliente = await conectarSIU();
  }

  const resultados = {
    historiaAcademica: [],
    inscripcionesExamenes: [],
    error: null,
  };

  try {
    // First get the page to establish the session context
    const resHistoria = await cliente.pedir(SIU_RUTAS.historiaAcademica);
    console.log('📄 Historia académica página:', resHistoria.html.length, 'chars, URL:', resHistoria.url);

    // Then try the AJAX endpoint to get the actual data
    // The SIU Guaraní kernel API uses GET with checks parameter
    const resDatos = await cliente.pedir(
      `${SIU_RUTAS.historiaAcademica}?checks=t&modo=anio`,
      { method: 'GET' }
    );
    console.log('📄 Datos AJAX:', resDatos.html.length, 'chars');

    // Parse the HTML content from the response (could be JSON with .cont or raw HTML)
    let htmlParaParsear = resDatos.html;
    if (resDatos.html.trim().startsWith('{')) {
      try {
        const json = JSON.parse(resDatos.html);
        htmlParaParsear = json.cont || resDatos.html;
        console.log('📄 JSON response, cont length:', (json.cont || '').length);
      } catch {
        // Not valid JSON, use as-is
      }
    }

    // Also parse the original page HTML as fallback
    const materiasDelPagina = parsearHistoriaAcademica(resHistoria.html);
    const materiasDeDatos = parsearHistoriaAcademica(htmlParaParsear);

    console.log('📊 Materias de página:', materiasDelPagina.length);
    console.log('📊 Materias de AJAX:', materiasDeDatos.length);

    // Use the one with more results (AJAX usually has the table data)
    if (materiasDeDatos.length > materiasDelPagina.length) {
      resultados.historiaAcademica = materiasDeDatos;
    } else {
      resultados.historiaAcademica = materiasDelPagina;
    }

    console.log('📊 Materias finales:', resultados.historiaAcademica.length);
    for (const m of resultados.historiaAcademica) {
      console.log(`   - ${m.codigoMateria}: ${m.nombreMateria} [${m.estado}] nota=${m.nota}`);
    }

    const resExamenes = await cliente.pedir(SIU_RUTAS.inscripcionesExamenes);
    resultados.inscripcionesExamenes = parsearInscripcionesExamenes(resExamenes.html);

  } catch (error) {
    resultados.error = error.message;
    console.error('❌ Error sincronizando SIU:', error.message);
  }

  return resultados;
}


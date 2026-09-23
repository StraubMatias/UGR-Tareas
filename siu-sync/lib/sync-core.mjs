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

  // SIU Guaraní 3 uses table rows for material data
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rows) {
    const cleanText = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Skip header rows and empty rows
    if (!cleanText || cleanText.length < 3) continue;
    if (/código|nombre|estado|nota|año|cuatrimestre|asignatura/i.test(cleanText) && cleanText.length < 30) continue;

    // Try to detect material codes (typically alphanumeric like "1001", "INF-100", "MAT-200")
    const codigoMatch = cleanText.match(/\b([A-Z]{2,4}[-.]?\d{3,4})\b/i);
    const codigo = codigoMatch ? codigoMatch[1].replace(/[-.]/, '') : null;

    // Detect status
    let estado = null;
    if (/APROBADO|APROBADA|PROMOCIONADO|PROMOCIONADA|NORMALMENTE/i.test(cleanText)) {
      estado = 'aprobada';
    } else if (/REGULARIZADO|REGULARIZADA|REGULAR/i.test(cleanText)) {
      estado = 'regularizada';
    } else if (/CURSANDO|EN_CURSO|ACTIVA/i.test(cleanText)) {
      estado = 'cursando';
    } else if (/DESAPROBADO|DESAPROBADA|NOT_APROBADO/i.test(cleanText)) {
      estado = 'desaprobada';
    } else if (/INSSCRIBIDO|INSCRIBIDO|INSCRITA|INSCRIPTO|INSCRIPTA/i.test(cleanText)) {
      estado = 'inscripta';
    }

    // Detect grade (note) - look for numbers between 1 and 10
    const notaMatch = cleanText.match(/\b(10|9\.?\d?|8\.?\d?|7\.?\d?|6\.?\d?|5\.?\d?|4\.?\d?|3\.?\d?|2\.?\d?|1\.?\d?|0\.?\d?)\s*(?:\/\s*10)?\b/);
    const nota = notaMatch ? parseFloat(notaMatch[1]) : null;

    // Extract material name from the HTML
    let nombre = null;
    const tdMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (tdMatches.length >= 2) {
      const nameTd = tdMatches[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (nameTd && nameTd.length > 2 && nameTd.length < 100) {
        nombre = nameTd;
      }
    }

    // If we found meaningful data, include it
    if (codigo || estado || (nota !== null && cleanText.length > 5)) {
      if (!nombre) {
        const betweenMatch = cleanText.match(/([A-Z]{2,4}[-.]?\d{3,4})\s+(.+?)\s+(?:APROBADO|APROBADA|PROMOCIONADO|PROMOCIONADA|REGULARIZADO|REGULARIZADA|CURSANDO|DESAPROBADO|DESAPROBADA|INSCRIBIDO|INSCRITA)/i);
        if (betweenMatch) {
          nombre = betweenMatch[2].trim();
        }
      }

      materias.push({
        codigoMateria: codigo || `materia_${materias.length + 1}`,
        nombreMateria: nombre || cleanText.substring(0, 80),
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
    const resHistoria = await cliente.pedir(SIU_RUTAS.historiaAcademica);
    console.log('📄 Historia académica respondida:', resHistoria.html.length, 'chars, URL:', resHistoria.url);

    if (resHistoria.html.includes('404') || resHistoria.html.includes('Not Found')) {
      console.warn('⚠️ Historia académica devolvió 404. La ruta puede ser incorrecta.');
    }

    resultados.historiaAcademica = parsearHistoriaAcademica(resHistoria.html);
    console.log('📊 Materias parseadas:', resultados.historiaAcademica.length);
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


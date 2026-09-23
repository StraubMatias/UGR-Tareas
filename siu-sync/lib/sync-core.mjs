// SIU Guaraní 同步核心逻辑
import { SIU_BASE_URL, SIU_RUTAS } from './constantes.mjs';
import { crearClienteSIU } from './red.mjs';

export async function conectarSIU() {
  const usuario = process.env.SIU_USER;
  const contrasena = process.env.SIU_PASSWORD;
  if (!usuario || !contrasena) {
    throw new Error('Faltan SIU_USER y SIU_PASSWORD en .env.local');
  }
  return crearClienteSIU({ usuario, contrasena });
}

// --- 解析函数（TODO: 根据实际页面调整选择器） ---

export function parsearHistoriaAcademica(html) {
  const materias = [];
  // TODO: 根据实际 SIU Guaraní 页面结构调整
  const filas = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const fila of filas) {
    const texto = fila.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (/APROBADA|PROMOCIONADO|REGULARIZADO|CURSANDO/i.test(texto)) {
      materias.push({ raw: texto });
    }
  }
  return materias;
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
    resultados.historiaAcademica = parsearHistoriaAcademica(resHistoria.html);

    const resExamenes = await cliente.pedir(SIU_RUTAS.inscripcionesExamenes);
    resultados.inscripcionesExamenes = parsearInscripcionesExamenes(resExamenes.html);

  } catch (error) {
    resultados.error = error.message;
    console.error('❌ Error sincronizando SIU:', error.message);
  }

  return resultados;
}


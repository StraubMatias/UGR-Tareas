// Núcleo de la sincronización con UGR Virtual, compartido entre el CLI
// (scripts/ugr-sync.mjs) y la acción de servidor del panel (src/app/actions.js).
// Toda la lógica de descubrimiento de cursos, mapeo a materias locales y
// detección de tareas nuevas vive acá; las inserciones en la base se hacen con
// el objeto `db` que cada llamador provee (libsql client o wrapper de turso).
import { randomUUID } from 'node:crypto';
import { crearCliente } from './red.mjs';
import { extraerCursos, extraerNombreCursoDesdePagina } from './materias.mjs';
import { extraerFechasActividad, extraerTareas } from './tareas.mjs';
import {
  coincidirMateria,
  inferirTipoTarea,
  limpiarTextoParaBusqueda,
  normalizarNombre
} from './normalizar.mjs';
import { UGR_BASE_URL, UGR_RUTAS } from './constantes.mjs';

// Crea el cliente HTTP con las credenciales del entorno.
export async function conectarUGR() {
  const { UGRVIRTUAL_USER, UGRVIRTUAL_PASSWORD } = process.env;
  if (!UGRVIRTUAL_USER || !UGRVIRTUAL_PASSWORD) {
    throw new Error('Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en .env.local.');
  }
  return crearCliente({ usuario: UGRVIRTUAL_USER, contrasena: UGRVIRTUAL_PASSWORD });
}

async function fechasDeDetalle({ cliente, tarea }) {
  try {
    if (!tarea?.url) return { inicio: null, fin: null };
    const pagina = await cliente.pedir(tarea.url);
    return extraerFechasActividad(pagina.html);
  } catch {
    return { inicio: null, fin: null };
  }
}

// Recorre los cursos del campus, los mapea contra las materias locales y
// devuelve las tareas nuevas que todavía no existen en la base.
export async function detectarTareasNuevas({ db, cliente }) {
  // 1) Materias locales (destino).
  const resMaterias = await db.execute('SELECT id, nombre FROM materias ORDER BY nombre');
  const materiasLocales = resMaterias.rows;

  // 2) Cursos del campus y mapeo contra las materias locales.
  const pageCursos = await cliente.pedir(UGR_RUTAS.cursos);
  const cursos = extraerCursos(pageCursos.html);

  // Moodle a veces sirve nombres truncados dentro de los selects (terminan en
  // "...") aunque el prefijo de versión «(V.TUCS.1.07.2)» ya sea visible.
  // El nombre completo está en la página del curso: lo resolvemos antes de
  // mapear contra las materias locales.
  const mapeos = [];
  for (const curso of cursos) {
    if (curso.nombreIncompleto) {
      try {
        const paginaCurso = await cliente.pedir(UGR_RUTAS.curso(curso.id));
        const nombreCompleto = extraerNombreCursoDesdePagina(paginaCurso.html, curso.id);
        if (nombreCompleto) curso.nombre = nombreCompleto;
      } catch {
        // Si falla la resolución, nos quedamos con el nombre parcial.
      }
    }
    const coincidencia = coincidirMateria(curso.nombre, materiasLocales);
    if (coincidencia) mapeos.push({ curso, coincidencia });
  }

  // 3) Tareas de cada curso mapeado y detección de faltantes.
  const detectadas = [];
  for (const { curso, coincidencia } of mapeos) {
    const pagina = await cliente.pedir(UGR_RUTAS.tareasDeCurso(curso.id));
    const tareas = extraerTareas(pagina.html, UGR_BASE_URL);

    const resExistentes = await db.execute({
      sql: 'SELECT nombre FROM tareas WHERE materia_id = ?',
      args: [coincidencia.materia.id]
    });
    const nombresExistentes = new Set(resExistentes.rows.map((t) => limpiarTextoParaBusqueda(t.nombre)));

    for (const tarea of tareas) {
      // La apertura no viene en el índice: se lee del detalle de la tarea.
      const fechas = await fechasDeDetalle({ cliente, tarea });
      const inicio = fechas.inicio || (tarea.inicio && tarea.inicio !== 'Sin fecha' ? tarea.inicio : 'Sin fecha');
      const fin = fechas.fin || (tarea.fin && tarea.fin !== 'Sin fecha' ? tarea.fin : 'Sin fecha');

      const nombreFinal = normalizarNombre({ nombre: tarea.nombre, cursoNombre: curso.nombre });
      const clave = limpiarTextoParaBusqueda(nombreFinal);
      if (nombresExistentes.has(clave)) continue;
      detectadas.push({
        materiaId: coincidencia.materia.id,
        materiaNombre: coincidencia.materia.nombre,
        cursoNombre: curso.nombre,
        idMoodle: `moodle_${curso.id}_${tarea.id}`,
        nombre: nombreFinal,
        inicio,
        fin,
        unidad: tarea.unidad ?? null,
        conNota: tarea.conNota,
        tipo: inferirTipoTarea(nombreFinal),
        url: tarea.url || '',
        detalles: 'Importada desde UGR Virtual'
      });
    }
  }

  return { materiasLocales, cursos, mapeos, detectadas };
}

// Inserta las tareas detectadas en la base. Devuelve cuántas insertó.
export async function insertarTareasDetectadas({ db, detectadas }) {
  const inserts = detectadas.map((t) => ({
    sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      `t_${randomUUID()}`,
      t.materiaId,
      t.nombre,
      t.inicio || 'Sin fecha',
      t.fin || 'Sin fecha',
      t.detalles || 'Importada desde UGR Virtual',
      t.unidad ?? null,
      t.conNota ? 1 : 0,
      t.tipo || 'actividad'
    ]
  }));

  if (inserts.length === 0) return 0;
  await db.batch(inserts, 'write');
  return inserts.length;
}
import { randomUUID } from 'node:crypto';
import { UGR_RUTAS } from '../constantes.mjs';
import { extraerCursos, extraerCursosDeAjax, extraerNombreCursoDesdePagina, extraerSesskey, extraerUserid, esCursoOrganizativo } from '../materias.mjs';
import { coincidirMateria, emparejarCursosConMaterias, limpiarTextoParaBusqueda } from '../normalizar.mjs';
import { conPool } from './pool.mjs';
const VENTANA_CURSADA_SEG = 240 * 24 * 3600;

function pareceCursandoTodavia(curso, ahoraSeg) {
  const acceso = Number(curso?.timeaccess || 0);
  const fin = Number(curso?.enddate || 0);
  if (acceso && acceso >= ahoraSeg - VENTANA_CURSADA_SEG) return true;
  if (fin && fin >= ahoraSeg - VENTANA_CURSADA_SEG) return true;
  if (!acceso && !fin) return true;
  return false;
}

export async function listarCursosDelCampus(cliente) {
  const paginas = [];
  for (const ruta of [UGR_RUTAS.cursos, UGR_RUTAS.misCursos, UGR_RUTAS.dashboard]) {
    try {
      paginas.push(await cliente.pedir(ruta));
    } catch {
      // Una de las vistas puede faltar según el tema; las otras alcanzan.
    }
  }
  const porId = new Map();
  const incorporar = (lista, { soloRecientes } = {}) => {
    const ahoraSeg = Math.floor(Date.now() / 1000);
    for (const curso of lista || []) {
      if (!curso?.id || esCursoOrganizativo(curso.nombre)) continue;
      const id = String(curso.id);
      if (soloRecientes && !porId.has(id) && !pareceCursandoTodavia(curso, ahoraSeg)) continue;
      const existente = porId.get(id);
      if (existente && !(existente.nombreIncompleto && !curso.nombreIncompleto)) continue;
      porId.set(id, curso);
    }
  };
  for (const pagina of paginas) incorporar(extraerCursos(pagina?.html));

  const sesskey = paginas.map((pagina) => extraerSesskey(pagina?.html)).find(Boolean);
  const userid = paginas.map((pagina) => extraerUserid(pagina?.html)).find(Boolean);
  if (sesskey && userid) {
    try {
      const cuerpo = JSON.stringify([{
        index: 0,
        methodname: 'core_enrol_get_users_courses',
        args: { userid: Number(userid), returnusercount: false }
      }]);
      const pagina = await cliente.pedir(UGR_RUTAS.ajax(sesskey), {
        method: 'POST',
        cuerpo,
        tipoCuerpo: 'application/json'
      });
      incorporar(extraerCursosDeAjax(JSON.parse(pagina.html || '[]')));
    } catch {
      // Si este webservice no está, quedan Mis cursos y el timeline.
    }
    try {
      const cuerpo = JSON.stringify([{
        index: 0,
        methodname: 'core_course_get_recent_courses',
        args: { userid: Number(userid), limit: 20 }
      }]);
      const pagina = await cliente.pedir(UGR_RUTAS.ajax(sesskey), {
        method: 'POST',
        cuerpo,
        tipoCuerpo: 'application/json'
      });
      incorporar(extraerCursosDeAjax(JSON.parse(pagina.html || '[]')));
    } catch {
      // Los cursos recientes son un respaldo: el timeline sigue valiendo.
    }
  }
  if (sesskey) {
    const ajax = await conPool(['inprogress', 'future', 'past'], 4, async (classification) => {
      try {
        const cuerpo = JSON.stringify([{
          index: 0,
          methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
          args: {
            offset: 0,
            limit: 0,
            classification,
            sort: 'fullname',
            customfieldname: '',
            customfieldvalue: '',
            searchvalue: ''
          }
        }]);
        const pagina = await cliente.pedir(UGR_RUTAS.ajax(sesskey), {
          method: 'POST',
          cuerpo,
          tipoCuerpo: 'application/json'
        });
        return { classification, cursos: extraerCursosDeAjax(JSON.parse(pagina.html || '[]')) };
      } catch {
        return { classification, cursos: [] };
      }
    });
    for (const { classification, cursos: extra } of ajax) {
      incorporar(extra, { soloRecientes: classification === 'past' });
    }
  }

  const cursos = [...porId.values()];
  await conPool(cursos, 4, async (curso) => {
    if (!curso.nombreIncompleto) return;
    try {
      const paginaCurso = await cliente.pedir(UGR_RUTAS.curso(curso.id));
      const nombreCompleto = extraerNombreCursoDesdePagina(paginaCurso.html, curso.id);
      if (nombreCompleto) curso.nombre = nombreCompleto;
    } catch {
      // Si falla la resolución, nos quedamos con el nombre parcial.
    }
  });
  return cursos.filter((curso) => !esCursoOrganizativo(curso.nombre));
}

/** Cursos del campus mapeados a las materias en las que el alumno está inscripto en el período. */
export async function mapeosInscripcionesCampus({ cliente, db, alumnoId, periodoId }) {
  const cursos = await listarCursosDelCampus(cliente);
  const res = await db.execute({
    sql: `SELECT m.id, m.nombre FROM inscripciones i
          JOIN materias m ON m.id = i.materia_id
          WHERE i.alumno_id = ? AND m.periodo_id = ?`,
    args: [alumnoId, periodoId]
  });
  const materias = res.rows.map((fila) => ({ id: String(fila.id), nombre: String(fila.nombre) }));
  const mapeos = cursos.flatMap((curso) => {
    const coincidencia = coincidirMateria(curso.nombre, materias);
    return coincidencia ? [{ curso, coincidencia }] : [];
  });
  return { cursos, mapeos, materiaIds: materias.map((m) => m.id) };
}

// Crea en el período actual las materias de la carrera que el campus muestra
// y que todavía no existían (una extra de otro cuatrimestre, por ejemplo) y
// devuelve el mapeo curso → materia para cargarles las tareas.
export async function asegurarMateriasDeLaCursada({ db, cursos, materias = [], plan = [], periodoId } = {}) {
  const cursando = emparejarCursosConMaterias(cursos, materias, plan);
  const altas = [];
  const nombresNuevos = new Set();
  for (const item of cursando) {
    if (!item.nueva || !periodoId) continue;
    const nombre = String(item.nombre || '').toUpperCase();
    const clave = limpiarTextoParaBusqueda(nombre);
    if (!clave || nombresNuevos.has(clave)) continue;
    if (materias.some((materia) => limpiarTextoParaBusqueda(materia?.nombre) === clave)) continue;
    nombresNuevos.add(clave);
    altas.push({
      sql: 'INSERT INTO materias (id, nombre, periodo_id) VALUES (?, ?, ?)',
      args: [`m_${randomUUID()}`, nombre, periodoId]
    });
  }
  if (altas.length > 0) await db.batch(altas, 'write');

  const vigentes = periodoId
    ? await db.execute({ sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre', args: [periodoId] })
    : { rows: materias };
  const mapeos = [];
  const materiaIds = [];
  const nombresPorId = new Map();
  for (const item of cursando) {
    const clave = limpiarTextoParaBusqueda(item.nombre);
    const fila = (vigentes.rows || []).find((materia) => {
      if (item.materiaId && String(materia.id) === String(item.materiaId)) return true;
      return clave && limpiarTextoParaBusqueda(materia.nombre) === clave;
    });
    const materiaId = fila?.id ? String(fila.id) : '';
    if (!materiaId) continue;
    const nombre = String(fila.nombre || item.nombre);
    if (!materiaIds.includes(materiaId)) {
      materiaIds.push(materiaId);
      nombresPorId.set(materiaId, nombre);
    }
    mapeos.push({
      curso: item.curso,
      coincidencia: { materia: { id: materiaId, nombre }, score: 100 }
    });
  }
  return { cursando, mapeos, materiaIds, nombresPorId, materiasNuevas: altas.length, nombresNuevos };
}
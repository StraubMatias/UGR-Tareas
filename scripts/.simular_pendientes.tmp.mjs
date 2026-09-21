import { createClient } from '@libsql/client';
process.loadEnvFile?.('/home/matute/tareasUGR/.env.local');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);
const tareaHabilitada = (fecha) => {
  if (!fecha || fecha === 'Sin fecha') return true;
  const fi = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fi.getTime()) && fi <= hoy;
};

// replicar obtenerDatos(periodo)
const periodoActivo = (await db.execute("SELECT * FROM periodos WHERE activo = 1")).rows[0];
console.log('periodo activo:', periodoActivo?.id);
const pid = periodoActivo?.id;

const resMaterias = await db.execute(`SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre ASC`, [pid]);
const resTareas = await db.execute(`SELECT t.id, t.materia_id, t.nombre, t.inicio, t.fin, t.con_nota, t.tipo FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE m.periodo_id = ?`, [pid]);
const resCompletadas = await db.execute(`SELECT c.tarea_id, COALESCE(a.nombre, c.alumno) AS alumno FROM completadas c JOIN tareas t ON t.id = c.tarea_id JOIN materias m ON m.id = t.materia_id LEFT JOIN alumnos a ON a.id = c.alumno_id WHERE m.periodo_id = ?`, [pid]);
const resNotas = await db.execute(`SELECT n.tarea_id, COALESCE(a.nombre, n.alumno) AS alumno, n.nota FROM notas_tareas n JOIN tareas t ON t.id = n.tarea_id JOIN materias m ON m.id = t.materia_id LEFT JOIN alumnos a ON a.id = n.alumno_id WHERE m.periodo_id = ?`, [pid]);

const completadasPorTarea = new Map();
for (const c of resCompletadas.rows) {
  const arr = completadasPorTarea.get(c.tarea_id) || [];
  arr.push(c.alumno);
  completadasPorTarea.set(c.tarea_id, arr);
}
const notasPorTarea = new Map();
for (const n of resNotas.rows) {
  const obj = notasPorTarea.get(n.tarea_id) || {};
  obj[n.alumno] = n.nota;
  notasPorTarea.set(n.tarea_id, obj);
}

const tareasConEstado = resTareas.rows.map((t) => ({
  ...t,
  conNota: Number(t.con_nota) === 1,
  completadoPor: completadasPorTarea.get(t.id) || [],
  notas: notasPorTarea.get(t.id) || {}
}));

function tareaCompletadaPor(tarea, alumno) {
  return tarea.completadoPor.includes(alumno)
    || (tarea.conNota && Object.prototype.hasOwnProperty.call(tarea.notas || {}, alumno));
}
function tareaFaltaNota(tarea, alumno) {
  return tarea.conNota && tareaCompletadaPor(tarea, alumno) && (tarea.notas?.[alumno] === undefined);
}
function tareaPendiente(tarea, alumno) {
  return !tareaCompletadaPor(tarea, alumno) || tareaFaltaNota(tarea, alumno);
}

for (const alumno of ['Matute', 'MatiasUGR', 'Seba']) {
  const noCompletadas = tareasConEstado.filter((t) => tareaPendiente(t, alumno));
  const faltaNota = noCompletadas.filter((t) => tareaFaltaNota(t, alumno));
  const pendientes = noCompletadas.filter((t) => !tareaFaltaNota(t, alumno) && tareaHabilitada(t.inicio));
  const futuras = noCompletadas.filter((t) => !tareaFaltaNota(t, alumno) && !tareaHabilitada(t.inicio));
  console.log(`\n=== ALUMNO: ${alumno} ===`);
  console.log('total noCompletadas:', noCompletadas.length, '| pendientes:', pendientes.length, '| faltaNota:', faltaNota.length, '| futuras:', futuras.length);
  console.log('pendientes:');
  for (const t of pendientes) console.log('  -', t.fin, '|', t.nombre, '|', t.materia_id);
  console.log('futuras:');
  for (const t of futuras) console.log('  -', t.inicio, '|', t.nombre);
}

await db.close();
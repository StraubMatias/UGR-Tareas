// Configuración del campus virtual UGR Virtual.
// Las credenciales nunca van acá: se leen desde .env.local (UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD).

export const UGR_BASE_URL = 'https://virtual.ugr.edu.ar';

export const UGR_RUTAS = {
  login: '/login/index.php',
  dashboard: '/my/',
  // Lista de cursos en los que el usuario está inscripto.
  cursos: '/course/index.php',
  // Índice de tareas (assign) de un curso: /mod/assign/index.php?id=ID
  // (Moodle 4.5 lo redirige al overview con expand[]=assign)
  tareasDeCurso: (cursoId) => `/mod/assign/index.php?id=${cursoId}`,
  // Índice de foros de un curso: /mod/forum/index.php?id=ID
  // (Moodle 4.5 lo redirige al overview con expand[]=forum)
  forosDeCurso: (cursoId) => `/mod/forum/index.php?id=${cursoId}`,
  // Vista unificada de Moodle: /course/overview.php?id=ID agrupa los módulos
  // del curso por tipo (assign, forum, quiz, feedback, …) y solo renderiza las
  // filas de los tipos pedidos en expand[]. Se usan todos los `modulos` y se
  // parsean con `extraerActividadesOverview` (tareas + foros + cuestionarios).
  overviewCurso: (cursoId, modulos) =>
    `/course/overview.php?id=${cursoId}&${(modulos || []).map((m) => `expand[]=${m}`).join('&')}`,
  // Página de un curso (para datos generales): /course/view.php?id=ID
  curso: (cursoId) => `/course/view.php?id=${cursoId}`
};

// Tipos de módulo de Moodle que son «consignas» para el tablero (se importan
// como tareas). Los demás (resource, url, page, folder, zoom, …) son material
// de lectura / reuniones y no aparecen como tareas.
export const MODULOS_CONSIGNA = [
  'assign',
  'forum',
  'quiz',
  'feedback',
  'h5pactivity',
  'lesson',
  'workshop',
  'choice',
  'data',
  'glossary'
];

// Rótulos que Moodle usa para las columnas del índice de asignaciones.
// Sirven para detectar si una columna es la de vencimiento o la de disponibilidad.
export const ROTULOS_VENCIMIENTO = ['vencimiento', 'due', 'fecha de entrega', 'entrega'];
export const ROTULOS_DISPONIBLE = ['disponible', 'available'];
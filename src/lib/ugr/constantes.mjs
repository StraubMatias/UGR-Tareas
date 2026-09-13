// Configuración del campus virtual UGR Virtual.
// Las credenciales nunca van acá: se leen desde .env.local (UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD).

export const UGR_BASE_URL = 'https://virtual.ugr.edu.ar';

export const UGR_RUTAS = {
  login: '/login/index.php',
  dashboard: '/my/',
  // Lista de cursos en los que el usuario está inscripto.
  cursos: '/course/index.php',
  // Índice de tareas (assign) de un curso: /mod/assign/index.php?id=ID
  tareasDeCurso: (cursoId) => `/mod/assign/index.php?id=${cursoId}`,
  // Índice de foros de un curso: /mod/forum/index.php?id=ID
  forosDeCurso: (cursoId) => `/mod/forum/index.php?id=${cursoId}`,
  // Página de un curso (para datos generales): /course/view.php?id=ID
  curso: (cursoId) => `/course/view.php?id=${cursoId}`
};

// Rótulos que Moodle usa para las columnas del índice de asignaciones.
// Sirven para detectar si una columna es la de vencimiento o la de disponibilidad.
export const ROTULOS_VENCIMIENTO = ['vencimiento', 'due', 'fecha de entrega', 'entrega'];
export const ROTULOS_DISPONIBLE = ['disponible', 'available'];
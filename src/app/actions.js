'use server';

import { db } from './turso';

const ADMINISTRADOR = 'Matute';

function esAdministrador(usuario) {
  return typeof usuario === 'string' && usuario.trim().toLowerCase() === ADMINISTRADOR.toLowerCase();
}

function parcialHabilitado(fecha) {
  if (!fecha || fecha === 'Sin fecha') return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaParcial = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaParcial.getTime()) && fechaParcial <= hoy;
}

function tareaHabilitada(fecha) {
  if (!fecha || fecha === 'Sin fecha') return true;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaInicio.getTime()) && fechaInicio <= hoy;
}

function tareaDentroDelPlazo(fecha) {
  if (!fecha || fecha === 'Sin fecha') return true;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaCierre = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(fechaCierre.getTime()) && hoy < fechaCierre;
}

async function asegurarEsquemaNotasTareas() {
  await db.execute(
    'CREATE TABLE IF NOT EXISTS notas_tareas (id TEXT PRIMARY KEY, tarea_id TEXT NOT NULL, alumno TEXT NOT NULL, nota TEXT NOT NULL, cargada_en TEXT, UNIQUE(tarea_id, alumno))'
  );

  try {
    await db.execute('ALTER TABLE notas_tareas ADD COLUMN cargada_en TEXT');
  } catch (error) {
    // La columna ya existe en instalaciones que recibieron la migración.
  }

  try {
    await db.execute('ALTER TABLE tareas ADD COLUMN con_nota INTEGER NOT NULL DEFAULT 0');
  } catch (error) {
    // La columna ya existe en instalaciones que recibieron la migración.
  }

  try {
    await db.execute("ALTER TABLE tareas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'actividad'");
  } catch (error) {
    // La columna ya existe en instalaciones que recibieron la migración.
  }

  try {
    await db.execute("ALTER TABLE materias ADD COLUMN condiciones TEXT NOT NULL DEFAULT ''");
  } catch (error) {
    // La columna ya existe en instalaciones que recibieron la migración.
  }

  try {
    await db.execute('ALTER TABLE materias ADD COLUMN nota_minima_regularizar REAL NOT NULL DEFAULT 4');
  } catch (error) {
    // La columna ya existe en instalaciones que recibieron la migración.
  }

  try {
    await db.execute('ALTER TABLE materias ADD COLUMN nota_minima_promocionar REAL NOT NULL DEFAULT 8');
  } catch (error) {
    // La columna ya existe en instalaciones que recibieron la migración.
  }

  try {
    await db.execute("ALTER TABLE materias ADD COLUMN regla_promocion TEXT NOT NULL DEFAULT 'tp_nota'");
  } catch (error) {
    // La columna ya existe en instalaciones que recibieron la migración.
  }

  await db.execute({
    sql: "UPDATE materias SET condiciones = ?, nota_minima_regularizar = 4, nota_minima_promocionar = 8 WHERE nombre LIKE ? AND (condiciones IS NULL OR condiciones = '')",
    args: [
      'Para regularizar la materia es necesario haber completado los trabajos prácticos propuestos. Quienes aprueben los trabajos prácticos con 8 (ocho) o más promueven la materia sin rendir el final.',
      '%SISTEMAS DE GESTIÓN DE SEGURIDAD DE LA INFORMACIÓN%'
    ]
  });

  await db.execute({
    sql: "UPDATE materias SET regla_promocion = 'tp_porcentaje_nota', nota_minima_regularizar = 75, nota_minima_promocionar = 8 WHERE nombre LIKE ? AND condiciones LIKE '%75%%' AND condiciones LIKE '%100%%'",
    args: ['%SISTEMAS DE GESTIÓN DE SEGURIDAD DE LA INFORMACIÓN%']
  });

  const reglasIniciales = [
    {
      nombre: '%AUDITORÍAS DE SEGURIDAD DE LA INFORMACIÓN%',
      regla: 'auditorias_tps',
      condiciones: 'Para regularizar la materia se necesita una nota de cursada de 6 (seis) o más y una nota de 6 (seis) o más en cada trabajo práctico. Promociona quien obtiene como mínimo 8 (ocho) en la cursada y 8 (ocho) o más en cada trabajo práctico.',
      regularizar: 6,
      promocionar: 8
    },
    {
      nombre: '%CIBERDELITOS%',
      regla: 'ciberdelitos_parciales',
      condiciones: 'Para regularizar y poder rendir el final hay que aprobar los dos parciales con nota mínima de 6 (seis) en cada uno. Promociona quien aprueba cada parcial con nota mínima de 8 (ocho).',
      regularizar: 6,
      promocionar: 8
    },
    {
      nombre: '%EVALUACIÓN Y GESTIÓN DE RIESGOS%',
      regla: 'riesgos_tps',
      condiciones: 'Para regularizar la materia es necesario haber completado al menos tres actividades prácticas obligatorias. Promociona quien tiene todos los trabajos prácticos aprobados con nota 8 (ocho) o más.',
      regularizar: 6,
      promocionar: 8
    },
    {
      nombre: '%GESTIÓN DE ACTIVOS DE LA INFORMACIÓN%',
      regla: 'activos_porcentaje',
      condiciones: 'Regulariza quien completa al menos el 75% de todas las actividades de la plataforma: tareas, foros, actividades y trabajos prácticos. Promociona quien completa al menos el 90% de esas actividades al cierre de regularidades.',
      regularizar: 75,
      promocionar: 90
    }
  ];

  for (const regla of reglasIniciales) {
    await db.execute({
      sql: 'UPDATE materias SET condiciones = ?, nota_minima_regularizar = ?, nota_minima_promocionar = ?, regla_promocion = ? WHERE nombre LIKE ? AND (condiciones IS NULL OR condiciones = \'\')',
      args: [regla.condiciones, regla.regularizar, regla.promocionar, regla.regla, regla.nombre]
    });
  }
}

function validarNota(nota) {
  const notaLimpia = typeof nota === 'string' ? nota.trim().replace(',', '.') : String(nota ?? '').trim();
  if (!notaLimpia) return { valida: false, vacia: true, valor: '' };

  const valor = Number(notaLimpia);
  return {
    valida: Number.isFinite(valor) && valor >= 1 && valor <= 10,
    vacia: false,
    valor: notaLimpia
  };
}

function normalizarUnidad(unidad) {
  const unidadLimpia = unidad === null || unidad === undefined ? '' : String(unidad).trim();
  if (!unidadLimpia) return { valida: true, valor: null };
  if (!/^\d+$/.test(unidadLimpia) || Number(unidadLimpia) < 1) {
    return { valida: false, valor: null };
  }
  return { valida: true, valor: Number(unidadLimpia) };
}

// --- AUTENTICACIÓN Y ALUMNOS ---

// Valida credenciales consultando directamente a la tabla alumnos en Turso
export async function validarLoginAction(usuarioInput, passwordInput) {
  try {
    const userClean = usuarioInput.trim();
    const passClean = passwordInput.trim();

    const res = await db.execute({
      sql: 'SELECT nombre, password FROM alumnos WHERE LOWER(nombre) = LOWER(?)',
      args: [userClean]
    });

    if (res.rows.length === 0) {
      return { exito: false, mensaje: 'Usuario no registrado en el sistema' };
    }

    const usuarioDB = res.rows[0];
    // Si un alumno no tiene password definida en la BD, se usa su nombre como clave por defecto
    const claveEsperada = usuarioDB.password ? usuarioDB.password : usuarioDB.nombre;

    if (passClean === claveEsperada) {
      return { exito: true, usuario: usuarioDB.nombre };
    } else {
      return { exito: false, mensaje: 'Contraseña incorrecta' };
    }
  } catch (error) {
    console.error('Error en validarLoginAction:', error);
    return { exito: false, mensaje: 'Error de conexión con la base de datos' };
  }
}

// Cambiar contraseña en la tabla alumnos en Turso
export async function cambiarPasswordAction(usuarioInput, passActualInput, passNuevaInput) {
  try {
    const userClean = usuarioInput ? usuarioInput.trim() : '';
    const passActualClean = passActualInput ? passActualInput.trim() : '';
    const passNuevaClean = passNuevaInput ? passNuevaInput.trim() : '';

    if (!userClean || !passActualClean || !passNuevaClean) {
      return { exito: false, mensaje: 'Completá todos los campos.' };
    }

    if (passNuevaClean.length < 6) {
      return { exito: false, mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    // 1. Validamos credenciales actuales
    const loginValido = await validarLoginAction(userClean, passActualClean);
    if (!loginValido.exito) {
      return { exito: false, mensaje: 'La contraseña actual es incorrecta.' };
    }

    // 2. Actualizamos el campo password en la base de datos Turso
    await db.execute({
      sql: 'UPDATE alumnos SET password = ? WHERE LOWER(nombre) = LOWER(?)',
      args: [passNuevaClean, userClean]
    });

    return { exito: true, mensaje: '¡Contraseña actualizada con éxito!' };
  } catch (error) {
    console.error('Error en cambiarPasswordAction:', error);
    return { exito: false, mensaje: 'Error al cambiar la contraseña en la base de datos.' };
  }
}

// Obtener todos los alumnos registrados
export async function obtenerAlumnosAction() {
  try {
    const res = await db.execute('SELECT nombre FROM alumnos ORDER BY nombre ASC');
    return res.rows.map((r) => r.nombre);
  } catch (error) {
    console.error('Error al obtener alumnos:', error);
    return [];
  }
}

// Crear nuevo alumno en la BD
export async function crearAlumnoAction(nombre) {
  try {
    const nombreFormateado = nombre.trim();
    if (!nombreFormateado) return;
    const id = 'a_' + Date.now();
    await db.execute({
      sql: 'INSERT INTO alumnos (id, nombre, password) VALUES (?, ?, ?)',
      args: [id, nombreFormateado, nombreFormateado]
    });
  } catch (error) {
    console.error('Error en crearAlumnoAction:', error);
  }
}

// Renombrar alumno
export async function editarAlumnoAction(nombreAntiguo, nuevoNombre) {
  try {
    await asegurarEsquemaNotasTareas();
    const nuevoFormateado = nuevoNombre.trim();
    if (!nuevoFormateado) return;

    await db.execute({
      sql: 'UPDATE alumnos SET nombre = ? WHERE nombre = ?',
      args: [nuevoFormateado, nombreAntiguo]
    });

    await db.execute({
      sql: 'UPDATE completadas SET alumno = ? WHERE alumno = ?',
      args: [nuevoFormateado, nombreAntiguo]
    });

    await db.execute({
      sql: 'UPDATE notas_parciales SET alumno = ? WHERE alumno = ?',
      args: [nuevoFormateado, nombreAntiguo]
    });
    await db.execute({
      sql: 'UPDATE notas_tareas SET alumno = ? WHERE alumno = ?',
      args: [nuevoFormateado, nombreAntiguo]
    });
  } catch (error) {
    console.error('Error en editarAlumnoAction:', error);
  }
}

// Eliminar alumno de la BD
export async function eliminarAlumnoAction(nombre) {
  try {
    await asegurarEsquemaNotasTareas();
    await db.execute({
      sql: 'DELETE FROM alumnos WHERE nombre = ?',
      args: [nombre]
    });
    await db.execute({
      sql: 'DELETE FROM completadas WHERE alumno = ?',
      args: [nombre]
    });
    await db.execute({
      sql: 'DELETE FROM notas_parciales WHERE alumno = ?',
      args: [nombre]
    });
    await db.execute({
      sql: 'DELETE FROM notas_tareas WHERE alumno = ?',
      args: [nombre]
    });
  } catch (error) {
    console.error('Error en eliminarAlumnoAction:', error);
  }
}

// --- MATERIAS Y TAREAS ---

export async function obtenerDatos() {
  try {
    await asegurarEsquemaNotasTareas();
    const [resMaterias, resTareas, resCompletadas] = await Promise.all([
      db.execute('SELECT * FROM materias ORDER BY nombre ASC'),
      db.execute('SELECT * FROM tareas'),
      db.execute('SELECT * FROM completadas')
    ]);

    const tareasPorMateria = new Map();
    resTareas.rows.forEach((tarea) => {
      const tareasMateria = tareasPorMateria.get(tarea.materia_id) || [];
      tareasMateria.push(tarea);
      tareasPorMateria.set(tarea.materia_id, tareasMateria);
    });

    const completadasPorTarea = new Map();
    resCompletadas.rows.forEach((completada) => {
      const completadasTarea = completadasPorTarea.get(completada.tarea_id) || [];
      completadasTarea.push(completada);
      completadasPorTarea.set(completada.tarea_id, completadasTarea);
    });

    const resNotasTareas = await db.execute('SELECT tarea_id, alumno, nota, cargada_en FROM notas_tareas');
    const notasPorTarea = new Map();
    const fechasNotasPorTarea = new Map();
    resNotasTareas.rows.forEach((nota) => {
      const notasTarea = notasPorTarea.get(nota.tarea_id) || {};
      notasTarea[nota.alumno] = nota.nota;
      notasPorTarea.set(nota.tarea_id, notasTarea);

      const fechasNotasTarea = fechasNotasPorTarea.get(nota.tarea_id) || {};
      fechasNotasTarea[nota.alumno] = nota.cargada_en;
      fechasNotasPorTarea.set(nota.tarea_id, fechasNotasTarea);
    });

    const materias = resMaterias.rows.map((m) => {
      const tareasMateria = tareasPorMateria.get(m.id) || [];

      const tareasConCompletados = tareasMateria.map((t) => {
        const completadas = completadasPorTarea.get(t.id) || [];
        const notas = notasPorTarea.get(t.id) || {};
        const notaCargadaEn = fechasNotasPorTarea.get(t.id) || {};
        const completadoPor = completadas.map((c) => c.alumno);
        const completadoEn = Object.fromEntries(
          completadas.map((c) => [c.alumno, c.completada_en])
        );

        return {
          id: t.id,
          nombre: t.nombre,
          inicio: t.inicio,
          fin: t.fin,
          detalles: t.detalles,
          unidad: t.unidad || '',
          conNota: Number(t.con_nota) === 1,
          tipo: t.tipo || 'actividad',
          completadoPor,
          completadoEn,
          notas,
          notaCargadaEn
        };
      });

      return {
        id: m.id,
        nombre: m.nombre,
        condiciones: m.condiciones || '',
        notaMinimaRegularizar: Number(m.nota_minima_regularizar) || 4,
        notaMinimaPromocionar: Number(m.nota_minima_promocionar) || 8,
        reglaPromocion: m.regla_promocion || 'tp_nota',
        tareas: tareasConCompletados
      };
    });

    return materias;
  } catch (error) {
    console.error('Error al obtener datos de Turso:', error);
    return [];
  }
}

export async function toggleTareaAction(tareaId, alumno) {
  try {
    const tarea = await db.execute({
      sql: 'SELECT inicio, fin FROM tareas WHERE id = ?',
      args: [tareaId]
    });
    if (tarea.rows.length === 0) return { exito: false, mensaje: 'La tarea no existe.' };
    if (!tareaHabilitada(tarea.rows[0].inicio)) {
      return { exito: false, mensaje: 'La tarea todavía no está habilitada.' };
    }
    if (!tareaDentroDelPlazo(tarea.rows[0].fin)) {
      return { exito: false, mensaje: 'La tarea ya cerró.' };
    }

    const existe = await db.execute({
      sql: 'SELECT * FROM completadas WHERE tarea_id = ? AND alumno = ?',
      args: [tareaId, alumno]
    });

    if (existe.rows.length > 0) {
      await db.execute({
        sql: 'DELETE FROM completadas WHERE tarea_id = ? AND alumno = ?',
        args: [tareaId, alumno]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO completadas (tarea_id, alumno, completada_en) VALUES (?, ?, datetime('now'))",
        args: [tareaId, alumno]
      });
    }
    return { exito: true };
  } catch (error) {
    console.error('Error en toggleTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo actualizar la tarea.' };
  }
}

export async function crearMateriaAction({ nombre, anio, cuatrimestre }) {
  try {
    const nombreFormateado = nombre?.trim();
    const anioNumerico = Number(anio);
    const cuatrimestreNumerico = Number(cuatrimestre);

    if (!nombreFormateado) {
      return { exito: false, mensaje: 'El nombre de la materia es obligatorio.' };
    }
    if (!Number.isInteger(anioNumerico) || anioNumerico < 2000) {
      return { exito: false, mensaje: 'Ingresá un año válido.' };
    }
    if (![1, 2].includes(cuatrimestreNumerico)) {
      return { exito: false, mensaje: 'El cuatrimestre debe ser 1 o 2.' };
    }

    const periodoId = `periodo_${anioNumerico}_${cuatrimestreNumerico}`;
    const id = 'm_' + Date.now();
    await db.execute({
      sql: 'INSERT OR IGNORE INTO periodos (id, anio, cuatrimestre, nombre, activo) VALUES (?, ?, ?, ?, 1)',
      args: [periodoId, anioNumerico, cuatrimestreNumerico, `${anioNumerico} - ${cuatrimestreNumerico}° cuatrimestre`]
    });
    await db.execute({
      sql: 'INSERT INTO materias (id, nombre, periodo_id) VALUES (?, ?, ?)',
      args: [id, nombreFormateado.toUpperCase(), periodoId]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearMateriaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la materia.' };
  }
}

export async function renombrarMateriaAction(id, nuevoNombre) {
  try {
    await db.execute({
      sql: 'UPDATE materias SET nombre = ? WHERE id = ?',
      args: [nuevoNombre.toUpperCase().trim(), id]
    });
  } catch (error) {
    console.error('Error en renombrarMateriaAction:', error);
  }
}

export async function editarCondicionesMateriaAction({ id, condiciones, notaMinimaRegularizar, notaMinimaPromocionar, reglaPromocion, usuario }) {
  try {
    const regularizar = Number(notaMinimaRegularizar);
    const promocionar = Number(notaMinimaPromocionar);
    const maximo = ['activos_porcentaje', 'tp_porcentaje_nota'].includes(reglaPromocion) ? 100 : 10;
    if (!esAdministrador(usuario)) {
      return { exito: false, mensaje: 'Solo el administrador puede editar condiciones.' };
    }
    if (![regularizar, promocionar].every((nota) => Number.isFinite(nota) && nota >= 1 && nota <= maximo)) {
      return { exito: false, mensaje: `Los valores mínimos deben estar entre 1 y ${maximo}.` };
    }
    if (promocionar < regularizar) {
      return { exito: false, mensaje: 'La nota para promocionar no puede ser menor que la de regularización.' };
    }
    await db.execute({
      sql: 'UPDATE materias SET condiciones = ?, nota_minima_regularizar = ?, nota_minima_promocionar = ? WHERE id = ?',
      args: [condiciones?.trim() || '', regularizar, promocionar, id]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error al editar condiciones de materia:', error);
    return { exito: false, mensaje: 'No se pudieron guardar las condiciones.' };
  }
}

export async function eliminarMateriaAction(id) {
  try {
    await db.execute({
      sql: 'DELETE FROM materias WHERE id = ?',
      args: [id]
    });
  } catch (error) {
    console.error('Error en eliminarMateriaAction:', error);
  }
}

export async function crearTareaAction({ materiaId, nombre, inicio, fin, detalles, unidad, conNota, tipo }) {
  try {
    const unidadNormalizada = normalizarUnidad(unidad);
    if (!unidadNormalizada.valida) {
      return { exito: false, mensaje: 'La unidad debe ser un número entero mayor o igual a 1.' };
    }
    const conNotaNumerico = conNota ? 1 : 0;
    const tipoNormalizado = ['actividad', 'foro', 'trabajo_practico'].includes(tipo) ? tipo : 'actividad';

    const id = 't_' + Date.now();
    await db.execute({
      sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles, unidad, con_nota, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, nombre, inicio || 'Sin fecha', fin || 'Sin fecha', detalles || 'Sin observaciones', unidadNormalizada.valor, conNotaNumerico, tipoNormalizado]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo crear la tarea.' };
  }
}

export async function editarTareaAction({ id, nombre, inicio, fin, detalles, unidad, conNota, tipo }) {
  try {
    const unidadNormalizada = normalizarUnidad(unidad);
    if (!unidadNormalizada.valida) {
      return { exito: false, mensaje: 'La unidad debe ser un número entero mayor o igual a 1.' };
    }
    const conNotaNumerico = conNota ? 1 : 0;
    const tipoNormalizado = ['actividad', 'foro', 'trabajo_practico'].includes(tipo) ? tipo : 'actividad';

    await db.execute({
      sql: 'UPDATE tareas SET nombre = ?, inicio = ?, fin = ?, detalles = ?, unidad = ?, con_nota = ?, tipo = ? WHERE id = ?',
      args: [nombre, inicio, fin, detalles, unidadNormalizada.valor, conNotaNumerico, tipoNormalizado, id]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en editarTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo editar la tarea.' };
  }
}

export async function eliminarTareaAction(id) {
  try {
    await asegurarEsquemaNotasTareas();
    await db.execute({ sql: 'DELETE FROM notas_tareas WHERE tarea_id = ?', args: [id] });
    await db.execute({
      sql: 'DELETE FROM tareas WHERE id = ?',
      args: [id]
    });
  } catch (error) {
    console.error('Error en eliminarTareaAction:', error);
  }
}

// --- HORARIOS DE CURSADA ---

export async function obtenerHorariosAction() {
  try {
    const res = await db.execute('SELECT * FROM horarios WHERE CAST(dia AS INTEGER) BETWEEN 1 AND 5 ORDER BY dia ASC, hora_inicio ASC');
    return res.rows;
  } catch (error) {
    console.error('Error al obtener horarios:', error);
    return [];
  }
}

export async function crearHorarioAction({ materiaId, dia, horaInicio, horaFin, aula, usuario }) {
  try {
    if (!esAdministrador(usuario)) {
      return { exito: false, mensaje: 'Solo el administrador puede crear horarios.' };
    }

    const diaNumerico = Number(dia);
    if (!Number.isInteger(diaNumerico) || diaNumerico < 1 || diaNumerico > 5) {
      return { exito: false, mensaje: 'Los horarios solo pueden cargarse de lunes a viernes.' };
    }

    const id = 'horario_' + Date.now();
    await db.execute({
      sql: 'INSERT INTO horarios (id, materia_id, dia, hora_inicio, hora_fin, aula) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, diaNumerico, horaInicio, horaFin, aula?.trim() || '']
    });
    return { exito: true };
  } catch (error) {
    console.error('Error al crear horario:', error);
    return { exito: false, mensaje: 'No se pudo crear el horario.' };
  }
}

export async function eliminarHorarioAction(id, usuario) {
  try {
    if (!esAdministrador(usuario)) {
      return { exito: false, mensaje: 'Solo el administrador puede borrar horarios.' };
    }

    await db.execute({ sql: 'DELETE FROM horarios WHERE id = ?', args: [id] });
    return { exito: true };
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    return { exito: false, mensaje: 'No se pudo borrar el horario.' };
  }
}

// --- PARCIALES Y NOTAS ---

export async function obtenerParcialesAction() {
  try {
    const [resParciales, resNotas] = await Promise.all([
      db.execute('SELECT * FROM parciales ORDER BY fecha ASC'),
      db.execute('SELECT * FROM notas_parciales')
    ]);

    return {
      parciales: resParciales.rows,
      notas: resNotas.rows
    };
  } catch (error) {
    console.error('Error al obtener parciales:', error);
    return { parciales: [], notas: [] };
  }
}

export async function crearParcialAction({ materiaId, nombre, fecha, detalles, usuario }) {
  try {
    if (!esAdministrador(usuario)) {
      return { exito: false, mensaje: 'Solo el administrador puede crear parciales.' };
    }

    const id = 'parcial_' + Date.now();
    await db.execute({
      sql: 'INSERT INTO parciales (id, materia_id, nombre, fecha, detalles) VALUES (?, ?, ?, ?, ?)',
      args: [id, materiaId, nombre, fecha || 'Sin fecha', detalles || 'Sin observaciones']
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en crearParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo crear el parcial.' };
  }
}

export async function editarParcialAction({ id, materiaId, nombre, fecha, detalles, usuario }) {
  try {
    if (!esAdministrador(usuario)) {
      return { exito: false, mensaje: 'Solo el administrador puede editar parciales.' };
    }

    await db.execute({
      sql: 'UPDATE parciales SET materia_id = ?, nombre = ?, fecha = ?, detalles = ? WHERE id = ?',
      args: [materiaId, nombre, fecha || 'Sin fecha', detalles || 'Sin observaciones', id]
    });
    return { exito: true };
  } catch (error) {
    console.error('Error en editarParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo editar el parcial.' };
  }
}

export async function eliminarParcialAction(id, usuario) {
  try {
    if (!esAdministrador(usuario)) {
      return { exito: false, mensaje: 'Solo el administrador puede borrar parciales.' };
    }

    await db.execute({ sql: 'DELETE FROM parciales WHERE id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM notas_parciales WHERE parcial_id = ?', args: [id] });
    return { exito: true };
  } catch (error) {
    console.error('Error en eliminarParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo borrar el parcial.' };
  }
}

export async function guardarNotaParcialAction(parcialId, alumno, nota, usuario) {
  try {
    if (!esAdministrador(usuario)) {
      return { exito: false, mensaje: 'Solo el administrador puede cargar o editar notas.' };
    }

    const parcial = await db.execute({
      sql: 'SELECT fecha FROM parciales WHERE id = ?',
      args: [parcialId]
    });

    if (parcial.rows.length === 0) {
      return { exito: false, mensaje: 'El parcial no existe.' };
    }

    if (!parcialHabilitado(parcial.rows[0].fecha)) {
      return { exito: false, mensaje: 'La nota se puede cargar a partir de la fecha del parcial.' };
    }

    const notaLimpia = typeof nota === 'string' ? nota.trim() : '';
    const validacion = validarNota(nota);
    if (!validacion.vacia && !validacion.valida) {
      return { exito: false, mensaje: 'La nota debe ser un número entre 1 y 10.' };
    }
    
    // Verificamos si ya existe nota cargada para este alumno en este parcial
    const existe = await db.execute({
      sql: 'SELECT id FROM notas_parciales WHERE parcial_id = ? AND alumno = ?',
      args: [parcialId, alumno]
    });

    if (existe.rows.length > 0) {
      if (notaLimpia === '') {
        // Si borra el input, eliminamos la nota registrada
        await db.execute({
          sql: 'DELETE FROM notas_parciales WHERE parcial_id = ? AND alumno = ?',
          args: [parcialId, alumno]
        });
      } else {
        // Actualizamos la nota
        await db.execute({
          sql: 'UPDATE notas_parciales SET nota = ? WHERE parcial_id = ? AND alumno = ?',
          args: [validacion.valor, parcialId, alumno]
        });
      }
    } else if (notaLimpia !== '') {
      // Insertamos nueva nota
      const id = 'nota_' + Date.now();
      await db.execute({
        sql: 'INSERT INTO notas_parciales (id, parcial_id, alumno, nota) VALUES (?, ?, ?, ?)',
        args: [id, parcialId, alumno, notaLimpia]
      });
    }
    return { exito: true };
  } catch (error) {
    console.error('Error en guardarNotaParcialAction:', error);
    return { exito: false, mensaje: 'No se pudo guardar la nota.' };
  }
}

export async function guardarNotaTareaAction(tareaId, alumno, nota, usuario) {
  try {
    await asegurarEsquemaNotasTareas();

    if (!alumno || (alumno !== usuario && !esAdministrador(usuario))) {
      return { exito: false, mensaje: 'Solo podés cargar tu propia nota.' };
    }

    const tarea = await db.execute({
      sql: 'SELECT con_nota, inicio, fin FROM tareas WHERE id = ?',
      args: [tareaId]
    });
    if (tarea.rows.length === 0 || Number(tarea.rows[0].con_nota) !== 1) {
      return { exito: false, mensaje: 'La tarea no está configurada para llevar nota.' };
    }
    if (!tareaHabilitada(tarea.rows[0].inicio)) {
      return { exito: false, mensaje: 'La tarea todavía no está habilitada para cargar notas.' };
    }
    if (!tareaDentroDelPlazo(tarea.rows[0].fin)) {
      return { exito: false, mensaje: 'La tarea ya cerró y no admite notas.' };
    }

    const validacion = validarNota(nota);
    if (!validacion.vacia && !validacion.valida) {
      return { exito: false, mensaje: 'La nota debe ser un número entre 1 y 10.' };
    }

    if (validacion.vacia) {
      await db.execute({
        sql: 'DELETE FROM notas_tareas WHERE tarea_id = ? AND alumno = ?',
        args: [tareaId, alumno]
      });
    } else {
      const cargadaEn = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO notas_tareas (id, tarea_id, alumno, nota, cargada_en) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tarea_id, alumno) DO UPDATE SET nota = excluded.nota, cargada_en = excluded.cargada_en',
        args: [`nota_tarea_${Date.now()}`, tareaId, alumno, validacion.valor, cargadaEn]
      });
    }

    return { exito: true };
  } catch (error) {
    console.error('Error en guardarNotaTareaAction:', error);
    return { exito: false, mensaje: 'No se pudo guardar la nota de la tarea.' };
  }
}
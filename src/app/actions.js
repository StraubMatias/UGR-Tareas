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
  } catch (error) {
    console.error('Error en editarAlumnoAction:', error);
  }
}

// Eliminar alumno de la BD
export async function eliminarAlumnoAction(nombre) {
  try {
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
  } catch (error) {
    console.error('Error en eliminarAlumnoAction:', error);
  }
}

// --- MATERIAS Y TAREAS ---

export async function obtenerDatos() {
  try {
    const resMaterias = await db.execute('SELECT * FROM materias ORDER BY nombre ASC');
    const resTareas = await db.execute('SELECT * FROM tareas');
    const resCompletadas = await db.execute('SELECT * FROM completadas');

    const materias = resMaterias.rows.map((m) => {
      const tareasMateria = resTareas.rows.filter((t) => t.materia_id === m.id);

      const tareasConCompletados = tareasMateria.map((t) => {
        const completadas = resCompletadas.rows.filter((c) => c.tarea_id === t.id);
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
          completadoPor,
          completadoEn
        };
      });

      return {
        id: m.id,
        nombre: m.nombre,
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
  } catch (error) {
    console.error('Error en toggleTareaAction:', error);
  }
}

export async function crearMateriaAction(nombre) {
  try {
    const id = 'm_' + Date.now();
    await db.execute({
      sql: 'INSERT INTO materias (id, nombre) VALUES (?, ?)',
      args: [id, nombre.toUpperCase().trim()]
    });
  } catch (error) {
    console.error('Error en crearMateriaAction:', error);
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

export async function crearTareaAction({ materiaId, nombre, inicio, fin, detalles }) {
  try {
    const id = 't_' + Date.now();
    await db.execute({
      sql: 'INSERT INTO tareas (id, materia_id, nombre, inicio, fin, detalles) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, materiaId, nombre, inicio || 'Sin fecha', fin || 'Sin fecha', detalles || 'Sin observaciones']
    });
  } catch (error) {
    console.error('Error en crearTareaAction:', error);
  }
}

export async function editarTareaAction({ id, nombre, inicio, fin, detalles }) {
  try {
    await db.execute({
      sql: 'UPDATE tareas SET nombre = ?, inicio = ?, fin = ?, detalles = ? WHERE id = ?',
      args: [nombre, inicio, fin, detalles, id]
    });
  } catch (error) {
    console.error('Error en editarTareaAction:', error);
  }
}

export async function eliminarTareaAction(id) {
  try {
    await db.execute({
      sql: 'DELETE FROM tareas WHERE id = ?',
      args: [id]
    });
  } catch (error) {
    console.error('Error en eliminarTareaAction:', error);
  }
}

// --- PARCIALES Y NOTAS ---

export async function obtenerParcialesAction() {
  try {
    const resParciales = await db.execute('SELECT * FROM parciales ORDER BY fecha ASC');
    const resNotas = await db.execute('SELECT * FROM notas_parciales');

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
          args: [notaLimpia, parcialId, alumno]
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
'use server';

import { db } from './turso';

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
        const completadoPor = resCompletadas.rows
          .filter((c) => c.tarea_id === t.id)
          .map((c) => c.alumno);

        return {
          id: t.id,
          nombre: t.nombre,
          inicio: t.inicio,
          fin: t.fin,
          detalles: t.detalles,
          completadoPor
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
        sql: 'INSERT INTO completadas (tarea_id, alumno) VALUES (?, ?)',
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
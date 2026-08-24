export async function cambiarPasswordAction(usuario, passActual, passNueva) {
  try {
    if (!usuario || !passActual || !passNueva) {
      return { exito: false, mensaje: 'Completá todos los campos.' };
    }

    if (passNueva.length < 6) {
      return { exito: false, mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    // 1. Validamos que la contraseña actual sea la correcta
    const loginValido = await validarLoginAction(usuario, passActual);
    if (!loginValido.exito) {
      return { exito: false, mensaje: 'La contraseña actual es incorrecta.' };
    }

    // 2. Aquí actualizás la contraseña en tu base de datos.
    // Ejemplo si usás la BD que definiste para usuarios/alumnos:
    // await db.collection('usuarios').updateOne({ usuario }, { $set: { password: passNueva } });
    
    // (Ajustá esta línea según cómo estés guardando los usuarios/alumnos en tu Server Action)

    return { exito: true, mensaje: '¡Contraseña actualizada con éxito!' };
  } catch (error) {
    return { exito: false, mensaje: 'Error al cambiar la contraseña.' };
  }
}
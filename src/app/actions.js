export async function cambiarPasswordAction(usuario, passActual, passNueva) {
  try {
    if (!usuario || !passActual || !passNueva) {
      return { exito: false, mensaje: 'Completá todos los campos.' };
    }

    if (passNueva.length < 6) {
      return { exito: false, mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    // Validar credenciales actuales
    const loginValido = await validarLoginAction(usuario, passActual);
    if (!loginValido.exito) {
      return { exito: false, mensaje: 'La contraseña actual es incorrecta.' };
    }

    // AQUÍ ACTUALIZÁS EN TU BASE DE DATOS SEGÚN TU LÓGICA
    // Ejemplo: await db.collection('usuarios').updateOne({ usuario }, { $set: { password: passNueva } });

    return { exito: true, mensaje: '¡Contraseña actualizada con éxito!' };
  } catch (error) {
    return { exito: false, mensaje: 'Error al cambiar la contraseña.' };
  }
}
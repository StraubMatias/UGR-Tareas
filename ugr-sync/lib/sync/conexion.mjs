// Cliente HTTP autenticado contra UGR Virtual (sesión Moodle).
import { crearCliente } from '../red.mjs';
import { optimizarLecturas } from '../lecturas.mjs';
import { cargarCredencialesUGR, mensajeFaltaCredencialesUGR, variableEntorno } from './env.mjs';

export async function conectarUGR() {
  cargarCredencialesUGR();
  const usuario = variableEntorno('UGRVIRTUAL_USER');
  const contrasena = variableEntorno('UGRVIRTUAL_PASSWORD');
  if (!usuario || !contrasena) {
    throw new Error(mensajeFaltaCredencialesUGR());
  }
  return optimizarLecturas(await crearCliente({ usuario, contrasena }));
}

/** Sesión propia del alumno (cuenta propia); no pisa la cookie del sync de comisión. */
export async function conectarUGRCon({ usuario, contrasena, rutaSesion }) {
  if (!usuario || !contrasena) {
    throw new Error('Faltan las credenciales de UGR Virtual de esta cuenta.');
  }
  return optimizarLecturas(await crearCliente({ usuario, contrasena, rutaSesion }));
}

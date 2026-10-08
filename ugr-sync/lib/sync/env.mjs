// Credenciales UGR en process.env (Next/.env.local, Vercel → Environment Variables, CLI → loadEnvFile).
// Sin lectura del filesystem: evita que Turbopack trace todo el repo en el server bundle.

/** Lectura dinámica para que el bundler de Next no inlinee las claves. */
export function variableEntorno(nombre) {
  return (process.env[nombre] || '').trim();
}

function tieneCredencialesUGR() {
  return Boolean(variableEntorno('UGRVIRTUAL_USER') && variableEntorno('UGRVIRTUAL_PASSWORD'));
}

/** No-op en server: las variables ya están en process.env. El CLI usa `process.loadEnvFile`. */
export function cargarCredencialesUGR() {}

export function mensajeFaltaCredencialesUGR() {
  if (process.env.VERCEL === '1') {
    return (
      'Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en el entorno de Vercel ' +
      '(las variables de entorno no llegaron al proceso del server). ' +
      'Añadí ambas en Vercel → Project Settings → Environment Variables ' +
      '(entorno Production) y hacé un nuevo deploy.'
    );
  }
  return (
    'Faltan UGRVIRTUAL_USER / UGRVIRTUAL_PASSWORD en process.env. ' +
    'Agregalas a .env.local en la raíz del proyecto y reiniciá `npm run dev` ' +
    '(o usá `npm run ugr:sync`, que carga .env.local al inicio).'
  );
}

export function credencialesUGRDisponibles() {
  return tieneCredencialesUGR();
}

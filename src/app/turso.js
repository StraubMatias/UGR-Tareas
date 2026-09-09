import { createClient } from '@libsql/client';

let cliente;

function obtenerCliente() {
  if (cliente) return cliente;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) {
    throw new Error('Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local o en el entorno de despliegue.');
  }

  cliente = createClient({ url, authToken });
  return cliente;
}

export const db = {
  execute(...args) {
    return obtenerCliente().execute(...args);
  },
  batch(...args) {
    return obtenerCliente().batch(...args);
  }
};
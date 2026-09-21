import { createClient, type Client } from '@libsql/client';

let cliente: Client | null = null;

function obtenerCliente(): Client {
  if (cliente) return cliente;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) {
    throw new Error('Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local o en el entorno de despliegue.');
  }

  cliente = createClient({ url, authToken });
  return cliente;
}

// Proxy que delega en el cliente real perezosamente, conservando todos los
// overloads tipados de Client (execute/batch/transaction/...).
export const db: Client = new Proxy({} as Client, {
  get(_target, prop) {
    const clienteReal = obtenerCliente();
    const valor = Reflect.get(clienteReal, prop, clienteReal);
    return typeof valor === 'function' ? (valor as (...args: unknown[]) => unknown).bind(clienteReal) : valor;
  }
});
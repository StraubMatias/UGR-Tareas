import { db } from '../app/turso';

let esquemaCuentasListo = false;

/** Columnas de cuentas propias (ultimo_acceso, etc.). Idempotente. */
export async function asegurarEsquemaCuentasEnServidor(): Promise<void> {
  if (esquemaCuentasListo) return;
  const columnas = await db.execute('PRAGMA table_info(alumnos)');
  const nombres = new Set(columnas.rows.map((fila) => String(fila.name)));
  if (!nombres.has('ultimo_acceso')) {
    await db.execute('ALTER TABLE alumnos ADD COLUMN ultimo_acceso TEXT');
  }
  esquemaCuentasListo = true;
}

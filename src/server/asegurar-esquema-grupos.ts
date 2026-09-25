import type { Client } from '@libsql/client';

let esquemaGruposListo = false;

/** Columnas/tablas de grupos (permite_individual, invitaciones, etc.). Idempotente. */
export async function asegurarEsquemaGruposEnServidor(db: Client): Promise<void> {
  if (esquemaGruposListo) return;
  const { crearEsquemaGrupos } = (await import('../../database/grupos-schema.mjs')) as {
    crearEsquemaGrupos: (db: Client) => Promise<void>;
  };
  await crearEsquemaGrupos(db);
  esquemaGruposListo = true;
}

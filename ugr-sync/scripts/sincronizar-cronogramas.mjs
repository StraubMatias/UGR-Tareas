// Descarga los PDF/DOCX de «Cronograma» de cada curso UGR, actualiza
// cronograma_eventos (origen oficial) y enlaces Zoom en horarios.
// Uso: node --env-file=.env.local ugr-sync/scripts/sincronizar-cronogramas.mjs
import { createClient } from '@libsql/client';
import { conectarUGR, listarCursosDelCampus } from '../lib/sync-core.mjs';
import { coincidirMateria } from '../lib/normalizar.mjs';
import { sincronizarCronogramasOficialesDesdeCampus } from '../lib/cronograma-oficial.mjs';
import { ejecutarHigieneCronograma } from '../../database/cronograma-higiene.mjs';

process.loadEnvFile?.('.env.local');

async function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (!tursoUrl || !tursoToken) {
    console.error('❌ Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN en .env.local');
    process.exit(1);
  }

  const db = createClient({ url: tursoUrl, authToken: tursoToken });
  const cliente = await conectarUGR();
  console.log('🔑 UGR Virtual…');
  await cliente.autenticar();

  const periodo = await db.execute(
    'SELECT id FROM periodos ORDER BY anio DESC, cuatrimestre DESC LIMIT 1'
  );
  const periodoId = periodo.rows[0]?.id;
  const resMaterias = periodoId
    ? await db.execute({ sql: 'SELECT id, nombre FROM materias WHERE periodo_id = ? ORDER BY nombre', args: [periodoId] })
    : await db.execute('SELECT id, nombre FROM materias ORDER BY nombre');
  const cursos = await listarCursosDelCampus(cliente);
  const mapeos = cursos.flatMap((curso) => {
    const coincidencia = coincidirMateria(curso.nombre, resMaterias.rows);
    return coincidencia ? [{ curso, coincidencia }] : [];
  });

  console.log(`📚 ${cursos.length} curso(s), ${mapeos.length} mapeo(s).\n`);

  const resumen = await sincronizarCronogramasOficialesDesdeCampus({ db, cliente, mapeos });
  for (const fila of resumen) {
    console.log(
      `• ${fila.nombre}: ${fila.eventosPdf} fecha(s) desde «${fila.recurso}»`
        + ` → ${fila.insertados} fila(s) oficial(es), -${fila.eliminadosUgr} UGR, -${fila.eliminadosManual} manual`
        + `; Zoom en ${fila.horariosZoom} horario(s)`
    );
  }

  const higiene = await ejecutarHigieneCronograma(db);
  console.log(
    `\n🧹 Higiene: ${higiene.eventosEliminados} evento(s) de ruido; ${higiene.parcialesInsertados} parcial(es) desde plan.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

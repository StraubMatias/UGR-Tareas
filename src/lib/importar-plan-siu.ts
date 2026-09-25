import type { Client } from '@libsql/client';
import { PLAN_DE_ESTUDIO } from '../app/plan-utils';

const CODIGOS_PLAN = new Set(PLAN_DE_ESTUDIO.map((materia) => materia.codigo));

export interface NotaPlanSiu {
  codigo: string;
  nombre: string;
  nota: string;
  estado: string;
}

export interface ResultadoImportacionPlanSiu {
  enCurso: number;
  notasCargadas: NotaPlanSiu[];
  notasYaCargadas: NotaPlanSiu[];
  mensaje: string;
}

export async function importarPlanSiuDesdeCliente(
  db: Client,
  alumno: { id: string; nombre: string },
  cliente: { pedir: (ruta: string, opciones?: unknown) => Promise<unknown> }
): Promise<ResultadoImportacionPlanSiu> {
  // @ts-expect-error módulo ESM del sync SIU
  const { sincronizarSIU, clasificarImportacionPlanSiu } = await import('../../siu-sync/lib/sync-core.mjs');
  const resultado = await sincronizarSIU({ cliente }) as {
    error?: string | null;
    planEstudio?: Array<{ codigoMateria?: string | null; omitir?: boolean; nota?: number | null; enCurso?: boolean }>;
    enCurso?: number;
  };

  if (resultado.error) {
    throw new Error(resultado.error);
  }

  const progresoActual = await db.execute({
    sql: 'SELECT materia_codigo, estado, nota FROM progreso_materias WHERE alumno_id = ? OR LOWER(alumno) = LOWER(?)',
    args: [alumno.id, alumno.nombre]
  });
  const existentes = new Map(
    progresoActual.rows.map((fila) => [
      String(fila.materia_codigo),
      { estado: String(fila.estado || ''), nota: fila.nota == null ? null : String(fila.nota) }
    ])
  );

  const materiasPlan = (resultado.planEstudio || []).filter(
    (materia) => materia.codigoMateria && CODIGOS_PLAN.has(materia.codigoMateria)
  );
  const { cargadas, yaTenias, enCurso } = clasificarImportacionPlanSiu(materiasPlan, existentes) as {
    cargadas: NotaPlanSiu[];
    yaTenias: NotaPlanSiu[];
    enCurso: number;
  };

  if (cargadas.length > 0) {
    const operaciones = cargadas.map((materia) => ({
      sql: `
        INSERT INTO progreso_materias (id, alumno_id, alumno, materia_codigo, estado, nota, actualizado_en)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(alumno, materia_codigo) DO UPDATE SET
          alumno_id = excluded.alumno_id,
          estado = excluded.estado,
          nota = excluded.nota,
          actualizado_en = excluded.actualizado_en
      `,
      args: [
        `progreso_${alumno.id}_${materia.codigo}`,
        alumno.id,
        alumno.nombre,
        materia.codigo,
        materia.estado,
        materia.nota
      ]
    }));
    await db.batch(operaciones, 'write');
  }

  const partesMensaje = [];
  if (cargadas.length > 0) partesMensaje.push(`Se importaron ${cargadas.length} nota(s) del plan de estudio.`);
  if (yaTenias.length > 0) partesMensaje.push(`${yaTenias.length} materia(s) ya tenían la misma nota cargada.`);
  if (cargadas.length === 0 && yaTenias.length === 0) {
    partesMensaje.push('No hay notas nuevas para importar (solo materias en curso o sin nota final).');
  }

  return {
    enCurso: enCurso ?? resultado.enCurso ?? 0,
    notasCargadas: cargadas,
    notasYaCargadas: yaTenias,
    mensaje: partesMensaje.join(' ')
  };
}

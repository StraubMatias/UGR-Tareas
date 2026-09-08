import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

process.loadEnvFile?.('.env.local');

const scryptAsync = promisify(scrypt);

async function hashearPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivada = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derivada).toString('hex')}`;
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const MATERIAS_PRIMER_CUATRIMESTRE = ['1.1.1', '1.2.1', '1.3.1', '1.4.1', '1.5.1'];

async function columnaExiste(tabla, columna) {
  const resultado = await db.execute(`PRAGMA table_info(${tabla})`);
  return resultado.rows.some((fila) => fila.name === columna);
}

async function agregarColumnaSiFalta(tabla, columna, definicion) {
  if (!(await columnaExiste(tabla, columna))) {
    await db.execute(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
}

async function ejecutarMigracion(numero, nombre, ejecutar) {
  const aplicada = await db.execute({
    sql: 'SELECT 1 FROM migraciones WHERE numero = ?',
    args: [numero]
  });
  if (aplicada.rows.length > 0) return;

  await ejecutar();
  await db.execute({
    sql: "INSERT INTO migraciones (numero, nombre, aplicada_en) VALUES (?, ?, datetime('now'))",
    args: [numero, nombre]
  });
  console.log(`Migración ${numero}: ${nombre}`);
}

async function main() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS migraciones (
      numero INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      aplicada_en TEXT NOT NULL
    )
  `);

  await ejecutarMigracion(1, 'normalizar esquema existente', async () => {
    await db.execute(
      'CREATE TABLE IF NOT EXISTS notas_tareas (id TEXT PRIMARY KEY, tarea_id TEXT NOT NULL, alumno TEXT NOT NULL, nota TEXT NOT NULL, cargada_en TEXT, UNIQUE(tarea_id, alumno))'
    );
    await agregarColumnaSiFalta('notas_tareas', 'cargada_en', 'TEXT');
    await agregarColumnaSiFalta('tareas', 'con_nota', 'INTEGER NOT NULL DEFAULT 0');
    await agregarColumnaSiFalta('tareas', 'tipo', "TEXT NOT NULL DEFAULT 'actividad'");
    await agregarColumnaSiFalta('materias', 'condiciones', "TEXT NOT NULL DEFAULT ''");
    await agregarColumnaSiFalta('materias', 'nota_minima_regularizar', 'REAL NOT NULL DEFAULT 4');
    await agregarColumnaSiFalta('materias', 'nota_minima_promocionar', 'REAL NOT NULL DEFAULT 8');
    await agregarColumnaSiFalta('materias', 'regla_promocion', "TEXT NOT NULL DEFAULT 'tp_nota'");
    await agregarColumnaSiFalta('alumnos', 'rol', "TEXT NOT NULL DEFAULT 'alumno'");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS progreso_materias (
        id TEXT PRIMARY KEY,
        alumno TEXT NOT NULL,
        materia_codigo TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        nota TEXT,
        actualizado_en TEXT,
        UNIQUE(alumno, materia_codigo)
      )
    `);

    await db.execute("UPDATE alumnos SET rol = 'admin' WHERE LOWER(nombre) = 'matute'");
    await db.execute("UPDATE alumnos SET rol = 'alumno' WHERE rol IS NULL OR rol NOT IN ('admin', 'alumno')");

    const alumnosIniciales = await db.execute('SELECT nombre FROM alumnos');
    for (const alumno of alumnosIniciales.rows) {
      for (const codigo of MATERIAS_PRIMER_CUATRIMESTRE) {
        await db.execute({
          sql: `
            INSERT OR IGNORE INTO progreso_materias
              (id, alumno, materia_codigo, estado, actualizado_en)
            VALUES (?, ?, ?, 'aprobada', datetime('now'))
          `,
          args: [`progreso_${alumno.nombre}_${codigo}`, alumno.nombre, codigo]
        });
      }
    }

    await db.execute({
      sql: "UPDATE materias SET condiciones = ?, nota_minima_regularizar = 4, nota_minima_promocionar = 8 WHERE nombre LIKE ? AND (condiciones IS NULL OR condiciones = '')",
      args: [
        'Para regularizar la materia es necesario haber completado los trabajos prácticos propuestos. Quienes aprueben los trabajos prácticos con 8 (ocho) o más promueven la materia sin rendir el final.',
        '%SISTEMAS DE GESTIÓN DE SEGURIDAD DE LA INFORMACIÓN%'
      ]
    });

    await db.execute({
      sql: "UPDATE materias SET regla_promocion = 'tp_porcentaje_nota', nota_minima_regularizar = 75, nota_minima_promocionar = 8 WHERE nombre LIKE ? AND condiciones LIKE '%75%%' AND condiciones LIKE '%100%%'",
      args: ['%SISTEMAS DE GESTIÓN DE SEGURIDAD DE LA INFORMACIÓN%']
    });

    const reglasIniciales = [
      {
        nombre: '%AUDITORÍAS DE SEGURIDAD DE LA INFORMACIÓN%',
        regla: 'auditorias_tps',
        condiciones: 'Para regularizar la materia se necesita una nota de cursada de 6 (seis) o más y una nota de 6 (seis) o más en cada trabajo práctico. Promociona quien obtiene como mínimo 8 (ocho) en la cursada y 8 (ocho) o más en cada trabajo práctico.',
        regularizar: 6,
        promocionar: 8
      },
      {
        nombre: '%CIBERDELITOS%',
        regla: 'ciberdelitos_parciales',
        condiciones: 'Para regularizar y poder rendir el final hay que aprobar los dos parciales con nota mínima de 6 (seis) en cada uno. Promociona quien aprueba cada parcial con nota mínima de 8 (ocho).',
        regularizar: 6,
        promocionar: 8
      },
      {
        nombre: '%EVALUACIÓN Y GESTIÓN DE RIESGOS%',
        regla: 'riesgos_tps',
        condiciones: 'Para regularizar la materia es necesario haber completado al menos tres actividades prácticas obligatorias. Promociona quien tiene todos los trabajos prácticos aprobados con nota 8 (ocho) o más.',
        regularizar: 6,
        promocionar: 8
      },
      {
        nombre: '%GESTIÓN DE ACTIVOS DE LA INFORMACIÓN%',
        regla: 'activos_porcentaje',
        condiciones: 'Regulariza quien completa al menos el 75% de todas las actividades de la plataforma: tareas, foros, actividades y trabajos prácticos. Promociona quien completa al menos el 90% de esas actividades al cierre de regularidades.',
        regularizar: 75,
        promocionar: 90
      }
    ];

    for (const regla of reglasIniciales) {
      await db.execute({
        sql: 'UPDATE materias SET condiciones = ?, nota_minima_regularizar = ?, nota_minima_promocionar = ?, regla_promocion = ? WHERE nombre LIKE ? AND (condiciones IS NULL OR condiciones = \'\')',
        args: [regla.condiciones, regla.regularizar, regla.promocionar, regla.regla, regla.nombre]
      });
    }
  });

  await ejecutarMigracion(2, 'agregar IDs estables de alumnos', async () => {
    for (const tabla of ['completadas', 'notas_parciales', 'notas_tareas', 'progreso_materias']) {
      await agregarColumnaSiFalta(tabla, 'alumno_id', 'TEXT');
    }

    await db.batch([
      { sql: 'UPDATE completadas SET alumno_id = (SELECT id FROM alumnos WHERE LOWER(alumnos.nombre) = LOWER(completadas.alumno)) WHERE alumno_id IS NULL', args: [] },
      { sql: 'UPDATE notas_parciales SET alumno_id = (SELECT id FROM alumnos WHERE LOWER(alumnos.nombre) = LOWER(notas_parciales.alumno)) WHERE alumno_id IS NULL', args: [] },
      { sql: 'UPDATE notas_tareas SET alumno_id = (SELECT id FROM alumnos WHERE LOWER(alumnos.nombre) = LOWER(notas_tareas.alumno)) WHERE alumno_id IS NULL', args: [] },
      { sql: 'UPDATE progreso_materias SET alumno_id = (SELECT id FROM alumnos WHERE LOWER(alumnos.nombre) = LOWER(progreso_materias.alumno)) WHERE alumno_id IS NULL', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_completadas_alumno_id ON completadas(alumno_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_notas_parciales_alumno_id ON notas_parciales(alumno_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_notas_tareas_alumno_id ON notas_tareas(alumno_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_progreso_materias_alumno_id ON progreso_materias(alumno_id)', args: [] }
    ], 'write');
  });

  await ejecutarMigracion(3, 'hashear contraseñas en texto plano', async () => {
    const alumnos = await db.execute('SELECT id, nombre, password FROM alumnos');
    for (const alumno of alumnos.rows) {
      if (String(alumno.password || '').startsWith('scrypt$')) continue;
      const plano = alumno.password || alumno.nombre;
      await db.execute({
        sql: 'UPDATE alumnos SET password = ? WHERE id = ?',
        args: [await hashearPassword(plano), alumno.id]
      });
    }
  });

  await ejecutarMigracion(4, 'registrar intentos de login', async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS login_intentos (
        clave TEXT PRIMARY KEY,
        fallos INTEGER NOT NULL DEFAULT 0,
        ventana_inicio INTEGER NOT NULL,
        bloqueado_hasta INTEGER
      )
    `);
  });

  await ejecutarMigracion(5, 'indices de consultas por periodo', async () => {
    await db.batch([
      { sql: 'CREATE INDEX IF NOT EXISTS idx_alumnos_nombre_lower ON alumnos(LOWER(nombre))', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_materias_periodo_id ON materias(periodo_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_tareas_materia_id ON tareas(materia_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_completadas_tarea_id ON completadas(tarea_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_completadas_tarea_alumno ON completadas(tarea_id, alumno_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_notas_tareas_tarea_id ON notas_tareas(tarea_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_parciales_materia_id ON parciales(materia_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_notas_parciales_parcial_id ON notas_parciales(parcial_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_notas_parciales_parcial_alumno ON notas_parciales(parcial_id, alumno_id)', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_horarios_materia_id ON horarios(materia_id)', args: [] }
    ], 'write');
  });

  await db.close?.();
}

main().catch(async (error) => {
  console.error('No se pudieron ejecutar las migraciones:', error);
  await db.close?.();
  process.exitCode = 1;
});

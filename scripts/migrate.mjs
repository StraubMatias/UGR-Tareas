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

  await ejecutarMigracion(6, 'revocación de sesiones', async () => {
    await agregarColumnaSiFalta('alumnos', 'sesion_version', 'INTEGER NOT NULL DEFAULT 1');
  });

  await ejecutarMigracion(7, 'agregar cronogramas académicos con modalidad', async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cronograma_eventos (
        id TEXT PRIMARY KEY,
        materia_id TEXT NOT NULL,
        fecha TEXT NOT NULL,
        modalidad TEXT NOT NULL DEFAULT 'sincrónico',
        tipo TEXT NOT NULL DEFAULT 'clase',
        titulo TEXT NOT NULL,
        detalles TEXT NOT NULL DEFAULT '',
        UNIQUE(materia_id, fecha, titulo)
      )
    `);

    const materias = await db.execute('SELECT id, nombre FROM materias');
    const buscarMateria = (texto) => materias.rows.find((materia) => materia.nombre.includes(texto));
    const eventos = [
      {
        materia: 'GESTIÓN DE ACTIVOS',
        filas: [
          ['2026-08-24', 'sincrónico', 'clase', 'Introducción a la materia y activos de información', 'Activos empresariales, ciclo de vida, ISO 27000 y Joyas de la Corona.'],
          ['2026-08-31', 'sincrónico', 'clase', 'Datos, metadatos y Data Governance', 'DLP, retención, eliminación segura, backups, caché y fuga de información.'],
          ['2026-09-07', 'sincrónico', 'clase', 'Superficie de ataque e inventarios', 'Shadow IT, inventario de sistemas y hardware, dueño y custodio.'],
          ['2026-09-14', 'sincrónico', 'sin_clases', 'Sin clases', 'Semana del turno de examen de septiembre.'],
          ['2026-09-21', 'sincrónico', 'clase', 'Inventario y clasificación de datos', 'Datos públicos, internos, confidenciales y personales.'],
          ['2026-09-28', 'sincrónico', 'clase', 'Inventario de software y servicios', 'Licencias, proveedores, procesos, roles, cloud e IA. Parcial opcional de unidades 1 y 2.'],
          ['2026-10-05', 'sincrónico', 'clase', 'Herramientas de inventariado', 'Hardware, software y herramientas de gestión de activos de TI.'],
          ['2026-10-19', 'sincrónico', 'clase', 'Herramientas de inventariado de datos', 'Cloud, IA y OSINT.'],
          ['2026-10-26', 'sincrónico', 'clase', 'Herramientas de GRC y TPRM', ''],
          ['2026-11-02', 'sincrónico', 'clase', 'Gestión de activos en marcos y legislación', 'COBIT 5, ITIL 4, SOx, PCI-DSS, NIST 800-60, ley 25326, DNPDP e ISO 42001.'],
          ['2026-11-09', 'sincrónico', 'clase', 'ISO 19770 y desarrollo profesional', 'Parcial opcional de unidades 3 y 4.'],
          ['2026-11-23', 'sincrónico', 'consulta', 'Clase de consulta', ''],
          ['2026-11-30', 'sincrónico', 'examen', '1er llamado Turno Diciembre', ''],
          ['2026-12-07', 'sincrónico', 'consulta', 'Clase de consulta', ''],
          ['2026-12-14', 'sincrónico', 'examen', '2do llamado Turno Diciembre', '']
        ]
      },
      {
        materia: 'EVALUACIÓN Y GESTIÓN DE RIESGOS',
        filas: [
          ['2026-08-21', 'sincrónico', 'clase', '¿Qué es el riesgo?', 'Fundamentos y marcos de referencia.'],
          ['2026-08-28', 'sincrónico', 'clase', 'Gobierno del riesgo', 'Apetito, tolerancia y marco regulatorio.'],
          ['2026-09-04', 'sincrónico', 'entrega', 'Contexto organizacional y activos de información', 'Trabajo final: primera entrega.'],
          ['2026-09-11', 'sincrónico', 'clase', 'Identificación de amenazas y vulnerabilidades', ''],
          ['2026-09-18', 'sincrónico', 'sin_clases', 'Sin clases', 'Turno de examen septiembre 2026.'],
          ['2026-09-25', 'sincrónico', 'clase', 'Análisis de riesgos', 'Metodologías cualitativas y cuantitativas.'],
          ['2026-10-02', 'sincrónico', 'clase', 'Tratamiento del riesgo', 'Controles, mitigación y planes de acción.'],
          ['2026-10-09', 'sincrónico', 'clase', 'Riesgo en Cloud y terceros', 'Cadena de suministro.'],
          ['2026-10-16', 'sincrónico', 'entrega', 'Métricas y riesgos emergentes', 'KRI, monitoreo y trabajo final: segunda entrega.'],
          ['2026-10-23', 'sincrónico', 'clase', 'GRC y cultura de riesgo', 'Comunicación ejecutiva.'],
          ['2026-10-30', 'sincrónico', 'clase', 'Cierre integrador', ''],
          ['2026-11-06', 'sincrónico', 'exposición', 'Presentación final por grupos', '1er turno.'],
          ['2026-11-13', 'sincrónico', 'exposición', 'Presentación final por grupos', '2do turno.'],
          ['2026-11-27', 'sincrónico', 'consulta', 'Clase de consulta', ''],
          ['2026-12-04', 'sincrónico', 'examen', 'Examen 1er llamado', 'Turno julio/agosto.'],
          ['2026-12-11', 'sincrónico', 'consulta', 'Clase de consulta', ''],
          ['2026-12-18', 'sincrónico', 'examen', 'Examen 2do llamado', 'Turno julio/agosto.']
        ]
      },
      {
        materia: 'CIBERDELITOS',
        filas: [
          ['2026-08-24', 'sincrónico', 'clase', 'Unidad 1: presentación e introducción a los ciberdelitos', 'Sociedad de la información, economía de datos e implicancias. Gonzalo Rodríguez.'],
          ['2026-08-31', 'sincrónico', 'clase', 'Unidad 1: derecho penal y ciberdelincuencia', 'Delitos informáticos y marco jurídico general. Gonzalo Rodríguez.'],
          ['2026-09-07', 'sincrónico', 'clase', 'Unidad 2: abordaje gubernamental del ciberdelito', 'Leonardo Gianzone.'],
          ['2026-09-14', 'sincrónico', 'sin_clases', 'Sin clases', 'Semana del turno de examen de septiembre.'],
          ['2026-09-21', 'sincrónico', 'clase', 'Unidad 2: marco jurídico internacional', 'Gonzalo Rodríguez.'],
          ['2026-09-28', 'sincrónico', 'clase', 'Unidad 3: regulación internacional', 'Implicancias geopolíticas. Leonardo Gianzone.'],
          ['2026-10-05', 'sincrónico', 'clase', 'Unidad 4: protección de datos personales', 'Gonzalo Rodríguez.'],
          ['2026-10-19', 'sincrónico', 'examen', '1er examen parcial', ''],
          ['2026-10-26', 'sincrónico', 'clase', 'Unidad 5: cibercrimen económico', 'Características y clases. Leonardo Gianzone.'],
          ['2026-11-02', 'sincrónico', 'clase', 'Unidad 6: delitos sexuales en la era digital', 'Leonardo Gianzone.'],
          ['2026-11-09', 'sincrónico', 'examen', '2do examen parcial', ''],
          ['2026-11-23', 'sincrónico', 'consulta', 'Clase de consulta', ''],
          ['2026-11-30', 'sincrónico', 'examen', '1er llamado Turno Diciembre', ''],
          ['2026-12-07', 'sincrónico', 'consulta', 'Clase de consulta', ''],
          ['2026-12-14', 'sincrónico', 'examen', '2do llamado Turno Diciembre', '']
        ]
      },
      {
        materia: 'SISTEMAS DE GESTIÓN DE SEGURIDAD',
        filas: [
          ['2026-08-19', 'sincrónico', 'clase', 'Unidad 1: presentación y marcos de seguridad', ''],
          ['2026-08-26', 'sincrónico', 'entrega', 'Presentación del trabajo práctico', 'Consultoría y apoyo a auditoría externa.'],
          ['2026-09-02', 'asincrónico', 'clase', 'Unidad 2: ISO/IEC 27001', 'Introducción y familia ISO 27K.'],
          ['2026-09-09', 'asincrónico', 'clase', 'Unidad 2: fundamentos de ISO 27001', 'SGSI, PDCA, riesgos, estructura, Anexo A e implementación.'],
          ['2026-09-16', 'sincrónico', 'entrega', 'Kick-off del proyecto', 'Entrega del cronograma del plan de cumplimiento de auditoría.'],
          ['2026-09-23', 'sincrónico', 'entrega', 'Plan de cumplimiento normativo', 'Presentación referida al caso de negocio elegido.'],
          ['2026-09-30', 'asincrónico', 'entrega', 'Simulador del caso de negocio', 'Cumplimiento de auditoría según el caso elegido.'],
          ['2026-10-07', 'asincrónico', 'clase', 'Unidad 3: CIS Controls v8', 'Controles básicos, fundamentales y organizativos.'],
          ['2026-10-14', 'sincrónico', 'exposición', 'Exposición de hitos 1, 2 y 3', 'Trabajo práctico, grupos turno 1.'],
          ['2026-10-21', 'sincrónico', 'exposición', 'Exposición de hitos 1, 2 y 3', 'Trabajo práctico, grupos turno 2.'],
          ['2026-10-28', 'sincrónico', 'exposición', 'Presentación de hitos 4 y 5', 'Trabajo práctico.'],
          ['2026-11-04', 'sincrónico', 'exposición', 'Presentación de hitos 4 y 5', 'Trabajo práctico.'],
          ['2026-11-11', 'sincrónico', 'entrega', 'Entrega de trabajo práctico', 'Fecha 1, instancia de evaluación principal.'],
          ['2026-11-18', 'sincrónico', 'entrega', 'Entrega de trabajo práctico', 'Fecha 2, instancia de evaluación principal.'],
          ['2026-11-25', 'sincrónico', 'entrega', 'Entrega de trabajo práctico', 'Fecha 2, instancia de evaluación principal.']
        ]
      }
    ];

    for (const cronograma of eventos) {
      const materia = buscarMateria(cronograma.materia);
      if (!materia) continue;
      for (const [fecha, modalidad, tipo, titulo, detalles] of cronograma.filas) {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO cronograma_eventos (id, materia_id, fecha, modalidad, tipo, titulo, detalles) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [`cronograma_${materia.id}_${fecha}_${titulo}`, materia.id, fecha, modalidad, tipo, titulo, detalles]
        });
      }
    }
  });

  await ejecutarMigracion(8, 'tabla de auditoría de acciones sensibles', async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id TEXT PRIMARY KEY,
        accion TEXT NOT NULL,
        usuario TEXT NOT NULL,
        detalle TEXT NOT NULL DEFAULT '',
        ip TEXT NOT NULL DEFAULT 'unknown',
        creada_en TEXT NOT NULL
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_auditoria_creada_en ON auditoria(creada_en)');
  });

  await db.close?.();
}

main().catch(async (error) => {
  console.error('No se pudieron ejecutar las migraciones:', error);
  await db.close?.();
  process.exitCode = 1;
});
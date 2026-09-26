/**
 * Planes de cursada cargados como cronograma `origen: manual`.
 * Fuentes: migración 7 (comisión), migración 13 (Auditorías Word 2026),
 * metodología TUCS 2.16.1 / 2.18.2 (temario por clase; parciales cuando
 * el campus o la cátedra los publiquen pasan por sync o se agregan al plan).
 */

/** @type {Array<{ materia: string, filas: [string, string, string, string, string][] }>} */
export const PLANES_CRONOGRAMA_COMISION = [
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
      ['2026-11-30', 'sincrónico', 'examen_final', '1er llamado Turno Diciembre', ''],
      ['2026-12-07', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-12-14', 'sincrónico', 'examen_final', '2do llamado Turno Diciembre', '']
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
      ['2026-12-04', 'sincrónico', 'examen_final', 'Examen 1er llamado', 'Turno julio/agosto.'],
      ['2026-12-11', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-12-18', 'sincrónico', 'examen_final', 'Examen 2do llamado', 'Turno julio/agosto.']
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
      ['2026-11-30', 'sincrónico', 'examen_final', '1er llamado Turno Diciembre', ''],
      ['2026-12-07', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-12-14', 'sincrónico', 'examen_final', '2do llamado Turno Diciembre', '']
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
  },
  {
    materia: 'AUDITORÍAS DE SEGURIDAD',
    filas: [
      ['2026-08-18', 'sincrónico', 'clase', 'Unidad 1: contexto global de SI y ciberseguridad', 'Evolución según referentes de la industria y Organizaciones internacionales. Los controles internos como respuesta y necesidad.'],
      ['2026-08-25', 'sincrónico', 'clase', 'Unidad 1: marcos de control', 'Las prácticas de control, de las normas a las buenas prácticas en SI y Ciberseguridad. Responsabilidades.'],
      ['2026-09-01', 'sincrónico', 'clase', 'Unidad 2: las auditorías en general', 'Definiciones de auditoría de seguridad de la información. El rol de las auditorías.'],
      ['2026-09-08', 'sincrónico', 'clase', 'Unidad 2: auditores', 'Habilidades, conocimiento y ética. Desde los principios generales de auditoría a los posibles conflictos.'],
      ['2026-09-15', 'sincrónico', 'sin_clases', 'Sin clases', 'Mesas de examen de septiembre: no hay cursada.'],
      ['2026-09-22', 'sincrónico', 'clase', 'Unidad 2: el auditor en la planificación', 'El rol del auditor en las estrategias y la planificación. Claves de éxito.'],
      ['2026-09-29', 'sincrónico', 'clase', 'Mejora continua y auditoría', 'Auditoría, motivaciones y objetivos.'],
      ['2026-10-06', 'sincrónico', 'clase', 'Unidad 3: auditoría del SGSI', 'Desde las normas de estandarización de aplicación internacional. Normas certificables.'],
      ['2026-10-13', 'sincrónico', 'clase', 'Unidad 3: proceso de certificación', 'Características del proceso de certificación. Estrategias y procesos. Acompañamiento interno del proceso y los roles de los auditores. Informes.'],
      ['2026-10-20', 'sincrónico', 'clase', 'Unidad 3: auditoría de certificación', 'Informe de auditoría. Certificaciones y posicionamiento empresarial.'],
      ['2026-10-27', 'sincrónico', 'clase', 'Unidad 4: auditorías interna y externa del SGSI', 'Evaluación del gobierno de TI. Casos.'],
      ['2026-11-03', 'sincrónico', 'clase', 'Unidad 4: marcos auditables', 'Identidad del marco. Determinación de grado de cumplimiento. Marcos auditables y de cumplimiento: PCI, Normas del BCRA y otros.'],
      ['2026-11-10', 'sincrónico', 'clase', 'Unidad 4: planificación de auditoría', 'Consideraciones del proceso de auditoría de marcos no certificables. Auditorías de marcos: Ciberseguridad del NIST e ISO 27002.'],
      ['2026-11-24', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-12-01', 'sincrónico', 'examen_final', 'Examen 1er llamado turno Diciembre', ''],
      ['2026-12-08', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-12-15', 'sincrónico', 'examen_final', 'Examen 2do llamado turno Diciembre', '']
    ]
  },
  {
    materia: 'CONCEPTOS DE DESARROLLO',
    filas: [
      ['2026-08-28', 'sincrónico', 'clase', 'Presentación e ingeniería del software', 'Ciclo de vida, repositorios y control de versiones con Git.'],
      ['2026-09-04', 'sincrónico', 'clase', 'Patrones de diseño (GoF)', 'Análisis y diseño basado en patrones.'],
      ['2026-09-11', 'sincrónico', 'clase', 'Patrones arquitectónicos', 'Principios y descripción arquitectónica.'],
      ['2026-09-18', 'sincrónico', 'sin_clases', 'Sin clases', 'Mesas de examen de septiembre.'],
      ['2026-09-25', 'sincrónico', 'clase', 'Pruebas de software', 'Validación, verificación y ciclo de vida.'],
      ['2026-10-02', 'sincrónico', 'clase', 'Desarrollo con Flutter (Dart)', 'Primeros pasos en apps móviles. Entrega TP N° 2.'],
      ['2026-10-09', 'sincrónico', 'clase', 'Pruebas unitarias en Flutter', 'Herramientas y buenas prácticas.'],
      ['2026-10-16', 'sincrónico', 'clase', 'Desarrollo dirigido por modelos', 'MDD, MDA y modelado de negocio.'],
      ['2026-10-23', 'sincrónico', 'clase', 'Mantenimiento y evolución del software', 'Tipos de mantenimiento y proceso.'],
      ['2026-10-30', 'sincrónico', 'clase', 'API REST con Ruby on Rails', 'Servicios web y consumo desde Flutter.'],
      ['2026-11-06', 'sincrónico', 'clase', 'Integración Flutter + API', 'Trabajo práctico y cierre de unidades.'],
      ['2026-11-13', 'sincrónico', 'clase', 'Repaso integrador', 'Consultas de parciales y trabajos prácticos.'],
      ['2026-11-20', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-11-27', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-12-04', 'sincrónico', 'examen_final', 'Examen 1er llamado turno Diciembre', ''],
      ['2026-12-11', 'sincrónico', 'examen_final', 'Examen 2do llamado turno Diciembre', '']
    ]
  },
  {
    materia: 'INTRODUCCIÓN A LA CRIPTOGRAFÍA',
    filas: [
      ['2026-08-27', 'sincrónico', 'clase', 'Módulo I: presentación y objetivos', 'Conceptos básicos de confidencialidad, integridad y autenticidad.'],
      ['2026-09-03', 'sincrónico', 'clase', 'Módulo I: criptografía simétrica', 'Cifrados clásicos y modernos.'],
      ['2026-09-10', 'sincrónico', 'clase', 'Módulo I: criptografía asimétrica', 'Intercambio de claves y firmas digitales.'],
      ['2026-09-17', 'sincrónico', 'sin_clases', 'Sin clases', 'Mesas de examen de septiembre.'],
      ['2026-09-24', 'sincrónico', 'clase', 'Módulo I: TLS y diagnóstico', 'Actividad integradora: análisis TLS.'],
      ['2026-10-01', 'sincrónico', 'clase', 'Módulo II: funciones hash y HMAC', 'Integridad de mensajes.'],
      ['2026-10-08', 'sincrónico', 'clase', 'Módulo II: certificados y PKI', 'Autoridades certificantes y cadena de confianza.'],
      ['2026-10-15', 'sincrónico', 'clase', 'Módulo II: protocolos seguros', 'TLS/SSL en la práctica.'],
      ['2026-10-22', 'sincrónico', 'clase', 'Módulo III: gestión de claves', 'Almacenamiento y rotación.'],
      ['2026-10-29', 'sincrónico', 'clase', 'Módulo III: criptografía en aplicaciones', 'Buenas prácticas de implementación.'],
      ['2026-11-05', 'sincrónico', 'clase', 'Módulo III: amenazas y post-cuántica', 'Panorama actual.'],
      ['2026-11-12', 'sincrónico', 'clase', 'Repaso integrador', 'Trabajos prácticos y parciales.'],
      ['2026-11-19', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-11-26', 'sincrónico', 'consulta', 'Clase de consulta', ''],
      ['2026-12-03', 'sincrónico', 'examen_final', 'Examen 1er llamado turno Diciembre', ''],
      ['2026-12-10', 'sincrónico', 'examen_final', 'Examen 2do llamado turno Diciembre', '']
    ]
  }
];

export function buscarMateriaPorFragmento(materias, fragmento) {
  const f = String(fragmento || '').trim();
  return materias.find((m) => String(m.nombre || '').includes(f));
}

export async function insertarPlanesCronograma(db, materias) {
  let insertados = 0;
  for (const cronograma of PLANES_CRONOGRAMA_COMISION) {
    const materia = buscarMateriaPorFragmento(materias, cronograma.materia);
    if (!materia) continue;
    for (const [fecha, modalidad, tipo, titulo, detalles] of cronograma.filas) {
      const res = await db.execute({
        sql: `INSERT OR IGNORE INTO cronograma_eventos
              (id, materia_id, fecha, modalidad, tipo, titulo, detalles, origen)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')`,
        args: [`cronograma_${materia.id}_${fecha}_${titulo}`, materia.id, fecha, modalidad, tipo, titulo, detalles || '']
      });
      if (res.rowsAffected > 0) insertados += 1;
    }
  }
  return insertados;
}

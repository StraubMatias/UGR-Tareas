// SIU Guaraní 配置
export const SIU_BASE_URL = process.env.SIU_BASE_URL || 'https://guarani.ugr.edu.ar/3w';

export const SIU_RUTAS = {
  login: '/acceso?auth=form',
  inicioAlumno: '/inicio_alumno',
  // 历史记录（已修读课程、成绩）
  historiaAcademica: '/historia_academica',
  // 成绩报告
  informeNotas: '/informe_notas',
  // 考试注册
  inscripcionesExamenes: '/inscripciones_a_examenes',
  // 课程表
  horariosCursadas: '/horarios_cursadas',
  // 个人中心
  perfil: '/perfil',
  // AJAX API 端点（常见）
  ajaxBase: '/ajax',
};

// SIU Guaraní 3W 常用的课程状态值
export const ESTADO_MATERIA = {
  APROBADA: 'APROBADA',
  REGULARIZADA: 'REGULARIZADA',
  CURSANDO: 'CURSANDO',
  INSCRIPTA: 'INSCRITA',
  DESAPROBADA: 'DESAPROBADA',
  ANULADA: 'ANULADA',
};

// 成绩类型映射
export const TIPO_EVALUACION = {
  FINAL: 'FINAL',
  PROMOCION: 'PROMOCION',
  LIBRE: 'LIBRE',
  PARCIAL: 'PARCIAL',
  TRABAJO_PRAC: 'TRABAJO_PRAC',
};

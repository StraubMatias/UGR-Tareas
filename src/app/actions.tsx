export type {
  ResumenMateriaSync,
  RespuestaAction,
  RespuestaSiuSync,
  TareaActionParams
} from './actions/types';

export type { GestionarGrupoParams } from './actions/evaluaciones';

export {
  validarLoginAction,
  cerrarSesionAction,
  obtenerSesionAction,
  registrarCuentaAction,
  cambiarPasswordAction,
  actualizarCuentaAction,
  crearAlumnoAction,
  editarAlumnoAction,
  eliminarAlumnoAction
} from './actions/auth';

export {
  obtenerEstadoCompleto,
  guardarProgresoPlanAction,
  toggleTareaAction
} from './actions/estado';

export {
  crearMateriaAction,
  renombrarMateriaAction,
  editarCondicionesMateriaAction,
  eliminarMateriaAction,
  crearTareaAction,
  editarTareaAction,
  eliminarTareaAction
} from './actions/materias';

export {
  syncUgrAction,
  syncSiuAction,
  sincronizarCuentaSiuAction,
  sincronizarCuentaUgrAction
} from './actions/sync';

export { crearHorarioAction, eliminarHorarioAction } from './actions/horarios';

export {
  crearParcialAction,
  editarParcialAction,
  eliminarParcialAction,
  guardarNotaParcialAction,
  guardarNotaTareaAction,
  gestionarGrupoTareaAction
} from './actions/evaluaciones';

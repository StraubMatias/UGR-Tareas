export type {
  ResumenMateriaSync,
  MateriaInscriptaSync,
  OpcionesSincronizarUgr,
  FaseSincronizarUgr,
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
  gestionarGrupoTareaAction,
  invitarAGrupoTareaAction,
  responderInvitacionGrupoAction
} from './actions/evaluaciones';

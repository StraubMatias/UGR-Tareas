import type { FormEvent } from 'react';
import ModalParcialEdicion from './ModalParcialEdicion';
import ModalCambioPassword from './ModalCambioPassword';
import ModalesEdicion from './ModalesEdicion';
import ModalSincronizacion from './ModalSincronizacion';
import type { SyncResult, SyncTipo, SyncEstado } from './types';
import type { DetalleSyncSiuProps } from './DetalleSyncSiu';
import type { Materia, Parcial, Tarea } from '../../core/cursada';

interface PortalModalesProps {
  materias: Materia[];
  etiquetaMateria: (nombre: string) => string;
  parcialEnEdicion: Parcial | null;
  materiaParcialSel: string;
  nombreParcial: string;
  fechaParcial: string;
  detallesParcial: string;
  setMateriaParcialSel: (v: string) => void;
  setNombreParcial: (v: string) => void;
  setFechaParcial: (v: string) => void;
  setDetallesParcial: (v: string) => void;
  onSubmitParcial: (e: FormEvent<HTMLFormElement>) => void;
  onCerrarParcial: () => void;
  modalPasswordOpen: boolean;
  usuarioActual: string | null;
  userPassChange: string;
  nuevoUserChange: string;
  currentPassChange: string;
  newPassChange: string;
  msgPassChange: { tipo: string; texto: string };
  onUserPassChange: (v: string) => void;
  onNuevoUserChange: (v: string) => void;
  onCurrentPassChange: (v: string) => void;
  onNewPassChange: (v: string) => void;
  onSubmitPassword: (e: FormEvent<HTMLFormElement>) => void;
  onCerrarPassword: () => void;
  alumnoEnEdicion: { antiguoNombre: string; nuevoNombre: string } | null;
  setAlumnoEnEdicion: (v: { antiguoNombre: string; nuevoNombre: string } | null) => void;
  onGuardarAlumno: (e: FormEvent<HTMLFormElement>) => void;
  materiaEnEdicion: { id: string; nombre: string } | null;
  setMateriaEnEdicion: (v: { id: string; nombre: string } | null) => void;
  onGuardarMateria: (e: FormEvent<HTMLFormElement>) => void;
  tareaEnEdicion: { materiaId: string; tarea: Tarea } | null;
  setTareaEnEdicion: (v: { materiaId: string; tarea: Tarea } | null) => void;
  onGuardarTarea: (e: FormEvent<HTMLFormElement>) => void;
  materiaCondicionesEnEdicion: {
    id: string;
    condiciones: string;
    notaMinimaRegularizar: number | string;
    notaMinimaPromocionar: number | string;
    reglaPromocion: string;
  } | null;
  setMateriaCondicionesEnEdicion: (v: PortalModalesProps['materiaCondicionesEnEdicion']) => void;
  onGuardarCondiciones: (e: FormEvent<HTMLFormElement>) => void;
  syncAbierto: boolean;
  syncTipo: SyncTipo;
  syncEstado: SyncEstado;
  syncMensaje: string;
  syncDatos: SyncResult | null;
  syncSiuDetalle: DetalleSyncSiuProps | null;
  syncSeleccionados: Set<string>;
  syncAvisosSeleccionados: Set<string>;
  syncEventosSeleccionados: Set<string>;
  onCerrarSync: () => void;
  onBuscarDeNuevoSync: () => void;
  onMarcarTodasSync: (valor: boolean) => void;
  onToggleSyncTarea: (id: string) => void;
  onMarcarTodasAvisosSync: (valor: boolean) => void;
  onToggleSyncAviso: (id: string) => void;
  onToggleSyncEvento: (id: string) => void;
  onAplicarCambiosSync: () => void;
}

export default function PortalModales(props: PortalModalesProps) {
  const {
    materias,
    etiquetaMateria,
    parcialEnEdicion,
    materiaParcialSel,
    nombreParcial,
    fechaParcial,
    detallesParcial,
    setMateriaParcialSel,
    setNombreParcial,
    setFechaParcial,
    setDetallesParcial,
    onSubmitParcial,
    onCerrarParcial,
    modalPasswordOpen,
    usuarioActual,
    userPassChange,
    nuevoUserChange,
    currentPassChange,
    newPassChange,
    msgPassChange,
    onUserPassChange,
    onNuevoUserChange,
    onCurrentPassChange,
    onNewPassChange,
    onSubmitPassword,
    onCerrarPassword,
    alumnoEnEdicion,
    setAlumnoEnEdicion,
    onGuardarAlumno,
    materiaEnEdicion,
    setMateriaEnEdicion,
    onGuardarMateria,
    tareaEnEdicion,
    setTareaEnEdicion,
    onGuardarTarea,
    materiaCondicionesEnEdicion,
    setMateriaCondicionesEnEdicion,
    onGuardarCondiciones,
    syncAbierto,
    syncTipo,
    syncEstado,
    syncMensaje,
    syncDatos,
    syncSiuDetalle,
    syncSeleccionados,
    syncAvisosSeleccionados,
    syncEventosSeleccionados,
    onCerrarSync,
    onBuscarDeNuevoSync,
    onMarcarTodasSync,
    onToggleSyncTarea,
    onMarcarTodasAvisosSync,
    onToggleSyncAviso,
    onToggleSyncEvento,
    onAplicarCambiosSync
  } = props;

  return (
    <>
      {parcialEnEdicion && (
        <ModalParcialEdicion
          materias={materias}
          etiquetaMateria={etiquetaMateria}
          materiaParcialSel={materiaParcialSel}
          nombreParcial={nombreParcial}
          fechaParcial={fechaParcial}
          detallesParcial={detallesParcial}
          onMateriaParcialSel={setMateriaParcialSel}
          onNombreParcial={setNombreParcial}
          onFechaParcial={setFechaParcial}
          onDetallesParcial={setDetallesParcial}
          onSubmit={onSubmitParcial}
          onCerrar={onCerrarParcial}
        />
      )}

      {modalPasswordOpen && (
        <ModalCambioPassword
          usuarioActual={usuarioActual}
          userPassChange={userPassChange}
          nuevoUserChange={nuevoUserChange}
          currentPassChange={currentPassChange}
          newPassChange={newPassChange}
          msgPassChange={msgPassChange}
          onUserPassChange={onUserPassChange}
          onNuevoUserChange={onNuevoUserChange}
          onCurrentPassChange={onCurrentPassChange}
          onNewPassChange={onNewPassChange}
          onSubmit={onSubmitPassword}
          onCerrar={onCerrarPassword}
        />
      )}

      <ModalesEdicion
        alumnoEnEdicion={alumnoEnEdicion}
        onCerrarAlumno={() => setAlumnoEnEdicion(null)}
        onCambiarAlumno={setAlumnoEnEdicion}
        onGuardarAlumno={onGuardarAlumno}
        materiaEnEdicion={materiaEnEdicion}
        onCerrarMateria={() => setMateriaEnEdicion(null)}
        onCambiarMateria={setMateriaEnEdicion}
        onGuardarMateria={onGuardarMateria}
        tareaEnEdicion={tareaEnEdicion}
        onCerrarTarea={() => setTareaEnEdicion(null)}
        onCambiarTarea={setTareaEnEdicion}
        onGuardarTarea={onGuardarTarea}
        materiaCondicionesEnEdicion={materiaCondicionesEnEdicion}
        onCerrarCondiciones={() => setMateriaCondicionesEnEdicion(null)}
        onCambiarCondiciones={setMateriaCondicionesEnEdicion}
        onGuardarCondiciones={onGuardarCondiciones}
      />

      {syncAbierto && (
        <ModalSincronizacion
          syncTipo={syncTipo}
          syncEstado={syncEstado}
          syncMensaje={syncMensaje}
          syncDatos={syncDatos}
          syncSiuDetalle={syncSiuDetalle}
          syncSeleccionados={syncSeleccionados}
          syncAvisosSeleccionados={syncAvisosSeleccionados}
          syncEventosSeleccionados={syncEventosSeleccionados}
          etiquetaMateria={etiquetaMateria}
          onCerrar={onCerrarSync}
          onBuscarDeNuevo={onBuscarDeNuevoSync}
          onMarcarTodasTareas={onMarcarTodasSync}
          onToggleTarea={onToggleSyncTarea}
          onMarcarTodasAvisos={onMarcarTodasAvisosSync}
          onToggleAviso={onToggleSyncAviso}
          onToggleEvento={onToggleSyncEvento}
          onAplicarCambios={onAplicarCambiosSync}
        />
      )}
    </>
  );
}

import type { FormEvent } from 'react';
import ModalParcialEdicion from './ModalParcialEdicion';
import ModalCambioPassword from './ModalCambioPassword';
import ModalesEdicion from './ModalesEdicion';
import type { Materia, Parcial, Tarea } from '../../core/cursada';
import type { MateriaCondicionesEdicion } from '../../hooks/tablero-estado/types';

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
  onSubmitPassword: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
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
  materiaCondicionesEnEdicion: MateriaCondicionesEdicion | null;
  setMateriaCondicionesEnEdicion: (v: MateriaCondicionesEdicion | null) => void;
  onGuardarCondiciones: (e: FormEvent<HTMLFormElement>) => void;
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
    onGuardarCondiciones
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
    </>
  );
}

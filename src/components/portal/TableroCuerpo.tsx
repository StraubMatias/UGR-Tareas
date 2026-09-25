'use client';

import { buildPortalVistasCursadaProps } from '../../lib/tablero-portal-view-props';
import type { TableroPortalViewModel } from '../../hooks/useTableroPortal';
import VistaAlumnos from '../VistaAlumnos';
import CuentaPropia from '../CuentaPropia';
import PantallaAcceso from './PantallaAcceso';
import PortalNav from './PortalNav';
import PortalVistasCursada from './PortalVistasCursada';

export default function TableroCuerpo({ vm }: { vm: TableroPortalViewModel }) {
  const { acceso, portalAcceso, tableroVacio, datos, ui, cargarBD, acciones, navegarA } = vm;

  if (!acceso.usuarioActual) {
    return (
      <PantallaAcceso
        modoAcceso={acceso.modoAcceso}
        inputUser={acceso.inputUser}
        inputPass={acceso.inputPass}
        registroPass={acceso.registroPass}
        registroConfirmacion={acceso.registroConfirmacion}
        errorLogin={acceso.errorLogin}
        enviandoAcceso={acceso.enviandoAcceso}
        onCambiarModo={(modo) => {
          acceso.setModoAcceso(modo);
          acceso.setErrorLogin('');
        }}
        onInputUser={acceso.setInputUser}
        onInputPass={acceso.setInputPass}
        onRegistroPass={acceso.setRegistroPass}
        onRegistroConfirmacion={acceso.setRegistroConfirmacion}
        onLogin={portalAcceso.handleLogin}
        onRegistro={portalAcceso.handleRegistro}
        onAbrirCambioPassword={() => acceso.setModalPasswordOpen(true)}
      />
    );
  }

  if (tableroVacio) {
    const usuario = acceso.usuarioActual;
    return (
      <div className="mx-auto mt-6 max-w-9xl space-y-4">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-[#121821] p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Tablero vacío</p>
          <h2 className="mt-2 text-2xl font-black text-white">Todavía no hay cursada</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            La cuenta ya está creada. Materias, tareas, grupos y cronograma aparecen cuando sincronizás con UGR Virtual. Si pasan 7 días sin esa sincronización, la cuenta se borra.
          </p>
        </section>
        <CuentaPropia
          usuario={usuario}
          onCompletado={() => { void cargarBD(true); }}
          onInterrumpida={() => { void cargarBD(true); }}
        />
        <VistaAlumnos
          materias={datos.materias}
          inscripciones={datos.inscripciones}
          alumnos={datos.alumnos}
          registrados={datos.registrados}
          esAdmin={false}
          usuarioActual={usuario}
          situacionPropiaAbierta={ui.situacionPropiaAbierta}
          setSituacionPropiaAbierta={ui.setSituacionPropiaAbierta}
          alumnosDesplegados={ui.alumnosDesplegados}
          toggleDesplegarAlumno={acciones.toggleDesplegarAlumno}
          toggleTareaDesdeCliente={acciones.toggleTareaDesdeCliente}
          irATareaEnMaterias={acciones.irATareaEnMaterias}
          notasTareasInputs={datos.notasTareasInputs}
          handleNotaTareaChangeLocal={acciones.handleNotaTareaChangeLocal}
          handleGuardarNotaTareaOnBlur={acciones.handleGuardarNotaTareaOnBlur}
          recargarTablero={cargarBD}
        />
      </div>
    );
  }

  return (
    <div className="max-w-9xl mx-auto">
      <PortalNav pestana={ui.pestana} onNavegar={navegarA} />
      <PortalVistasCursada {...buildPortalVistasCursadaProps(vm)} />
    </div>
  );
}

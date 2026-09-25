import { useRef, useState } from 'react';
import type { NovedadTablero, PortalPestana } from '../components/portal/types';

export function useTableroEstadoUi() {
  const [pestana, setPestana] = useState<PortalPestana>('alumnos');
  const [cargando, setCargando] = useState(true);
  const [iniciado, setIniciado] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const [notificacionesVistas, setNotificacionesVistas] = useState<string[]>([]);
  const notificacionesRef = useRef<HTMLDivElement | null>(null);
  const refrescandoRef = useRef(false);
  const periodoEspejoRef = useRef(false);
  const pausarRefrescoRef = useRef(false);
  const [mostrarAvisoInicio, setMostrarAvisoInicio] = useState(false);
  const [novedades, setNovedades] = useState<NovedadTablero[]>([]);
  const [syncPickerAbierto, setSyncPickerAbierto] = useState(false);
  const [syncCuentaFuente, setSyncCuentaFuente] = useState<'ugr' | 'siu' | null>(null);
  const [notasDesplegadas, setNotasDesplegadas] = useState<Record<string, boolean>>({});
  const [mesCalendario, setMesCalendario] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [diaCalendarioSeleccionado, setDiaCalendarioSeleccionado] = useState<Date | null>(null);
  const [alumnosDesplegados, setAlumnosDesplegados] = useState<Record<string, boolean>>({});
  const [materiasDesplegadas, setMateriasDesplegadas] = useState<Record<string, boolean>>({});
  const [situacionPropiaAbierta, setSituacionPropiaAbierta] = useState(true);
  const [historialPropioAbierto, setHistorialPropioAbierto] = useState(true);
  const [alumnoComparar, setAlumnoComparar] = useState('');
  const [materiaRanking, setMateriaRanking] = useState('');
  const [tareaFoco, setTareaFoco] = useState<{ materiaId: string; tareaId: string } | null>(null);
  const [tareaFocoVisible, setTareaFocoVisible] = useState(false);
  const [planModalAbierto, setPlanModalAbierto] = useState(false);
  const [cuatrimestreSimulado, setCuatrimestreSimulado] = useState('');
  const [materiasSimuladas, setMateriasSimuladas] = useState<string[]>([]);

  return {
    pestana,
    setPestana,
    cargando,
    setCargando,
    iniciado,
    setIniciado,
    notificacionesAbiertas,
    setNotificacionesAbiertas,
    notificacionesVistas,
    setNotificacionesVistas,
    notificacionesRef,
    refrescandoRef,
    periodoEspejoRef,
    pausarRefrescoRef,
    mostrarAvisoInicio,
    setMostrarAvisoInicio,
    novedades,
    setNovedades,
    syncPickerAbierto,
    setSyncPickerAbierto,
    syncCuentaFuente,
    setSyncCuentaFuente,
    notasDesplegadas,
    setNotasDesplegadas,
    mesCalendario,
    setMesCalendario,
    diaCalendarioSeleccionado,
    setDiaCalendarioSeleccionado,
    alumnosDesplegados,
    setAlumnosDesplegados,
    materiasDesplegadas,
    setMateriasDesplegadas,
    situacionPropiaAbierta,
    setSituacionPropiaAbierta,
    historialPropioAbierto,
    setHistorialPropioAbierto,
    alumnoComparar,
    setAlumnoComparar,
    materiaRanking,
    setMateriaRanking,
    tareaFoco,
    setTareaFoco,
    tareaFocoVisible,
    setTareaFocoVisible,
    planModalAbierto,
    setPlanModalAbierto,
    cuatrimestreSimulado,
    setCuatrimestreSimulado,
    materiasSimuladas,
    setMateriasSimuladas
  };
}

'use client';

import type { PortalPestana } from './types';

const cargadoresVista: Partial<Record<PortalPestana, () => Promise<unknown>>> = {
  alumnos: () => import('../VistaAlumnos'),
  materias: () => import('../VistaMaterias'),
  promocion: () => import('../VistaPromocion'),
  historial: () => import('../VistaHistorial'),
  plan: () => import('../VistaPlan'),
  parciales: () => import('../VistaParciales'),
  ranking: () => import('../VistaRanking'),
  horarios: () => import('../VistaHorarios'),
  admin: () => import('../VistaAdminPanel')
};

const vistasPrecargadas = new Set<PortalPestana>();
let modalesPrecargados = false;

/** Descarga el chunk de la pestaña antes del click (hover / focus / touch). */
export function precargarVistaPortal(pestana: PortalPestana) {
  const cargar = cargadoresVista[pestana];
  if (!cargar || vistasPrecargadas.has(pestana)) return;
  vistasPrecargadas.add(pestana);
  void cargar();
}

/** Modales de edición: una sola vez al interactuar con la nav. */
export function precargarModalesPortal() {
  if (modalesPrecargados) return;
  modalesPrecargados = true;
  void import('./PortalModales');
}

export function precargarAlInteractuarNav(pestana: PortalPestana, activa: boolean) {
  if (activa) return;
  precargarVistaPortal(pestana);
  precargarModalesPortal();
}

let syncPrecargado = false;

export function precargarSyncPortal() {
  if (syncPrecargado) return;
  syncPrecargado = true;
  void import('../CuentaPropia');
  void import('./ModalCuentaSync');
  void import('./ModalElegirSyncFuente');
}

// Validaciones compartidas entre cliente y servidor.
// Este archivo no lleva 'use client' ni 'use server': se importa desde ambos lados.

import { tareaEstaHabilitada } from '../core/cursada.ts';

/**
 * Fecha de hoy en Argentina (YYYY-MM-DD).
 * El campus y la cátedra trabajan con la hora de Argentina, así que las
 * comparaciones de fechas deben usar esa zona, no la del servidor o la del
 * navegador: los tests corren en UTC en CI y en hora local en la máquina.
 */
export function claveHoyArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

export function parcialHabilitado(fecha: string | null | undefined): boolean {
  if (!fecha || fecha === 'Sin fecha') return false;
  const fechaLimpia = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) return false;
  return fechaLimpia <= claveHoyArgentina();
}

export const tareaHabilitada = tareaEstaHabilitada;

export function tareaDentroDelPlazo(fecha: string | null | undefined): boolean {
  if (!fecha || fecha === 'Sin fecha') return true;
  const fechaCierre = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCierre)) return true;
  return claveHoyArgentina() < fechaCierre;
}

export function formatearNotaParaMostrar(nota: string | number | null | undefined): string {
  if (nota == null || nota === '') return '';
  const num = Number(String(nota).replace(',', '.'));
  if (!Number.isFinite(num)) return String(nota);
  const redondeada = Math.round(num * 100) / 100;
  if (Math.abs(redondeada - Math.round(redondeada)) < 0.001) return String(Math.round(redondeada));
  return String(redondeada).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function validarNota(nota: string | number | null | undefined): { valida: boolean; vacia: boolean; valor: string } {
  const notaLimpia = typeof nota === 'string' ? nota.trim().replace(',', '.') : String(nota ?? '').trim();
  if (!notaLimpia) return { valida: false, vacia: true, valor: '' };

  const valor = Number(notaLimpia);
  const valorFormateado = formatearNotaParaMostrar(notaLimpia);
  return {
    valida: Number.isFinite(valor) && valor >= 1 && valor <= 10,
    vacia: false,
    valor: valorFormateado || notaLimpia
  };
}

export function normalizarUnidad(unidad: string | number | null | undefined): { valida: boolean; valor: number | null } {
  const unidadLimpia = unidad === null || unidad === undefined ? '' : String(unidad).trim();
  if (!unidadLimpia) return { valida: true, valor: null };
  if (!/^\d+$/.test(unidadLimpia) || Number(unidadLimpia) < 1) {
    return { valida: false, valor: null };
  }
  return { valida: true, valor: Number(unidadLimpia) };
}


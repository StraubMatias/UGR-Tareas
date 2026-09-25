'use client';

import dynamic from 'next/dynamic';
import PortalVistaCarga from './PortalVistaCarga';

export const VistaAlumnos = dynamic(() => import('../VistaAlumnos'), { loading: () => <PortalVistaCarga /> });
export const VistaMaterias = dynamic(() => import('../VistaMaterias'), { loading: () => <PortalVistaCarga /> });
export const VistaPromocion = dynamic(() => import('../VistaPromocion'), { loading: () => <PortalVistaCarga /> });
export const VistaHistorial = dynamic(() => import('../VistaHistorial'), { loading: () => <PortalVistaCarga /> });
export const VistaPlan = dynamic(() => import('../VistaPlan'), { loading: () => <PortalVistaCarga /> });
export const VistaParciales = dynamic(() => import('../VistaParciales'), { loading: () => <PortalVistaCarga /> });
export const VistaRanking = dynamic(() => import('../VistaRanking'), { loading: () => <PortalVistaCarga /> });
export const VistaHorarios = dynamic(() => import('../VistaHorarios'), { loading: () => <PortalVistaCarga /> });
export const VistaAdminPanel = dynamic(() => import('../VistaAdminPanel'), { loading: () => <PortalVistaCarga /> });

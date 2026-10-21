'use client';

import { useEffect } from 'react';
import ModalOverlay from './ModalOverlay';

interface ModalElegirDriveProps {
  onCerrar: () => void;
}

const OPCIONES_DRIVE = [
  {
    titulo: 'Drive general',
    detalle: 'Material general de la cursada.',
    url: 'https://drive.google.com/drive/folders/1DdVDpLcRHGLk19XnbICzCtVxw8xbo9Vg?usp=sharing'
  },
  {
    titulo: 'Sistemas de Gestión de Seguridad de la Información (Marcos Normativos)',
    detalle: 'Material de la materia.',
    url: 'https://drive.google.com/drive/u/1/folders/16gls-6QTNGugkYJeAouvi68fA23OrU5d'
  }
];

export default function ModalElegirDrive({ onCerrar }: ModalElegirDriveProps) {
  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [onCerrar]);

  return (
    <ModalOverlay maxWidth="md" variant="compact">
      <div className="space-y-4" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-drive">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="titulo-modal-drive" className="text-base font-bold text-white">Material en Drive</h3>
            <p className="mt-1 text-xs text-slate-400">Elegí la carpeta que querés abrir.</p>
          </div>
          <button type="button" onClick={onCerrar} className="text-xs text-slate-400 hover:text-white cursor-pointer">
            Cerrar
          </button>
        </div>
        <div className="grid gap-3">
          {OPCIONES_DRIVE.map((opcion) => (
            <a
              key={opcion.url}
              href={opcion.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onCerrar}
              className="block rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-left hover:bg-cyan-500/15 transition-colors"
            >
              <span className="text-lg" aria-hidden="true">📁</span>
              <p className="mt-2 text-sm font-bold text-cyan-100">{opcion.titulo}</p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">{opcion.detalle}</p>
            </a>
          ))}
        </div>
      </div>
    </ModalOverlay>
  );
}

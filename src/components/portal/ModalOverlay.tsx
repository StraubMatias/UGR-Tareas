'use client';

import { useEffect, type ReactNode } from 'react';

interface ModalOverlayProps {
  children: ReactNode;
  maxWidth?: 'md' | 'xl' | '2xl' | 'full';
  /** `sheet`: casi pantalla completa (ediciones). `compact`: cuadro centrado (sync, etc.). */
  variant?: 'sheet' | 'compact';
}

const ancho: Record<NonNullable<ModalOverlayProps['maxWidth']>, string> = {
  md: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  full: 'max-w-6xl'
};

export default function ModalOverlay({ children, maxWidth = 'md', variant = 'sheet' }: ModalOverlayProps) {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  if (variant === 'compact') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
        role="presentation"
      >
        <div
          className={`w-full max-h-[min(90dvh,720px)] overflow-y-auto rounded-2xl border border-slate-800 bg-[#161c26] p-6 shadow-2xl sm:p-8 ${ancho[maxWidth]}`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-3 md:p-4"
      role="presentation"
    >
      <div
        className={`flex w-full min-h-0 flex-col overflow-hidden border border-slate-800 bg-[#161c26] shadow-2xl
          h-[100dvh] max-h-[100dvh] rounded-none
          sm:h-auto sm:max-h-[min(100dvh,920px)] sm:rounded-2xl
          ${ancho[maxWidth]}`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalOverlayHeader({
  title,
  subtitle,
  onClose,
  closeLabel = 'Cerrar'
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
        >
          {closeLabel}
        </button>
      ) : null}
    </header>
  );
}

export function ModalOverlayBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}

export function ModalOverlayFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="shrink-0 border-t border-slate-800 bg-[#141a24] px-5 py-4 sm:px-6">
      {children}
    </footer>
  );
}

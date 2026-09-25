import type { ReactNode } from 'react';

interface ModalOverlayProps {
  children: ReactNode;
  maxWidth?: 'md' | 'xl' | '2xl';
  onClose?: () => void;
}

const ancho: Record<NonNullable<ModalOverlayProps['maxWidth']>, string> = {
  md: 'max-w-md',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl'
};

export default function ModalOverlay({ children, maxWidth = 'md' }: ModalOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className={`bg-[#161c26] border border-slate-800 rounded-2xl p-6 sm:p-8 w-full shadow-2xl ${ancho[maxWidth]}`}>
        {children}
      </div>
    </div>
  );
}

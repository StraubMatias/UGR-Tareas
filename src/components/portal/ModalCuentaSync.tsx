'use client';

import dynamic from 'next/dynamic';
import ModalOverlay from './ModalOverlay';

const CuentaPropia = dynamic(() => import('../CuentaPropia'), {
  loading: () => (
    <div className="text-center py-10">
      <span className="text-3xl animate-spin inline-block" aria-hidden="true">⏳</span>
    </div>
  )
});

interface ModalCuentaSyncProps {
  usuario: string;
  fuente: 'ugr' | 'siu';
  usarCredencialesServidor?: boolean;
  onCerrar: () => void;
  onCompletado: () => void;
  onInterrumpida: () => void;
}

export default function ModalCuentaSync({
  usuario,
  fuente,
  usarCredencialesServidor = false,
  onCerrar,
  onCompletado,
  onInterrumpida
}: ModalCuentaSyncProps) {
  return (
    <ModalOverlay maxWidth="2xl">
      <div className="max-h-[85vh] overflow-y-auto -m-2 p-2">
        <CuentaPropia
          usuario={usuario}
          fuenteInicial={fuente}
          variante="modal"
          permitirCambiarFuente={false}
          usarCredencialesServidor={usarCredencialesServidor}
          onCerrar={onCerrar}
          onCompletado={onCompletado}
          onInterrumpida={onInterrumpida}
        />
      </div>
    </ModalOverlay>
  );
}

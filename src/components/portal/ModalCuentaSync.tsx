import CuentaPropia from '../CuentaPropia';
import type { ResumenMateriaSync } from '../../app/actions/types';
import ModalOverlay from './ModalOverlay';

interface ModalCuentaSyncProps {
  usuario: string;
  onCerrar: () => void;
  onSincronizada: (mensaje: string, resumen?: ResumenMateriaSync[]) => void;
  onSincronizadaSiu: (mensaje: string) => void;
  onInterrumpida: () => void;
}

export default function ModalCuentaSync({
  usuario,
  onCerrar,
  onSincronizada,
  onSincronizadaSiu,
  onInterrumpida
}: ModalCuentaSyncProps) {
  return (
    <ModalOverlay maxWidth="2xl">
      <CuentaPropia
        usuario={usuario}
        onCerrar={onCerrar}
        onSincronizada={onSincronizada}
        onSincronizadaSiu={onSincronizadaSiu}
        onInterrumpida={onInterrumpida}
      />
    </ModalOverlay>
  );
}

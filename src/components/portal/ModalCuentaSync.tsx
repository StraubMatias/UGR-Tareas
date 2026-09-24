import CuentaPropia from '../CuentaPropia';
import ModalOverlay from './ModalOverlay';

interface ModalCuentaSyncProps {
  usuario: string;
  fuente: 'ugr' | 'siu';
  onCerrar: () => void;
  onCompletado: () => void;
  onInterrumpida: () => void;
}

export default function ModalCuentaSync({
  usuario,
  fuente,
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
          onCerrar={onCerrar}
          onCompletado={onCompletado}
          onInterrumpida={onInterrumpida}
        />
      </div>
    </ModalOverlay>
  );
}

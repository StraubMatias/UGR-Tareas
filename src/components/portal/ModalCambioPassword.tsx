import type { FormEvent } from 'react';

interface MensajePassword {
  tipo: string;
  texto: string;
}

interface ModalCambioPasswordProps {
  usuarioActual: string | null;
  userPassChange: string;
  nuevoUserChange: string;
  currentPassChange: string;
  newPassChange: string;
  msgPassChange: MensajePassword;
  onUserPassChange: (valor: string) => void;
  onNuevoUserChange: (valor: string) => void;
  onCurrentPassChange: (valor: string) => void;
  onNewPassChange: (valor: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCerrar: () => void;
}

export default function ModalCambioPassword({
  usuarioActual,
  userPassChange,
  nuevoUserChange,
  currentPassChange,
  newPassChange,
  msgPassChange,
  onUserPassChange,
  onNuevoUserChange,
  onCurrentPassChange,
  onNewPassChange,
  onSubmit,
  onCerrar
}: ModalCambioPasswordProps) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#161c26] border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <span>🔐</span> Usuario o contraseña
        </h3>
        <p className="text-xs text-slate-400 mb-5">La contraseña actual confirma el cambio. El usuario nuevo puede ser tu nombre: las notas y entregas se quedan en la misma cuenta.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Usuario actual</label>
            <input
              type="text"
              required
              readOnly={Boolean(usuarioActual)}
              placeholder="El usuario con el que entrás"
              value={userPassChange}
              onChange={(e) => onUserPassChange(e.target.value)}
              className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none read-only:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Usuario nuevo</label>
            <input
              type="text"
              placeholder="Vacío si solo cambiás la clave"
              value={nuevoUserChange}
              onChange={(e) => onNuevoUserChange(e.target.value)}
              className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña Actual</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={currentPassChange}
              onChange={(e) => onCurrentPassChange(e.target.value)}
              className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nueva contraseña</label>
            <input
              type="password"
              placeholder="Vacía si solo cambiás el usuario"
              value={newPassChange}
              onChange={(e) => onNewPassChange(e.target.value)}
              className="w-full bg-[#0f141c] border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none"
            />
          </div>

          {msgPassChange.texto && (
            <p
              className={`text-xs text-center p-3 rounded-lg border ${
                msgPassChange.tipo === 'exito'
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50'
                  : 'bg-red-950/40 text-red-300 border-red-900/50'
              }`}
            >
              {msgPassChange.texto}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

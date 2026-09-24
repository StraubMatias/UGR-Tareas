type ModoAcceso = 'login' | 'registro';

interface PantallaAccesoProps {
  modoAcceso: ModoAcceso;
  inputUser: string;
  inputPass: string;
  registroPass: string;
  registroConfirmacion: string;
  errorLogin: string;
  enviandoAcceso: boolean;
  onCambiarModo: (modo: ModoAcceso) => void;
  onInputUser: (valor: string) => void;
  onInputPass: (valor: string) => void;
  onRegistroPass: (valor: string) => void;
  onRegistroConfirmacion: (valor: string) => void;
  onLogin: (e: React.FormEvent) => void;
  onRegistro: (e: React.FormEvent) => void;
  onAbrirCambioPassword: () => void;
}

export default function PantallaAcceso({
  modoAcceso,
  inputUser,
  inputPass,
  registroPass,
  registroConfirmacion,
  errorLogin,
  enviandoAcceso,
  onCambiarModo,
  onInputUser,
  onInputPass,
  onRegistroPass,
  onRegistroConfirmacion,
  onLogin,
  onRegistro,
  onAbrirCambioPassword
}: PantallaAccesoProps) {
  return (
    <div className="portal-login max-w-md mx-auto mt-8 border rounded-2xl p-8">
      <div className="text-center mb-6">
        <div className="portal-login-mark inline-block p-4 rounded-2xl mb-6 text-4xl bg-gradient-to-br from-cyan-500/20 to-amber-500/10 border border-cyan-400/30">
          <svg className="h-10 w-10 text-cyan-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="portal-kicker mb-2">Acceso personal</p>
        <h2 className="text-3xl font-black text-white mb-2 bg-gradient-to-r from-cyan-300 via-white to-amber-300 bg-clip-text text-transparent">
          {modoAcceso === 'registro' ? 'Crear cuenta' : 'Iniciar sesión'}
        </h2>
        <p className="text-sm text-slate-400 mt-3 max-w-xs mx-auto leading-relaxed">
          {modoAcceso === 'registro'
            ? 'Elegí un usuario que no esté usado y tu clave. El tablero queda vacío hasta que sincronices con UGR Virtual. Si pasan 7 días sin sincronizar, la cuenta se borra. Desde una misma conexión se pueden crear hasta dos cuentas. El DNI y la clave del campus se piden al sincronizar y no se guardan.'
            : 'Tu tablero para seguir la cursada sin perder el hilo.'}
        </p>
        <div className="portal-login-meta mt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          <span>2° cuatrimestre</span>
          <span aria-hidden="true">·</span>
          <span>2026</span>
        </div>
      </div>

      <form onSubmit={modoAcceso === 'registro' ? onRegistro : onLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Usuario</label>
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={inputUser}
            onChange={(e) => onInputUser(e.target.value)}
            className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={modoAcceso === 'registro' ? registroPass : inputPass}
            onChange={(e) => (modoAcceso === 'registro' ? onRegistroPass(e.target.value) : onInputPass(e.target.value))}
            className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
          />
        </div>
        {modoAcceso === 'registro' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Repetir contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={registroConfirmacion}
              onChange={(e) => onRegistroConfirmacion(e.target.value)}
              className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3.5 text-base text-white focus:outline-none transition-all"
            />
          </div>
        )}
        {errorLogin && (
          <p className="text-sm text-red-400 text-center bg-red-950/30 border border-red-900/30 p-3 rounded-lg">
            ⚠️ {errorLogin}
          </p>
        )}

        <button
          type="submit"
          disabled={enviandoAcceso}
          className="portal-login-button w-full font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
        >
          {enviandoAcceso
            ? (modoAcceso === 'registro' ? 'Creando cuenta…' : 'Entrando…')
            : (modoAcceso === 'registro' ? 'Crear cuenta' : 'Entrar')}
        </button>
      </form>

      <div className="mt-6 text-center border-t border-slate-800/80 pt-4 space-y-3">
        <button
          type="button"
          onClick={() => onCambiarModo(modoAcceso === 'registro' ? 'login' : 'registro')}
          className="block w-full text-xs text-cyan-300 hover:text-cyan-200 underline font-medium cursor-pointer"
        >
          {modoAcceso === 'registro' ? 'Ya tengo cuenta' : 'Crear una cuenta propia'}
        </button>
        <button
          type="button"
          onClick={onAbrirCambioPassword}
          className="text-xs text-cyan-300 hover:text-cyan-200 underline font-medium cursor-pointer"
        >
          🔐 Cambiar usuario o contraseña
        </button>
      </div>
    </div>
  );
}

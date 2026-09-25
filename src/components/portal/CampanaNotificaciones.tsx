import type { NovedadTablero } from './types';
import type { PortalPestana } from './types';

interface CampanaNotificacionesProps {
  notificaciones: NovedadTablero[];
  notificacionesVistas: string[];
  abiertas: boolean;
  onToggleAbiertas: () => void;
  onMarcarVistas: (ids: string[]) => void;
  onNavegar: (pestana: PortalPestana) => void;
  onResponderInvitacion?: (invitacionId: string, aceptar: boolean) => Promise<{ exito: boolean; mensaje?: string }>;
  etiquetaMateria: (nombre: string) => string;
  contenedorRef: React.RefObject<HTMLDivElement | null>;
}

export default function CampanaNotificaciones({
  notificaciones,
  notificacionesVistas,
  abiertas,
  onToggleAbiertas,
  onMarcarVistas,
  onNavegar,
  onResponderInvitacion,
  etiquetaMateria,
  contenedorRef
}: CampanaNotificacionesProps) {
  const noVistas = notificaciones.filter((n) => !notificacionesVistas.includes(n.id));

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        aria-label={`Notificaciones${noVistas.length ? ` (${noVistas.length} sin ver)` : ''}`}
        aria-expanded={abiertas}
        onClick={onToggleAbiertas}
        className="relative shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-1.5 sm:p-2 rounded-lg text-base leading-none transition-all cursor-pointer"
      >
        🔔
        {noVistas.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#161c26]">
            {noVistas.length > 9 ? '9+' : noVistas.length}
          </span>
        )}
      </button>
      {abiertas && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[min(20rem,calc(100vw-1.25rem))] bg-[#161c26] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Recordatorios</p>
            <button
              type="button"
              disabled={noVistas.length === 0}
              onClick={() => onMarcarVistas(notificaciones.map((n) => n.id))}
              className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-100 disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer"
            >
              Marcar vistas
            </button>
          </div>
          {notificaciones.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-400">No tenés recordatorios pendientes.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
              {notificaciones.map((notificacion) => {
                const esInvitacion = notificacion.tipo === 'invitacion-grupo';
                const texto = esInvitacion
                  ? `${notificacion.deAlumno} te invitó al grupo «${notificacion.grupoNombre || 'grupo'}»`
                  : notificacion.tipo === 'parcial'
                    ? 'Rendís mañana'
                    : notificacion.tipo === 'nuevo-parcial'
                      ? 'Nuevo parcial cargado'
                      : notificacion.tipo === 'nueva-tarea'
                        ? 'Nueva tarea cargada'
                        : notificacion.tipo === 'aviso-nuevo'
                          ? 'Aviso en el campus'
                          : notificacion.tipo === 'apertura'
                            ? 'Se habilita mañana'
                            : notificacion.dias === 0
                              ? 'Vence hoy'
                              : `Vence en ${notificacion.dias} ${notificacion.dias === 1 ? 'día' : 'días'}`;

                if (esInvitacion && notificacion.invitacionId) {
                  return (
                    <div
                      key={notificacion.id}
                      className={`px-4 py-3 ${notificacionesVistas.includes(notificacion.id) ? 'opacity-60' : ''}`}
                    >
                      <p className="text-sm font-semibold text-slate-100 truncate">{notificacion.nombre}</p>
                      <p className="text-xs text-slate-400 mt-1">{etiquetaMateria(notificacion.materia)}</p>
                      <p className="text-xs font-bold mt-2 text-cyan-300">{texto}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-lg bg-cyan-500 px-2 py-1.5 text-xs font-bold text-slate-950 cursor-pointer"
                          onClick={() => {
                            void onResponderInvitacion?.(notificacion.invitacionId!, true).then(() => {
                              onMarcarVistas([notificacion.id]);
                              onNavegar('alumnos');
                            });
                          }}
                        >
                          Unirme
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-600 px-2 py-1.5 text-xs font-semibold text-slate-300 cursor-pointer"
                          onClick={() => {
                            void onResponderInvitacion?.(notificacion.invitacionId!, false).then(() => {
                              onMarcarVistas([notificacion.id]);
                            });
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={notificacion.id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        onMarcarVistas([notificacion.id]);
                        onNavegar(
                          ['parcial', 'nuevo-parcial'].includes(notificacion.tipo)
                            ? 'parciales'
                            : notificacion.tipo === 'aviso-nuevo'
                              ? 'horarios'
                              : 'materias'
                        );
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-800/70 transition-colors cursor-pointer ${notificacionesVistas.includes(notificacion.id) ? 'opacity-60' : ''}`}
                    >
                      <p className="text-sm font-semibold text-slate-100 truncate">{notificacion.nombre}</p>
                      <p className="text-xs text-slate-400 mt-1">{etiquetaMateria(notificacion.materia)}</p>
                      <p className={`text-xs font-bold mt-2 ${notificacion.tipo === 'vencimiento' && (notificacion.dias ?? 99) <= 2 ? 'text-red-300' : 'text-amber-300'}`}>
                        {texto}
                      </p>
                    </button>
                    {notificacion.url && (
                      <a
                        href={notificacion.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir el anuncio en UGR Virtual"
                        className="absolute top-2 right-2 text-[11px] font-semibold text-blue-300 hover:text-blue-100 hover:underline"
                      >
                        UGR ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

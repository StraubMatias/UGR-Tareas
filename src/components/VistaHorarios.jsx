import { etiquetaMateria } from '../lib/cursada';

// Vista "Horarios / Calendario mensual": grilla del mes con cursadas, parciales,
// entregas y cronograma, más el modal de detalle por día.
export default function VistaHorarios({
  mesCalendario,
  setMesCalendario,
  nombresMeses,
  horarios,
  parciales,
  tareasCalendario,
  cronograma,
  materias,
  diasCalendario,
  claveHoyCalendario,
  eventosDelDiaCalendario,
  obtenerDiaSemanaHorario,
  diaCalendarioSeleccionado,
  setDiaCalendarioSeleccionado
}) {
  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Cronograma de cursada</p>
            <h2 className="mt-1 text-2xl font-extrabold text-white">Calendario mensual</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1))}
              aria-label="Mes anterior"
              className="calendar-nav-button"
            >
              ←
            </button>
            <h3 className="min-w-40 text-center text-lg font-extrabold capitalize text-white">
              {nombresMeses[mesCalendario.getMonth()]} {mesCalendario.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
              className="calendar-nav-button"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => {
                const hoy = new Date();
                setMesCalendario(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
              }}
              className="calendar-today-button"
            >
              Hoy
            </button>
          </div>
        </div>
        {horarios.length === 0 && parciales.length === 0 && tareasCalendario.length === 0 && cronograma.length === 0 ? (
          <div className="bg-[#161c26] border border-slate-800 p-12 rounded-2xl text-center text-slate-400 text-sm">
            Todavía no hay eventos ni horarios cargados.
          </div>
        ) : (
          <div className="monthly-calendar rounded-2xl border border-slate-800 bg-[#111821] p-2 sm:p-4">
            <div className="grid grid-cols-7 border-b border-slate-800 pb-2 text-center">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
                <span key={dia} className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 sm:text-xs">{dia}</span>
              ))}
            </div>
            <div className="calendar-grid mt-2 grid grid-cols-7 gap-1 sm:gap-2">
              {diasCalendario.map((fecha, indice) => {
                if (!fecha) return <div key={`vacio-${indice}`} className="calendar-empty" />;

                const eventos = eventosDelDiaCalendario(fecha);
                const claveDia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
                const esHoy = claveDia === claveHoyCalendario;
                const cantidadEventos = eventos.horarios.length + eventos.parciales.length + eventos.tareas.length + eventos.cronograma.length;

                return (
                  <button
                    key={claveDia}
                    type="button"
                    onClick={() => setDiaCalendarioSeleccionado(fecha)}
                    aria-label={`Ver detalle del día ${fecha.toLocaleDateString('es-AR', { dateStyle: 'full' })}`}
                    className={`calendar-day ${esHoy ? 'calendar-day-today' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`calendar-date ${esHoy ? 'calendar-date-today' : ''}`}>{fecha.getDate()}</span>
                      {cantidadEventos > 0 && (
                        <span className="text-[9px] font-bold text-slate-500">
                          {cantidadEventos}
                        </span>
                      )}
                    </div>
                    {cantidadEventos > 0 && <div className="mt-2 space-y-1.5">
                      {eventos.horarios.map((horario) => {
                        const materia = materias.find((item) => item.id === horario.materia_id);
                        return (
                          <div key={`${claveDia}-${horario.id}`} className="calendar-event calendar-class" title={`${materia?.nombre || 'Materia'} · ${horario.hora_inicio} - ${horario.hora_fin}`}>
                            <span className="font-bold">{horario.hora_inicio}</span> {materia?.nombre || 'Materia'}
                          </div>
                        );
                      })}
                      {eventos.parciales.map((parcial) => {
                        const materia = materias.find((item) => item.id === parcial.materia_id);
                        return (
                          <div key={parcial.id} className="calendar-event calendar-exam" title={`${parcial.nombre} · ${materia?.nombre || 'Materia'}`}>
                            <span className="font-bold">Parcial</span> {materia?.nombre || 'Materia'}
                            {parcial.detalles && <span className="block truncate opacity-75">{parcial.detalles}</span>}
                          </div>
                        );
                      })}
                      {eventos.tareas.map(({ tarea, materia }) => (
                        <div key={tarea.id} className="calendar-event calendar-task" title={`Entrega: ${tarea.nombre} · ${materia.nombre}`}>
                          <span className="font-bold">Entrega</span> {tarea.nombre}
                        </div>
                      ))}
                      {eventos.cronograma.map((evento) => {
                        const materia = materias.find((item) => item.id === evento.materia_id);
                        const esAsincronico = evento.modalidad === 'asincrónico';
                        const esSinClases = evento.modalidad === 'sin_clases';
                        const diaSemana = obtenerDiaSemanaHorario(new Date(`${evento.fecha}T00:00:00`));
                        const horarioMateria = horarios.find((h) => h.materia_id === evento.materia_id && Number(h.dia) === diaSemana);
                        return (
                          <div key={evento.id} className={`calendar-event ${esAsincronico ? 'calendar-async' : 'calendar-academic'}`} title={`${evento.titulo} · ${materia?.nombre || 'Materia'}`}>
                            <span className="font-bold">{esAsincronico ? 'Asíncrono' : esSinClases ? 'Sin clases' : 'Clase'}</span> {esAsincronico ? (horarioMateria ? `${horarioMateria.hora_inicio} - ${horarioMateria.hora_fin}` : '') : esSinClases ? 'Sin clases' : evento.titulo}
                          </div>
                        );
                      })}
                    </div>}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-800 pt-3 text-[11px] font-semibold text-slate-400">
              <span><i className="calendar-legend-dot bg-cyan-400" /> Cursada</span>
              <span><i className="calendar-legend-dot bg-purple-400" /> Parcial</span>
              <span><i className="calendar-legend-dot bg-amber-400" /> Entrega</span>
              <span><i className="calendar-legend-dot bg-emerald-400" /> Cronograma</span>
              <span><i className="calendar-legend-dot bg-orange-400" /> Asincrónico</span>
            </div>
          </div>
        )}
      </div>
{diaCalendarioSeleccionado && (() => {
        const eventos = eventosDelDiaCalendario(diaCalendarioSeleccionado);
        const fechaTexto = diaCalendarioSeleccionado.toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        return (
          <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setDiaCalendarioSeleccionado(null);
          }}>
            <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Detalle del día</p>
                  <h2 id="calendar-modal-title" className="mt-1 text-xl font-extrabold capitalize text-white">{fechaTexto}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDiaCalendarioSeleccionado(null)}
                  aria-label="Cerrar detalle del día"
                  className="calendar-modal-close"
                >
                  ×
                </button>
              </div>

              {eventos.horarios.length === 0 && eventos.parciales.length === 0 && eventos.tareas.length === 0 && eventos.cronograma.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No hay eventos programados para este día.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {eventos.horarios.map((horario) => {
                    const materia = materias.find((item) => item.id === horario.materia_id);
                    return (
                      <div key={`modal-${horario.id}`} className="calendar-modal-event calendar-class">
                        <p className="text-sm font-extrabold">Cursada · {horario.hora_inicio} - {horario.hora_fin}</p>
                        <p className="mt-1 text-sm">{etiquetaMateria(materia?.nombre || 'Materia no disponible')}</p>
                        {horario.aula && <p className="mt-1 text-xs opacity-75">Aula {horario.aula}</p>}
                      </div>
                    );
                  })}
                  {eventos.parciales.map((parcial) => {
                    const materia = materias.find((item) => item.id === parcial.materia_id);
                    return (
                      <div key={`modal-${parcial.id}`} className="calendar-modal-event calendar-exam">
                        <p className="text-sm font-extrabold">Parcial · {parcial.nombre}</p>
                        <p className="mt-1 text-sm">{etiquetaMateria(materia?.nombre || 'Materia no disponible')}</p>
                        {parcial.detalles && <p className="mt-2 text-sm opacity-85">{parcial.detalles}</p>}
                      </div>
                    );
                  })}
{eventos.tareas.map(({ tarea, materia }) => (
                    <div key={`modal-${tarea.id}`} className="calendar-modal-event calendar-task">
                      <p className="text-sm font-extrabold">Entrega · {tarea.nombre}</p>
                      <p className="mt-1 text-sm">{etiquetaMateria(materia.nombre)}</p>
                      {tarea.detalles && <p className="mt-2 text-sm opacity-85">{tarea.detalles}</p>}
                    </div>
                  ))}
                  {eventos.cronograma.map((evento) => {
                    const materia = materias.find((item) => item.id === evento.materia_id);
                    const esAsincronico = evento.modalidad === 'asincrónico';
                    const esSinClases = evento.modalidad === 'sin_clases';
                    const diaSemana = obtenerDiaSemanaHorario(new Date(`${evento.fecha}T00:00:00`));
                    const horarioMateria = horarios.find((h) => h.materia_id === evento.materia_id && Number(h.dia) === diaSemana);
                    return (
                      <div key={`modal-${evento.id}`} className={`calendar-modal-event ${esAsincronico ? 'calendar-async' : 'calendar-academic'}`}>
                        <p className="text-sm font-extrabold">{esAsincronico ? 'Clase asincrónica' : esSinClases ? 'Sin clases' : 'Cronograma'} · {esAsincronico ? (horarioMateria ? `${horarioMateria.hora_inicio} - ${horarioMateria.hora_fin}` : '') : esSinClases ? 'Sin clases' : evento.titulo}</p>
                        <p className="mt-1 text-sm">{etiquetaMateria(materia?.nombre || 'Materia no disponible')}</p>
                        {esAsincronico && evento.titulo && <p className="mt-1 text-sm opacity-85">{evento.titulo}</p>}
                        {esSinClases && evento.titulo && <p className="mt-1 text-sm opacity-85">{evento.titulo}</p>}
                        {evento.detalles && <p className="mt-2 text-sm opacity-85">{evento.detalles}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        );
      })()}
    </>
  );
}
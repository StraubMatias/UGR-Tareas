import { autorEsEquipoDocente, extraerDocentesDeCurso } from '../docentes.mjs';
import { UGR_BASE_URL, UGR_RUTAS } from '../constantes.mjs';
import {
  analizarAvisosParaCronograma,
  DIAS_HACIA_ATRAS,
  avisoEsRelevante,
  extraerDiscusionesDeForo,
  extraerForosDelIndice,
  extraerPostsDeHilo,
  fechaHoyLocal,
  filtrarEventosDeAviso,
  sumarDias
} from '../avisos.mjs';
import { conPool } from './pool.mjs';
import { parsearAviso } from '../parser-aviso.mjs';
import { evaluarOportunidadPromocion } from '../inteligencia-sync.mjs';

// Recorre los foros de avisos de los cursos mapeados y extrae los hilos nuevos
// publicados desde DIAS_HACIA_ATRAS días hacia atrás en adelante (el típico
// aviso del jueves que anuncia un encuentro del martes siguiente entra en la
// ventana). Devuelve { avisosDetectados, eventosSugeridos }; nada se inserta
// acá.
export async function detectarAvisosMoodle({ db, cliente, mapeos, hoy, diasAtras = DIAS_HACIA_ATRAS, alumnoId, gruposPorMateria }) {
  const fechaBase = hoy || fechaHoyLocal();
  const diasVentana = Math.max(1, Number(diasAtras) || DIAS_HACIA_ATRAS);
  // Los hilos publicados antes de la ventana ya fueron procesados (o no
  // anuncian nada del día actual en adelante) y no se vuelven a proponer:
  // avisos_moodle guarda el histórico por curso + hilo.
  const fechaMinima = sumarDias(fechaBase, -diasVentana);

  // La vista previa persiste pendientes. Deben reaparecer al confirmar o
  // reabrir el modal; solo una decisión definitiva excluye el hilo.
  const resConocidos = await db.execute("SELECT curso_id, hilo_id FROM avisos_moodle WHERE estado IN ('aceptado', 'rechazado')");
  const conocidos = new Set(
    resConocidos.rows.map((fila) => `${fila.curso_id}:${fila.hilo_id}`)
  );

  const avisosDetectados = [];
  const eventosSugeridos = [];
  // Cache de la comprobación «¿el autor es del equipo docente?» por
  // (curso, autorId): evita volver a pedir el perfil de un mismo autor en
  // varios hilos detectados en el mismo sync.
  const cachePerfilDocente = new Map();

  // 1) Índice de foros de todos los cursos en paralelo (concurrencia 4) y,
  // dentro de cada curso, las páginas de los foros «de avisos» (Avisos,
  // Consultas, …) con la misma concurrencia. Antes se encadenaba un pedido por
  // curso y luego otro por foro: ese ida-y-vuelta era gran parte de la lentitud.
  // En el mismo worker se baja la página del curso para identificar al equipo
  // docente (los avisos que llegan a la campana son solo del profesorado).
  const cursosConForos = await conPool(mapeos || [], 4, async ({ curso, coincidencia }) => {
    try {
      const [paginaForos, paginaCurso] = await Promise.all([
        cliente.pedir(UGR_RUTAS.forosDeCurso(curso.id)).catch(() => null),
        cliente.pedir(UGR_RUTAS.curso(curso.id)).catch(() => null)
      ]);
      const docentes = paginaCurso
        ? extraerDocentesDeCurso(paginaCurso.html, UGR_BASE_URL)
        : [];
      const foros = extraerForosDelIndice(paginaForos?.html || '', UGR_BASE_URL)
        .filter((foro) => foro.esAvisos);
      const conDiscusiones = await conPool(foros, 4, async (foro) => {
        try {
          const paginaForo = await cliente.pedir(foro.url);
          return { foro, discusiones: extraerDiscusionesDeForo(paginaForo.html, UGR_BASE_URL) };
        } catch {
          return { foro, discusiones: [] };
        }
      });
      return {
        curso,
        coincidencia,
        docentes,
        foros: conDiscusiones.filter(({ discusiones }) => discusiones.length > 0)
      };
    } catch {
      return null;
    }
  });

  for (const resultado of cursosConForos) {
    if (!resultado) continue;
    const { curso, coincidencia, foros, docentes } = resultado;

    for (const { foro, discusiones } of foros) {
      // 2) Hilos nuevos dentro de la ventana: los ya conocidos no se vuelven a
      // proponer, y los que no se actualizaron en los últimos `diasVentana`
      // días no se leen siquiera (evita pedir el post de hilos viejos la
      // primera vez que corre el sync).
      const nuevas = discusiones.filter((d) =>
        !conocidos.has(`${curso.id}:${d.id}`)
        && (!d.actualizado || d.actualizado >= fechaMinima)
      );

      // 3) Primer post de cada hilo nuevo, en paralelo (concurrencia 4).
      const posts = await conPool(nuevas, 4, async (d) => {
        try {
          const pagina = await cliente.pedir(d.url);
          return extraerPostsDeHilo(pagina.html, UGR_BASE_URL);
        } catch {
          return [];
        }
      });

      for (let i = 0; i < nuevas.length; i += 1) {
        const discusion = nuevas[i];
        const delHilo = posts[i] || [];
        // El anuncio puede ser el post que abre el hilo o un recordatorio
        // posterior del docente. Se queda el primero de la ventana que sea
        // suyo y que le sirva a la cursada.
        let post = null;
        let analisis = [];
        for (const candidato of delHilo) {
          if (!candidato.fecha || candidato.fecha < fechaMinima) continue;
          const esDeDocente = await autorEsEquipoDocente({
            autor: candidato.autor,
            autorId: candidato.autorId,
            cursoId: curso.id,
            docentes,
            cliente,
            cache: cachePerfilDocente
          });
          if (!esDeDocente) continue;
          const eventos = filtrarEventosDeAviso(candidato, analizarAvisosParaCronograma({
            titulo: candidato.titulo,
            contenido: candidato.contenido,
            materiaNombre: coincidencia.materia.nombre,
            hoy: fechaBase,
            fechaPublicacion: candidato.fecha
          }));
          
          const materiaId = String(coincidencia.materia.id || '');
          const gruposAlumno = gruposPorMateria?.get(materiaId) || [];
          const infoParser = parsearAviso(candidato.contenido, gruposAlumno);
          
          // Solo continuar si hay eventos del parser original, es relevante, O el parser encontró algo
          if (eventos.length === 0 && !avisoEsRelevante(candidato) && !infoParser.esEvento) continue;
          
          post = candidato;
          analisis = [...eventos]; // Copiar eventos existentes para no modificar el array original
          
          // Si NO hay eventos del parser original, agregar uno del parser inteligente
          if (infoParser.esEvento && eventos.length === 0) {
            const textoLower = candidato.contenido.toLowerCase();
            const isRecuperatorio = textoLower.includes('recuperatorio') || /\\brecu\\b/.test(textoLower);
            
            const evento = {
              titulo: isRecuperatorio 
                ? `[OPORTUNIDAD PROMOCIÓN] ${coincidencia.materia.nombre}: Recuperatorio`
                : `Aviso ${coincidencia.materia.nombre}: ${candidato.titulo.substring(0, 30)}...`,
              fecha: infoParser.fecha,
              tipo: isRecuperatorio ? 'examen' : 'clase',
              prioridad: infoParser.prioridad
            };
            
            // Si es recuperatorio, evaluar oportunidad de promoción
            if (isRecuperatorio && alumnoId && materiaId) {
              try {
                const notasRes = await db.execute({
                  sql: `
                    SELECT p.nombre, np.nota
                    FROM parciales p
                    LEFT JOIN notas_parciales np ON np.parcial_id = p.id AND np.alumno_id = ?
                    WHERE p.materia_id = ?
                    ORDER BY p.fecha ASC
                    LIMIT 2
                  `,
                  args: [alumnoId, materiaId]
                });
                const parciales = notasRes.rows;
                if (parciales.length >= 2) {
                  const nota1 = Number(parciales[0].nota || 0);
                  const nota2 = Number(parciales[1].nota || 0);
                  const oportunidad = evaluarOportunidadPromocion({ parcial1: nota1, parcial2: nota2 }, coincidencia.materia.nombre);
                  if (oportunidad.debeRendir) {
                    evento.titulo = `[OPORTUNIDAD PROMOCIÓN] ${evento.titulo}`;
                    evento.titulo += ` - ${oportunidad.razon}`;
                    evento.prioridad = 'alta';
                  }
                }
              } catch (e) {
                // Ignorar errores de consulta
              }
            }
            
            analisis.push(evento);
          } else if (eventos.length > 0) {
            // Si ya hay eventos, solo marcar como prioritario si el parser detectó grupo
            if (infoParser.grupoDestino && infoParser.prioridad === 'alta') {
              for (const ev of analisis) {
                ev.prioridad = 'alta';
              }
            }
          }
          break;
        }
        if (!post) continue;
        const id = `aviso_${curso.id}_${discusion.id}`;

        avisosDetectados.push({
          id,
          idMoodle: `moodle_avisos_${curso.id}_${discusion.id}`,
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          materiaId: coincidencia.materia.id,
          materiaNombre: coincidencia.materia.nombre,
          foroId: foro.id,
          foroNombre: foro.nombre,
          hiloId: discusion.id,
          titulo: post.titulo,
          autor: post.autor,
          fecha: post.fecha,
          contenido: post.contenido,
          contenidoHtml: post.contenidoHtml,
          url: post.urlHilo || discusion.url
        });

        for (const analizado of analisis) {
          eventosSugeridos.push({
            avisoId: id,
            avisoIdMoodle: `moodle_avisos_${curso.id}_${discusion.id}`,
            materiaId: coincidencia.materia.id,
            url: post.urlHilo || discusion.url,
            ...analizado
          });
        }
      }
    }
  }

  return { avisosDetectados, eventosSugeridos };
}
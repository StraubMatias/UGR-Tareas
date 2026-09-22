# Tareas UGR

El campus guarda los archivos. Este tablero guarda el estado de la comisión.

Tareas UGR es el lugar donde una cursada deja de depender del grupo de WhatsApp, de una planilla que alguien olvidó actualizar y de entrar materia por materia a UGR Virtual para saber qué falta. Cada alumno ve qué tiene pendiente, qué ya entregó, cómo viene la promoción y qué le queda de la carrera. El administrador mantiene materias, fechas y equipos sin perseguir a nadie.

No reemplaza al campus. Lo complementa: el campus sigue siendo donde se entrega, y este tablero es donde la comisión entiende la cursada.

## El problema que resuelve

En una comisión chica el trabajo real no es subir un PDF. Es saber, el mismo día y para todos:

- qué actividad está abierta, cuál vence esta semana y cuál todavía no habilitó el docente;
- quién entregó, a quién le falta la nota y quién quedó afuera de un grupo;
- si con las notas de hoy la materia se regulariza, se promociona o hay que rendir final;
- cuándo es el próximo parcial, en qué aula cursan y qué avisó la cátedra en el foro;
- qué materias de la carrera ya están aprobadas y cuáles se desbloquean después.

UGR Virtual responde eso, pero repartido en cursos, foros y calificaciones. Tareas UGR lo junta en una sola sesión, con el nombre de cada compañero y las reglas de esta cursada.

## Qué puede hacer la comisión

**Saber cómo viene cada uno.** La vista propia muestra pendientes, entregas sin nota, actividades futuras, completadas y trabajos grupales. El mismo corte existe para el resto de la comisión, con buscador que ignora acentos. De los compañeros se consulta el estado. La entrega y la nota se copian de UGR Virtual al sincronizar; el alumno no las carga a mano.

**No perder una fecha.** Cada tarea tiene materia, unidad, apertura, cierre y un semáforo. La campana avisa vencimientos, actividades que se habilitan y novedades de la cátedra. El calendario del mes mezcla clases, parciales, entregas y eventos que salieron del campus. Al lado están los horarios de cursada, con aula y el próximo examen a la vista.

**Trabajar en equipo sin una planilla aparte.** Una actividad puede ser grupal, con cupo máximo si hace falta. El alumno arma su grupo o se suma a uno con lugar. La entrega y la nota valen para todo el equipo, y se guardan juntas: no queda un integrante actualizado y otro no. Con progreso cargado no se cambia de grupo, y con grupos armados no se apaga la modalidad grupal a mitad de camino.

**Llevar parciales y promoción en serio.** Cada materia tiene sus parciales, sus notas y sus condiciones: desde qué nota se regulariza, desde cuál se promociona, y si esa regla mira trabajos prácticos, un porcentaje de actividades o la nota del práctico. El ranking suma el puntaje de la cursada y deja comparar con un compañero qué explica la diferencia.

**Ver la carrera, no solo el cuatrimestre.** El plan de estudio de la Tecnicatura en Seguridad de la Información está cargado con sus correlativas. Cada alumno marca qué aprobó o promocionó y ve qué materias le quedan habilitadas. El historial conserva entregas y notas, y el selector de período permite mirar una cursada anterior sin mezclarla con la actual.

**Empezar con una cuenta propia.** Cualquier alumno de la UGR puede crear su usuario y su clave. En el alta escribe también el DNI y la contraseña de UGR Virtual: el campus los comprueba en el momento y no quedan guardados. Si UGR acepta, el sincronizar te dice a qué materias de la carrera estás inscripto, guarda esa cursada en el período actual y después carga únicamente las tareas que todavía no estaban. El compañero que sincroniza después se anota en las mismas materias y no duplica lo que ya está. El ranking muestra a quienes cursan esa misma materia.

**Administrar sin ser el que anota todo a mano.** Quien tiene rol de administrador crea y edita materias, tareas, horarios, parciales y alumnos. La sincronización con UGR Virtual, hecha a pedido y con confirmación, detecta tareas nuevas (unidad y fechas incluidas), trae los avisos recientes de los foros y propone eventos para el cronograma: consultas, encuentros, entregas. Completa enlaces que faltaban y no pisa los que ya estaban. También se puede correr en seco, solo para ver qué cambiaría.

## Hecho para datos de una cursada real

Las notas, los grupos y el avance del plan viven en una base propia (Turso). El navegador no guarda la cursada: solo recuerda qué avisos ya se leyeron.

Entrar exige usuario y contraseña. La contraseña se guarda con scrypt, la sesión va firmada y el navegador no puede leerla. Dura 30 minutos, se invalida al cambiar la clave y se borra al salir. Un intento repetido de login se bloquea un rato, igual que una ráfaga de escrituras. Un alumno no carga la nota ni la entrega de otro. Alta, baja y edición de la cursada quedan del lado del administrador. Cada acceso y cada cambio relevante queda en un registro de auditoría.

La conexión con el campus usa las credenciales del entorno, nunca un usuario escrito en el código. El tablero no se ofrece a buscadores: es un espacio de la comisión, no una página pública.

## Con qué está hecho

Next.js 16 y React 19 para la aplicación, TypeScript en todo lo que ve el usuario, Tailwind CSS 4 para la interfaz y Turso para los datos. El sincronizador habla con UGR Virtual (Moodle) y solo se carga cuando alguien sincroniza. La lógica de notas, grupos, fechas y plan tiene tests automáticos.

Está pensado para correr en el plan gratuito de Vercel: el tablero consulta la base en una sola lectura, se refresca cada dos minutos mientras la pestaña está visible y no arrastra al servidor los binarios que la base no necesita ahí.

## Ponerlo en marcha

Hace falta Node.js 20 o superior y una base Turso.

```bash
npm install
npm run migrate
npm run dev
```

Las variables viven en `.env.local` (hay un `.env.example` con los nombres). `SESSION_SECRET` firma las sesiones. `ADMIN_USUARIO` define al administrador que crea la migración; `npm run admin:reset-password` le genera una clave nueva. `UGRVIRTUAL_USER` y `UGRVIRTUAL_PASSWORD` solo hacen falta para la sincronización de la comisión.

`npm test` corre la suite. `npm run build` deja la aplicación lista para publicar.

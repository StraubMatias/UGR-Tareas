# 📚 Tareas UGR

Portal de cursada para una comisión de estudiantes: centraliza materias, entregas, notas, trabajos grupales, cronograma, parciales, horarios y el avance de cada alumno en la carrera, complementando (no reemplazando) UGR Virtual.

## ✨ Qué hace

### 📊 Estado por alumno
El corazón de la app: cómo viene cada estudiante.
- Tarjeta propia de **Tu situación** más acordeones por compañero, con buscador que ignora acentos.
- Filtros con contadores: **Pendientes, Sin nota, Futuras, Completadas y Grupales**.
- Tarjetas de tareas con materia, unidad, semáforo de fechas, estado de entrega y enlace directo al campus.
- **Dos columnas independientes que se rellenan sin huecos** cuando hay ancho disponible (una en pantallas angostas), sin importar de qué materia o unidad sea cada tarea.
- Entregas y notas se cargan solo en las tareas propias; de los compañeros se consulta su estado y notas.
- En trabajos grupales: tu grupo, compañeros, otros equipos, alumnos sin grupo y cupos, con acceso a la gestión de grupos.
- Panel del **próximo examen** con fecha, horarios de cursada y días restantes.

### 📚 Materias y tareas
- Materias con tareas organizadas por **unidad y tipo**, con fechas de apertura y cierre.
- Marcado de entregas y carga de notas (propias y del grupo), con validaciones según el estado de la actividad.
- Alta y edición desde el **Panel de Carga** (administradores).

### 🧩 Trabajos grupales
- Activación de modalidad grupal por tarea, con **cupo máximo opcional** por equipo.
- Los alumnos crean o eligen su grupo; cada integrante ve y carga lo mismo que en una tarea individual.
- Notas y entregas se aplican a todo el grupo en una **transacción**: nunca quedan integrantes actualizados a medias.
- Reglas claras: sin cambios de grupo con progreso cargado, sin cambios de modalidad con grupos existentes.

### 📝 Parciales y notas
- Parciales por materia y fecha, con notas por alumno.
- El semáforo distingue tareas entregadas, pendientes y con nota faltante.

### 🗓️ Cronograma
- **Calendario mensual** con clases, parciales, entregas y eventos del campus en un solo lugar.
- Horarios de cursada por materia y día, con modal de detalle por día.

### 🕘 Historial y períodos
- Historial de entregas y notas por alumno.
- Selector de **período de cursada** para consultar la información correspondiente.

### 🏆 Ranking y promoción
- Puntaje acumulado por tareas, actividades y parciales, con comparación entre compañeros.
- Seguimiento de **promoción por materia** según las notas.

### 🔔 Recordatorios
- Campana de notificaciones: vencimientos, tareas que se habilitan y novedades de la comisión.

### 🎯 Plan de estudio
- Seguimiento de materias del plan con correlatividades y estados por alumno.

### 🛠️ Administración
- Panel centralizado para mantener materias, tareas, horarios, parciales y alumnos.
- Cambio de clave para los usuarios y recuperación de acceso administrador.

## 🔄 Sincronización con UGR Virtual

Un sincronizador propio ([`ugr-sync/`](ugr-sync/README.md)) se conecta al campus y, con confirmación del administrador:
- detecta **tareas nuevas** por materia (incluyendo unidad y fechas del campus),
- publica en la campana los **avisos recientes** de los foros de cada curso,
- propone **eventos para el cronograma** (consultas, encuentros, entregas),
- y **completa enlaces faltantes** de tareas y parciales, sin sobrescribir URLs existentes.

## 🛠️ Tecnologías

| Tecnología | Para qué se usa |
|---|---|
| [Next.js](https://nextjs.org/) 16 + React 19 | App (App Router, Server Actions) |
| [Tailwind CSS](https://tailwindcss.com/) 4 | Estilos |
| [Turso](https://turso.tech/) / libSQL | Base de datos |
| [Cheerio](https://cheerio.js.org/) | Parsing del HTML de Moodle (solo en `ugr-sync`) |
| Node.js 20+ | Runtime |

## 🧪 Tests

Suite con el runner nativo de Node (`node:test`), para la lógica de la app y para el sincronizador (con fixtures HTML reales del campus).

## 💡 Motivación

No busca reemplazar plataformas universitarias: la idea es que el grupo no pierda fechas ni entregas y sepa en todo momento qué falta, qué viene y cómo avanza la carrera en conjunto.

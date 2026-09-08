# Tareas UGR

Portal de gestión de cursada para una comisión de estudiantes de la UGR.

## Sobre el proyecto

Tareas UGR es una aplicación pensada para centralizar la información de la carrera en un solo lugar. La idea es que un grupo de compañeros pueda organizar materias, tareas, fechas de parciales, notas, horarios y progreso sin depender de varios canales separados.

La app está diseñada para que cada alumno vea rápidamente qué tiene pendiente, qué ya entregó, qué falta corregir, qué nota cargó y cómo avanza respecto de sus compañeros. También incluye un panel de administración para cargar y modificar la información del curso.

## Qué hace la aplicación

### Gestión de materias y tareas
- Crear, editar y eliminar materias
- Cargar tareas por materia, unidad y tipo
- Definir fechas de inicio y fin de cada tarea
- Marcar tareas como realizadas por cada alumno
- Diferenciar tareas pendientes, entregadas, futuras y con nota faltante

### Seguimiento del alumno
- Ver el estado personal de cada materia
- Consultar qué tareas faltan por completar
- Revisar si una tarea ya fue entregada o si falta cargar la nota
- Mantener un historial de actividades y notas cargadas

### Parciales y notas
- Registrar parciales por materia y fecha
- Cargar notas por alumno
- Gestionar notas de trabajos prácticos y evaluaciones
- Mantener un registro de todas las notas y su fecha de carga

### Horarios y calendario
- Cargar horarios de cursada por materia y día
- Visualizar el cronograma semanal
- Ver eventos relevantes del calendario académico
- Consultar fechas importantes de tareas y parciales

### Notificaciones y alertas
- Avisar vencimientos próximos
- Notificar tareas que se habilitan en breve
- Mostrar nuevos parciales o tareas cargadas
- Marcar recordatorios como leídos

### Progreso y comparación
- Ver el avance del plan de estudio por alumno
- Comparar el progreso entre compañeros
- Revisar ranking por participación y tareas completadas
- Analizar quién está más adelantado o quién tiene más actividades realizadas

### Panel administrativo
- Dar de alta alumnos
- Editar datos del grupo
- Crear y modificar tareas, materias, horarios y parciales
- Administrar el contenido del portal desde un mismo lugar

## Nuevas funcionalidades agregadas

Además de la organización básica, la aplicación incluye varias funciones que la convierten en una herramienta más completa para la cursada:

- Sistema de ranking con comparación entre compañeros
- Historial de actividades por alumno
- Gestion de plan de estudio y estados de materias
- Notificaciones automáticas por fechas importantes
- Calendario con eventos y vencimientos
- Panel de administración más completo para manejar la comisión
- Diferenciación de tareas según estado y requerimientos de nota

## Tecnologías usadas

- [Next.js](https://nextjs.org/)
- React
- Tailwind CSS
- [Turso](https://turso.tech/) con libSQL
- Node.js

## Capturas del proyecto

La siguiente sección está preparada para incluir imágenes reales del proyecto. Cuando tengas screenshots del app los pasás y yo los dejo integrados en el README para que quede más visual y presentable.

### Dashboard principal

![Dashboard principal](https://placehold.co/1400x900/0f172a/ffffff?text=Dashboard+Tareas+UGR)

### Materias y tareas

![Materias y tareas](https://placehold.co/1400x900/1e293b/ffffff?text=Materias+y+Tareas)

### Parciales, notas y horarios

![Parciales, notas y horarios](https://placehold.co/1400x900/334155/ffffff?text=Parciales%2C+notas+y+horarios)

> Si me pasás capturas reales del proyecto, las reemplazo por estas imágenes de ejemplo para que el README quede listo para GitHub.

## Requisitos

- Node.js 20 o superior
- Base de datos compatible con Turso/libSQL
- Variables de entorno para la conexión a la base de datos y la sesión

## Configuración local

1. Cloná el repositorio:

   ```bash
   git clone https://github.com/Matute2004/tareasUGR.git
   cd tareasUGR
   ```

2. Instalá las dependencias:

   ```bash
   npm install
   ```

3. Creá un archivo .env.local en la raíz del proyecto:

   ```env
   TURSO_DATABASE_URL=tu_url_de_turso
   TURSO_AUTH_TOKEN=tu_token_de_turso
   SESSION_SECRET=una_clave_larga_y_secreta
   ```

   SESSION_SECRET se usa para firmar la sesión. Si no está definido, la app puede usar TURSO_AUTH_TOKEN como alternativa, pero es recomendable configurar un secreto aparte.

4. Iniciá el entorno de desarrollo:

   ```bash
   npm run dev
   ```

5. Abrí http://localhost:3000 en tu navegador.

## Scripts disponibles

```bash
npm run dev      # inicia el servidor de desarrollo
npm run build    # genera la build de producción
npm run start    # levanta la app compilada
npm run lint     # ejecuta ESLint
```

## Roles y administración

Cada alumno puede consultar y actualizar su propio avance. El administrador puede manejar materias, tareas, horarios, parciales, notas y configuración general del grupo.

Actualmente el nombre del administrador está definido dentro del código, pero el proyecto está pensado para adaptarse fácilmente a otra comisión o institución.

## Motivación

Este proyecto no busca reemplazar una plataforma universitaria ni convertirse en un sistema académico rígido. Busca ser una herramienta útil, simple y rápida para estudiantes que quieren organizar la cursada de una manera clara y ordenada.

La parte de ranking y comparación funciona como motivación extra, pero la utilidad principal sigue siendo ayudar a la comisión a no perder fechas ni tareas importantes.

## Estado

Proyecto en desarrollo activo, orientado a uso real de una comisión o grupo de cursada.

## ¿Qué sigue?

Si querés, se puede dejar todavía más pulido con una versión final para GitHub con:
- screenshots reales del proyecto
- una sección de demo o usos comunes
- un logo o portada del proyecto
- una explicación más visual del flujo del usuario


# Tareas UGR

> Un lugar simple para organizar la cursada con tus compañeros.

## Sobre el proyecto

Este proyecto nació de una necesidad bastante concreta: con mis amigos, que también son compañeros de la carrera, necesitábamos una forma clara de llevar el control de las tareas, las fechas importantes y el avance de cada uno.

Entre grupos de WhatsApp, apuntes, PDFs y calendarios separados, era fácil perder una entrega o enterarse tarde de un parcial. **Tareas UGR** busca resolver eso centralizando la información de la cursada en un solo lugar, de forma simple, rápida y fácil de consultar.

Aunque empezó pensado para nuestra carrera y nuestra comisión, el sistema puede adaptarse a cualquier carrera, materia o grupo de estudiantes.

## ¿Qué permite hacer?

- Organizar las tareas por materia, unidad y tipo de actividad.
- Marcar las tareas realizadas y consultar qué tiene pendiente cada alumno.
- Diferenciar tareas pendientes, tareas entregadas que todavía necesitan una nota y tareas futuras.
- Cargar notas de trabajos prácticos y parciales.
- Registrar fechas y detalles de parciales.
- Mostrar avisos cuando se acercan vencimientos o nuevas fechas importantes.
- Consultar los horarios de cursada y la información de cada materia.
- Ver un historial de actividades y notas registradas.
- Comparar el avance entre compañeros.
- Mantener un ranking basado en la participación y las actividades realizadas, como una competencia sana dentro del grupo.

La idea no es agregar complejidad, sino evitar tener que buscar la misma información en varios lugares. Todo lo importante de la cursada debería estar a mano, ordenado y entendido de un vistazo.

## Tecnologías

- [Next.js](https://nextjs.org/)
- React
- Tailwind CSS
- [Turso](https://turso.tech/) mediante `@libsql/client`
- Node.js

## Requisitos

- Node.js 20 o superior.
- Una base de datos compatible con Turso/libSQL.
- Las variables de entorno necesarias para conectarse a la base de datos y firmar las sesiones.

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

3. Creá un archivo `.env.local` en la raíz del proyecto:

   ```env
   TURSO_DATABASE_URL=tu_url_de_turso
   TURSO_AUTH_TOKEN=tu_token_de_turso
   SESSION_SECRET=una_clave_larga_y_secreta
   ```

   `SESSION_SECRET` se utiliza para firmar las sesiones. Si no está definido, la aplicación puede usar `TURSO_AUTH_TOKEN` como alternativa, aunque se recomienda configurar un secreto separado.

4. Iniciá el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

## Scripts disponibles

```bash
npm run dev      # inicia el entorno de desarrollo
npm run build    # genera la compilación de producción
npm run start    # inicia la aplicación compilada
npm run lint     # ejecuta ESLint
```

## Roles

Cada alumno puede consultar y actualizar su propio avance. El usuario administrador puede cargar y editar materias, tareas, horarios, parciales y notas del grupo.

El nombre del administrador se configura actualmente en el código del servidor. Si se adapta el proyecto para otra comisión o institución, conviene reemplazarlo por un sistema de roles configurable.

## La idea detrás

Este no busca ser un sistema académico enorme ni reemplazar las plataformas oficiales de la universidad. Es una herramienta hecha por estudiantes para estudiantes: un tablero compartido para saber qué hay que hacer, cuándo hay que hacerlo y cómo viene el grupo.

La competencia del ranking es un extra para motivar, pero el objetivo principal sigue siendo que nadie se pierda una tarea, un parcial o un horario por falta de información.

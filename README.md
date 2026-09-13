# 📚 Tareas UGR

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38bdf8?logo=tailwindcss&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-libSQL-2b6cb0?logo=sqlite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![Estado](https://img.shields.io/badge/estado-en%20uso%20real%20🟢-22c55e)

> 🎓 **Portal de gestión de cursada** para una comisión real: materias, tareas, parciales, horarios, notas, plan de estudio y ranking, todo en un solo lugar.

---

## 📑 Índice

- [🤔 ¿Qué es?](#-qué-es-tareas-ugr)
- [✨ Funcionalidades](#-funcionalidades)
- [🖼️ Capturas de la app](#️-capturas-de-la-app)
- [🛠️ Tecnologías](#️-tecnologías)
- [🧱 Estructura del proyecto](#-estructura-del-proyecto)
- [🚀 Puesta en marcha](#-puesta-en-marcha)
- [📜 Scripts disponibles](#-scripts-disponibles)
- [🔄 Sincronización con UGR Virtual](#-sincronización-con-ugr-virtual)
- [🧪 Tests](#-tests)
- [💡 Motivación](#-motivación)
- [✍️ En resumen](#️-en-resumen)

---

## 🤔 ¿Qué es Tareas UGR?

Tareas UGR es una herramienta para acompañar la cursada de forma **práctica y clara**. La idea principal es centralizar todo lo importante de una comisión o grupo de estudiantes en un solo lugar: materias, tareas, entregas, parciales, horarios, notas, avances y comparaciones con el resto del grupo.

No es una demo ni un prototipo: es un proyecto **pensado para uso real entre compañeros**. Nació para resolver un problema muy concreto — cuando cada uno guarda la información en distintos lados, es fácil perder una entrega, no enterarse de una fecha importante o no saber cómo viene el grupo.

## ✨ Funcionalidades

### 📚 Gestión de materias y tareas
- Crear y editar materias, y organizar tareas por **materia, unidad y tipo**
- Definir fechas de inicio y fin, y marcar qué tareas completó cada alumno
- Diferenciar tareas **pendientes, entregadas, futuras y con nota faltante**

### 📊 Estado personal y del grupo
- Avance individual por alumno y qué tareas faltan completar
- Historial de entregas y actividades por estudiante
- Revisión rápida de lo ya entregado y lo que todavía necesita nota

### 📝 Parciales, notas y evaluaciones
- Registrar parciales por materia y fecha, y cargar notas por alumno
- Seguimiento de evaluaciones y tareas con nota
- Progreso y evolución de cada materia

### 🗓️ Horarios y calendario
- Horarios de cursada por materia y día
- Calendario mensual del curso con las fechas clave de tareas y parciales en un mismo espacio

### 🔔 Notificaciones y recordatorios
- Avisos de vencimientos cercanos y tareas que se habilitan pronto
- Alertas de nuevas entregas o parciales cargados por los administradores

### 🎯 Plan de estudio y comparación
- Rastreo del plan de estudios por alumno, con correlatividades y estados
- Comparación del avance del grupo y **ranking con puntaje** por tareas, actividades y parciales

### 🛠️ Administración del curso
- Alta de alumnos y carga de tareas, materias, horarios y parciales
- Panel centralizado para mantener la información del curso ordenada y visible para todos

### 🧩 Extras que suman
- Distinción clara entre **actividades, tareas con nota, foros y evaluaciones**
- Botón **🔄 Sincronizar UGR** para importar tareas nuevas directo desde el campus virtual
- Cada alumno entra y ve de un vistazo su situación, lo pendiente, lo próximo y cómo va comparado con sus compañeros

## 🖼️ Capturas de la app

Las vistas principales del proyecto:

#### 📊 Estado del Alumno

![Estado del Alumno](./screenshots/Screenshot_2026-09-07-215924.png)

#### 🗓️ Cronograma

![Cronograma](./screenshots/Screenshot_2026-09-07-215958.png)

#### 🎓 Plan de Estudio

![Plan de Estudio](./screenshots/Screenshot_2026-09-07-220030.png)

#### 📜 Historial

![Historial](./screenshots/Screenshot_2026-09-07-220050.png)

#### 🏆 Ranking

![Ranking](./screenshots/Screenshot_2026-09-07-220103.png)

## 🛠️ Tecnologías

| Tecnología | Para qué se usa |
|---|---|
| [Next.js](https://nextjs.org/) 16 | Framework (App Router + Server Actions) |
| React 19 | UI de la app |
| [Tailwind CSS](https://tailwindcss.com/) 4 | Estilos |
| [Turso](https://turso.tech/) / libSQL | Base de datos |
| [Cheerio](https://cheerio.js.org/) | Parsing del HTML de Moodle (solo en `ugr-sync`) |
| Node.js 20+ | Runtime |

## 🧱 Estructura del proyecto

```text
tareasUGR/
├── src/                    # app Next.js (panel, estado del alumno, plan de estudio…)
│   ├── app/                #   rutas, server actions, plan-utils y acceso a Turso
│   ├── components/         #   vistas .jsx
│   └── lib/                #   lógica pura de la cursada
├── ugr-sync/               # sincronizador con UGR Virtual (módulo independiente)
│   ├── lib/                #   red, autenticación, parsers de Moodle, sync-core
│   ├── scripts/            #   CLI: sync.mjs y login.mjs
│   ├── test/               #   tests + fixtures HTML reales de Moodle
│   └── README.md           #   documentación técnica del módulo
├── database/migrate.mjs    # migraciones de la base (Turso / libSQL)
├── tests/                  # tests de la app (node:test)
├── screenshots/            # capturas de las vistas
├── .env.example            # variables de entorno de ejemplo
└── README.md               # este archivo

# carpetas locales, NO versionadas (ver .gitignore)
data/                       # datos generados en runtime (sesión UGR, …)
varios/                     # cajón de sastre: archivos de herramientas (aider, vscode, claude)
```

> 💡 `data/` y `varios/` están en `.gitignore`: son locales de cada persona y nunca se comparten por git.

## 🚀 Puesta en marcha

### 📋 Requisitos

- **Node.js 20 o superior**
- Una base de datos compatible con **Turso / libSQL**
- Variables de entorno para la conexión y la sesión (ver `.env.example`)

### 🔧 Instalación

```bash
# 1. Instalá dependencias
npm install

# 2. Copiá las variables de entorno y completalas
cp .env.example .env.local

# 3. Prepará la base de datos (crea esquema, índices y hashea contraseñas planas)
npm run migrate

# 4. Levantá la app en modo desarrollo
npm run dev
```

### 🔐 Variables de entorno

```env
TURSO_DATABASE_URL=libsql://tu-base.turso.io
TURSO_AUTH_TOKEN=tu_token_de_turso
SESSION_SECRET=una_clave_larga_y_aleatoria

# Opcionales: credenciales del campus virtual para el sincronizador (ugr-sync)
UGRVIRTUAL_USER=
UGRVIRTUAL_PASSWORD=
```

> ⚠️ `SESSION_SECRET` es obligatorio y **no debe reutilizar el token de Turso**. Las credenciales de `UGRVIRTUAL_*` solo van en `.env.local`, nunca en git.

## 📜 Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila la app para producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run migrate` | Aplica las migraciones de la base |
| `npm run test` | Corré los tests de la app y de `ugr-sync` |
| `npm run ugr:login` | Inicia sesión en UGR Virtual y guarda la cookie |
| `npm run ugr:sync` | Detecta tareas nuevas en el campus y sugiere importarlas |

## 🤝 Convenciones de git

El repo se maneja con commits descriptivos y un solo flujo en `main`.

### Identidad

Los commits deben salir con la identidad real (ya seteada en la config local del repo):

```bash
git config user.name "Matute2004"
git config user.email "straubmatias14@gmail.com"
```

> Chequeá que ese correo esté verificado en tu cuenta de GitHub, así los commits quedan atribuidos correctamente (los anteriores con `Your Name <you@example.com>` salen sin avatar de esa persona).

### Mensajes de commit

Evitá mensajes genéricos tipo «act general» y usá prefijos que describan el cambio:

| Prefijo | Uso | Ejemplo |
|---|---|---|
| `feat:` | Nueva funcionalidad | `feat: botón de sincronización desde el panel` |
| `fix:` | Corrección de un error | `fix: guardar la sesión de Moodle en /tmp en Vercel` |
| `docs:` | Documentación (README, comentarios) | `docs: convenciones de git y autenticación` |
| `refactor:` | Código reorganizado sin cambiar comportamiento | `refactor: mover parsers de Moodle a ugr-sync/lib` |
| `test:` | Tests | `test: cubrir mapeo de materias de 2° año 1° cuatri` |
| `chore:` | Config, dependencias, mantenimiento | `chore: ignorar .aider y data/` |

Consejos:

- **Un commit = un cambio lógico.** Si tocaste tres cosas distintas, hacé tres commits.
- El *body* es opcional para explicar el «por qué» cuando el título solo no alcanza.
- Antes de commitear, corré `npm run test` (y `npm run lint` si tocaste JS).

## 🔄 Sincronización con UGR Virtual

La app trae un **sincronizador propio** que se conecta al campus [`virtual.ugr.edu.ar`](https://virtual.ugr.edu.ar) (Moodle) y trae las tareas nuevas de tus materias a la app, sin copiar y pegar a mano.

El módulo vive en [`ugr-sync/`](ugr-sync/README.md) y es **independiente de la interfaz**: se puede usar desde el **CLI**, desde el **botón del panel** o como **librería**. Usa tu sesión (login clásico de Moodle), porque el campus no ofrece API pública para estudiantes.

### ⚙️ Configuración

Agregá tus credenciales en `.env.local` (**nunca en git**):

```env
UGRVIRTUAL_USER=tu_usuario
UGRVIRTUAL_PASSWORD=tu_contrasena
```

> ℹ️ Las credenciales se leen cada vez que se ejecuta una acción, incluso con el servidor ya levantado: no hace falta reiniciar `npm run dev` tras agregarlas. Igual, conviene reiniciar una vez para que Next arranque con el entorno completo.

### 🖥️ Desde la terminal (CLI)

```bash
# 1. Iniciar sesión y guardar la cookie (data/ugr-sesion.json, no se versiona)
npm run ugr:login

# 2. Sincronizar: detecta tareas nuevas y pregunta antes de insertar
npm run ugr:sync

# 2b. Variantes útiles
npm run ugr:sync -- --dry   # solo muestra lo que encontró, no escribe nada
npm run ugr:sync -- --yes   # inserta todo sin preguntar
```

### 🖥️ Desde el panel

También hay un botón **🔄 Sincronizar UGR** en la app (visible solo para el admin, junto a «Panel de Carga»). Abre una ventana con lo que encontró el sync y muestra cada tarea con un **check**: solo las tildadas se importan al apretar «Importar seleccionadas» (con «Tildar/Destildar todas» para cambiar el lote completo). **Nada se carga automáticamente.**

### ⚙️ Qué hace el sync, por dentro

1. **Mapea cursos → materias**: lista los cursos del campus (`/course/index.php`) y los empareja con las materias locales por **nombre literal**, ignorando el prefijo de versión tipo `(V.TUCS.1.07.2)`. Si Moodle sirve el nombre truncado en el listado, abre la página del curso para recuperar el nombre completo.
2. **Detecta tareas nuevas** leyendo el overview de cada curso (`/course/overview.php`): tareas, foros y cuestionarios. Por cada tarea trae también la **unidad** (del índice, p. ej. «Unidad II») y la **fecha de apertura** (del detalle, bloque «Apertura»/«Cierre»), que quedan cargadas como inicio/fin en la app.
3. **No duplica**: una actividad no se propone si ya existe una tarea local con el mismo nombre (núcleo igual o tolerando sufijos), o si ya está cargada como **parcial** en esa materia (`coincidirParcial()` la empareja por el núcleo del nombre o por la misma fecha de vencimiento). Así, los parciales del cronograma no se importan dos veces.
4. **Completa enlaces pendientes**: tanto tareas como parciales que nacieron sin URL (los del cronograma) reciben el link real a Moodle cuando la actividad aparece en el campus. Solo escribe si la columna `url` está vacía: **nunca pisa un enlace existente**.

### ⚠️ Notas

- El campus no ofrece API pública para estudiantes: se reutiliza la **sesión HTTP** (cookies de Moodle). Si Moodle cambia el HTML de los índices, puede requerir un ajuste menor en los parsers (`ugr-sync/lib/materias.mjs`, `ugr-sync/lib/tareas.mjs`).
- Las migraciones de base (incluida la columna `parciales.url`) viven en `database/migrate.mjs` y se aplican con `npm run migrate`.
- La documentación técnica completa del módulo está en [`ugr-sync/README.md`](ugr-sync/README.md).

## 🧪 Tests

El proyecto corre tests con el runner nativo de Node (`node:test`), tanto para la lógica de la app (`tests/`) como para el sincronizador (`ugr-sync/test/`, con fixtures HTML reales del campus):

```bash
npm run test
```

## 💡 Motivación

La idea no es reemplazar plataformas universitarias ni crear una herramienta académica compleja. La intención es ayudar a un grupo de estudiantes a **organizarse mejor**: no perder fechas ni tareas, y tener la cursada clara y ordenada desde un solo lugar.

El ranking funciona como motivación extra, pero la verdadera utilidad es que el grupo sepa en todo momento qué falta, qué viene y cómo avanza la carrera en conjunto.

## ✍️ En resumen

Tareas UGR es una app hecha para una comisión real de estudiantes que necesita un lugar central para organizar la cursada. Tiene gestión de tareas, notas, horarios, parciales, historial, plan de estudio, comparación entre compañeros y sincronización con el campus virtual — una herramienta útil, funcional y pensada para usarse todos los días. 🚀
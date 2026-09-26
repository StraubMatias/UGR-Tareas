# UGR Tareas — especificación técnica

Tablero de cursada de la Tecnicatura Universitaria en Ciberseguridad (UGR). Una sola aplicación Next.js habla con Turso y, al sincronizar, con el campus Moodle [`https://virtual.ugr.edu.ar`](https://virtual.ugr.edu.ar). No hay API de estudiantes: el sync reutiliza el HTML y las cookies de sesión de Moodle 4.5.

La presentación para la comisión está en [`UGRTareas.md`](UGRTareas.md). Este archivo es el contrato de implementación y de despliegue. El detalle del módulo de campus está en [`ugr-sync/README.md`](ugr-sync/README.md).

## Stack

| Capa | Versión / elección |
| --- | --- |
| Runtime | Node 20+ |
| App | Next.js 16.3.5 (App Router, Turbopack en `next dev`), React 19.2.8 |
| Lenguaje de la app | TypeScript. El compilador de chequeo es TypeScript 7 (`@typescript/native` → `npm:typescript@^7.0.2`). El paquete `typescript` es el API 6 (`npm:@typescript/typescript6@^6.0.2`) porque ESLint / typescript-eslint no hablan la API de TS 7 |
| Estilos | Tailwind CSS 4 (`@tailwindcss/postcss`) |
| Datos | Turso (libSQL) vía `@libsql/client/http`. No se usa el cliente nativo: los binarios glibc/musl se excluyen del trace de Vercel en `next.config.mjs` |
| Campus | `ugr-sync/` en ESM puro (`.mjs`) + Cheerio 1.2. No se migra a TypeScript |
| Tests | `node:test` (`node --test`). No hay Jest ni runner de componentes |
| Lint | ESLint 9 + `eslint-config-next` 16.3.5 |

`tsconfig.json` tiene `strict: true`, `noEmit: true`, `moduleResolution: bundler`.

Instalación: `npm install --legacy-peer-deps`. Hace falta el flag porque typescript-eslint (vía `eslint-config-next`) declara peer de TypeScript `< 6.1` y el compilador de chequeo es 7.

## Topología

No hay rutas REST. La UI es un client component (`src/components/portal/TableroPortal.tsx`, montado desde `src/app/page.tsx`) y toda escritura pasa por Server Actions de `src/app/actions.tsx` (`'use server'`). El layout (`src/app/layout.tsx`) exporta `maxDuration = 60`: en Vercel Hobby ese es el tope de la función que ejecuta esas actions. Un sync que se pase de 60 s lo corta la plataforma.

```
navegador
  └─ cookie ugr_sesion
       └─ Server Actions (actions.tsx)
            ├─ Turso HTTP  (src/app/turso.ts, cliente perezoso)
            └─ ugr-sync    (import dinámico; Cheerio no entra en el refresh del tablero)
                 └─ HTTPS virtual.ugr.edu.ar
                      cookie MoodleSession + logintoken
```

Zona horaria de fechas de campus y de clase: `America/Argentina/Buenos_Aires`.

El HTML de la app no lleva datos de sesión. `next.config.mjs` no pone `Cache-Control: no-store` global: un no-store obligaba a Vercel a reenviar los chunks de `/_next/static` en cada visita y se comía Fast Origin Transfer del plan Hobby. Los chunks ya van con hash.

Cabeceras en todas las rutas: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, COOP/CORP `same-origin`, `Permissions-Policy` vacía de cámara/micrófono/geo, HSTS 2 años, CSP con `default-src 'self'`. `script-src` y `style-src` permiten `'unsafe-inline'`; `script-src` también `'unsafe-eval'` (lo exige el runtime de Next en este setup). `robots` del layout: `noindex, nofollow`. `poweredByHeader: false`.

## Árbol

```
src/app/page.tsx          entrada App Router → TableroPortal
src/app/page.tsx          reexporta TableroPortal
src/components/portal/TableroPortal.tsx  orquestador (hook + layout)
src/components/portal/TableroCuerpo.tsx  login / tablero vacío / pestañas
src/lib/tablero-portal-view-props.ts  props de vistas y modales desde el view-model
src/hooks/useTableroPortal.ts  carga, sync, acciones y derivados
src/hooks/tablero-acciones/  handlers por dominio (alumnos, tareas, parciales, …)
src/hooks/useTableroAcciones.ts  compone los handlers del tablero
src/app/actions.tsx       Server Actions, sesión, rate limit, borrado
src/app/turso.ts          cliente HTTP de Turso
src/app/plan-utils.ts     PLAN_DE_ESTUDIO (códigos y correlativas)
src/app/validators.ts     notas, unidades, habilitación de tarea/parcial
src/app/layout.tsx        metadata, maxDuration
src/core/cursada.ts       puntaje, pendientes, historial (puro)
src/lib/companeros.ts     misma cursada, materia en común, intersección
src/lib/cuentas.ts        vencimiento a 7 días, tope por IP, SQL de borrado
src/lib/grupos-tareas.ts  alta/baja de grupo dentro de una transacción
src/components/           vistas (estado, materias, grupos, plan, …)
ugr-sync/lib/             parsers y núcleo de sync (ver su README)
ugr-sync/scripts/         CLI login y sync
database/migrate.mjs      migraciones 1–26, idempotentes
database/grupos-schema.mjs
tests/                    tests de la app
ugr-sync/test/            tests del sync, con fixtures HTML de Moodle
```

## Modelo de datos

SQLite en Turso. Las migraciones viven en `database/migrate.mjs` y se registran en `migraciones(numero, nombre, aplicada_en)`. Correr dos veces no reejecuta un número ya insertado. Hoy el último número es **26** (25: grupos con entrega individual e invitaciones; 26: `alumnos.ultimo_acceso` para cuentas propias inactivas).

Identidad y cursada:

- `alumnos`: `id`, `nombre` (único case-insensitive, índice `alumnos_nombre_unico` sobre `LOWER(nombre)`), `password` (`scrypt$<salt hex>$<64 bytes hex>`), `rol` (`admin` | `alumno`), `sesion_version`, `origen` (`comision` | `propio`), `creado_en`, `sincronizado_en`, `creado_ip`, `ultimo_acceso` (migración 26). Las columnas `ugr_usuario`, `ugr_secreto` y `ugr_vinculado_en` existen por migraciones viejas y la 20 las deja en `NULL`. No se vuelven a escribir.
- `periodos`: año, cuatrimestre, `activo`.
- `materias`: del período. Condiciones de promoción en `condiciones`, `nota_minima_regularizar`, `nota_minima_promocionar`, `regla_promocion`.
- `inscripciones`: PK `(alumno_id, materia_id)`. Es la cursada real. El tablero de un alumno y el estado de un compañero salen de acá, no de “toda la comisión”.
- `horarios`: semanal. `alumno_id` NULL = horario compartido de la materia. Con `alumno_id` = horario propio, y se borra con la cuenta.

Actividades (compartidas, una fila por materia, no por alumno):

- `tareas`: nombre, inicio, fin, unidad, `con_nota`, `tipo` (`actividad` | `foro` | `trabajo_practico`), `url`, `grupal`, `cupo_maximo`.
- `parciales`: nombre, fecha (un día), `url`.
- `cronograma_eventos`: fecha, modalidad, tipo, título, detalles, `url`, `origen`.
- `avisos_moodle`: hilo del campus, estado (`aceptado` entra a la campana).
- `grupos_tareas` / `integrantes_tareas`: grupo por tarea. FK con `ON DELETE CASCADE` hacia la tarea y hacia el alumno.

Por alumno (se borran con la cuenta):

- `completadas` `(tarea_id, alumno_id, alumno, completada_en)`
- `notas_tareas` y `notas_parciales`, con `cerrada` (0/1)
- `progreso_materias`: estado del plan (`alumno_id`, `materia_codigo`, `estado`, `nota`)

Operación:

- `login_intentos`: clave, fallos, ventana, `bloqueado_hasta`. Sirve para login, altas y acciones de escritura.
- `auditoria`: acción, usuario, detalle, IP, `creada_en`.

El plan de la tecnicatura no está en la base. Está en `PLAN_DE_ESTUDIO` (`src/app/plan-utils.ts`): código, nombre, cuatrimestre, correlativas. Incluye materias fuera del bloque original de la comisión, entre ellas `2.16.1` Conceptos de Desarrollo de Software y `2.18.2` Introducción a la Criptografía. El sync empareja el curso de Moodle contra ese plan (el prefijo de versión del campus, p. ej. `(V.TUCS…)`, se ignora).

## Cuentas y sesión

Contraseña de la cuenta: scrypt, salt de 16 bytes, clave de 64 bytes, comparación con `timingSafeEqual`. No es la clave de UGR Virtual.

Cookie `ugr_sesion`: `base64url(JSON).base64url(HMAC-SHA256)`. El JSON lleva `usuario`, `versionSesion` y `expira`. HMAC con `SESSION_SECRET`. Flags: `httpOnly`, `sameSite=lax`, `secure` si `NODE_ENV=production`, `path=/`, `maxAge` 30 minutos (`DURACION_SESION_SEGUNDOS`). Cada request compara `versionSesion` con `alumnos.sesion_version`. Cambiar la contraseña incrementa la versión y deja muerta la cookie anterior.

Alta pública (`registrarCuentaAction`): usuario, contraseña y confirmación. No pide DNI ni clave de campus. Inserta `origen='propio'`, `creado_en` y `creado_ip`. El usuario tiene 3–100 caracteres; la contraseña, 6–128. Choque de `LOWER(nombre)` (también `Ana` / `ana`) devuelve “Ese usuario ya existe”. Tope: **2 cuentas `propio` vivas con la misma `creado_ip`**. La IP sale de `cf-connecting-ip`, si no de la primera IP pública de `x-forwarded-for`, si no de `x-real-ip`. Borrar la cuenta libera el cupo. Las cuentas `comision` que crea el admin no llevan `creado_ip` y no consumen el cupo. Quien llega sin IP cae en el balde `unknown` y comparte ese mismo tope de 2.

Cuenta `propio` que a los 7 días (`DIAS_PARA_SINCRONIZAR`) no tiene `sincronizado_en` ni inscripciones: `borrarCuentasSinSincronizar` la elimina al registrar, al entrar y al cargar el tablero. El error de esa limpieza se traga para no tumbar el login si faltara una columna. Una sync exitosa escribe `sincronizado_en` una sola vez (`COALESCE` del valor ya guardado). Una cuenta `comision` no entra en esa limpieza.

Borrado (admin o vencimiento), `sentenciasBorrarAlumno`: integrantes, completadas, notas de parcial y de tarea, progreso del plan, inscripciones, horarios con ese `alumno_id`, filas de `auditoria` cuyo `usuario` es esa persona, claves `user:`, `accion:user:` y `ugr:` de `login_intentos`, y la fila de `alumnos`. Después se borran grupos que quedaron sin integrantes. No se tocan `materias`, `tareas`, `parciales`, `cronograma_eventos` ni `avisos_moodle`. Las filas por alumno también matchean `LOWER(alumno)` por si `alumno_id` quedó viejo.

Rate limit (tabla `login_intentos`):

| Clave | Tope | Ventana / bloqueo |
| --- | --- | --- |
| Login por usuario | 5 | 15 min / 15 min |
| Login por IP | 20 | 15 min / 15 min |
| Escritura por IP y por usuario | 30 | 1 min / 5 min |
| Sync personal | 5 por usuario y 20 por IP | misma ventana de login |

El admin se promueve en las migraciones 1 y 11 si `ADMIN_USUARIO` está en el entorno. `npm run admin:reset-password` le pone una contraseña aleatoria y sube `sesion_version`. El nombre del admin no va hardcodeado.

## Quién ve qué

`obtenerEstadoCompleto` manda al cliente las materias del período y las inscripciones. Un alumno `propio` con cero inscripciones recibe el tablero vacío (no la comisión entera).

Estado por alumno:

- Lista de compañeros: quien comparte **al menos una** materia (`alumnosConAlgunaMateriaEnComun`).
- Ficha de otro: solo la intersección (`materiasEnComun`). Quien no cursa Criptografía no ve pendientes de Criptografía.
- Ficha propia: toda la cursada de esa cuenta.
- Admin: ve a todos; la ficha de cada uno es la inscripción de esa persona, sin intersecarla con la del admin.

Ranking y “misma cursada” siguen en `alumnosConLaMismaCursada` (conjunto exacto de materias). No se ensancha al aflojar la lista de Estado.

Grupos: la UI y `gestionarGrupoTareaAction` solo aceptan alumnos con fila en `inscripciones` para la `materia_id` de esa tarea. Salir o borrar el grupo no exige eso.

Filtro **Grupales** en Estado (`tareaGrupalPendienteEnTablero` en `src/core/cursada.ts`): tareas grupales **sin nota** en el tablero del alumno (incluye entregadas pero aún sin calificación). Si la tarea lleva nota y el alumno ya tiene nota, pasa a **Completadas**. Si la tarea no lleva nota (`con_nota = 0`), sale de Grupales cuando figura entregada.

Un alumno no escribe entregas ni notas propias. Esas filas las escribe el sync (o el admin, para corregir). El campus es la fuente. `guardarProgresoPlanAction` sí deja que el alumno marque una materia del plan como aprobada o promocionada: eso no sale del campus.

## Sincronización con el campus

Un botón **Sincronizar** (UGR o SIU). Ninguna ruta persiste DNI ni contraseña de UGR en la base.

**Alumno** — `sincronizarCuentaUgrAction(dni, password)` o `sincronizarCuentaSiuAction(usuario, password)`. UGR usa `conectarUGRCon({ usuario, contrasena, rutaSesion: null })`: jar aislado, no pisa la cookie de la comisión. Si Moodle rechaza el login, la action responde “UGR Virtual no aceptó ese DNI o contraseña” y no loguea las credenciales. Una sync buena reemplaza las inscripciones del período actual (`inscribirAlumnoEnPeriodo`): la cursada queda en lo que el campus dice ahora.

**UGR en varias pasadas (cuenta propia y admin en la UI):** un solo botón **Sincronizar** encadena varias server actions para no superar el techo de **60 s por request** (`maxDuration` en `layout.tsx`). Orden: `fase: 'preparar'` (login, inscripciones, lista de materias) → varios lotes `fase: 'materias'` con `materiaIds` (tamaño de lote en `src/lib/sync-ugr-orquestacion.ts`, típicamente 2 materias; 3 si hay muchas) → lotes `fase: 'avisos'`. El texto de progreso habla de pasadas (p. ej. “materias 1/4”), no del total de materias de la cursada. SIU sigue siendo una sola action. Detalle en `src/server/sync-ugr-cursada.ts` y `src/components/CuentaPropia.tsx`.

**Admin** — mismo flujo en la UI; si no ingresa credenciales, el servidor usa `UGRVIRTUAL_*` (UGR, `conectarUGR()`) o `SIU_USER` / `SIU_PASSWORD` (SIU). La cookie de Moodle de la comisión se guarda en `data/ugr-sesion.json` (local, gitignored) o en `/tmp/ugr-sesion.json` si `VERCEL=1`.

Qué se lee, con concurrencia máxima **4** (`conPool`, default 4; no subirla):

1. Cursos del alumno (`/my/courses.php` y, si hace falta, el AJAX de Moodle con `sesskey`).
2. Altas de materias del plan que falten en el período, una sola vez.
3. Overview del curso (`/course/overview.php`, módulos de `MODULOS_CONSIGNA`: assign, forum, quiz, feedback, h5pactivity, lesson, workshop, choice, data, glossary). Lo que ya está no se vuelve a pedir el detalle de fechas.
4. Calendario (`/calendar/view.php`, upcoming y mes).
5. Foros de avisos, ventana de **7 días** (`DIAS_HACIA_ATRAS`). Clave de aviso: curso + hilo. No se ensancha esa ventana.
6. Libreta (`/grade/report/user/index.php`) para notas.
7. Si la materia es nueva y `condiciones` está vacía, entra al curso, lee el archivo de metodología (PDF/DOCX) y guarda un resumen corto. No pisa las condiciones ya cargadas de las materias originales.

Reglas de escritura:

- Tarea ya existente: no se duplica. Se actualiza la fecha si el campus trae una fecha distinta. Una fecha vacía del campus **no borra** la fecha guardada (`fechasACorregir`).
- Nombre con “parcial” o “evaluación” (`pareceEvaluacion`): es parcial, no tarea con apertura y cierre. Se rinde **un** día de clase. Si apertura y cierre difieren, se queda el día cuyo weekday coincide con `horarios.dia` (1 = lunes … 5 = viernes). La nota no se pide hasta ese día (`parcialYaSeRindio`). La fecha del parcial se relee en cada sync desde la página de la actividad.
- Nota con `cerrada = 1`: no se vuelve a consultar. Al verificarla contra la libreta se cierra.
- Clase: duración fija **90 minutos** (`DURACION_CLASE_MINUTOS`). El inicio verdadero es el que declara el texto del enlace (`horarioDeclaradoEnTitulo`: “17 hs. a 18.30”, “a las 19 Hs”, “Viernes 18:00 hs”), no la ventana larga del calendario. Fin = inicio + 90. Un evento repetido cuya duración no es 90 y cuyo título no declara hora no es horario semanal. `ajustarClasesAlHorario` reescribe título y detalle de la clase; no toca “Se abre/Se cierra”, quizzes, `tipo === 'consulta'` ni filas “sin clases”. Si el título ya existe y solo cambió el rango, `insertarEventosCronograma` hace `UPDATE`, no inserta un duplicado.

## Entorno

Copiar [`.env.example`](.env.example) a `.env.local`. `.env*` está en `.gitignore`; `.env.example` no.

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | sí | `libsql://….turso.io` |
| `TURSO_AUTH_TOKEN` | sí | token de la base |
| `SESSION_SECRET` | sí | HMAC de la cookie. Si falta, la action tira al firmar |
| `ADMIN_USUARIO` | para migrate / reset | nombre exacto del admin a promover |
| `UGRVIRTUAL_USER` | solo sync admin y CLI | usuario del campus de la comisión |
| `UGRVIRTUAL_PASSWORD` | solo sync admin y CLI | clave de ese usuario. El alta de un alumno no la usa |

## Correr en local

```bash
npm install --legacy-peer-deps
node --env-file=.env.local database/migrate.mjs   # o: npm run migrate, con las vars ya exportadas
npm run dev                                       # http://localhost:3000
```

`npm run migrate` es `node database/migrate.mjs` y **no** carga `.env.local` solo. Hace falta `node --env-file=.env.local` o exportar `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` y, si se quiere promover admin, `ADMIN_USUARIO`.

CLI de la comisión (usa la cookie compartida, no la del alumno):

```bash
node --env-file=.env.local ugr-sync/scripts/login.mjs
npm run ugr:sync -- --dry    # no escribe
npm run ugr:sync -- --yes    # inserta sin preguntar
```

Chequeos:

```bash
npx tsc --noEmit          # TS 7
npm test                  # tests/*.test.mjs y ugr-sync/test/**/*.test.mjs
npm run lint
npm run build             # el build de producción, el mismo que corre Vercel
```

## Despliegue (Vercel Hobby)

El repo no trae `vercel.json`. El proyecto de Vercel apunta a este directorio, framework Next.js, install command con `--legacy-peer-deps` (si no, el install del build falla por los peers de arriba).

Variables en **Project Settings → Environment Variables**, entorno Production (y Preview si se usa): las cinco de la tabla. `UGRVIRTUAL_*` tienen que estar en el proceso del server: `conectarUGR()` en `VERCEL=1` no lee un `.env.local` del deploy y falla explícito si no llegaron. Después de crearlas o rotarlas, hace falta un deploy nuevo: las actions leen `process.env` en runtime del deployment actual.

Orden:

1. Crear la base en Turso y anotar URL + token.
2. Cargar las env en Vercel. `SESSION_SECRET`: 32+ bytes aleatorios (`openssl rand -base64 32`). No reutilizar un token viejo de otro proyecto.
3. Aplicar el esquema **antes** de que el primer request pegue a una columna nueva:

   ```bash
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… ADMIN_USUARIO=… npm run migrate
   ```

   O el equivalente con `--env-file`. La 11 promueve `ADMIN_USUARIO`. La 24 agrega `creado_ip`; sin ella el `INSERT` del alta pública falla. La **25** crea tablas de grupos/invitaciones; la **26**, `ultimo_acceso`.
4. Deploy. `layout.tsx` ya declara `maxDuration = 60` **por invocación** de server action. El sync UGR desde la UI hace varias invocaciones seguidas (preparar + lotes de materias + avisos); cada una tiene su propio tope de 60 s. SIU y el atajo servidor `fase: 'nucleo'` siguen siendo una sola pasada y son los que más se acercan al límite si la cursada es grande.
5. `npm run admin:reset-password` contra la misma base si la contraseña del admin hay que rotarla. Imprime la clave nueva una vez; no queda en el repo.

Filesystem: no persistir nada fuera de Turso. `data/` es local y gitignored. En Vercel la sesión de la comisión vive en `/tmp` y puede perderse entre invocaciones; el cliente vuelve a loguearse. La sesión personal no se escribe a disco (`rutaSesion: null`).

Límites que no se negocian en este plan: concurrencia 4 hacia Moodle, ventana de avisos 7 días, `maxDuration` 60. Subir la concurrencia o la ventana multiplica pedidos y se come el presupuesto de 60 s y el de la cátedra.

## Qué no hace este servicio

- No guarda el DNI ni la contraseña de UGR Virtual. Entran en memoria durante `sincronizarCuentaUgrAction` y se descartan.
- No es la entrega. El enlace abre la actividad en el campus.
- No reconsulta una nota ya cerrada.
- No deja que un alumno marque su propia entrega o su nota de cátedra. El admin sí puede corregir filas.

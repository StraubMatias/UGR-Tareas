# Sincronizador UGR Virtual

Módulo independiente que sincroniza la app con el campus
[`virtual.ugr.edu.ar`](https://virtual.ugr.edu.ar) (Moodle): detecta **tareas nuevas**
de las materias mapeadas, **publica en la campana los avisos recientes** de los foros
Avisos/Consultas y **sugiere sus eventos al cronograma** (clases de consulta,
entregas, encuentros, «sin clases»), evita duplicar **parciales** ya cargados desde el
cronograma y completa el **enlace a UGR Virtual** de tareas y parciales que quedaron
sin URL.

No depende de la interfaz de la app: se puede usar desde el CLI, desde el botón
«🔄 Sincronizar UGR» del panel (vía `src/app/actions.tsx`) o como librería.

## Estructura

```
ugr-sync/
├── lib/                    # librería (sin dependencias de la app)
│   ├── constantes.mjs      #   URL y rutas del campus
│   ├── autenticar.mjs      #   login de Moodle + persistencia de la sesión
│   ├── red.mjs             #   cliente HTTP con cookies y re-login automático
│   ├── materias.mjs        #   parser de la lista de cursos
│   ├── tareas.mjs          #   parser del índice de tareas y del overview
│   ├── normalizar.mjs      #   fechas, tipos y matcheo (cursos, tareas, parciales)
│   └── sync-core.mjs       #   núcleo: detección, inserción y backfill de enlaces
├── scripts/
│   ├── login.mjs           #   CLI: inicia sesión y guarda la cookie
│   └── sync.mjs            #   CLI: detecta/inserta tareas y completa enlaces
└── test/                   # tests (node:test) + fixtures HTML reales de Moodle
    └── fixtures/
```

## Cómo se usa

Requisitos: credenciales en `.env.local` (nunca en git) y base Turso corriendo.

```bash
# 1. Iniciar sesión y guardar la cookie (data/ugr-sesion.json, no se commitea)
npm run ugr:login

# 2. Sincronizar (modo interactivo: pregunta antes de insertar)
npm run ugr:sync

# 2b. Variantes
npm run ugr:sync -- --dry   # solo muestra, no escribe nada
npm run ugr:sync -- --yes   # inserta tareas Y publica avisos sin preguntar
```

Correr los tests del módulo:

```bash
node --test ugr-sync/test
```

## Qué hace el sync, con detalle

1. **Mapea cursos → materias**: lista los cursos del campus (`/course/index.php`),
   recupera el nombre completo si Moodle lo sirve truncado y los empareja con las
   materias locales por nombre literal (ignora el prefijo de versión, p. ej.
   `(V.TUCS.1.07.2)`).
2. **Detecta tareas nuevas** leyendo el overview de cada curso (`/course/overview.php`):
   tareas, foros y cuestionarios. Una actividad no se propone si:
   - ya existe una tarea local con el mismo nombre (núcleo igual o tolerando
     sufijos), o
   - ya está cargada como **parcial** en la misma materia: `coincidirParcial()`
     la empareja por **núcleo del nombre** o por la **misma fecha de vencimiento**,
     con lo que los parciales del cronograma no se importan como tarea dos veces.
3. **Completa enlaces pendientes**: tanto las tareas como los parciales que nacieron
   sin URL (los del cronograma) reciben el link real a Moodle cuando la actividad
   aparece en el campus. Solo se escribe cuando la columna `url` está vacía: nunca
   pisa un enlace existente.
4. **Detecta avisos y eventos espontáneos**: recorre los foros «informativos» de
   cada curso (Avisos, Novedades, Consultas, …) y toma los hilos **publicados en
   los últimos 7 días** (ni hilos viejos ni avisos cuya fecha ya pasó). Cada aviso
   se registra una sola vez (clave `curso_id + hilo_id`: el upsert nunca duplica)
   y, si se confirma, se **publica en la campana** de la app. Del texto del aviso
   se sugieren además eventos al cronograma (clases de consulta, encuentros,
   entregas, exámenes, «sin clases») con fecha del día actual o en adelante
   (p. ej. «el martes 15 a las 20:00 tendremos un encuentro» → evento del 2026-09-15).

El recorrido es **paralelo** (concurrencia 4): overviews de todos los cursos,
índices de foros, páginas de foro y post de cada hilo se piden de a cuatro. Además,
el detalle de fechas (apertura/vencimiento) solo se lee para las tareas que todavía
no existen en la base, así un sync sin novedades no encadena un pedido HTTP por tarea.

## Notas

- El campus no ofrece API pública para estudiantes: se reutiliza la sesión HTTP
  (cookies de Moodle). Si Moodle cambia el HTML de los índices, puede requerir
  un ajuste menor en los parsers (`lib/materias.mjs`, `lib/tareas.mjs`).
- Las migraciones de base (incluida la columna `parciales.url`) viven en
  [`database/migrate.mjs`](../database/migrate.mjs) y se corren con `npm run migrate`.
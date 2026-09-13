# Sincronizador UGR Virtual

Módulo independiente que sincroniza la app con el campus
[`virtual.ugr.edu.ar`](https://virtual.ugr.edu.ar) (Moodle): detecta **tareas nuevas**
de las materias mapeadas, evita duplicar **parciales** ya cargados desde el cronograma
y completa el **enlace a UGR Virtual** de tareas y parciales que quedaron sin URL.

No depende de la interfaz de la app: se puede usar desde el CLI, desde el botón
«🔄 Sincronizar UGR» del panel (vía `src/app/actions.js`) o como librería.

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
npm run ugr:sync -- --yes   # inserta todo sin preguntar
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

## Notas

- El campus no ofrece API pública para estudiantes: se reutiliza la sesión HTTP
  (cookies de Moodle). Si Moodle cambia el HTML de los índices, puede requerir
  un ajuste menor en los parsers (`lib/materias.mjs`, `lib/tareas.mjs`).
- Las migraciones de base (incluida la columna `parciales.url`) viven en
  [`database/migrate.mjs`](../database/migrate.mjs) y se corren con `npm run migrate`.
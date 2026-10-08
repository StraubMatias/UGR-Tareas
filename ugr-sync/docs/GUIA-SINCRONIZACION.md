# Guía de sincronización UGR Virtual

Documento de referencia para humanos y para agentes: qué hace el sync, en qué orden, y **dónde está cada pieza en el repo**.

## Resumen en una frase

El módulo `ugr-sync` inicia sesión en Moodle (`virtual.ugr.edu.ar`), recorre los cursos mapeados a materias de Turso, detecta tareas/avisos/calendario/notas, y escribe en la base solo lo que el operador confirma (CLI) o lo que define la acción de servidor (cuenta propia / admin).

## Puntos de entrada

| Comando / código | Archivo | Rol |
|------------------|---------|-----|
| `npm run ugr:sync` | `ugr-sync/scripts/sync.mjs` | Sync de **comisión** (credenciales `UGRVIRTUAL_*` del `.env.local`) |
| `npm run ugr:cronogramas` | `ugr-sync/scripts/sincronizar-cronogramas.mjs` | Solo PDF/Word de cronograma + Zoom + higiene |
| `npm run ugr:login` | `ugr-sync/scripts/login.mjs` | Guarda cookie en `data/ugr-sesion.json` (local, gitignored) |
| Botón panel / cuenta propia | `src/server/sync-ugr-cursada.ts` | Mismo núcleo, flujo por alumno con sesión propia |
| Vista previa admin | `ugr-sync/lib/previa.mjs` | Detecta sin publicar; confirma después |

Variables de entorno:

- `UGRVIRTUAL_USER` / `UGRVIRTUAL_PASSWORD` — cuenta que sincroniza (comisión o la tuya en local).
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — base de la app.

## Flujo del CLI (`sync.mjs`)

Implementado en fases en `ugr-sync/scripts/lib/flujo-sync-comision.mjs`:

1. **Detectar** (`faseDetectar`)
   - `detectarTareasNuevas` — overview de cada curso, tareas nuevas, URLs pendientes, calendario, condiciones de materia.
   - `detectarAvisosMoodle` — foros de avisos, últimos 7 días, eventos sugeridos al cronograma.
2. **Mostrar** (`imprimirResumenDetectado`) — consola; con `--dry` termina acá.
3. **Persistir** (`fasePersistir`)
   - `aplicarComplementoCampus` — eventos/horarios del calendario Moodle, fechas corregidas, parciales desde plan, notas de libreta (si hay `alumnoId`).
   - `insertarAvisosDetectados` — siempre registra hilos (estado `pendiente`).
   - Pregunta (o `--yes`): insertar tareas, publicar avisos + eventos cronograma.
   - Backfill `url` en tareas y parciales.
4. **Cronogramas oficiales** (`faseCronogramasOficiales`) — con `--yes` o `--cronogramas`: `cronograma-oficial.mjs` + `database/cronograma-higiene.mjs`.

Flags: `--yes`, `--dry`, `--cronogramas`.

## Arquitectura de `ugr-sync/lib/`

### Capa HTTP y sesión

| Archivo | Responsabilidad |
|---------|-----------------|
| `constantes.mjs` | `UGR_BASE_URL`, rutas Moodle (`overview`, calendario, foros, etc.) |
| `autenticar.mjs` | Login, jar de cookies, `data/ugr-sesion.json` |
| `red.mjs` | `crearCliente`, redirects, re-login si expira sesión |
| `egress.mjs` | Allowlist al seguir redirects fuera del host |
| `lecturas.mjs` | Cache ligera de HTML repetido en un mismo sync |

### Credenciales y conexión

| Archivo | Responsabilidad |
|---------|-----------------|
| `sync/env.mjs` | Carga `.env.local` / Vercel; `UGRVIRTUAL_*` |
| `sync/conexion.mjs` | `conectarUGR()`, `conectarUGRCon()` (cuenta propia) |
| `sync/pool.mjs` | `conPool` — paralelismo 4 para HTTP |

### Parsers HTML (sin DB)

| Archivo | Responsabilidad |
|---------|-----------------|
| `materias.mjs` | Lista de cursos, AJAX timeline, nombres truncados |
| `tareas.mjs` | Overview, fechas «Abre/Abrió», libreta, quiz/assign |
| `calendario.mjs` | Eventos del calendario Moodle, clasificación, títulos genéricos Zoom |
| `avisos.mjs` | Foros, hilos, posts, NLP liviano → tipo de evento |
| `docentes.mjs` | Equipo docente del curso, perfil del autor |
| `metodologia.mjs` | PDF/DOCX de metodología → condiciones de promoción |
| `assign-entregas.mjs` | Buzones assign con varias entregas (SGSI, etc.) |
| `docx-texto.mjs` | Texto desde DOCX sin dependencias pesadas |
| `cronograma-oficial.mjs` | Recurso «Cronograma», PDF/Word → `cronograma_eventos` + Zoom en `horarios.url_clase` |

### Núcleo de negocio (con DB)

| Archivo | Responsabilidad |
|---------|-----------------|
| `sync/cursos-campus.mjs` | `listarCursosDelCampus`, `mapeosInscripcionesCampus`, `asegurarMateriasDeLaCursada` |
| `sync/avisos-detectar.mjs` | `detectarAvisosMoodle` |
| `sync/avisos-db.mjs` | `insertarAvisosDetectados`, `aprobarAvisos`, `rechazarAvisos` |
| `sync/cronograma-db.mjs` | `insertarEventosCronograma` (origen `ugr`, respeta plan manual/oficial) |
| `sync-core.mjs` | **Resto del núcleo**: `detectarTareasNuevas`, notas, assign, parciales, `aplicarComplementoCampus`, etc. Reexporta los módulos `sync/*`. |
| `normalizar.mjs` | Matcheo curso↔materia, tarea↔parcial, fechas, tipos |
| `sync-optimizacion.mjs` | Omitir lecturas cuando el dato ya es estable |
| `previa.mjs` | Orquestación detectar → confirmar → escribir (admin) |

### Base de datos relacionada (fuera de `ugr-sync/`)

| Archivo | Responsabilidad |
|---------|-----------------|
| `database/migrate.mjs` | Esquema: `tareas`, `parciales`, `cronograma_eventos`, `avisos_moodle`, `horarios.url_clase`, … |
| `database/cronograma-higiene.mjs` | Borra ruido UGR si hay plan fuerte; promueve parciales desde cronograma |
| `database/planes-cronograma-comision.mjs` | Plan manual de respaldo (ej. SGSI sin fechas en PDF) |
| `database/enlaces-clase-comision.json` | Catálogo único Zoom/URL (calendario Next + `zoom-enlaces-comision.mjs`) |
| `ugr-sync/lib/zoom-cursada.mjs` | Elige enlace por día/hora de `horarios` |
| `ugr-sync/lib/zoom-enlaces-comision.mjs` | Semilla de enlaces; migración 37 y sync escriben `url_clase` |

Ver también [`docs/CONTEXTO-IA.md`](../../docs/CONTEXTO-IA.md) (handoff calendario / campana / promoción).

## `detectarTareasNuevas` (corazón del sync)

Ubicación: `sync-core.mjs` (función exportada).

Pasos internos:

1. Materias locales (`periodo_id` si aplica).
2. Cursos campus + `coincidirMateria` por nombre (ignora prefijo `V.TUCS…`).
3. `moverTareasQueSonParciales` — evaluaciones mal clasificadas.
4. Por cada curso (paralelo): `overview` → actividades assign/forum/quiz.
5. Comparar con `tareas` / `parciales` existentes; armar `detectadas`, `urlsActualizar`, `urlsParcialesActualizar`.
6. Detalle de fechas solo si hace falta (`actividadNecesitaDetalleFechas`) — apertura con hora.
7. `completarDesdeCalendario` — solo si la materia **no** tiene plan `manual`/`oficial`.
8. `completarCondicionesCampus` — metodología PDF si `materias.condiciones` vacío.
9. `leerProgresoCampus` — libreta del alumno si hay `alumnoId`.

Retorno: objeto usado por `aplicarComplementoCampus` y por el informe en `sync-ugr-cursada.ts`.

## Cronograma: tres fuentes

1. **Manual / migraciones** — `origen: manual` (`planes-cronograma-comision.mjs`).
2. **Oficial campus** — PDF/Word vía `cronograma-oficial.mjs` → `origen: oficial`.
3. **Campus calendario + avisos** — `origen: ugr` (genéricos filtrados en UI por `cronograma-vista.ts` + higiene).

Prioridad en pantalla: oficial > manual > ugr (ver puntajes en `src/lib/cronograma-vista.ts` y `cronograma-higiene.mjs`).

## App Next.js (consumo)

| Archivo | Uso del sync |
|---------|----------------|
| `src/server/sync-ugr-cursada.ts` | Sync personal: inscripciones, notas, assign, resumen |
| `src/app/actions/estado.ts` | Carga `cronograma_eventos`, `horarios.url_clase` |
| `src/lib/calendario-tablero.ts` | Día del calendario, alinear fecha al día de cursada |
| `src/lib/cronograma-vista.ts` | Ocultar Zoom genérico, tema en bloque «Cursada» |

## Tests

```bash
npm test   # incluye ugr-sync/test/*.test.mjs
```

Fixtures HTML reales en `ugr-sync/test/fixtures/`. Tras cambiar parsers, actualizar tests cercanos (`parsers.test.mjs`, `calendario.test.mjs`, `avisos.test.mjs`, `cronograma-oficial.test.mjs`).

## SIU (no confundir)

`siu-sync/` es **otro** módulo (`siu-sync/lib/sync-core.mjs`): plan de estudio y notas SIU Guaraní. No importa desde `ugr-sync/lib/sync-core.mjs` salvo tests viejos que deben apuntar a `siu-sync`.

## Cuando algo falla

| Síntoma | Dónde mirar |
|---------|-------------|
| Login / sesión | `autenticar.mjs`, `red.mjs`, `npm run ugr:login` |
| Curso no mapea | `normalizar.mjs` → `coincidirMateria`; nombre en `materias` |
| Tarea falta o duplicada | `tareas.mjs`, `detectarTareasNuevas`, `moverTareasQueSonParciales` |
| Fecha de apertura mal | `tareas.mjs` rotulos Abre/Abrió; `fechasACorregir` en `normalizar.mjs` |
| Cronograma con ruido | `cronograma-higiene.mjs`, `npm run ugr:cronogramas` |
| Aviso no aparece | `avisos-detectar.mjs`, estado en `avisos_moodle` |
| Nota assign multi-entrega | `assign-entregas.mjs`, `sincronizarHitosAssignEnMaterias` |

## Mantenimiento habitual

1. `npm run migrate` tras pull si hubo migraciones.
2. `npm run ugr:sync -- --yes` tras cambios de consignas en Moodle.
3. `npm run ugr:cronogramas` si actualizaron PDF en el curso.
4. `npm test` antes de commitear cambios en parsers.

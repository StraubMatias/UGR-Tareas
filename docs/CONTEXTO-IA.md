# Contexto del proyecto (handoff para humanos e IAs)

Describe **cómo está armado el repo hoy**: piezas delicadas y dónde tocar. Complementa [`README.md`](../README.md) (contrato técnico y deploy) y [`ugr-sync/docs/GUIA-SINCRONIZACION.md`](../ugr-sync/docs/GUIA-SINCRONIZACION.md) (sync Moodle).

---

## Qué es el producto

Tablero Next.js + Turso para la Tecnicatura en Ciberseguridad (UGR). Los alumnos sincronizan con UGR Virtual / SIU; el campus es fuente de verdad para tareas, notas y fechas. No hay API oficial de Moodle: todo es HTML + cookies (`ugr-sync/`).

---

## Mapa rápido de carpetas

| Ruta | Rol |
|------|-----|
| `src/app/` | App Router, Server Actions, Turso |
| `src/components/portal/` | Tablero (pestañas, campana, sync) |
| `src/components/VistaHorarios.tsx` | Calendario mensual + modal del día |
| `src/lib/calendario-tablero.ts` | Qué eventos caen en cada día |
| `src/lib/cronograma-vista.ts` | Filtra ruido del cronograma; tema de clase junto a «Cursada» |
| `src/lib/promocion-materia.ts` | Reglas de promoción / regularización |
| `src/lib/notificaciones-tablero.ts` | Campana (parciales, vencimientos, avisos) |
| `src/lib/enlaces-clase-comision.ts` | URLs de Zoom/aula para el calendario |
| `database/migrate.mjs` | Migraciones numeradas (último nº al final del archivo) |
| `database/planes-cronograma-comision.mjs` | Plan manual por materia (prioridad sobre PDF) |
| `database/enlaces-clase-comision.json` | **Catálogo único** de enlaces sincrónicos |
| `database/cronograma-higiene.mjs` | Limpia basura de PDFs importados |
| `ugr-sync/lib/cronograma-oficial.mjs` | PDF/DOCX + Zoom del campus |
| `ugr-sync/lib/zoom-cursada.mjs` | Empareja enlace ↔ día/hora de cursada |
| `ugr-sync/lib/zoom-enlaces-comision.mjs` | Lee el JSON y escribe `horarios.url_clase` |

---

## Calendario y link sincrónico

El cronograma mensual es la vista principal de cursada:

- **Grilla del mes:** cada bloque de cursada muestra `materia · HH:MM–HH:MM` y un acceso **Sincrónico ↗** al Zoom o módulo Moodle.
- **Modal del día:** horario, unidad/tema del plan, detalle (p. ej. docente), link sincrónico completo, parciales, entregas y demás eventos del plan.

**De dónde sale el enlace**

1. Columna `horarios.url_clase` en Turso (rellenada por sync o migración que aplica el catálogo).
2. Si falta, respaldo en runtime desde [`database/enlaces-clase-comision.json`](../database/enlaces-clase-comision.json) vía `enlaces-clase-comision.ts`.

**Casos especiales**

- **SGSI:** dos módulos (mié 19:00 y jue 20:30). `elegirEnlaceZoomParaFilaHorario` en `zoom-cursada.mjs` elige por fila de horario.
- **Ciberdelitos:** el campus alterna Zoom según docente. En el JSON está Rodríguez (`profesorClave: rodriguez`); si el plan del día menciona Gianzone, no se usa el link de Rodríguez hasta cargar el de Gianzone en el mismo JSON.

**Archivos:** `VistaHorarios.tsx`, `calendario-tablero.ts`, `enlaces-clase-comision.ts`, `cronograma-vista.ts`.

---

## Cronograma académico (plan de materia)

- Eventos en `cronograma_eventos` (origen `manual`, `oficial`, `ugr`).
- Importación desde PDF/Word del campus: `cronograma-oficial.mjs`; los PDFs mal formateados se limpian con `cronograma-higiene.mjs`.
- **Plan manual** en `planes-cronograma-comision.mjs` tiene prioridad cuando choca con lo importado.
- En pantalla, las clases del plan que coinciden con el horario semanal no se duplican: el tema queda en el bloque «Cursada» (`presentarCronogramaDelDia`).

---

## Promoción y estado de materia

- Reglas en `materias.regla_promocion` + `promocion-materia.ts` (p. ej. `parciales_y_tps`, `ciberdelitos_parciales`, solo TPs).
- `parcialYaRendido`: hay nota **o** la fecha del parcial es anterior a hoy (zona `America/Argentina/Buenos_Aires`); el mismo día sin nota aún no cuenta rendido.
- UI: `estado-materia-ui.ts`, `VistaPromocion.tsx`.

---

## Campana de notificaciones

- Arma la lista en `notificaciones-tablero.ts`: vencimientos de tareas, parciales (solo hoy/mañana), avisos Moodle aceptados, invitaciones a grupo, etc.
- Parciales: `diferenciaDiasCalendarioCampus`; no avisa días ya pasados ni si `parcialYaRendido`; el mismo día deja de avisar después de las 22:00 AR.
- Avisos del campus: vigencia en `avisos.ts` (`avisoVigenteEnCampana`).

---

## Sync con UGR Virtual

- Cuenta propia: varias invocaciones de Server Action (una materia por pasada) por `maxDuration` 60 s en Vercel (`sync-ugr-orquestacion.ts`, `sync-ugr-cursada.ts`).
- Comisión / CLI: `ugr-sync/scripts/sync.mjs`, `flujo-sync-comision.mjs`; al persistir corre `sincronizarEnlacesZoomHorarios`.
- Credenciales: `UGRVIRTUAL_*` en entorno; cookie de comisión en `data/ugr-sesion.json` (local) o `/tmp` en Vercel. `sync/env.mjs` evita lecturas de filesystem en el build de Vercel.

---

## Agregar o cambiar un enlace de clase

1. Editar solo [`database/enlaces-clase-comision.json`](../database/enlaces-clase-comision.json).
2. Campos: `materia` (fragmento del nombre), `urlCampus`, opcional `dia` / `horaInicio`, opcional `profesorClave` (`rodriguez` | `gianzone`) para Ciberdelitos.
3. Aplicar en DB: `npm run migrate` (si existe migración que aplica el catálogo) o `npm run ugr:sync -- --yes`.
4. Tests: `tests/enlaces-clase-comision.test.mjs`, `ugr-sync/test/zoom-cursada.test.mjs`.

---

## Tests y calidad

```bash
npm test          # tests/ + ugr-sync/test/
npm run build
npm run lint
```

No hay tests E2E de UI. Lógica de calendario, promoción y enlaces: `tests/*.test.mjs`.

---

## Qué no refactorizar sin cuidado

- `ugr-sync/lib/sync-core.mjs` — núcleo grande; cambios chicos y con tests.
- Duplicar enlaces fuera del JSON (desalinea calendario y sync).
- Subir concurrencia HTTP o la ventana de avisos sin medir tiempo de sync.

---

## Otra documentación

| Archivo | Uso |
|---------|-----|
| [`UGRTareas.md`](../UGRTareas.md) | Presentación comisión / portfolio |
| [`README.md`](../README.md) | Deploy, modelo de datos, seguridad |
| [`SECURITY.md`](../SECURITY.md) | Secretos y amenazas |
| [`ugr-sync/README.md`](../ugr-sync/README.md) | Módulo campus |

Cuando el producto gane una capacidad nueva, **sumarla en las secciones de arriba** (no mantener un changelog aparte).

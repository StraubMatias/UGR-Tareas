# Seguridad

## Secretos

- **Nunca en Git.** Usá `.env.local` en desarrollo y variables de entorno en Vercel. Ver `.env.example`.
- Lo que el repo **sí** expone (y es normal, porque el código es público a propósito): cómo se valida la sesión, los rate limits, los parsers de Moodle y Guaraní, y el esquema SQL. Eso ayuda a auditar. La defensa en producción son los **secretos en el entorno**, los permisos de Turso, HTTPS y los límites del servidor desplegado.
- Lo que el repo **no** expone: `TURSO_*`, `SESSION_SECRET`, `UGRVIRTUAL_*`, `SIU_*`, `ADMIN_USUARIO`, la base de datos y las cookies de Moodle de la comisión. Detalle en [README — Repositorio público](README.md#repositorio-público-y-qué-queda-fuera-de-git).

## Credenciales de terceros

El tablero maneja dos juegos de credenciales ajenas, y en los dos casos el patrón es el mismo: **entran en memoria, se usan para esa operación y se descartan**.

| Credencial | Quién la tipea | Dónde vive |
| --- | --- | --- |
| DNI y clave de UGR Virtual | Cada alumno, en el modal de sincronización | Solo en el request. No se guardan en la base ni en disco. |
| Usuario y clave de SIU Guaraní | Cada alumno, en el modal de Solicitudes | Solo en el request. No se guardan en la base ni en disco. |

El **admin** puede, en ambos casos, usar las credenciales del servidor (`UGRVIRTUAL_*`, `SIU_USER` / `SIU_PASSWORD`) sin tipear nada: viven en el entorno y solo las lee el servidor.

## Sesión y cuentas

- Cookie de sesión: `httpOnly`, `sameSite=lax`, `secure` en producción, con HMAC-SHA256 y expiración de 30 minutos. Cada request compara la `sesion_version` del alumno: cambiar la contraseña invalida las cookies anteriores.
- Contraseñas de cuenta: scrypt con salt por usuario y comparación en tiempo constante. **No** son las claves del campus.
- Rate limit por usuario y por IP en login, altas y acciones de escritura.
- Topes de cuentas propias por IP y **borrado automático a los 7 días sin sincronizar con UGR Virtual**. Entrar al tablero no alcanza: tiene que haber un sync. El admin queda fuera de esa regla.
- El password del admin no va hardcodeado: se promueve por migración con `ADMIN_USUARIO` y se rota con `npm run admin:reset-password`.

## Lo que el servicio no hace

- No guarda credenciales de campus ni de Guaraní.
- No deja que un alumno escriba su propia entrega ni su propia nota de cátedra: eso lo escribe el sync o el admin.
- No reconsulta una nota ya cerrada.
- No expone una API de estudiantes: el campus no tiene una, y el sync reutiliza la sesión HTTP de Moodle. Por eso la app es la única forma de escribir en la base, y toda escritura pasa por Server Actions con sesión y rate limit.

## Headers y superficie

`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, COOP/CORP `same-origin`, `Permissions-Policy` sin cámara/micrófono/geo, HSTS de 2 años, CSP con `default-src 'self'` y `robots: noindex, nofollow`. El layout declara `maxDuration = 60`: es el tope de cada Server Action en Vercel Hobby, y el sync encadena varias invocaciones para no pasarse.

## Incidentes

Si creés que filtraste un token (`TURSO_AUTH_TOKEN`, `SESSION_SECRET`, clave de campus o de Guaraní), rotalo en Turso/Vercel y redeployá. Un `SESSION_SECRET` nuevo invalida todas las cookies del portal.

No reportes vulnerabilidades en issues públicos con datos de producción; contactá al mantenedor del deploy de la comisión.

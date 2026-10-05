# Seguridad

- **Secretos:** nunca en Git. Usá `.env.local` en desarrollo y variables de entorno en Vercel. Ver `.env.example`.
- **Repo público:** el código es visible; la instancia en producción no se expone por el clone. Detalle en [README — Repositorio público](README.md#repositorio-público-y-qué-queda-fuera-de-git).
- **Incidentes:** si creés que filtraste un token (`TURSO_AUTH_TOKEN`, `SESSION_SECRET`, clave de campus), rotalo en Turso/Vercel y redeploy. `SESSION_SECRET` nuevo invalida todas las cookies del portal.

No reportes vulnerabilidades en issues públicos con datos de producción; contactá al mantenedor del deploy de la comisión.

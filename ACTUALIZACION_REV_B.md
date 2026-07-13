# Actualización Rev. B — 2026-07-13 (leer antes de continuar cualquier tarea)

> Para el agente que ya está trabajando con la Rev. A de `INSTRUCCIONES_DESARROLLO.md`.
> `AGENTS.md` e `INSTRUCCIONES_DESARROLLO.md` ya fueron actualizados a Rev. B; este archivo resume SOLO lo que cambió y cómo aplicarlo al trabajo en curso.

## Cambio 1 — Greenfield total: los sistemas anteriores son solo referencia funcional
**Antes (Rev. A):** integrar y re-apuntar los activos existentes (`andina-dashboard`, bot WhatsApp, visor BIM).
**Ahora:** todo se construye desde cero en este repo. `andina-dashboard` y la app AppSheet v1 definen QUÉ debe lograr la plataforma (capacidades, flujos, pantallas), nunca CÓMO — **prohibido copiar o adaptar su código**. La infraestructura sí se mantiene: Supabase self-hosted en `lukeserver` (esquema dedicado v4) y CI/CD push-to-deploy.

**Cómo aplicarlo:**
- Tareas F1.5 (re-apuntar dashboard) y F1.6 (migrar bot) de la Rev. A quedan **anuladas**. Si hay trabajo iniciado sobre el código de `andina-dashboard`, se descarta (no borrar el repo viejo: sigue en producción para el 413 y sirve de referencia visual).
- Bot WhatsApp y visor BIM pasan a **Fase 3** como reimplementaciones v4 (F3.2 y F3.3 nuevas).
- Lo que NO cambia: esquema de datos, importador del cubicador, PWA terreno offline, migración ETL del 413, fases 0 y 2 completas.

## Cambio 2 — El dashboard nace multi-proyecto: muestra TODA la cartera
**Nueva tarea F1.5** (`apps/dashboard`, desde cero):
- Vista inicial = cartera completa: todos los proyectos visibles para el usuario, con KPIs comparables (avance físico juntas/spools, curva S, alertas QA/QC, materiales críticos).
- Drill-down por proyecto → detalle (ISO/spool/junta, calidad, materiales).
- Regla dura: ninguna pantalla asume proyecto único; `proyecto_id` siempre viene del contexto de navegación.
- KPIs en vistas/funciones SQL (compartidas con `bi_*`), no calculados en frontend.

## Cambio 3 — Rol de lectura transversal (soporta el dashboard de cartera)
- Nuevo: `usuarios.acceso_global boolean` (o rol GERENCIA): **lectura** de todos los proyectos, nunca escritura global. Ajustar las policies RLS de lectura: `membresía activa OR acceso_global`.
- Si las migraciones de F0.2 ya están escritas, agregar una migración incremental (no editar migraciones ya aplicadas).

## Checklist de aplicación inmediata
1. Releer `AGENTS.md` (Rev. B): secciones nuevas "Reglas del dashboard" y "Anti-patrones a NO repetir".
2. Renombrar `apps/oficina` → `apps/dashboard` si ya existe; si no, crearla así.
3. Agregar migración para `acceso_global` + ajuste de policies de lectura.
4. Continuar el roadmap normal; el orden de fases no cambia (F0 → F1 → F2 → F3).

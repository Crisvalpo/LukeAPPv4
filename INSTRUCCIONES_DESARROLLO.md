# LukeAPP v4 — Instrucciones de desarrollo (roadmap completo)

> Para el agente/desarrollador en Antigravity. Leer primero `AGENTS.md` (reglas inviolables).
> Estado: marcar `[x]` al completar cada tarea. **Rev. B — Julio 2026**.
> Rev. B (2026-07-13): `apps/oficina` → `apps/dashboard`; rol GERENCIA + `acceso_global` en usuarios (migr. 003); bucket Storage `evidencias` privado (regla inviolable). Ver `AGENTS.md` para detalles.

## 0. Contexto

- **v1 (referencia viva)**: carpeta OneDrive `EIMI00413 - Andina - ...` — AppSheet + ~30 tablas Excel en 6 dominios (CAT/LIST/LOG/REG/REL/DOC + 0_UX). Es la fuente de la migración y el espejo funcional de lo que hay que cubrir.
- **v4 (este repo)**: plataforma multi-proyecto. Un esquema, N proyectos; diferencias por industria (minería/refinería/celulosa) vía configuración.
- **Actor clave — el cubicador**: seguirá trabajando en su Excel de siempre. La ingeniería entra a la plataforma por importación masiva con detección de diferencias (módulo M3), no por digitación.

- **Sistemas anteriores = solo referencia funcional (Rev. B)**: v4 es greenfield; no se integra ni migra código existente. El repo `Crisvalpo/andina-dashboard` (dashboard, visor BIM 3D, bot WhatsApp, QR, guías) y la app AppSheet v1 definen QUÉ debe lograr la plataforma, no CÓMO. La infraestructura sí se reutiliza: Supabase self-hosted en `lukeserver` (esquema dedicado v4) y el patrón CI/CD push-to-deploy.

Arquitectura (resumen):

```
Cubicador (Excel) ──> Importador (staging + diff) ──┐
Terreno (PWA offline, PowerSync/SQLite) ──sync──────┤    Supabase self-hosted en lukeserver
Dashboard v4 (React, TODA la cartera + drill-down) ─┤──> Postgres, esquema v4 (RLS por proyecto)
[Fase 3] Bot WhatsApp v4 / Visor BIM v4 ────────────┤        ├── Supabase Storage (evidencias)
                                                    └        └── Vistas bi_* ──> Power BI
```

> Nota de despliegue: Supabase ya corre self-hosted en `lukeserver` (Docker + PostgREST con `PGRST_DB_SCHEMAS`). v4 vive en un esquema dedicado (`lukeapp`) en esa instancia; evaluar instancia/DB separada solo si el volumen multi-proyecto lo exige. PowerSync soporta Postgres self-hosted (requiere replicación lógica habilitada).

## 1. Estructura del repo (monorepo)

```
/supabase/migrations/     # SQL versionado (fuente de verdad del esquema)
/supabase/seed/           # plantillas_catalogo por industria + datos demo
/etl/                     # Python: migración 413 + parser Excel cubicador
/apps/terreno/            # PWA React offline-first (Vite + TS + PowerSync)
/apps/dashboard/          # Web React online (Vite + TS): cartera multi-proyecto, maestros, importador, revisiones
/packages/shared/         # tipos TS generados desde la BD, validadores zod, utilidades
/docs/                    # arquitectura, decisiones (ADR), manual de importación
```

## 2. Modelo de datos

### 2.1 Núcleo transversal
| Tabla | Campos principales |
|---|---|
| `empresas` | id, nombre, rut, tipo (mandante/contratista) |
| `proyectos` | id, codigo (EIMI00413), nombre, mandante_id, contrato, industria (mineria/refineria/celulosa), fecha_inicio, estado |
| `proyecto_config` | proyecto_id, usa_awp, usa_pwht, clases_con_pwht, usa_pmi, usa_sublineas, usa_test_pack, … |
| `usuarios` | id (= auth.users.id), email, nombre, telefono, telegram_id |
| `membresias` | usuario_id, proyecto_id, rol (ADMIN/OT/QAQC/LOGISTICA/SUPERVISOR), activo |
| `permisos_rol` | proyecto_id, rol, tabla, puede_agregar/actualizar/eliminar (migrar las 211 reglas v1 como plantilla) |
| `plantillas_catalogo` | industria, dominio, tabla, payload JSONB, version |
| `evidencias` | id, proyecto_id, entidad, registro_id, tipo (FOTO/PDF_ISO/PDF_PID/FOTO_EVIDENCIA/…), storage_path, hash, usuario, timestamp |

### 2.2 Dominios operativos (todos con `proyecto_id`; unicidad `UNIQUE(proyecto_id, id_negocio)`)
Replicar las entidades v1 (nombres v1 entre paréntesis como referencia de columnas):

- **cat_**: fluido_servicio, clase_piping, diametros_nps, aislacion_ext, revestimiento_int, esquema_pintura, porcentaje_nde, tipo_prueba, tipo_soporte, tipo_union, personal, cwa, cwp, iwp (`CAT_*_MS`).
- **list_**: lineas (`LIST_Lineas_MS_`, 17 cols), isos (`LIST_Isos_MS_`), spools (`LIST_Spools_MS_`), juntas (`LIST_Juntas_MS_`), mto (`LIST_MTO_MS`, 33 cols — agregar `heat_number` opcional), soportes, valvulas, equipos, tie_ins, pid, bim (`LIST_Bim_MS`, GUID Revit ↔ spool/soporte/válvula). Mecánica: mec (`LIST_Mec_MS`), esp_elem.
- **log_**: spool, materiales, guia, pid, iso, sdi (`LOG_*_MS`).
- **reg_**: ejecucion_juntas, junta_adicional, inspeccion_visual, dimensional_spool, pintura_spool, montaje_valvulas, montaje_soportes, esp_elem (`REG_*_MS`).
- **rel_**: pid_lineas, sdi_iso.
- **doc_**: revision_events.

Cadena de FKs: `reg_* → list_juntas → list_spools → list_isos → list_lineas → proyectos`. Catálogos referenciados por FK dentro del mismo proyecto (validar `proyecto_id` coincidente con trigger o FK compuesta).

### 2.3 Importador (staging)
| Tabla | Campos principales |
|---|---|
| `import_perfiles` | id, proyecto_id, tabla_destino, mapeo JSONB (columna_excel → campo), opciones (fila_encabezado, hoja), version |
| `import_lotes` | id, proyecto_id, perfil_id, archivo_storage_path, hash_archivo, estado (cargado/validado/diff_listo/aprobado/aplicado/rechazado), resumen JSONB (n_nuevas/modificadas/ausentes/sin_cambio/errores), usuario, timestamps |
| `import_filas` | id, lote_id, nro_fila, payload JSONB, clave_natural, accion (nueva/modificada/ausente/sin_cambio/error), diff JSONB (campo: {antes, despues}), error_detalle, aprobada bool |

Claves naturales por tabla (declarar en código, no hardcodear en SQL): mto → `item`; lineas → `id_linea`; isos → `id_linea+sheet`; spools → `id_spool`; juntas → `id_spool+numero_junta`; soportes → `id_soporte`; valvulas → `id_valvula`.

## 3. Seguridad
- RLS en TODAS las tablas: `EXISTS (SELECT 1 FROM membresias m WHERE m.usuario_id = auth.uid() AND m.proyecto_id = tabla.proyecto_id AND m.activo)`; escritura además valida `permisos_rol`.
- Storage: bucket `evidencias` con policy por prefijo de proyecto.
- Roles v1 se conservan: ADMIN, OT, QAQC, LOGISTICA, SUPERVISOR.
- Correr advisors de seguridad de Supabase tras cada migración.

---

## FASE 0 — Fundación (esquema + migración 413)

- [x] **F0.1** Inicializar monorepo (pnpm workspaces) + `supabase init` + CI básico (lint, tsc, `supabase db reset` en verde). ✅ 2026-07-13 — Monorepo pnpm, apps/terreno + apps/oficina (Vite+React+TS), packages/shared, etl/requirements.txt, .github/workflows/ci.yml
- [x] **F0.2** Migración SQL núcleo (2.1) con triggers de auditoría y RLS. ✅ 2026-07-13 — 11 tablas en schema `lukeapp` (empresas, proyectos, proyecto_config, usuarios, membresias, permisos_rol, plantillas_catalogo, evidencias, import_perfiles, import_lotes, import_filas), 7 ENUMs, funciones tiene_membresia/tiene_permiso_escritura, trigger auto-creación de perfil. RLS verificada (0 tablas sin RLS).
- [x] **F0.3** Migración SQL dominios piping + mecánica (2.2) con FKs e índices por `proyecto_id`. ✅ 2026-07-13 — 44 tablas en schema `lukeapp`: 14 cat_*, 13 list_* (cadena lineas→isos→spools→juntas), 6 log_*, 8 reg_*, 2 rel_*, 1 doc_*. Total schema: 55 tablas, todas con RLS activa. PGRST_DB_SCHEMAS actualizado (lukeapp expuesto vía Kong).
- [x] **F0.4** Seeds `plantillas_catalogo`: 3 industrias. Partir de los CAT reales del 413 para minería; refinería y celulosa con plantillas base (clases aleadas+PWHT / inox-dúplex+PMI) marcadas `borrador — validar con OT`. No incluir personal ni CWA/CWP (se cargan por proyecto). ✅ 2026-07-13 — Cargados en BD en lukeserver (30 plantillas listas en lukeapp.plantillas_catalogo).
- [x] **F0.4b** **Ingesta documental con IA** (migración 004 + servicio): ✅ 2026-07-13 — Migración 004 aplicada (pgvector, doc_biblioteca, doc_chunks con RLS, RAG search function); columnas origen/fuente/confianza en importación; script etl/procesar_documento.py estructurado con Gemini; frontend interactivo de BibliotecaDocumental + RevisionLoteIA integrado y compilando correctamente.
- [x] **F0.5** ETL migración 413 (`/etl/migrar_413.py`): ✅ 2026-07-13 — Migración exitosa de todos los dominios relacionales y registros del piloto 413 a lukeserver. Integación relacional 100% limpia (0 huérfanos).
- [x] **F0.6** Generar tipos TS desde la BD hacia `/packages/shared`. ✅ 2026-07-13 — Tipos de base de datos Postgres del esquema `lukeapp` autogenerados y codificados en UTF-8 en `/packages/shared/src/types/database.ts`. Typecheck de todo el monorepo en verde.
- [x] **Criterio de salida**: BD con el 413 completo cargado (conteos reales saneados: 109 líneas, 154 ISOs, 340 spools, 1084 juntas, 2783 MTO, 99 registros de terreno); RLS verificada con dos usuarios de prueba de proyectos distintos de forma transaccional exitosa. ✅ 2026-07-13

## ⚡ Reprioritización 2026-07-13 — Ruta crítica: habilitar proyectos nuevos

Andina (413) queda operando con los datos actuales como piloto; CORRECCION_F05 se difiere a la ventana de corte (F1.2). El orden de trabajo pasa a ser:

1. **P1 — Wizard "Nuevo proyecto"** (adelanta F3.1): crear proyecto (código, nombre, mandante, industria) → instancia catálogos desde `plantillas_catalogo` de su industria → aplica `permisos_rol` plantilla → invita usuarios con rol por membresía. Incluye seed de la plantilla de permisos (las ~211 reglas v1 genéricas por rol/tabla). ✅ 2026-07-13 — Migración 005 (`crear_proyecto_wizard` usa `auth.uid()`, GRANT solo authenticated; vista `v_cartera_kpis` security_invoker) aplicada y validada end-to-end en lukeserver (proyecto refinería de prueba: 61 filas de catálogo, config con PMI derivado, membresía ADMIN, 22 permisos plantilla — pendiente ampliar a las ~211 reglas v1). Fix crítico: payloads de `plantillas_catalogo` estaban doble-codificados (strings JSON en vez de objetos); corregido en BD y en `seed_plantilla()`. Backfill de `lukeapp.usuarios` para los 4 usuarios auth existentes + membresía ADMIN 413 y `acceso_global` para cristianluke@gmail.com / cluke@eimontajes.cl.
2. **P2 — Dashboard cartera mínimo** (F1.5 reducido): home con lista/cards de todos los proyectos visibles (RLS + `acceso_global`), estado y KPIs básicos disponibles con los datos que existan; drill-down al detalle. Es la pantalla donde vive el botón "Nuevo proyecto". ✅ 2026-07-13 — `CarteraProyectos.tsx` (cards por industria, KPIs desde `v_cartera_kpis`, drill-down con avance de juntas, botón Nuevo Proyecto → wizard), `Login.tsx` (Supabase Auth), `App.tsx` con gate de sesión y `proyecto_id` siempre desde navegación. Cliente Supabase corregido: esquema `lukeapp` + variables `VITE_`. ⚠️ **Bloqueador pendiente**: PostgREST en lukeserver NO expone el esquema `lukeapp` (PGRST106; expone `public, storage, graphql_public, maquinaria, andina`) — requiere agregar `lukeapp` a `PGRST_DB_SCHEMAS` (docker-compose) o `ALTER ROLE authenticator SET pgrst.db_schemas = '…, lukeapp'; NOTIFY pgrst, 'reload config';` (decisión del operador: instancia compartida con producción).
3. - [x] **P3 — Importador del cubicador** (F1.3): Detección de diferencias transaccional, autogeneración de ID Isométrico, y validación de integridad referencial (Base CAT lista) en frontend y base de datos.
4. **P4 — Ingesta documental IA** (F0.4b, ya construida): conectarla al flujo del proyecto nuevo (subir adenda/especificaciones al crearlo).

Criterio de éxito de la reprioritización: crear un proyecto demo de otra industria (refinería o celulosa), cargarle un line list/MTO vía importador y verlo junto a Andina en la cartera — todo en el mismo día.

## FASE 1 — Coexistencia + Importador del cubicador

- [ ] **F1.1** Vistas `bi_*` para Power BI (avance por spool/junta, curvas por proyecto, consolidado cartera). Usuario de solo-lectura para el conector.
- [ ] **F1.2** Puente AppSheet (solo 413, provisional): job programado que sincroniza Excel v1 → Postgres (mismo parser del ETL) hasta que el terreno migre a la PWA. Documentar ventana de corte.
- [x] **F1.3** **Módulo M3 — Importador Excel del cubicador** (en `/apps/dashboard`), el corazón de esta fase:
  - Wizard: subir archivo → elegir/crear `import_perfil` (mapeo visual columna→campo con autodetección por nombre de encabezado) → validación (tipos, catálogos existentes, claves) → staging.
  - **Motor de diff**: comparar staging vs tabla destino por clave natural → clasificar nueva/modificada/ausente/sin_cambio; diff campo a campo visible en UI (antes/después resaltado).
  - Pantalla de revisión: filtrar por acción, aprobar todo/por fila; filas `ausente` requieren aprobación explícita y quedan marcadas, nunca borradas; si tienen avance en `reg_*` → conflicto bloqueante con detalle.
  - Aplicación transaccional del lote aprobado + registro en `import_lotes.resumen`.
  - Re-importación: el cubicador edita su mismo Excel y lo vuelve a subir; el sistema reconoce el perfil por estructura y muestra solo lo que cambió.
  - Probar con los Excel reales del 413 (MTO 3.092 filas y juntas 1.688 como casos de estrés).
- [ ] **F1.4** Pantallas oficina técnica mínimas: maestros LIST (lectura + edición puntual), gestión de revisiones ISO/PID (flujo `log_iso`/`doc_revision_events` v1).
- [ ] **F1.5** **Dashboard v4 multi-proyecto** (`apps/dashboard`, nuevo desde cero): la vista inicial es la **cartera completa** — todos los proyectos visibles para el usuario (todos si tiene `acceso_global`/GERENCIA) con KPIs comparables: avance físico juntas/spools, curva S, alertas QA/QC, materiales críticos. Drill-down a proyecto → módulos de detalle (avance por ISO/spool/junta, calidad, materiales). Ninguna pantalla asume proyecto único: `proyecto_id` siempre viene del contexto de navegación. KPIs en vistas/funciones SQL compartidas con `bi_*`, no en frontend. Referencia funcional (no copiar código): `andina-dashboard`.
- ✅ **Criterio de salida**: el cubicador carga su MTO real, lo edita, lo re-sube y ve el diff correcto en <1 min; dashboard mostrando la cartera completa con el 413 + un proyecto demo de otra industria; Power BI consolidado sin exports manuales.

## FASE 2 — PWA terreno offline

- [ ] **F2.1** Setup PowerSync: instancia conectada a Supabase; sync rules: por usuario → proyecto activo (membresía) → catálogos del proyecto + maestros necesarios + sus registros. Nunca cartera completa.
- [ ] **F2.2** PWA base (`/apps/terreno`): Vite + React + TS + PowerSync Web SDK (SQLite WASM/OPFS), instalable (manifest + service worker), login Supabase Auth con sesión persistente offline.
- [ ] **F2.3** Módulos de registro (todos escriben a SQLite local, cero dependencia de red):
  - Ejecución de juntas (espejo de `REG_EjecucionJuntas_MS`: soldador/estampa, proceso, fecha, estado) + junta adicional.
  - Inspección visual QAQC (estado, defecto, próxima etapa, tipo NDE).
  - Dimensional, pintura, montaje de válvulas/soportes, levantamiento de spool (LOG).
  - Cámara: captura + compresión cliente (~1600px) + cola de subida a Storage con reintento; el registro nunca espera la foto.
  - Escaneo QR de spools/lotes en la PWA, offline contra SQLite local (referencia funcional: `escanear.html` de andina-dashboard; no copiar código).
- [ ] **F2.4** Etapas de workflow condicionales por `proyecto_config` (PWHT, PMI, hot-work): visibles solo si el flag del proyecto está activo.
- [ ] **F2.5** Piloto en el 413 en paralelo con AppSheet (una cuadrilla); checklist de validación: 8h sin señal, sync sin pérdida, conflictos resueltos.
- ✅ **Criterio de salida**: registro completo de una jornada en modo avión; al reconectar, todo sincroniza y aparece en Power BI.

## FASE 3 — Módulos avanzados (reimplementados en v4) + proyecto nuevo

- [ ] **F3.1** Wizard "Nuevo proyecto": código, mandante, industria → clona `plantillas_catalogo` + `permisos_rol` plantilla → invita usuarios con roles. Objetivo: proyecto operativo en <1 día.
- [ ] **F3.2** Bot WhatsApp v4 (nuevo, referencia funcional: `lib/bot.js` de andina-dashboard): reporte conversacional de avance por chat/audio, multi-proyecto (usuario→membresía→proyecto activo), escribe en `log_*`/`reg_*` vía API con Supabase Auth; auditoría propia. **RAG sobre `doc_chunks`** (F0.4b): el bot responde consultas técnicas citando adendas, especificaciones y estándares del proyecto activo.
- [ ] **F3.3** Visor BIM v4 (nuevo, referencia funcional: módulo BIM de andina-dashboard): vinculación elemento 3D ↔ spool (`list_bim`), colores por estado, por proyecto.
- [ ] **F3.4** Onboarding del primer contrato nuevo real; retiro programado de AppSheet (v1 queda en solo-lectura como archivo histórico).
- ✅ **Criterio de salida**: contrato nuevo operando sin tocar Excel salvo el flujo del cubicador (que es por diseño).

## Backlog (no iniciar sin pedido explícito)
Disciplinas Estructuras y E&I (el patrón de módulos ya lo permite), integración ERP, firma digital de protocolos, dossier QA/QC autogenerado por test pack, herramientas dinámicas del bot (`bot_tools_dinamicas`) sobre el esquema v4, guías de despacho (`guia.html`) integradas a `log_guia`.

## Anti-patrones a NO repetir de los sistemas de referencia
- Claves compartidas / tokens HMAC caseros / lectura pública por defecto → en v4 todo pasa por Supabase Auth + RLS.
- Buckets públicos para evidencias → buckets privados con policies por proyecto.
- `service_role` key jamás en frontend; solo backend/.env.
- Pantallas o servicios que asumen un proyecto único hardcodeado.

## Decisiones ya tomadas (no reabrir)
Supabase + PowerSync + PWA React · catálogos por proyecto con plantillas por industria · el cubicador mantiene Excel (importador con diff, no digitación) · AppSheet solo transición · español de Chile en UI, snake_case sin acentos en BD.

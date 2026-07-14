# LukeAPP v4 — Reglas para agentes de desarrollo

## Qué es este proyecto
Plataforma multi-proyecto de trazabilidad de montaje industrial (piping y mecánica): ingeniería → prefabricación → QA/QC → logística → montaje. **Desarrollo greenfield**: se construye todo desde cero en este repo. Los sistemas anteriores NO se integran ni se migra su código — son únicamente **referencia funcional** de lo que la plataforma debe lograr:

- **v1 AppSheet + Excel** (carpeta OneDrive `EIMI00413 - Andina - ...`): define el modelo de entidades probado en terreno (CAT/LIST/LOG/REG/REL/DOC), los roles y los flujos. Es además la fuente de datos del proyecto piloto.
- **`Crisvalpo/andina-dashboard`** (GitHub): define capacidades esperadas — dashboard de avance, visor BIM 3D vinculado a spools, bot WhatsApp de reporte, escaneo QR, guías de despacho. Se reimplementan en v4 cuando el roadmap lo indique; no se copia código.

Documentos: `LukeAPP v4 - Arquitectura Multi-Proyecto.docx` (decisiones) · `INSTRUCCIONES_DESARROLLO.md` (roadmap con fases y criterios).

## Stack (fijo, no proponer alternativas)
- **Datos**: Supabase (PostgreSQL + Auth + Storage + RLS). Migraciones SQL versionadas en `supabase/migrations/`. Despliegue objetivo: instancia self-hosted en `lukeserver` (Docker), esquema dedicado; desarrollo con `supabase start` local.
- **Sincronización offline**: PowerSync (SQLite local en cliente, sync rules por proyecto/rol). Requiere replicación lógica en Postgres.
- **Frontend**: monorepo React + TypeScript + Vite + Tailwind CSS. `apps/dashboard` (web online, multi-proyecto), `apps/terreno` (PWA offline-first con PowerSync Web SDK).
- **Analítica externa**: Power BI directo a Postgres (solo vistas `bi_*`).
- **ETL**: Python (openpyxl/pandas) para la carga del piloto 413 y el parser del cubicador.

## Reglas de Interfaz y Estilos (UI)
1. **Tailwind CSS obligatorio**: Todo el estilo debe manejarse con clases utilitarias de Tailwind. Cero estilos en línea (`style={{}}`) y cero archivos `.css` personalizados.
2. **Estética Industrial Seria**: Plataforma corporativa para construcción/montaje. No uses efectos de brillo desmesurado, estrellitas, glassmorphism excesivo ni diseños lúdicos. Interfaz sobria, de alto contraste y altamente funcional orientada al dato.
3. **Componentes Base**: Centraliza átomos UI (Botones, Inputs, Cards) en `src/components/ui/` construidos con Tailwind para mantener consistencia.

## Reglas de datos (inviolables)
1. **Toda tabla operativa lleva `proyecto_id`** (FK a `proyectos`). IDs de negocio (`id_linea`, `id_iso`, `id_spool`, `id_junta`, …) únicos **por proyecto**: `UNIQUE (proyecto_id, id_negocio)`. Nunca únicos globales.
2. Dominios v1 como prefijo de tabla: `cat_` (catálogos, por proyecto), `list_` (maestros), `log_` (movimientos), `reg_` (registros de terreno), `rel_` (N:M), `doc_` (documental). Núcleo sin prefijo: `empresas`, `proyectos`, `proyecto_config`, `usuarios`, `membresias`, `permisos_rol`, `plantillas_catalogo`, `evidencias`.
3. snake_case, español sin acentos (`id_tipo_union`, `estampa_ejecutor`). UI en español de Chile.
4. **RLS obligatoria en todas las tablas**: acceso solo a proyectos con membresía activa; escritura según `permisos_rol`. Excepción única: usuarios con `acceso_global = true` (rol GERENCIA) tienen **lectura** de toda la cartera — nunca escritura global.
5. **Autenticación solo con Supabase Auth.** Prohibido almacenar contraseñas propias, claves compartidas o tokens caseros.
6. Evidencias (fotos/PDF) en Supabase Storage, bucket **privado** con policies por proyecto, ruta `{proyecto}/{dominio}/{entidad}/{archivo}`; metadatos en tabla `evidencias`. Nunca binarios en la BD.
7. Auditoría en toda tabla: `creado_por/creado_en/actualizado_por/actualizado_en` (triggers).
8. Diferencias entre industrias (minería/refinería/celulosa) por **configuración** (`proyecto_config`, `plantillas_catalogo`, etapas activables), nunca columnas o tablas específicas de un mandante.

## Reglas del dashboard (multi-proyecto por diseño)
- La vista inicial es **la cartera completa**: todos los proyectos visibles para el usuario (todos, si es GERENCIA), con KPIs comparables (avance físico juntas/spools, curva S, alertas QA/QC, materiales críticos).
- Desde la cartera se hace drill-down a un proyecto; **ninguna pantalla asume un proyecto único** — el `proyecto_id` siempre viene del contexto de navegación, jamás hardcodeado.
- KPIs y agregaciones se calculan en vistas/funciones SQL (compartidas con `bi_*`), no en el frontend.

## Reglas de importación Excel (cubicador)
El cubicador seguirá trabajando en Excel: la plataforma **nunca le exige cambiar de herramienta**. Sus entregables (MTO, line list, isométricos, spools, juntas, soportes, válvulas) entran por el Importador:
- Toda carga pasa por staging (`import_lotes` + `import_filas` con payload JSONB); jamás escribir directo del Excel a las tablas `list_*`.
- Cada tabla importable tiene **clave natural declarada** (ej. MTO: `proyecto_id + item`; junta: `proyecto_id + id_spool + numero_junta`) para calcular diffs en re-importaciones: filas nuevas / modificadas (diff campo a campo) / ausentes / sin cambio.
- Las filas ausentes **nunca se borran automáticamente**: se marcan `ausente_en_ultima_revision` y requieren aprobación de OT. Si tienen avance de terreno (`reg_*`), se bloquean y alertan como conflicto.
- Mapeos columna-Excel → campo-BD configurables por proyecto (`import_perfiles`). El archivo original se conserva en Storage con hash.
- Aplicar un lote es transaccional: entra todo el diff aprobado, o nada.

## Reglas de ingesta documental con IA
Los entregables del cliente (adendas, especificaciones técnicas, estándares, CWP, line lists en PDF) se cargan a una **biblioteca documental por proyecto** y se procesan con IA para dos fines: extracción asistida de datos y base de conocimiento para el bot (F3.2).
- Documento original siempre a Storage (bucket privado) + registro en `doc_biblioteca`; texto extraído se trocea a `doc_chunks` con embeddings (pgvector) para RAG futuro.
- **La extracción IA nunca escribe directo en `cat_*`/`list_*`/`proyecto_config`**: genera un `import_lote` con `origen = 'extraccion_ia'` y confianza por campo, que pasa por el mismo flujo de diff + aprobación humana del importador. La IA propone, OT aprueba.
- Registrar siempre trazabilidad: de qué documento y página salió cada dato extraído (`import_filas.fuente`).
- LLM: Gemini (API ya usada por el equipo); nunca enviar documentos a servicios no aprobados.

## Reglas offline (PWA terreno)
- Toda escritura de terreno va a SQLite local (PowerSync) y se encola; la app jamás requiere red para registrar. Sin spinners bloqueantes por conectividad.
- Fotos: compresión en cliente (~1600px), cola local, subida a Storage al reconectar; el registro nunca espera la foto.
- Sync rules: cada dispositivo descarga solo su proyecto activo + catálogos de ese proyecto. Nunca la cartera completa.

## Definition of done (cada tarea)
- `supabase db reset` pasa limpio; RLS verificada con advisors de Supabase.
- `tsc --noEmit` sin errores, lint limpio, tests de la tarea pasando.
- Sin secretos hardcodeados (`.env` + `.env.example` actualizado).
- Marcar la tarea en `INSTRUCCIONES_DESARROLLO.md`.

## Fuera de alcance (no implementar sin pedido explícito)
Disciplinas Estructuras y E&I (solo dejar el patrón preparado), integración ERP, CRDT/edición colaborativa, apps nativas iOS/Android (la PWA es el objetivo).

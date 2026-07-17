# P8 — Referencias entre documentos + estado de catálogos del proyecto

**Para:** agente Antigravity · **Alcance:** `apps/ia-worker` (prompt IA), `supabase/migrations` (tabla + RPC), `apps/dashboard` (panel). Construye sobre el motor de ingesta IA existente; **no** lo reemplaza.

## Problema que resuelve

Un documento puede **no contener** el dato de un catálogo pero **referenciar** otro documento donde sí está (ej.: la especificación dice *"esquema de pintura según Procedimiento PROC-PINT-XXX"*). Hoy eso queda como un hueco silencioso: el catálogo Esquemas de Pintura queda vacío y el usuario no sabe que el dato vive en otro documento aún no cargado.

Dos aclaraciones de diseño que ya son verdad y hay que preservar:
- **La ingesta es aditiva y por documento.** Cada documento propone solo los catálogos que contiene, y al aplicar hace diff contra lo existente (`nueva`/`modificada`/`sin_cambio`). **Nunca** re-pregunta por los 14. Cargar el documento referenciado después solo propone su catálogo y lo fusiona. No romper esto.
- La app ya tiene la RPC `lukeapp.obtener_estado_catalogos(proyecto_id)` (migración 024) usada por el chequeo "base CAT lista". P8 la extiende.

## Parte A — La IA extrae las referencias a otros documentos

En `apps/ia-worker/src/gemini.js`, extender `SCHEMA_CATALOGO`/`PROMPT_CATALOGO` para que, además de los catálogos, Gemini devuelva un arreglo `referencias_externas`: documentos que el archivo menciona como fuente de datos técnicos/catálogo que **no están en este archivo**. Por cada referencia:

- `codigo_documento` — el código/identificador citado (ej. `PROC-PINT-XXX`, `ET-SOLD-001`).
- `titulo` — descripción textual (ej. "Procedimiento de Pintura").
- `catalogo_sugerido` — cuál de los 14 catálogos probablemente define, si es inferible (ej. `cat_esquema_pintura`); null si no aplica.
- `pagina` y `cita` — igual que las propuestas de catálogo (trazabilidad).

Instruir al modelo: capturar solo referencias a documentos que plausiblemente contienen datos de catálogo/especificación (procedimientos, especificaciones, estándares citados como fuente), no toda mención bibliográfica.

## Parte B — Migración `20260717_028_referencias_documentos.sql`

Tabla nueva:

```sql
CREATE TABLE lukeapp.documento_referencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id       UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  documento_id      UUID NOT NULL,            -- documento que origina la referencia
  codigo_documento  TEXT NOT NULL,            -- documento referenciado
  titulo            TEXT,
  catalogo_sugerido TEXT,                     -- ej 'cat_esquema_pintura', nullable
  pagina            INT,
  cita              TEXT,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','resuelta','descartada')),
  resuelta_por_doc  UUID,                     -- documento cargado que la satisface
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, documento_id, codigo_documento)
);
ALTER TABLE lukeapp.documento_referencias ENABLE ROW LEVEL SECURITY;
-- RLS SELECT: lukeapp.tiene_acceso_lectura(proyecto_id); escritura: tiene_membresia.
CREATE INDEX idx_doc_ref_proyecto ON lukeapp.documento_referencias(proyecto_id, estado);
```

- Al procesar un documento, el worker inserta sus `referencias_externas` aquí (`estado='pendiente'`).
- **Auto-resolución simple:** cuando se sube/procesa un documento cuyo `codigo` coincide con el `codigo_documento` de una referencia pendiente del proyecto, marcarla `resuelta` + `resuelta_por_doc`. (Coincidencia por código normalizado; si no hay match automático, queda pendiente y el usuario puede descartarla manualmente.)

RPC nueva o extensión de `obtener_estado_catalogos`:

- `estado_catalogos_proyecto(p_proyecto_id UUID)` → por cada uno de los 14 `cat_*`: `{ tabla, n_filas, referencias_pendientes: [{codigo_documento, titulo, pagina}] }`. Combina el conteo de filas con las referencias pendientes cuyo `catalogo_sugerido` apunta a esa tabla. `SECURITY DEFINER`, `TO authenticated`, validando lectura del proyecto.

## Parte C — Panel "Estado de catálogos" (frontend)

En la vista **"2. Catálogos"** (y/o como resumen en la Ingesta Documental), mostrar los 14 catálogos con su estado, alimentado por `estado_catalogos_proyecto`:

- **Poblado** (N filas) — verde.
- **Vacío** — gris, sin observaciones.
- **Referenciado, pendiente de cargar** — ámbar, con el detalle: *"Definido en documento referenciado: PROC-PINT-XXX (Procedimiento de Pintura) — súbelo para completar este catálogo"*. Enlazar/undestacar el botón de subir documento.

Además, una sección **"Documentos referenciados pendientes"** (lista de `documento_referencias` con `estado='pendiente'`): código, título, de qué documento salió, y qué catálogo completaría. Se van marcando como resueltas al cargar el documento correspondiente. Permitir "descartar" una referencia que no aplique.

## Definition of Done

- [ ] La IA devuelve `referencias_externas` con código, título, catálogo sugerido, página y cita; se guardan en `documento_referencias`.
- [ ] Subir un documento cuyo código coincide con una referencia pendiente la marca `resuelta` automáticamente.
- [ ] El panel de catálogos muestra los 3 estados (poblado / vacío / referenciado-pendiente) con el detalle del documento que falta.
- [ ] Se preserva la acumulación aditiva: cargar el documento referenciado solo propone su catálogo y hace diff; no re-pregunta por los otros 13.
- [ ] RLS: las referencias solo son visibles/editables por miembros del proyecto (o acceso_global).

## Prueba sugerida

Con un proyecto nuevo: subir una especificación que mencione un procedimiento externo (p. ej. de pintura). Verificar que (1) aparece la referencia pendiente y el catálogo Esquemas de Pintura se marca "referenciado, pendiente", (2) al subir luego ese procedimiento, propone solo Esquemas de Pintura, la referencia pasa a "resuelta" y el resto de catálogos queda intacto.

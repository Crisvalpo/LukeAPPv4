-- ============================================================
-- LukeAPP v4 — Migración 004: Ingesta documental con IA
-- Schema: lukeapp
-- Depende de: 001_nucleo, 002_dominios, 003_gerencia
-- Rev. B — Julio 2026
--
-- Cambios:
-- 1. Habilitar extensión pgvector
-- 2. Tabla doc_biblioteca: biblioteca documental por proyecto
-- 3. Tabla doc_chunks: trozos de texto + embeddings para RAG
-- 4. Extender import_lotes: columna origen
-- 5. Extender import_filas: columnas fuente + confianza
-- 6. RLS completa con tiene_acceso_lectura()
-- ============================================================

-- ─── 1. Extensión pgvector ────────────────────────────────────
-- Necesaria para almacenar embeddings de doc_chunks
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 2. ENUM tipo_documento ──────────────────────────────────
CREATE TYPE lukeapp.tipo_documento AS ENUM (
  'adenda',
  'especificacion_tecnica',
  'estandar',
  'cwp',
  'line_list',
  'pid',
  'plano',
  'procedimiento',
  'otro'
);

-- ─── 3. ENUM estado_procesamiento_doc ────────────────────────
CREATE TYPE lukeapp.estado_procesamiento_doc AS ENUM (
  'pendiente',       -- recién subido, sin procesar
  'procesando',      -- OCR / chunking en curso
  'procesado',       -- chunks + embeddings listos
  'extrayendo',      -- Gemini extrayendo datos estructurados
  'lote_generado',   -- import_lote creado, pendiente aprobación OT
  'completado',      -- lote aprobado y aplicado
  'error'            -- fallo en cualquier etapa
);

-- ─── 4. doc_biblioteca ────────────────────────────────────────
-- Biblioteca documental por proyecto
-- Un documento puede pertenecer a uno o más proyectos (FK a proyecto)
-- El PDF original siempre va a Storage (bucket privado)
CREATE TABLE lukeapp.doc_biblioteca (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id           UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,

  -- Clasificación
  tipo_documento        lukeapp.tipo_documento NOT NULL,
  titulo                TEXT NOT NULL,
  descripcion           TEXT,
  revision              TEXT,                   -- rev del documento ('0', 'A', 'B', ...)
  fecha_documento       DATE,

  -- Storage
  storage_path          TEXT NOT NULL,          -- {proyecto}/doc/{tipo}/{archivo}
  hash                  TEXT,                   -- sha256 del PDF original
  nombre_original       TEXT,
  tamanio_bytes         BIGINT,
  mime_type             TEXT DEFAULT 'application/pdf',

  -- Estado del pipeline IA
  estado_procesamiento  lukeapp.estado_procesamiento_doc NOT NULL DEFAULT 'pendiente',
  n_paginas             INT,
  n_chunks              INT,
  error_detalle         TEXT,                   -- mensaje de error si estado = 'error'

  -- Metadatos adicionales (extractables por IA o ingresados manualmente)
  metadata              JSONB,                  -- { "norma": "ASME B31.3", "revision_ing": "B", ... }

  -- Trazabilidad del lote IA generado
  lote_ia_id            UUID REFERENCES lukeapp.import_lotes(id),

  -- Auditoría
  creado_por            UUID REFERENCES auth.users(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por       UUID REFERENCES auth.users(id),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_biblioteca_proyecto   ON lukeapp.doc_biblioteca(proyecto_id);
CREATE INDEX idx_doc_biblioteca_tipo       ON lukeapp.doc_biblioteca(tipo_documento);
CREATE INDEX idx_doc_biblioteca_estado     ON lukeapp.doc_biblioteca(estado_procesamiento);

CREATE TRIGGER trg_doc_biblioteca_auditoria
  BEFORE UPDATE ON lukeapp.doc_biblioteca
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();

ALTER TABLE lukeapp.doc_biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_biblioteca_select" ON lukeapp.doc_biblioteca
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

CREATE POLICY "doc_biblioteca_insert" ON lukeapp.doc_biblioteca
  FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));

CREATE POLICY "doc_biblioteca_update" ON lukeapp.doc_biblioteca
  FOR UPDATE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

COMMENT ON TABLE lukeapp.doc_biblioteca IS
  'Biblioteca documental por proyecto: PDFs de adendas, specs, estándares, CWPs, etc. '
  'El PDF original siempre en Storage (nunca binario en BD). '
  'Alimenta doc_chunks (RAG) y genera import_lotes con origen=extraccion_ia.';

-- ─── 5. doc_chunks ────────────────────────────────────────────
-- Trozos de texto extraído + embeddings vectoriales
-- Propósito dual: diff+aprobación de datos estructurados Y base RAG para el bot (F3.2)
CREATE TABLE lukeapp.doc_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id    UUID NOT NULL REFERENCES lukeapp.doc_biblioteca(id) ON DELETE CASCADE,
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),  -- desnormalizado para RLS eficiente

  -- Posición
  nro_chunk       INT NOT NULL,               -- orden del trozo dentro del documento
  pagina_inicio   INT,                         -- página del PDF donde empieza el chunk
  pagina_fin      INT,                         -- página donde termina (puede abarcar varias)

  -- Contenido
  contenido       TEXT NOT NULL,               -- texto del chunk (max ~1000 tokens recomendado)

  -- Embedding (pgvector)
  -- Dimensión 768 = text-embedding-004 de Google (modelo actual del equipo)
  -- Cambiar a 1536 si se migra a text-embedding-3-large de OpenAI
  embedding       vector(768),

  -- Metadatos del chunk
  metadata        JSONB,                       -- { "seccion": "3.2", "titulo_seccion": "Clases de piping" }

  -- Auditoría
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_chunks_documento  ON lukeapp.doc_chunks(documento_id);
CREATE INDEX idx_doc_chunks_proyecto   ON lukeapp.doc_chunks(proyecto_id);
CREATE INDEX idx_doc_chunks_orden      ON lukeapp.doc_chunks(documento_id, nro_chunk);

-- Índice vectorial HNSW para búsqueda semántica eficiente
-- cosine similarity = estándar para embeddings de texto
CREATE INDEX idx_doc_chunks_embedding ON lukeapp.doc_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE lukeapp.doc_chunks ENABLE ROW LEVEL SECURITY;

-- Lectura: membresía activa OR acceso_global (GERENCIA puede auditar cualquier proyecto)
CREATE POLICY "doc_chunks_select" ON lukeapp.doc_chunks
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- Escritura: solo backend con membresía (el pipeline IA usa service_role para insertar chunks)
CREATE POLICY "doc_chunks_insert" ON lukeapp.doc_chunks
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Permitir también inserción desde authenticated para el backend de la app
CREATE POLICY "doc_chunks_insert_auth" ON lukeapp.doc_chunks
  FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));

COMMENT ON TABLE lukeapp.doc_chunks IS
  'Trozos de texto de documentos + embeddings pgvector. '
  'Doble propósito: (1) extracción estructurada con Gemini → import_lote con origen=extraccion_ia, '
  '(2) base RAG para el bot de F3.2 — buscar por similitud semántica sobre especificaciones del proyecto.';

COMMENT ON COLUMN lukeapp.doc_chunks.embedding IS
  'Vector de embedding generado con text-embedding-004 (768 dims). '
  'Búsqueda por similitud coseno via índice HNSW. '
  'Si se cambia el modelo, recrear índice y regenerar todos los embeddings del proyecto.';

-- ─── 6. Función de búsqueda RAG ──────────────────────────────
-- Busca los N chunks más relevantes para una consulta en un proyecto dado
-- Usada por el bot (F3.2) y por la UI de extracción para verificar contexto
CREATE OR REPLACE FUNCTION lukeapp.buscar_chunks_similares(
  p_proyecto_id   UUID,
  p_embedding     vector(768),
  p_limite        INT DEFAULT 5,
  p_umbral        FLOAT DEFAULT 0.7    -- similitud mínima (coseno: 1=idéntico, 0=ortogonal)
)
RETURNS TABLE (
  chunk_id        UUID,
  documento_id    UUID,
  titulo_doc      TEXT,
  nro_chunk       INT,
  pagina_inicio   INT,
  contenido       TEXT,
  similitud       FLOAT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    c.id              AS chunk_id,
    c.documento_id,
    d.titulo          AS titulo_doc,
    c.nro_chunk,
    c.pagina_inicio,
    c.contenido,
    1 - (c.embedding <=> p_embedding) AS similitud
  FROM lukeapp.doc_chunks c
  JOIN lukeapp.doc_biblioteca d ON d.id = c.documento_id
  WHERE c.proyecto_id = p_proyecto_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> p_embedding) >= p_umbral
  ORDER BY c.embedding <=> p_embedding   -- ASC = más similar primero
  LIMIT p_limite;
$$;

COMMENT ON FUNCTION lukeapp.buscar_chunks_similares IS
  'Búsqueda semántica RAG sobre doc_chunks de un proyecto. '
  'Retorna los chunks más similares a un embedding de consulta. '
  'Usada por el bot (F3.2) y por la UI de extracción documental.';

-- ─── 7. Extender import_lotes: columna origen ─────────────────
-- Distinguir entre lotes manuales (Excel del cubicador) y propuestas IA
ALTER TABLE lukeapp.import_lotes
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'manual'
  CHECK (origen IN ('manual', 'extraccion_ia', 'etl_migracion', 'api'));

ALTER TABLE lukeapp.import_lotes
  ADD COLUMN IF NOT EXISTS documento_id UUID REFERENCES lukeapp.doc_biblioteca(id);

COMMENT ON COLUMN lukeapp.import_lotes.origen IS
  'Origen del lote: manual (Excel cubicador), extraccion_ia (Gemini sobre PDF), '
  'etl_migracion (script Python migración 413), api (integración externa).';

COMMENT ON COLUMN lukeapp.import_lotes.documento_id IS
  'Documento fuente si origen=extraccion_ia. FK a doc_biblioteca.';

CREATE INDEX idx_import_lotes_origen     ON lukeapp.import_lotes(origen);
CREATE INDEX idx_import_lotes_documento  ON lukeapp.import_lotes(documento_id);

-- ─── 8. Extender import_filas: fuente + confianza ─────────────
-- fuente: trazabilidad → de qué documento y página salió el dato
-- confianza: 0.0-1.0 → qué tan segura está la IA (visible en UI para que OT priorice revisión)
ALTER TABLE lukeapp.import_filas
  ADD COLUMN IF NOT EXISTS fuente JSONB;
  -- formato: { "documento_id": "uuid", "titulo": "Especificación E-001", "paginas": [3, 4] }

ALTER TABLE lukeapp.import_filas
  ADD COLUMN IF NOT EXISTS confianza NUMERIC
  CHECK (confianza IS NULL OR (confianza >= 0 AND confianza <= 1));

COMMENT ON COLUMN lukeapp.import_filas.fuente IS
  'Trazabilidad del dato extraído por IA: { documento_id, titulo, paginas }. '
  'Obligatorio cuando el lote tiene origen=extraccion_ia.';

COMMENT ON COLUMN lukeapp.import_filas.confianza IS
  'Confianza de la extracción IA: 0.0 (muy incierto) a 1.0 (certeza alta). '
  'La UI puede filtrar por umbral de confianza para priorizar revisión manual. '
  'NULL para lotes con origen=manual.';

-- ─── 9. Índice adicional en import_filas ─────────────────────
CREATE INDEX IF NOT EXISTS idx_import_filas_confianza ON lukeapp.import_filas(confianza)
  WHERE confianza IS NOT NULL;

-- ─── 10. Comentarios finales ──────────────────────────────────
COMMENT ON EXTENSION vector IS
  'pgvector: soporte de vectores para embeddings. Usado por doc_chunks para RAG.';

-- ============================================================
-- LukeAPP v4 — Migración 028: Referencias de Documentos y Estado de Catálogos
-- Schema: lukeapp
-- Depende de: 20260713_004_documental_ia.sql, 20260717_025_cat_enriquecimiento.sql
-- Rev. A — Julio 2026
-- ============================================================

-- 1. Añadir columna codigo a doc_biblioteca para albergar el identificador formal del documento
ALTER TABLE lukeapp.doc_biblioteca 
  ADD COLUMN IF NOT EXISTS codigo TEXT;
COMMENT ON COLUMN lukeapp.doc_biblioteca.codigo IS 'Identificador formal/código del documento (ej: PROC-PINT-XXX)';

-- 2. Crear tabla documento_referencias
CREATE TABLE IF NOT EXISTS lukeapp.documento_referencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id       UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  documento_id      UUID NOT NULL REFERENCES lukeapp.doc_biblioteca(id) ON DELETE CASCADE, -- doc que cita la referencia
  codigo_documento  TEXT NOT NULL,            -- documento referenciado
  titulo            TEXT,
  catalogo_sugerido TEXT,                     -- ej: 'cat_esquema_pintura'
  pagina            INT,
  cita              TEXT,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','resuelta','descartada')),
  resuelta_por_doc  UUID REFERENCES lukeapp.doc_biblioteca(id) ON DELETE SET NULL,     -- doc que la satisface
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, documento_id, codigo_documento)
);

-- RLS
ALTER TABLE lukeapp.documento_referencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_ref ON lukeapp.documento_referencias;
CREATE POLICY select_ref ON lukeapp.documento_referencias
  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

DROP POLICY IF EXISTS write_ref ON lukeapp.documento_referencias;
CREATE POLICY write_ref ON lukeapp.documento_referencias
  FOR ALL TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

-- Índices
CREATE INDEX IF NOT EXISTS idx_doc_ref_proyecto ON lukeapp.documento_referencias(proyecto_id, estado);
CREATE INDEX IF NOT EXISTS idx_doc_ref_sugerido ON lukeapp.documento_referencias(proyecto_id, catalogo_sugerido) WHERE estado = 'pendiente';

-- 3. Trigger de Auto-Resolución al procesar o asociar código a un documento
CREATE OR REPLACE FUNCTION lukeapp.resolver_referencias_documentos()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo <> '' THEN
    UPDATE lukeapp.documento_referencias
    SET estado = 'resuelta',
        resuelta_por_doc = NEW.id
    WHERE proyecto_id = NEW.proyecto_id
      AND estado = 'pendiente'
      -- Comparación robusta por código normalizado (sin espacios, guiones ni guiones bajos)
      AND regexp_replace(upper(trim(codigo_documento)), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(trim(NEW.codigo)), '[^A-Z0-9]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resolver_referencias ON lukeapp.doc_biblioteca;
CREATE TRIGGER trg_resolver_referencias
AFTER INSERT OR UPDATE OF codigo, estado_procesamiento ON lukeapp.doc_biblioteca
FOR EACH ROW
WHEN (NEW.estado_procesamiento IN ('procesado', 'lote_generado', 'completado') AND NEW.codigo IS NOT NULL)
EXECUTE FUNCTION lukeapp.resolver_referencias_documentos();

-- 4. Trigger de Reversión al eliminar un documento resolutor
CREATE OR REPLACE FUNCTION lukeapp.revertir_referencias_documentos()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE lukeapp.documento_referencias
  SET estado = 'pendiente',
      resuelta_por_doc = NULL
  WHERE resuelta_por_doc = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revertir_referencias ON lukeapp.doc_biblioteca;
CREATE TRIGGER trg_revertir_referencias
BEFORE DELETE ON lukeapp.doc_biblioteca
FOR EACH ROW
EXECUTE FUNCTION lukeapp.revertir_referencias_documentos();

-- 5. RPC estado_catalogos_proyecto para reporte visual en frontend
CREATE OR REPLACE FUNCTION lukeapp.estado_catalogos_proyecto(p_proyecto_id UUID)
RETURNS TABLE (
  tabla                  TEXT,
  n_filas                INT,
  referencias_pendientes JSONB
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_tiene_acceso BOOLEAN;
BEGIN
  -- Validar acceso de lectura al proyecto
  SELECT lukeapp.tiene_acceso_lectura(p_proyecto_id) INTO v_tiene_acceso;
  IF NOT COALESCE(v_tiene_acceso, false) THEN
    RAISE EXCEPTION 'No tienes acceso de lectura a este proyecto';
  END IF;

  RETURN QUERY
  WITH counts AS (
    SELECT 'cat_fluido_servicio'::text AS t_name, count(*)::int AS cnt FROM lukeapp.cat_fluido_servicio WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_clase_piping'::text, count(*)::int FROM lukeapp.cat_clase_piping WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_diametros_nps'::text, count(*)::int FROM lukeapp.cat_diametros_nps WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_esquema_pintura'::text, count(*)::int FROM lukeapp.cat_esquema_pintura WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_aislacion_ext'::text, count(*)::int FROM lukeapp.cat_aislacion_ext WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_porcentaje_nde'::text, count(*)::int FROM lukeapp.cat_porcentaje_nde WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_tipo_prueba'::text, count(*)::int FROM lukeapp.cat_tipo_prueba WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_tipo_union'::text, count(*)::int FROM lukeapp.cat_tipo_union WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_revestimiento_int'::text, count(*)::int FROM lukeapp.cat_revestimiento_int WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_tipo_soporte'::text, count(*)::int FROM lukeapp.cat_tipo_soporte WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_personal'::text, count(*)::int FROM lukeapp.cat_personal WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_cwa'::text, count(*)::int FROM lukeapp.cat_cwa WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_cwp'::text, count(*)::int FROM lukeapp.cat_cwp WHERE proyecto_id = p_proyecto_id AND activo
    UNION ALL
    SELECT 'cat_iwp'::text, count(*)::int FROM lukeapp.cat_iwp WHERE proyecto_id = p_proyecto_id AND activo
  ),
  refs AS (
    SELECT 
      catalogo_sugerido AS t_name,
      jsonb_agg(jsonb_build_object(
        'id', r.id,
        'codigo_documento', r.codigo_documento,
        'titulo', r.titulo,
        'pagina', r.pagina,
        'cita', r.cita,
        'documento_origen_id', r.documento_id,
        'documento_origen_titulo', (SELECT d.titulo FROM lukeapp.doc_biblioteca d WHERE d.id = r.documento_id)
      )) AS ref_list
    FROM lukeapp.documento_referencias r
    WHERE r.proyecto_id = p_proyecto_id AND r.estado = 'pendiente' AND r.catalogo_sugerido IS NOT NULL
    GROUP BY r.catalogo_sugerido
  )
  SELECT 
    c.t_name AS tabla,
    c.cnt AS n_filas,
    COALESCE(r.ref_list, '[]'::jsonb) AS referencias_pendientes
  FROM counts c
  LEFT JOIN refs r ON r.t_name = c.t_name;
END;
$$;

GRANT EXECUTE ON FUNCTION lukeapp.estado_catalogos_proyecto(UUID) TO authenticated, service_role;

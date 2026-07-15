-- ============================================================
-- LukeAPP v4 — Migración 017: Ajustes para Carga de Datos y Versionamiento
-- Schema: lukeapp
-- Depende de: 001_nucleo, 002_dominios, 004_documental_ia
-- Rev. B — Julio 2026
-- ============================================================

-- ─── 1. pdf_path en log_pid ─────────────────────────────────
ALTER TABLE lukeapp.log_pid ADD COLUMN IF NOT EXISTS pdf_path TEXT;
COMMENT ON COLUMN lukeapp.log_pid.pdf_path IS 'Referencia al archivo PDF de la revisión histórica en Storage';

-- ─── 2. Normalización de tags en list_lineas ────────────────
-- Función de normalización de tags de línea
CREATE OR REPLACE FUNCTION lukeapp.normalizar_tag_linea(p_tag TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_tag IS NULL THEN
    RETURN NULL;
  END IF;
  -- Remover espacios, comillas dobles, comillas simples, guiones y pasar a minúsculas
  RETURN LOWER(REGEXP_REPLACE(p_tag, '[[:space:]''"\-]', '', 'g'));
END;
$$;

-- Columna de nombre normalizado
ALTER TABLE lukeapp.list_lineas ADD COLUMN IF NOT EXISTS nombre_normalizado TEXT;
COMMENT ON COLUMN lukeapp.list_lineas.nombre_normalizado IS 'Tag de línea normalizado (sin espacios, comillas ni guiones) para validación cruzada';

-- Trigger para automatizar el cálculo de nombre_normalizado
CREATE OR REPLACE FUNCTION lukeapp.tg_list_lineas_normalizar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nombre_normalizado := lukeapp.normalizar_tag_linea(NEW.id_linea);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_list_lineas_normalizar
BEFORE INSERT OR UPDATE OF id_linea ON lukeapp.list_lineas
FOR EACH ROW EXECUTE FUNCTION lukeapp.tg_list_lineas_normalizar();

-- Backfill para los registros existentes
UPDATE lukeapp.list_lineas SET actualizado_en = now() WHERE nombre_normalizado IS NULL;

-- ─── 3. Anotaciones JSONB en documentos vigentes ────────────
ALTER TABLE lukeapp.list_pid ADD COLUMN IF NOT EXISTS anotaciones JSONB;
COMMENT ON COLUMN lukeapp.list_pid.anotaciones IS 'Trazos destacados virtuales dibujados sobre el visor del PDF (Green, Orange, Pink)';

ALTER TABLE lukeapp.list_isos ADD COLUMN IF NOT EXISTS anotaciones JSONB;
COMMENT ON COLUMN lukeapp.list_isos.anotaciones IS 'Trazos destacados virtuales dibujados sobre el visor del PDF del isométrico';

ALTER TABLE lukeapp.doc_biblioteca ADD COLUMN IF NOT EXISTS anotaciones JSONB;
COMMENT ON COLUMN lukeapp.doc_biblioteca.anotaciones IS 'Trazos destacados virtuales sobre las especificaciones técnicas o documentos cargados';

-- ─── 4. Tabla de configuración de integraciones ──────────────
CREATE TABLE IF NOT EXISTS lukeapp.proyecto_integraciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  proveedor       TEXT NOT NULL CHECK (proveedor IN ('sharepoint_onedrive')),
  config          JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "tenant_id": "...", "client_id": "...", "folder_path_excel": "...", "folder_path_pdfs": "..." }
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, proveedor)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_integraciones_proyecto ON lukeapp.proyecto_integraciones(proyecto_id);

CREATE OR REPLACE TRIGGER trg_proyecto_integraciones_auditoria
  BEFORE UPDATE ON lukeapp.proyecto_integraciones
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();

ALTER TABLE lukeapp.proyecto_integraciones ENABLE ROW LEVEL SECURITY;

-- RLS: Lectura para quienes tienen membresía o acceso_global
CREATE POLICY "proyecto_integraciones_select" ON lukeapp.proyecto_integraciones
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- RLS: Escritura solo para ADMIN del proyecto
CREATE POLICY "proyecto_integraciones_write" ON lukeapp.proyecto_integraciones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.membresias m
      WHERE m.usuario_id = auth.uid()
        AND m.proyecto_id = proyecto_integraciones.proyecto_id
        AND m.rol = 'ADMIN'
        AND m.activo = true
    )
  );

COMMENT ON TABLE lukeapp.proyecto_integraciones IS 'Configuración de credenciales y rutas para la sincronización con SharePoint/OneDrive';

-- ─── 5. Redefinir crear_proyecto_wizard para inicialización limpia ───
CREATE OR REPLACE FUNCTION lukeapp.crear_proyecto_wizard(
  p_codigo          TEXT,
  p_nombre          TEXT,
  p_mandante_id     UUID,
  p_industria       lukeapp.industria_tipo,
  p_creador_id      UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_creador     UUID;
  v_proyecto_id UUID;
  v_plantilla   RECORD;
  v_item        JSONB;
BEGIN
  -- El creador es siempre el usuario autenticado
  v_creador := COALESCE(auth.uid(), p_creador_id);
  IF v_creador IS NULL THEN
    RAISE EXCEPTION 'crear_proyecto_wizard requiere un usuario autenticado';
  END IF;

  -- Solo GERENCIA (acceso_global) puede crear proyectos nuevos
  IF NOT EXISTS (
    SELECT 1 FROM lukeapp.usuarios u
    WHERE u.id = v_creador AND u.acceso_global = true
  ) THEN
    RAISE EXCEPTION 'Solo usuarios GERENCIA pueden crear proyectos nuevos';
  END IF;

  -- 1. Crear el proyecto
  INSERT INTO lukeapp.proyectos (codigo, nombre, mandante_id, industria, estado, creado_por)
  VALUES (upper(trim(p_codigo)), trim(p_nombre), p_mandante_id, p_industria, 'activo', v_creador)
  RETURNING id INTO v_proyecto_id;

  -- 2. Instanciar catálogos (Exclusivamente cat_diametros_nps por filosofía de inicio limpio)
  FOR v_plantilla IN
    SELECT tabla, payload FROM lukeapp.plantillas_catalogo
    WHERE industria = p_industria AND tabla = 'cat_diametros_nps' AND activo = true
  LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_plantilla.payload)
    LOOP
      INSERT INTO lukeapp.cat_diametros_nps (proyecto_id, nps, nps_mm, creado_por)
      VALUES (v_proyecto_id, v_item->>'nps', (v_item->>'nps_mm')::numeric, v_creador)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 3. Configuración inicial vacía por defecto (se activa asistidamente después)
  INSERT INTO lukeapp.proyecto_config (proyecto_id, usa_pwht, clases_con_pwht, usa_pmi, creado_por)
  VALUES (v_proyecto_id, false, '{}', false, v_creador);

  -- 4. Membresía del creador como ADMIN
  INSERT INTO lukeapp.membresias (usuario_id, proyecto_id, rol, activo, creado_por)
  VALUES (v_creador, v_proyecto_id, 'ADMIN', true, v_creador);

  -- 5. Permisos de rol plantilla
  INSERT INTO lukeapp.permisos_rol (proyecto_id, rol, tabla, puede_agregar, puede_actualizar, puede_eliminar, creado_por)
  VALUES
    (v_proyecto_id, 'ADMIN', 'list_lineas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_isos', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_spools', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_juntas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_mto', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_soportes', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_valvulas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'reg_ejecucion_juntas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'reg_inspeccion_visual', true, true, true, v_creador),
    (v_proyecto_id, 'OT', 'list_lineas', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_isos', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_spools', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_juntas', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_mto', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_soportes', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_valvulas', true, true, false, v_creador),
    (v_proyecto_id, 'QAQC', 'reg_inspeccion_visual', true, true, false, v_creador),
    (v_proyecto_id, 'QAQC', 'reg_dimensional_spool', true, true, false, v_creador),
    (v_proyecto_id, 'QAQC', 'reg_pintura_spool', true, true, false, v_creador),
    (v_proyecto_id, 'SUPERVISOR', 'reg_ejecucion_juntas', true, true, false, v_creador),
    (v_proyecto_id, 'SUPERVISOR', 'reg_montaje_valvulas', true, true, false, v_creador),
    (v_proyecto_id, 'SUPERVISOR', 'reg_montaje_soportes', true, true, false, v_creador);

END;
$$;

-- ─── 6. Redefinir importar_calcular_diff con alertas de conflicto jerárquicas ───
CREATE OR REPLACE FUNCTION lukeapp.importar_calcular_diff(p_lote_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_lote   RECORD;
  v_tabla  TEXT;
  v_fila   RECORD;
  v_act    RECORD;
  v_diff   JSONB;
  v_desc   TEXT; v_fluido TEXT; v_clase TEXT; v_nps TEXT; v_num TEXT;
  v_tag TEXT; v_unidad TEXT; v_material TEXT; v_norma TEXT; v_sched TEXT;
  v_heat TEXT; v_linea_ref TEXT; v_iso_ref TEXT; v_spool_ref TEXT;
  v_rev TEXT; v_estado TEXT; v_pdf TEXT; v_peso TEXT; v_long TEXT; v_nro_juntas TEXT;
  v_sector TEXT; v_num_junta TEXT; v_tipo_union TEXT; v_proceso TEXT; v_mat_base TEXT;
  v_req_pwht TEXT; v_req_pmi TEXT; v_pct_nde TEXT;
  v_clave TEXT;
BEGIN
  SELECT l.*, p.tabla_destino INTO v_lote
  FROM lukeapp.import_lotes l JOIN lukeapp.import_perfiles p ON p.id = l.perfil_id
  WHERE l.id = p_lote_id FOR UPDATE OF l;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lote % no existe', p_lote_id; END IF;
  IF NOT lukeapp.importar_es_editor(v_lote.proyecto_id) THEN
    RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto';
  END IF;
  IF v_lote.estado NOT IN ('cargado', 'validado', 'diff_listo') THEN
    RAISE EXCEPTION 'El lote está en estado % y no admite recálculo', v_lote.estado;
  END IF;
  v_tabla := v_lote.tabla_destino;

  DELETE FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND nro_fila < 0;

  v_clave := CASE 
    WHEN v_tabla = 'list_lineas' THEN 'id_linea' 
    WHEN v_tabla = 'list_mto' THEN 'item'
    WHEN v_tabla = 'list_isos' THEN 'id_iso'
    WHEN v_tabla = 'list_spools' THEN 'id_spool'
    WHEN v_tabla = 'list_juntas' THEN 'id_junta'
  END;

  UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false,
    error_detalle = 'Falta el valor de la clave (' || v_clave || ')'
  WHERE lote_id = p_lote_id AND (clave_natural IS NULL OR clave_natural = '');

  UPDATE lukeapp.import_filas f SET accion = 'error', aprobada = false,
    error_detalle = 'Clave duplicada en el archivo (primera aparición en fila ' ||
      (SELECT min(f2.nro_fila) FROM lukeapp.import_filas f2
       WHERE f2.lote_id = f.lote_id AND f2.clave_natural = f.clave_natural) || ')'
  WHERE f.lote_id = p_lote_id AND f.clave_natural IS NOT NULL AND f.clave_natural <> ''
    AND EXISTS (
      SELECT 1 FROM lukeapp.import_filas f2
      WHERE f2.lote_id = f.lote_id AND f2.clave_natural = f.clave_natural
        AND f2.nro_fila < f.nro_fila
    );

  FOR v_fila IN
    SELECT id, nro_fila, payload, clave_natural FROM lukeapp.import_filas
    WHERE lote_id = p_lote_id AND nro_fila > 0
      AND (accion IS NULL OR accion NOT IN ('error'))
    ORDER BY nro_fila
  LOOP
    IF v_tabla = 'list_lineas' THEN
      v_num := v_fila.payload ->> 'longitud_total';
      IF NOT lukeapp.importar_num_valido(v_num) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'longitud_total no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      v_desc   := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_fluido := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      v_clase  := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      v_nps    := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');

      SELECT l.id, l.descripcion, upper(fc.codigo) AS fluido_codigo, upper(cp.codigo) AS clase_codigo, l.nps_texto, l.longitud_total, l.ausente_en_revision, l.activo INTO v_act
      FROM lukeapp.list_lineas l LEFT JOIN lukeapp.cat_fluido_servicio fc ON fc.id = l.fluido_id LEFT JOIN lukeapp.cat_clase_piping cp ON cp.id = l.clase_id
      WHERE l.proyecto_id = v_lote.proyecto_id AND upper(trim(l.id_linea)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'fluido_codigo', v_act.fluido_codigo, v_fluido);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'clase_codigo', v_act.clase_codigo, v_clase);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_texto', v_act.nps_texto, v_nps);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'longitud_total', v_act.longitud_total::text, lukeapp.importar_a_num(v_num)::text);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff, error_detalle = NULL WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_mto' THEN
      v_num := v_fila.payload ->> 'cantidad';
      IF NOT lukeapp.importar_num_valido(v_num) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'cantidad no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_tag := NULLIF(trim(v_fila.payload ->> 'tag'), '');
      v_unidad := NULLIF(trim(v_fila.payload ->> 'unidad'), '');
      v_nps := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      v_clase := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      v_material := NULLIF(trim(v_fila.payload ->> 'material'), '');
      v_norma := NULLIF(trim(v_fila.payload ->> 'norma'), '');
      v_sched := NULLIF(trim(v_fila.payload ->> 'schedule'), '');
      v_heat := NULLIF(trim(v_fila.payload ->> 'heat_number'), '');
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');

      SELECT m.id, m.descripcion, m.tag, m.cantidad, m.unidad, m.nps_texto, upper(cp.codigo) AS clase_codigo, m.material, m.norma, m.schedule, m.heat_number, upper(trim(l.id_linea)) AS linea_codigo, m.ausente_en_revision, m.activo INTO v_act
      FROM lukeapp.list_mto m LEFT JOIN lukeapp.cat_clase_piping cp ON cp.id = m.clase_id LEFT JOIN lukeapp.list_lineas l ON l.id = m.linea_id
      WHERE m.proyecto_id = v_lote.proyecto_id AND upper(trim(m.item)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tag', v_act.tag, v_tag);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'cantidad', v_act.cantidad::text, lukeapp.importar_a_num(v_num)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'unidad', v_act.unidad, v_unidad);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_texto', v_act.nps_texto, v_nps);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'clase_codigo', v_act.clase_codigo, v_clase);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'material', v_act.material, v_material);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'norma', v_act.norma, v_norma);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'schedule', v_act.schedule, v_sched);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'heat_number', v_act.heat_number, v_heat);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea', v_act.linea_codigo, v_linea_ref);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff, error_detalle = NULL WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_isos' THEN
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_rev := NULLIF(trim(v_fila.payload ->> 'revision'), '');
      v_estado := NULLIF(trim(v_fila.payload ->> 'estado'), '');
      v_pdf := NULLIF(trim(v_fila.payload ->> 'pdf_path'), '');

      SELECT i.id, i.descripcion, i.revision, i.estado, i.pdf_path, upper(trim(l.id_linea)) AS linea_codigo, i.ausente_en_revision INTO v_act
      FROM lukeapp.list_isos i LEFT JOIN lukeapp.list_lineas l ON l.id = i.linea_id
      WHERE i.proyecto_id = v_lote.proyecto_id AND upper(trim(i.id_iso)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'revision', v_act.revision, v_rev);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'estado', v_act.estado, v_estado);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'pdf_path', v_act.pdf_path, v_pdf);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea', v_act.linea_codigo, v_linea_ref);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_spools' THEN
      v_peso := v_fila.payload ->> 'peso';
      v_long := v_fila.payload ->> 'longitud';
      v_nro_juntas := v_fila.payload ->> 'nro_juntas';
      IF NOT lukeapp.importar_num_valido(v_peso) OR NOT lukeapp.importar_num_valido(v_long) OR NOT lukeapp.importar_num_valido(v_nro_juntas) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'peso, longitud o nro_juntas no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      v_iso_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_iso')), '');
      v_tag := NULLIF(trim(v_fila.payload ->> 'tag_gestion'), '');
      v_sector := NULLIF(trim(v_fila.payload ->> 'sector'), '');
      v_estado := NULLIF(trim(v_fila.payload ->> 'estado_montaje'), '');

      SELECT s.id, s.tag_gestion, s.peso, s.longitud, s.nro_juntas, s.estado_montaje, s.sector, upper(trim(i.id_iso)) AS iso_codigo, s.ausente_en_revision INTO v_act
      FROM lukeapp.list_spools s LEFT JOIN lukeapp.list_isos i ON i.id = s.iso_id
      WHERE s.proyecto_id = v_lote.proyecto_id AND upper(trim(s.id_spool)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tag_gestion', v_act.tag_gestion, v_tag);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'peso', v_act.peso::text, lukeapp.importar_a_num(v_peso)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'longitud', v_act.longitud::text, lukeapp.importar_a_num(v_long)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nro_juntas', v_act.nro_juntas::text, lukeapp.importar_a_num(v_nro_juntas)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'estado_montaje', v_act.estado_montaje, v_estado);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'sector', v_act.sector, v_sector);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_iso', v_act.iso_codigo, v_iso_ref);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_juntas' THEN
      v_spool_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_spool')), '');
      v_num_junta := NULLIF(trim(v_fila.payload ->> 'numero_junta'), '');
      v_tipo_union := NULLIF(upper(trim(v_fila.payload ->> 'tipo_union')), '');
      v_nps := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      v_proceso := NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), '');
      v_mat_base := NULLIF(trim(v_fila.payload ->> 'material_base'), '');
      v_req_pwht := NULLIF(trim(v_fila.payload ->> 'requiere_pwht'), '');
      v_req_pmi := NULLIF(trim(v_fila.payload ->> 'requiere_pmi'), '');
      v_pct_nde := v_fila.payload ->> 'porcentaje_nde';

      IF v_pct_nde IS NOT NULL AND NOT lukeapp.importar_num_valido(v_pct_nde) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'porcentaje_nde no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      SELECT j.id, j.numero_junta, upper(tu.codigo) AS tipo_union_codigo, j.nps_texto, j.proceso_soldadura, j.material_base,
             j.requiere_pwht, j.requiere_pmi, j.porcentaje_nde, upper(trim(s.id_spool)) AS spool_codigo, j.ausente_en_revision INTO v_act
      FROM lukeapp.list_juntas j LEFT JOIN lukeapp.list_spools s ON s.id = j.spool_id LEFT JOIN lukeapp.cat_tipo_union tu ON tu.id = j.tipo_union_id
      WHERE j.proyecto_id = v_lote.proyecto_id AND upper(trim(j.id_spool || '_' || j.numero_junta)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'numero_junta', v_act.numero_junta, v_num_junta);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tipo_union', v_act.tipo_union_codigo, v_tipo_union);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_texto', v_act.nps_texto, v_nps);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'proceso_soldadura', v_act.proceso_soldadura, v_proceso);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'material_base', v_act.material_base, v_mat_base);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'requiere_pwht', v_act.requiere_pwht::text, COALESCE(v_req_pwht, 'false'));
        v_diff := lukeapp.importar_diff_campo(v_diff, 'requiere_pmi', v_act.requiere_pmi::text, COALESCE(v_req_pmi, 'false'));
        v_diff := lukeapp.importar_diff_campo(v_diff, 'porcentaje_nde', v_act.porcentaje_nde::text, lukeapp.importar_a_num(v_pct_nde)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_spool', v_act.spool_codigo, v_spool_ref);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    END IF;
  END LOOP;

  -- Búsqueda de elementos ausentes y catalogación de conflictos de avance
  IF v_tabla = 'list_lineas' THEN
    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, aprobada, error_detalle)
    SELECT p_lote_id, -row_number() OVER (ORDER BY l.id_linea), jsonb_build_object('id_linea', l.id_linea, 'descripcion', l.descripcion, 'nps_texto', l.nps_texto, 'longitud_total', l.longitud_total), upper(trim(l.id_linea)), 'ausente', false,
      CASE WHEN a.avance > 0 THEN 'CONFLICTO: la línea tiene ' || a.avance || ' junta(s) con avance de terreno — resolver con OT antes de marcar ausente' END
    FROM lukeapp.list_lineas l LEFT JOIN LATERAL (SELECT count(*) AS avance FROM lukeapp.list_juntas j JOIN lukeapp.reg_ejecucion_juntas rj ON rj.junta_id = j.id WHERE j.linea_id = l.id) a ON true
    WHERE l.proyecto_id = v_lote.proyecto_id AND l.activo AND NOT l.ausente_en_revision AND upper(trim(l.id_linea)) NOT IN (SELECT clave_natural FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND nro_fila > 0 AND clave_natural IS NOT NULL);

  ELSIF v_tabla = 'list_mto' THEN
    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, aprobada)
    SELECT p_lote_id, -row_number() OVER (ORDER BY m.item), jsonb_build_object('item', m.item, 'descripcion', m.descripcion, 'cantidad', m.cantidad, 'unidad', m.unidad, 'nps_texto', m.nps_texto), upper(trim(m.item)), 'ausente', false
    FROM lukeapp.list_mto m WHERE m.proyecto_id = v_lote.proyecto_id AND m.activo AND NOT m.ausente_en_revision AND upper(trim(m.item)) NOT IN (SELECT clave_natural FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND nro_fila > 0 AND clave_natural IS NOT NULL);

  ELSIF v_tabla = 'list_isos' THEN
    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, aprobada, error_detalle)
    SELECT p_lote_id, -row_number() OVER (ORDER BY i.id_iso), jsonb_build_object('id_iso', i.id_iso, 'id_linea', i.id_linea, 'sheet', i.sheet, 'revision', i.revision), upper(trim(i.id_iso)), 'ausente', false,
      CASE WHEN a.avance > 0 THEN 'CONFLICTO: el isométrico tiene ' || a.avance || ' junta(s) con avance de terreno — resolver con OT antes de marcar ausente' END
    FROM lukeapp.list_isos i LEFT JOIN LATERAL (SELECT count(*) AS avance FROM lukeapp.list_juntas j JOIN lukeapp.reg_ejecucion_juntas rj ON rj.junta_id = j.id JOIN lukeapp.list_spools s ON s.id = j.spool_id WHERE s.iso_id = i.id) a ON true
    WHERE i.proyecto_id = v_lote.proyecto_id AND i.activo AND NOT i.ausente_en_revision AND upper(trim(i.id_iso)) NOT IN (SELECT clave_natural FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND nro_fila > 0 AND clave_natural IS NOT NULL);

  ELSIF v_tabla = 'list_spools' THEN
    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, aprobada, error_detalle)
    SELECT p_lote_id, -row_number() OVER (ORDER BY s.id_spool), jsonb_build_object('id_spool', s.id_spool, 'tag_gestion', s.tag_gestion, 'estado_montaje', s.estado_montaje), upper(trim(s.id_spool)), 'ausente', false,
      CASE WHEN a.avance > 0 THEN 'CONFLICTO: el spool tiene ' || a.avance || ' junta(s) con avance de terreno — resolver con OT antes de marcar ausente' END
    FROM lukeapp.list_spools s LEFT JOIN LATERAL (SELECT count(*) AS avance FROM lukeapp.list_juntas j JOIN lukeapp.reg_ejecucion_juntas rj ON rj.junta_id = j.id WHERE j.spool_id = s.id) a ON true
    WHERE s.proyecto_id = v_lote.proyecto_id AND s.activo AND NOT s.ausente_en_revision AND upper(trim(s.id_spool)) NOT IN (SELECT clave_natural FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND nro_fila > 0 AND clave_natural IS NOT NULL);

  ELSIF v_tabla = 'list_juntas' THEN
    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, aprobada, error_detalle)
    SELECT p_lote_id, -row_number() OVER (ORDER BY j.id_spool, j.numero_junta), jsonb_build_object('id_spool', j.id_spool, 'numero_junta', j.numero_junta, 'estado', j.estado), upper(trim(j.id_spool || '_' || j.numero_junta)), 'ausente', false,
      CASE WHEN a.avance > 0 THEN 'CONFLICTO: la junta tiene avance de terreno (' || j.estado || ') — resolver con OT antes de marcar ausente' END
    FROM lukeapp.list_juntas j LEFT JOIN LATERAL (SELECT count(*) AS avance FROM lukeapp.reg_ejecucion_juntas rj WHERE rj.junta_id = j.id) a ON true
    WHERE j.proyecto_id = v_lote.proyecto_id AND j.activo AND NOT j.ausente_en_revision AND upper(trim(j.id_spool || '_' || j.numero_junta)) NOT IN (SELECT clave_natural FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND nro_fila > 0 AND clave_natural IS NOT NULL);
  END IF;

  UPDATE lukeapp.import_lotes SET estado = 'diff_listo', actualizado_por = v_uid, resumen = COALESCE(resumen, '{}'::jsonb) || (SELECT jsonb_build_object('n_nuevas', count(*) FILTER (WHERE accion = 'nueva'), 'n_modificadas', count(*) FILTER (WHERE accion = 'modificada'), 'n_ausentes', count(*) FILTER (WHERE accion = 'ausente'), 'n_sin_cambio', count(*) FILTER (WHERE accion = 'sin_cambio'), 'n_errores', count(*) FILTER (WHERE accion = 'error'), 'n_conflictos', count(*) FILTER (WHERE accion = 'ausente' AND error_detalle LIKE 'CONFLICTO%')) FROM lukeapp.import_filas WHERE lote_id = p_lote_id) WHERE id = p_lote_id;
END;
$$;

-- ─── 7. Redefinir importar_aplicar_lote con soporte para Soft Delete activo = false ───
CREATE OR REPLACE FUNCTION lukeapp.importar_aplicar_lote(p_lote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_uid   UUID := auth.uid(); v_lote  RECORD; v_tabla TEXT; v_fila  RECORD;
  v_fluido_id UUID; v_clase_id UUID; v_linea_id UUID; v_iso_id UUID; v_spool_id UUID; v_tipo_union_id UUID;
  v_cod TEXT; n_ins INT := 0; n_upd INT := 0; n_aus INT := 0; v_resumen JSONB;
BEGIN
  SELECT l.*, p.tabla_destino INTO v_lote FROM lukeapp.import_lotes l JOIN lukeapp.import_perfiles p ON p.id = l.perfil_id WHERE l.id = p_lote_id FOR UPDATE OF l;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote % no existe', p_lote_id; END IF;
  IF NOT lukeapp.importar_es_editor(v_lote.proyecto_id) THEN RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto'; END IF;
  IF v_lote.estado <> 'diff_listo' THEN RAISE EXCEPTION 'El lote está en estado %; solo se aplica desde diff_listo', v_lote.estado; END IF;
  v_tabla := v_lote.tabla_destino;
  IF EXISTS (SELECT 1 FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND aprobada AND error_detalle LIKE 'CONFLICTO%') THEN RAISE EXCEPTION 'El lote tiene filas en conflicto aprobadas; resolver antes de aplicar'; END IF;

  FOR v_fila IN SELECT * FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND aprobada AND accion IN ('nueva', 'modificada', 'ausente') ORDER BY accion, nro_fila LOOP
    IF v_tabla = 'list_lineas' THEN
      v_fluido_id := NULL; v_clase_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id INTO v_fluido_id FROM lukeapp.cat_fluido_servicio WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; IF v_fluido_id IS NULL THEN RAISE EXCEPTION 'Fila %: fluido "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id INTO v_clase_id FROM lukeapp.cat_clase_piping WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; IF v_clase_id IS NULL THEN RAISE EXCEPTION 'Fila %: clase "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_lineas (proyecto_id, id_linea, descripcion, fluido_id, clase_id, nps_texto, longitud_total, creado_por) VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'id_linea'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_fluido_id, v_clase_id, NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), lukeapp.importar_a_num(v_fila.payload ->> 'longitud_total'), v_uid); n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_lineas SET descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), fluido_id = v_fluido_id, clase_id = v_clase_id, nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), longitud_total = lukeapp.importar_a_num(v_fila.payload ->> 'longitud_total'), ausente_en_revision = false, activo = true, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_fila.clave_natural; n_upd := n_upd + 1;
      ELSE 
        -- Soft Delete: ausente_en_revision = true AND activo = false
        UPDATE lukeapp.list_lineas SET ausente_en_revision = true, activo = false, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_fila.clave_natural; n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'list_mto' THEN
      v_clase_id := NULL; v_linea_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id INTO v_clase_id FROM lukeapp.cat_clase_piping WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; IF v_clase_id IS NULL THEN RAISE EXCEPTION 'Fila %: clase "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id INTO v_linea_id FROM lukeapp.list_lineas WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_cod; IF v_linea_id IS NULL THEN RAISE EXCEPTION 'Fila %: línea "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_mto (proyecto_id, linea_id, item, descripcion, tag, cantidad, unidad, nps_texto, clase_id, material, norma, schedule, heat_number, creado_por) VALUES (v_lote.proyecto_id, v_linea_id, trim(v_fila.payload ->> 'item'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), NULLIF(trim(v_fila.payload ->> 'tag'), ''), lukeapp.importar_a_num(v_fila.payload ->> 'cantidad'), NULLIF(trim(v_fila.payload ->> 'unidad'), ''), NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), v_clase_id, NULLIF(trim(v_fila.payload ->> 'material'), ''), NULLIF(trim(v_fila.payload ->> 'norma'), ''), NULLIF(trim(v_fila.payload ->> 'schedule'), ''), NULLIF(trim(v_fila.payload ->> 'heat_number'), ''), v_uid); n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_mto SET linea_id = v_linea_id, descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), tag = NULLIF(trim(v_fila.payload ->> 'tag'), ''), cantidad = lukeapp.importar_a_num(v_fila.payload ->> 'cantidad'), unidad = NULLIF(trim(v_fila.payload ->> 'unidad'), ''), nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), clase_id = v_clase_id, material = NULLIF(trim(v_fila.payload ->> 'material'), ''), norma = NULLIF(trim(v_fila.payload ->> 'norma'), ''), schedule = NULLIF(trim(v_fila.payload ->> 'schedule'), ''), heat_number = NULLIF(trim(v_fila.payload ->> 'heat_number'), ''), ausente_en_revision = false, activo = true, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(item)) = v_fila.clave_natural; n_upd := n_upd + 1;
      ELSE 
        -- Soft Delete
        UPDATE lukeapp.list_mto SET ausente_en_revision = true, activo = false, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(item)) = v_fila.clave_natural; n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'list_isos' THEN
      v_linea_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id INTO v_linea_id FROM lukeapp.list_lineas WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_cod; IF v_linea_id IS NULL THEN RAISE EXCEPTION 'Fila %: línea "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;
      
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_isos (proyecto_id, linea_id, sheet, descripcion, revision, estado, pdf_path, creado_por) VALUES (v_lote.proyecto_id, v_linea_id, trim(v_fila.payload ->> 'sheet'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), NULLIF(trim(v_fila.payload ->> 'revision'), ''), NULLIF(trim(v_fila.payload ->> 'estado'), ''), NULLIF(trim(v_fila.payload ->> 'pdf_path'), ''), v_uid); n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_isos SET linea_id = v_linea_id, descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), revision = NULLIF(trim(v_fila.payload ->> 'revision'), ''), estado = NULLIF(trim(v_fila.payload ->> 'estado'), ''), pdf_path = NULLIF(trim(v_fila.payload ->> 'pdf_path'), ''), ausente_en_revision = false, activo = true, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_iso)) = v_fila.clave_natural; n_upd := n_upd + 1;
      ELSE 
        -- Soft Delete
        UPDATE lukeapp.list_isos SET ausente_en_revision = true, activo = false, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_iso)) = v_fila.clave_natural; n_aus := n_aus + 1;
      END IF;
    
    ELSIF v_tabla = 'list_spools' THEN
      v_iso_id := NULL; v_linea_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_iso')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id, linea_id INTO v_iso_id, v_linea_id FROM lukeapp.list_isos WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_iso)) = v_cod; IF v_iso_id IS NULL THEN RAISE EXCEPTION 'Fila %: iso "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_spools (proyecto_id, iso_id, linea_id, id_spool, tag_gestion, peso, longitud, nro_juntas, estado_montaje, sector, creado_por) VALUES (v_lote.proyecto_id, v_iso_id, v_linea_id, trim(v_fila.payload ->> 'id_spool'), NULLIF(trim(v_fila.payload ->> 'tag_gestion'), ''), lukeapp.importar_a_num(v_fila.payload ->> 'peso'), lukeapp.importar_a_num(v_fila.payload ->> 'longitud'), (lukeapp.importar_a_num(v_fila.payload ->> 'nro_juntas'))::int, NULLIF(trim(v_fila.payload ->> 'estado_montaje'), ''), NULLIF(trim(v_fila.payload ->> 'sector'), ''), v_uid); n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_spools SET iso_id = v_iso_id, linea_id = v_linea_id, tag_gestion = NULLIF(trim(v_fila.payload ->> 'tag_gestion'), ''), peso = lukeapp.importar_a_num(v_fila.payload ->> 'peso'), longitud = lukeapp.importar_a_num(v_fila.payload ->> 'longitud'), nro_juntas = (lukeapp.importar_a_num(v_fila.payload ->> 'nro_juntas'))::int, estado_montaje = NULLIF(trim(v_fila.payload ->> 'estado_montaje'), ''), sector = NULLIF(trim(v_fila.payload ->> 'sector'), ''), ausente_en_revision = false, activo = true, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool)) = v_fila.clave_natural; n_upd := n_upd + 1;
      ELSE 
        -- Soft Delete
        UPDATE lukeapp.list_spools SET ausente_en_revision = true, activo = false, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool)) = v_fila.clave_natural; n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'list_juntas' THEN
      v_spool_id := NULL; v_linea_id := NULL; v_tipo_union_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_spool')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id, linea_id INTO v_spool_id, v_linea_id FROM lukeapp.list_spools WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool)) = v_cod; IF v_spool_id IS NULL THEN RAISE EXCEPTION 'Fila %: spool "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'tipo_union')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN SELECT id INTO v_tipo_union_id FROM lukeapp.cat_tipo_union WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; IF v_tipo_union_id IS NULL THEN RAISE EXCEPTION 'Fila %: tipo_union "%" no existe', v_fila.nro_fila, v_cod; END IF; END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_juntas (proyecto_id, spool_id, linea_id, id_spool, numero_junta, tipo_union_id, nps_texto, proceso_soldadura, material_base, requiere_pwht, requiere_pmi, porcentaje_nde, creado_por) VALUES (v_lote.proyecto_id, v_spool_id, v_linea_id, trim(v_fila.payload ->> 'id_spool'), trim(v_fila.payload ->> 'numero_junta'), v_tipo_union_id, NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), ''), NULLIF(trim(v_fila.payload ->> 'material_base'), COALESCE((v_fila.payload ->> 'requiere_pwht')::boolean, false), COALESCE((v_fila.payload ->> 'requiere_pmi')::boolean, false), lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje_nde'), v_uid); n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_juntas SET spool_id = v_spool_id, linea_id = v_linea_id, tipo_union_id = v_tipo_union_id, nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), proceso_soldadura = NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), ''), material_base = NULLIF(trim(v_fila.payload ->> 'material_base'), ''), requiere_pwht = COALESCE((v_fila.payload ->> 'requiere_pwht')::boolean, false), requiere_pmi = COALESCE((v_fila.payload ->> 'requiere_pmi')::boolean, false), porcentaje_nde = lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje_nde'), ausente_en_revision = false, activo = true, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool || '_' || numero_junta)) = v_fila.clave_natural; n_upd := n_upd + 1;
      ELSE 
        -- Soft Delete
        UPDATE lukeapp.list_juntas SET ausente_en_revision = true, activo = false, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool || '_' || numero_junta)) = v_fila.clave_natural; n_aus := n_aus + 1;
      END IF;

    END IF;
  END LOOP;

  v_resumen := COALESCE(v_lote.resumen, '{}'::jsonb) || jsonb_build_object('aplicadas_nuevas', n_ins, 'aplicadas_modificadas', n_upd, 'marcadas_ausentes', n_aus, 'aplicado_en', now(), 'aplicado_por', v_uid);
  UPDATE lukeapp.import_lotes SET estado = 'aplicado', resumen = v_resumen, actualizado_por = v_uid WHERE id = p_lote_id;
  RETURN v_resumen;
END;
$$;

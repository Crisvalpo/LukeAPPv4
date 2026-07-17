-- ============================================================
-- LukeAPP v4 — Migración 024: Importador Base Firme y Cadena de Ingeniería
-- Schema: lukeapp
-- Depende de: 20260713_010_cat_enriquecimiento.sql, 20260713_011_mto_spool_junta_nde.sql
-- Rev. A — Julio 2026
-- ============================================================

-- ─── 1. Crear función para consultar estado de catálogos (Chequeo "Base CAT lista") ───
CREATE OR REPLACE FUNCTION lukeapp.obtener_estado_catalogos(p_proyecto_id UUID)
RETURNS TABLE (
  tabla TEXT,
  filas_count INT
) 
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'cat_fluido_servicio'::TEXT, COUNT(*)::INT FROM lukeapp.cat_fluido_servicio WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_clase_piping'::TEXT, COUNT(*)::INT FROM lukeapp.cat_clase_piping WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_diametros_nps'::TEXT, COUNT(*)::INT FROM lukeapp.cat_diametros_nps WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_aislacion_ext'::TEXT, COUNT(*)::INT FROM lukeapp.cat_aislacion_ext WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_revestimiento_int'::TEXT, COUNT(*)::INT FROM lukeapp.cat_revestimiento_int WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_esquema_pintura'::TEXT, COUNT(*)::INT FROM lukeapp.cat_esquema_pintura WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_porcentaje_nde'::TEXT, COUNT(*)::INT FROM lukeapp.cat_porcentaje_nde WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_tipo_prueba'::TEXT, COUNT(*)::INT FROM lukeapp.cat_tipo_prueba WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_tipo_union'::TEXT, COUNT(*)::INT FROM lukeapp.cat_tipo_union WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_tipo_soporte'::TEXT, COUNT(*)::INT FROM lukeapp.cat_tipo_soporte WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_personal'::TEXT, COUNT(*)::INT FROM lukeapp.cat_personal WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_iwp'::TEXT, COUNT(*)::INT FROM lukeapp.cat_iwp WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_cwa'::TEXT, COUNT(*)::INT FROM lukeapp.cat_cwa WHERE proyecto_id = p_proyecto_id AND activo
  UNION ALL
  SELECT 'cat_cwp'::TEXT, COUNT(*)::INT FROM lukeapp.cat_cwp WHERE proyecto_id = p_proyecto_id AND activo;
END;
$$;

GRANT EXECUTE ON FUNCTION lukeapp.obtener_estado_catalogos(UUID) TO authenticated, service_role;

-- ─── 2. Redefinir importar_calcular_diff para soportar la cadena completa ───
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
  
  -- Variables auxiliares de control
  v_cod    TEXT; 
  v_presion TEXT; 
  v_temp   TEXT;
  v_capas  TEXT; 
  v_porcentaje TEXT;
  
  -- Campos comunes
  v_desc   TEXT; v_fluido TEXT; v_clase TEXT; v_nps TEXT; v_num TEXT;
  v_tag    TEXT; v_unidad TEXT; v_material TEXT; v_norma TEXT; v_sched TEXT;
  v_heat   TEXT; v_linea_ref TEXT; v_iso_ref TEXT; v_spool_ref TEXT;
  v_rev    TEXT; v_estado TEXT; v_pdf TEXT; v_peso TEXT; v_long TEXT; v_nro_juntas TEXT;
  v_sector TEXT; v_num_junta TEXT; v_tipo_union TEXT; v_proceso TEXT; v_mat_base TEXT;
  v_req_pwht TEXT; v_req_pmi TEXT; v_pct_nde TEXT; v_nde_codigo TEXT;
  
  -- Campos nuevos de list_lineas
  v_prueba TEXT; v_pintura TEXT; v_revestimiento TEXT; v_aislacion TEXT;
  
  -- Campos de catálogos enriquecidos
  v_nombre TEXT; v_color_nombre TEXT; v_color_ral TEXT;
  v_presion_psi TEXT; v_aplicacion TEXT;
  v_tipo_material TEXT; v_unidad_medida TEXT;
  v_restriccion_pintura TEXT; v_especificacion TEXT;
  v_sistema_aplicacion TEXT; v_preparacion_superficie TEXT; v_espesor_total_um TEXT; v_detalle_capas TEXT;
  v_metodo TEXT; v_norma_nde TEXT;
  v_condicion_diseno TEXT; v_medio_fluido TEXT;
  v_acronimo TEXT; v_tipo_uniones TEXT; v_metodo_trabajo TEXT; v_nde_requerido TEXT;
  v_rut TEXT; v_cargo TEXT; v_area TEXT; v_supervisor TEXT;
  v_fecha_inicio TEXT; v_fecha_fin TEXT;
  
  v_clave  TEXT;
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
    WHEN v_tabla = 'cat_diametros_nps' THEN 'nps'
    ELSE 'codigo'
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
      IF v_num IS NOT NULL AND NOT lukeapp.importar_num_valido(v_num) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'longitud_total no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      v_desc   := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_fluido := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      v_clase  := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      v_nps    := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      v_prueba := NULLIF(upper(trim(v_fila.payload ->> 'prueba_codigo')), '');
      v_pintura := NULLIF(upper(trim(v_fila.payload ->> 'pintura_codigo')), '');
      v_revestimiento := NULLIF(upper(trim(v_fila.payload ->> 'revestimiento_codigo')), '');
      v_aislacion := NULLIF(upper(trim(v_fila.payload ->> 'aislacion_codigo')), '');

      SELECT l.id, l.descripcion, upper(fc.codigo) AS fluido_codigo, upper(cp.codigo) AS clase_codigo, 
             l.nps_texto, l.longitud_total, l.ausente_en_revision, l.activo,
             upper(tp.codigo) AS prueba_codigo, upper(ep.codigo) AS pintura_codigo,
             upper(ri.codigo) AS revestimiento_codigo, upper(ae.codigo) AS aislacion_codigo INTO v_act
      FROM lukeapp.list_lineas l 
        LEFT JOIN lukeapp.cat_fluido_servicio fc ON fc.id = l.fluido_id 
        LEFT JOIN lukeapp.cat_clase_piping cp ON cp.id = l.clase_id
        LEFT JOIN lukeapp.cat_tipo_prueba tp ON tp.id = l.prueba_id
        LEFT JOIN lukeapp.cat_esquema_pintura ep ON ep.id = l.pintura_id
        LEFT JOIN lukeapp.cat_revestimiento_int ri ON ri.id = l.revestimiento_id
        LEFT JOIN lukeapp.cat_aislacion_ext ae ON ae.id = l.aislacion_id
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
        v_diff := lukeapp.importar_diff_campo(v_diff, 'prueba_codigo', v_act.prueba_codigo, v_prueba);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'pintura_codigo', v_act.pintura_codigo, v_pintura);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'revestimiento_codigo', v_act.revestimiento_codigo, v_revestimiento);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'aislacion_codigo', v_act.aislacion_codigo, v_aislacion);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_mto' THEN
      v_num := v_fila.payload ->> 'cantidad';
      IF NOT lukeapp.importar_num_valido(v_num) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'cantidad no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      v_desc    := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_unidad  := NULLIF(trim(v_fila.payload ->> 'unidad'), '');
      v_nps     := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      v_clase   := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      v_spool_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_spool')), '');
      v_material := NULLIF(trim(v_fila.payload ->> 'material'), '');
      v_norma   := NULLIF(trim(v_fila.payload ->> 'norma'), '');
      v_sched   := NULLIF(trim(v_fila.payload ->> 'schedule'), '');
      v_heat    := NULLIF(trim(v_fila.payload ->> 'heat_number'), '');

      SELECT m.id, m.descripcion, m.cantidad, m.unidad, m.nps_texto, m.material, m.norma, m.schedule, m.heat_number,
             upper(l.id_linea) AS linea_codigo, upper(cp.codigo) AS clase_codigo, upper(s.id_spool) AS spool_codigo, m.ausente_en_revision INTO v_act
      FROM lukeapp.list_mto m 
        LEFT JOIN lukeapp.list_lineas l ON l.id = m.linea_id
        LEFT JOIN lukeapp.cat_clase_piping cp ON cp.id = m.clase_id
        LEFT JOIN lukeapp.list_spools s ON s.id = m.spool_id
      WHERE m.proyecto_id = v_lote.proyecto_id AND upper(trim(m.item)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'cantidad', v_act.cantidad::text, lukeapp.importar_a_num(v_num)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'unidad', v_act.unidad, v_unidad);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_texto', v_act.nps_texto, v_nps);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'clase_codigo', v_act.clase_codigo, v_clase);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea', v_act.linea_codigo, v_linea_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_spool', v_act.spool_codigo, v_spool_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'material', v_act.material, v_material);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'norma', v_act.norma, v_norma);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'schedule', v_act.schedule, v_sched);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'heat_number', v_act.heat_number, v_heat);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_isos' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      v_rev := NULLIF(trim(v_fila.payload ->> 'revision'), '');
      v_estado := NULLIF(trim(v_fila.payload ->> 'estado'), '');
      v_pdf := NULLIF(trim(v_fila.payload ->> 'pdf_path'), '');

      SELECT i.id, i.descripcion, upper(l.id_linea) AS linea_codigo, i.revision, i.estado, i.pdf_path, i.ausente_en_revision INTO v_act
      FROM lukeapp.list_isos i LEFT JOIN lukeapp.list_lineas l ON l.id = i.linea_id
      WHERE i.proyecto_id = v_lote.proyecto_id AND upper(trim(i.id_iso)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea', v_act.linea_codigo, v_linea_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'revision', v_act.revision, v_rev);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'estado', v_act.estado, v_estado);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'pdf_path', v_act.pdf_path, v_pdf);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_spools' THEN
      v_peso := v_fila.payload ->> 'peso';
      v_long := v_fila.payload ->> 'longitud';
      v_nro_juntas := v_fila.payload ->> 'nro_juntas';
      
      IF v_peso IS NOT NULL AND NOT lukeapp.importar_num_valido(v_peso) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'peso no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;
      IF v_long IS NOT NULL AND NOT lukeapp.importar_num_valido(v_long) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'longitud no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;
      IF v_nro_juntas IS NOT NULL AND NOT lukeapp.importar_num_valido(v_nro_juntas) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'nro_juntas no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      v_iso_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_iso')), '');
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      v_tag := NULLIF(trim(v_fila.payload ->> 'tag_gestion'), '');
      v_estado := NULLIF(trim(v_fila.payload ->> 'estado_montaje'), '');
      v_sector := NULLIF(trim(v_fila.payload ->> 'sector'), '');

      SELECT s.id, upper(i.id_iso) AS iso_codigo, upper(l.id_linea) AS linea_codigo, s.tag_gestion, s.peso, s.longitud, s.nro_juntas, s.estado_montaje, s.sector, s.ausente_en_revision INTO v_act
      FROM lukeapp.list_spools s 
        LEFT JOIN lukeapp.list_isos i ON i.id = s.iso_id
        LEFT JOIN lukeapp.list_lineas l ON l.id = s.linea_id
      WHERE s.proyecto_id = v_lote.proyecto_id AND upper(trim(s.id_spool)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_iso', v_act.iso_codigo, v_iso_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea', v_act.linea_codigo, v_linea_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tag_gestion', v_act.tag_gestion, v_tag);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'peso', v_act.peso::text, lukeapp.importar_a_num(v_peso)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'longitud', v_act.longitud::text, lukeapp.importar_a_num(v_long)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nro_juntas', v_act.nro_juntas::text, lukeapp.importar_a_num(v_nro_juntas)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'estado_montaje', v_act.estado_montaje, v_estado);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'sector', v_act.sector, v_sector);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_juntas' THEN
      v_spool_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_spool')), '');
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      v_num_junta := NULLIF(trim(v_fila.payload ->> 'numero_junta'), '');
      v_tipo_union := NULLIF(upper(trim(v_fila.payload ->> 'tipo_union')), '');
      v_nps := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      v_proceso := NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), '');
      v_mat_base := NULLIF(trim(v_fila.payload ->> 'material_base'), '');
      v_req_pwht := NULLIF(trim(v_fila.payload ->> 'requiere_pwht'), '');
      v_req_pmi := NULLIF(trim(v_fila.payload ->> 'requiere_pmi'), '');
      v_pct_nde := v_fila.payload ->> 'porcentaje_nde';
      v_nde_codigo := NULLIF(upper(trim(v_fila.payload ->> 'porcentaje_nde')), '');

      SELECT j.id, j.numero_junta, upper(tu.codigo) AS tipo_union_codigo, j.nps_texto, j.proceso_soldadura, j.material_base,
             j.requiere_pwht, j.requiere_pmi, j.porcentaje_nde, upper(cn.codigo) AS nde_codigo,
             upper(trim(s.id_spool)) AS spool_codigo, upper(l.id_linea) AS linea_codigo, j.ausente_en_revision INTO v_act
      FROM lukeapp.list_juntas j 
        LEFT JOIN lukeapp.list_spools s ON s.id = j.spool_id 
        LEFT JOIN lukeapp.list_lineas l ON l.id = j.linea_id
        LEFT JOIN lukeapp.cat_tipo_union tu ON tu.id = j.tipo_union_id
        LEFT JOIN lukeapp.cat_porcentaje_nde cn ON cn.id = j.nde_id
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
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_spool', v_act.spool_codigo, v_spool_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea', v_act.linea_codigo, v_linea_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'porcentaje_nde', v_act.nde_codigo, v_nde_codigo);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_fluido_servicio' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_nombre := NULLIF(trim(v_fila.payload ->> 'nombre'), '');
      v_color_nombre := NULLIF(trim(v_fila.payload ->> 'color_nombre'), '');
      v_color_ral := NULLIF(trim(v_fila.payload ->> 'color_ral'), '');

      SELECT id, descripcion, nombre, color_nombre, color_ral INTO v_act FROM lukeapp.cat_fluido_servicio
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nombre', v_act.nombre, v_nombre);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'color_nombre', v_act.color_nombre, v_color_nombre);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'color_ral', v_act.color_ral, v_color_ral);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_clase_piping' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_fluido := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      v_presion := NULLIF(trim(v_fila.payload ->> 'presion_max'), '');
      v_temp := NULLIF(trim(v_fila.payload ->> 'temp_max'), '');
      v_material := NULLIF(trim(v_fila.payload ->> 'material'), '');
      v_presion_psi := NULLIF(trim(v_fila.payload ->> 'presion_psi'), '');
      v_aplicacion := NULLIF(trim(v_fila.payload ->> 'aplicacion'), '');

      SELECT cp.id, cp.descripcion, upper(f.codigo) AS fluido_codigo, cp.presion_max, cp.temp_max, cp.material, cp.presion_psi, cp.aplicacion INTO v_act
      FROM lukeapp.cat_clase_piping cp LEFT JOIN lukeapp.cat_fluido_servicio f ON f.id = cp.fluido_id
      WHERE cp.proyecto_id = v_lote.proyecto_id AND upper(cp.codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'fluido_codigo', v_act.fluido_codigo, v_fluido);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'presion_max', v_act.presion_max::text, v_presion);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'temp_max', v_act.temp_max::text, v_temp);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'material', v_act.material, v_material);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'presion_psi', v_act.presion_psi::text, v_presion_psi);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'aplicacion', v_act.aplicacion, v_aplicacion);

        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_diametros_nps' THEN
      v_num := v_fila.payload ->> 'nps_mm';
      v_tipo_material := NULLIF(trim(v_fila.payload ->> 'tipo_material'), '');
      v_unidad_medida := NULLIF(trim(v_fila.payload ->> 'unidad_medida'), '');

      SELECT id, nps_mm, tipo_material, unidad_medida INTO v_act FROM lukeapp.cat_diametros_nps
      WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(nps)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_mm', v_act.nps_mm::text, v_num);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tipo_material', v_act.tipo_material, v_tipo_material);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'unidad_medida', v_act.unidad_medida, v_unidad_medida);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_esquema_pintura' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_capas := v_fila.payload ->> 'capas';
      v_sistema_aplicacion := NULLIF(trim(v_fila.payload ->> 'sistema_aplicacion'), '');
      v_preparacion_superficie := NULLIF(trim(v_fila.payload ->> 'preparacion_superficie'), '');
      v_espesor_total_um := v_fila.payload ->> 'espesor_total_um';
      v_detalle_capas := NULLIF(trim(v_fila.payload ->> 'detalle_capas'), '');

      SELECT id, descripcion, capas, sistema_aplicacion, preparacion_superficie, espesor_total_um, detalle_capas INTO v_act FROM lukeapp.cat_esquema_pintura
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'capas', v_act.capas::text, v_capas);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'sistema_aplicacion', v_act.sistema_aplicacion, v_sistema_aplicacion);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'preparacion_superficie', v_act.preparacion_superficie, v_preparacion_superficie);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'espesor_total_um', v_act.espesor_total_um::text, lukeapp.importar_a_num(v_espesor_total_um)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'detalle_capas', v_act.detalle_capas, v_detalle_capas);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_aislacion_ext' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_restriccion_pintura := NULLIF(trim(v_fila.payload ->> 'restriccion_pintura'), '');

      SELECT id, descripcion, restriccion_pintura INTO v_act FROM lukeapp.cat_aislacion_ext
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'restriccion_pintura', v_act.restriccion_pintura, v_restriccion_pintura);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_porcentaje_nde' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_porcentaje := v_fila.payload ->> 'porcentaje';
      v_metodo := NULLIF(trim(v_fila.payload ->> 'metodo'), '');
      v_aplicacion := NULLIF(trim(v_fila.payload ->> 'aplicacion'), '');
      v_norma_nde := NULLIF(trim(v_fila.payload ->> 'norma'), '');

      SELECT id, descripcion, porcentaje, metodo, aplicacion, norma INTO v_act FROM lukeapp.cat_porcentaje_nde
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'porcentaje', v_act.porcentaje::text, v_porcentaje);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'metodo', v_act.metodo, v_metodo);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'aplicacion', v_act.aplicacion, v_aplicacion);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'norma', v_act.norma, v_norma_nde);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_tipo_prueba' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_aplicacion := NULLIF(trim(v_fila.payload ->> 'aplicacion'), '');
      v_condicion_diseno := NULLIF(trim(v_fila.payload ->> 'condicion_diseno'), '');
      v_medio_fluido := NULLIF(trim(v_fila.payload ->> 'medio_fluido'), '');

      SELECT id, descripcion, aplicacion, condicion_diseno, medio_fluido INTO v_act FROM lukeapp.cat_tipo_prueba
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'aplicacion', v_act.aplicacion, v_aplicacion);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'condicion_diseno', v_act.condicion_diseno, v_condicion_diseno);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'medio_fluido', v_act.medio_fluido, v_medio_fluido);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_tipo_union' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_acronimo := NULLIF(trim(v_fila.payload ->> 'acronimo'), '');
      v_tipo_uniones := NULLIF(trim(v_fila.payload ->> 'tipo_uniones'), '');
      v_metodo_trabajo := NULLIF(trim(v_fila.payload ->> 'metodo_trabajo'), '');
      v_nde_requerido := NULLIF(trim(v_fila.payload ->> 'nde_requerido'), '');
      v_aplicacion := NULLIF(trim(v_fila.payload ->> 'aplicacion'), '');

      SELECT id, descripcion, acronimo, tipo_uniones, metodo_trabajo, nde_requerido, aplicacion INTO v_act FROM lukeapp.cat_tipo_union
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'acronimo', v_act.acronimo, v_acronimo);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tipo_uniones', v_act.tipo_uniones, v_tipo_uniones);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'metodo_trabajo', v_act.metodo_trabajo, v_metodo_trabajo);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nde_requerido', v_act.nde_requerido, v_nde_requerido);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'aplicacion', v_act.aplicacion, v_aplicacion);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_revestimiento_int' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_especificacion := NULLIF(trim(v_fila.payload ->> 'especificacion'), '');

      SELECT id, descripcion, especificacion INTO v_act FROM lukeapp.cat_revestimiento_int
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'especificacion', v_act.especificacion, v_especificacion);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_personal' THEN
      v_nombre := NULLIF(trim(v_fila.payload ->> 'nombre'), '');
      v_tag := NULLIF(trim(v_fila.payload ->> 'estampa'), '');
      v_cargo := NULLIF(trim(v_fila.payload ->> 'cargo'), '');
      v_area := NULLIF(trim(v_fila.payload ->> 'area'), '');
      v_supervisor := NULLIF(trim(v_fila.payload ->> 'supervisor'), '');
      v_estado := NULLIF(trim(v_fila.payload ->> 'estado'), '');

      SELECT id, nombre, estampa, cargo, area, supervisor, estado INTO v_act FROM lukeapp.cat_personal
      WHERE proyecto_id = v_lote.proyecto_id AND upper(rut) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nombre', v_act.nombre, v_nombre);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'estampa', v_act.estampa, v_tag);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'cargo', v_act.cargo, v_cargo);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'area', v_act.area, v_area);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'supervisor', v_act.supervisor, v_supervisor);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'estado', v_act.estado, v_estado);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_iwp' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_fecha_inicio := NULLIF(trim(v_fila.payload ->> 'fecha_inicio'), '');
      v_fecha_fin := NULLIF(trim(v_fila.payload ->> 'fecha_fin'), '');

      SELECT id, descripcion, fecha_inicio, fecha_fin INTO v_act FROM lukeapp.cat_iwp
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'fecha_inicio', v_act.fecha_inicio::text, v_fecha_inicio);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'fecha_fin', v_act.fecha_fin::text, v_fecha_fin);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    END IF;
  END LOOP;

  -- Búsqueda de elementos ausentes (sigue patrón idéntico de la 023)
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

-- ─── 3. Redefinir importar_aplicar_lote con resolución completa de FKs ───
CREATE OR REPLACE FUNCTION lukeapp.importar_aplicar_lote(p_lote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_uid   UUID := auth.uid(); v_lote  RECORD; v_tabla TEXT; v_fila  RECORD;
  
  -- FKs
  v_fluido_id UUID; v_clase_id UUID; v_linea_id UUID; v_iso_id UUID; v_spool_id UUID; 
  v_tipo_union_id UUID; v_nps_id UUID; v_nde_id UUID; v_prueba_id UUID; v_pintura_id UUID;
  v_revestimiento_id UUID; v_aislacion_id UUID;
  
  v_cod TEXT; n_ins INT := 0; n_upd INT := 0; n_aus INT := 0; v_resumen JSONB;
BEGIN
  SELECT l.*, p.tabla_destino INTO v_lote 
  FROM lukeapp.import_lotes l JOIN lukeapp.import_perfiles p ON p.id = l.perfil_id 
  WHERE l.id = p_lote_id FOR UPDATE OF l;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote % no existe', p_lote_id; END IF;
  IF NOT lukeapp.importar_es_editor(v_lote.proyecto_id) THEN RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto'; END IF;
  IF v_lote.estado <> 'diff_listo' THEN RAISE EXCEPTION 'El lote está en estado %; solo se aplica desde diff_listo', v_lote.estado; END IF;
  v_tabla := v_lote.tabla_destino;
  
  IF EXISTS (SELECT 1 FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND aprobada AND error_detalle LIKE 'CONFLICTO%') THEN 
    RAISE EXCEPTION 'El lote tiene filas en conflicto aprobadas; resolver antes de aplicar'; 
  END IF;

  FOR v_fila IN SELECT * FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND aprobada AND accion IN ('nueva', 'modificada', 'ausente') ORDER BY accion, nro_fila LOOP
    IF v_tabla = 'list_lineas' THEN
      v_fluido_id := NULL; v_clase_id := NULL; v_nps_id := NULL;
      v_prueba_id := NULL; v_pintura_id := NULL; v_revestimiento_id := NULL; v_aislacion_id := NULL;
      
      -- fluido
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_fluido_id FROM lukeapp.cat_fluido_servicio WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_fluido_id IS NULL THEN RAISE EXCEPTION 'Fila %: fluido "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;
      
      -- clase
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_clase_id FROM lukeapp.cat_clase_piping WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_clase_id IS NULL THEN RAISE EXCEPTION 'Fila %: clase "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- nps (diametros)
      v_cod := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_nps_id FROM lukeapp.cat_diametros_nps WHERE proyecto_id = v_lote.proyecto_id AND upper(nps) = upper(v_cod); 
        IF v_nps_id IS NULL THEN RAISE EXCEPTION 'Fila %: diámetro NPS "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- prueba
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'prueba_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_prueba_id FROM lukeapp.cat_tipo_prueba WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_prueba_id IS NULL THEN RAISE EXCEPTION 'Fila %: tipo de prueba "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- pintura (esquema)
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'pintura_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_pintura_id FROM lukeapp.cat_esquema_pintura WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_pintura_id IS NULL THEN RAISE EXCEPTION 'Fila %: esquema de pintura "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- revestimiento interior
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'revestimiento_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_revestimiento_id FROM lukeapp.cat_revestimiento_int WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_revestimiento_id IS NULL THEN RAISE EXCEPTION 'Fila %: revestimiento interior "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- aislacion exterior
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'aislacion_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_aislacion_id FROM lukeapp.cat_aislacion_ext WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_aislacion_id IS NULL THEN RAISE EXCEPTION 'Fila %: aislación exterior "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_lineas 
          (proyecto_id, id_linea, descripcion, fluido_id, clase_id, nps_id, nps_texto, 
           prueba_id, pintura_id, revestimiento_id, aislacion_id, longitud_total, creado_por) 
        VALUES 
          (v_lote.proyecto_id, trim(v_fila.payload ->> 'id_linea'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
           v_fluido_id, v_clase_id, v_nps_id, NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), 
           v_prueba_id, v_pintura_id, v_revestimiento_id, v_aislacion_id, 
           lukeapp.importar_a_num(v_fila.payload ->> 'longitud_total'), v_uid); 
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_lineas SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          fluido_id = v_fluido_id, 
          clase_id = v_clase_id, 
          nps_id = v_nps_id,
          nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), 
          prueba_id = v_prueba_id,
          pintura_id = v_pintura_id,
          revestimiento_id = v_revestimiento_id,
          aislacion_id = v_aislacion_id,
          longitud_total = lukeapp.importar_a_num(v_fila.payload ->> 'longitud_total'), 
          ausente_en_revision = false, 
          activo = true, 
          actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_fila.clave_natural; 
        n_upd := n_upd + 1;
      ELSE
        UPDATE lukeapp.list_lineas SET ausente_en_revision = true, activo = false, actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_fila.clave_natural; 
        n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'list_mto' THEN
      v_clase_id := NULL; v_linea_id := NULL; v_nps_id := NULL; v_spool_id := NULL;
      
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_clase_id FROM lukeapp.cat_clase_piping WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_clase_id IS NULL THEN RAISE EXCEPTION 'Fila %: clase "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;
      
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_linea_id FROM lukeapp.list_lineas WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_cod; 
        IF v_linea_id IS NULL THEN RAISE EXCEPTION 'Fila %: línea "%" no existe en el proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      v_cod := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_nps_id FROM lukeapp.cat_diametros_nps WHERE proyecto_id = v_lote.proyecto_id AND upper(nps) = upper(v_cod); 
        IF v_nps_id IS NULL THEN RAISE EXCEPTION 'Fila %: NPS "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_spool')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_spool_id FROM lukeapp.list_spools WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool)) = v_cod; 
        IF v_spool_id IS NULL THEN RAISE EXCEPTION 'Fila %: spool "%" no existe en el proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_mto 
          (proyecto_id, linea_id, item, descripcion, tag, cantidad, unidad, nps_id, nps_texto, clase_id, spool_id, material, norma, schedule, heat_number, creado_por) 
        VALUES 
          (v_lote.proyecto_id, v_linea_id, trim(v_fila.payload ->> 'item'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), NULLIF(trim(v_fila.payload ->> 'tag'), ''), 
           lukeapp.importar_a_num(v_fila.payload ->> 'cantidad'), NULLIF(trim(v_fila.payload ->> 'unidad'), ''), v_nps_id, NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), v_clase_id, v_spool_id, 
           NULLIF(trim(v_fila.payload ->> 'material'), ''), NULLIF(trim(v_fila.payload ->> 'norma'), ''), NULLIF(trim(v_fila.payload ->> 'schedule'), ''), NULLIF(trim(v_fila.payload ->> 'heat_number'), ''), v_uid); 
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_mto SET 
          linea_id = v_linea_id, 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          tag = NULLIF(trim(v_fila.payload ->> 'tag'), ''), 
          cantidad = lukeapp.importar_a_num(v_fila.payload ->> 'cantidad'), 
          unidad = NULLIF(trim(v_fila.payload ->> 'unidad'), ''), 
          nps_id = v_nps_id,
          nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), 
          clase_id = v_clase_id, 
          spool_id = v_spool_id,
          material = NULLIF(trim(v_fila.payload ->> 'material'), ''), 
          norma = NULLIF(trim(v_fila.payload ->> 'norma'), ''), 
          schedule = NULLIF(trim(v_fila.payload ->> 'schedule'), ''), 
          heat_number = NULLIF(trim(v_fila.payload ->> 'heat_number'), ''), 
          ausente_en_revision = false, 
          activo = true, 
          actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(item)) = v_fila.clave_natural; 
        n_upd := n_upd + 1;
      ELSE
        UPDATE lukeapp.list_mto SET ausente_en_revision = true, activo = false, actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(item)) = v_fila.clave_natural; 
        n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'list_isos' THEN
      v_linea_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_linea_id FROM lukeapp.list_lineas WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_cod; 
        IF v_linea_id IS NULL THEN RAISE EXCEPTION 'Fila %: línea "%" no existe en el proyecto. Cárgala primero.', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_isos 
          (proyecto_id, linea_id, id_linea, sheet, id_iso, descripcion, revision, estado, pdf_path, creado_por) 
        VALUES 
          (v_lote.proyecto_id, v_linea_id, v_cod, trim(v_fila.payload ->> 'sheet'), 
           v_cod || '-' || trim(v_fila.payload ->> 'sheet'), -- Generado: ID_LINEA + '-' + SHEET
           NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), NULLIF(trim(v_fila.payload ->> 'revision'), ''), 
           NULLIF(trim(v_fila.payload ->> 'estado'), ''), NULLIF(trim(v_fila.payload ->> 'pdf_path'), ''), v_uid); 
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_isos SET 
          linea_id = v_linea_id, 
          id_linea = v_cod,
          sheet = trim(v_fila.payload ->> 'sheet'),
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          revision = NULLIF(trim(v_fila.payload ->> 'revision'), ''), 
          estado = NULLIF(trim(v_fila.payload ->> 'estado'), ''), 
          pdf_path = NULLIF(trim(v_fila.payload ->> 'pdf_path'), ''), 
          ausente_en_revision = false, 
          activo = true, 
          actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_iso)) = v_fila.clave_natural; 
        n_upd := n_upd + 1;
      ELSE
        UPDATE lukeapp.list_isos SET ausente_en_revision = true, activo = false, actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_iso)) = v_fila.clave_natural; 
        n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'list_spools' THEN
      v_iso_id := NULL; v_linea_id := NULL;
      
      -- Resolver iso_id e id_linea
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_iso')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id, linea_id INTO v_iso_id, v_linea_id FROM lukeapp.list_isos WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_iso)) = v_cod; 
        IF v_iso_id IS NULL THEN RAISE EXCEPTION 'Fila %: iso "%" no existe en el proyecto. Cárgalo primero.', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- Verificar id_linea explícito si viene en payload y comparar
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN
        SELECT id INTO v_linea_id FROM lukeapp.list_lineas WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_cod;
        IF v_linea_id IS NULL THEN RAISE EXCEPTION 'Fila %: línea "%" no existe en el proyecto.', v_fila.nro_fila, v_cod; END IF;
      END IF;

      IF v_linea_id IS NULL AND v_fila.accion <> 'ausente' THEN
        RAISE EXCEPTION 'Fila %: No se pudo resolver la línea para el spool.', v_fila.nro_fila;
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_spools 
          (proyecto_id, iso_id, linea_id, id_spool, tag_gestion, peso, longitud, nro_juntas, estado_montaje, sector, creado_por) 
        VALUES 
          (v_lote.proyecto_id, v_iso_id, v_linea_id, trim(v_fila.payload ->> 'id_spool'), NULLIF(trim(v_fila.payload ->> 'tag_gestion'), ''), 
           lukeapp.importar_a_num(v_fila.payload ->> 'peso'), lukeapp.importar_a_num(v_fila.payload ->> 'longitud'), 
           COALESCE(lukeapp.importar_a_num(v_fila.payload ->> 'nro_juntas')::int, 0), NULLIF(trim(v_fila.payload ->> 'estado_montaje'), ''), 
           NULLIF(trim(v_fila.payload ->> 'sector'), ''), v_uid); 
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_spools SET 
          iso_id = v_iso_id, 
          linea_id = v_linea_id, 
          tag_gestion = NULLIF(trim(v_fila.payload ->> 'tag_gestion'), ''), 
          peso = lukeapp.importar_a_num(v_fila.payload ->> 'peso'), 
          longitud = lukeapp.importar_a_num(v_fila.payload ->> 'longitud'), 
          nro_juntas = COALESCE(lukeapp.importar_a_num(v_fila.payload ->> 'nro_juntas')::int, 0), 
          estado_montaje = NULLIF(trim(v_fila.payload ->> 'estado_montaje'), ''), 
          sector = NULLIF(trim(v_fila.payload ->> 'sector'), ''), 
          ausente_en_revision = false, 
          activo = true, 
          actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool)) = v_fila.clave_natural; 
        n_upd := n_upd + 1;
      ELSE
        UPDATE lukeapp.list_spools SET ausente_en_revision = true, activo = false, actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool)) = v_fila.clave_natural; 
        n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'list_juntas' THEN
      v_spool_id := NULL; v_linea_id := NULL; v_tipo_union_id := NULL; v_nps_id := NULL; v_nde_id := NULL;
      
      -- Resolver spool e id_linea del spool
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_spool')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id, linea_id INTO v_spool_id, v_linea_id FROM lukeapp.list_spools WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool)) = v_cod; 
        IF v_spool_id IS NULL THEN RAISE EXCEPTION 'Fila %: spool "%" no existe en el proyecto. Cárgalo primero.', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- Verificar id_linea si viene explícito
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN
        SELECT id INTO v_linea_id FROM lukeapp.list_lineas WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_cod;
        IF v_linea_id IS NULL THEN RAISE EXCEPTION 'Fila %: línea "%" no existe.', v_fila.nro_fila, v_cod; END IF;
      END IF;

      IF v_linea_id IS NULL AND v_fila.accion <> 'ausente' THEN
        RAISE EXCEPTION 'Fila %: No se pudo resolver la línea para la junta.', v_fila.nro_fila;
      END IF;

      -- tipo_union
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'tipo_union')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_tipo_union_id FROM lukeapp.cat_tipo_union WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_tipo_union_id IS NULL THEN RAISE EXCEPTION 'Fila %: tipo_union "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- nps (diámetro)
      v_cod := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_nps_id FROM lukeapp.cat_diametros_nps WHERE proyecto_id = v_lote.proyecto_id AND upper(nps) = upper(v_cod); 
        IF v_nps_id IS NULL THEN RAISE EXCEPTION 'Fila %: diámetro NPS "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod; END IF; 
      END IF;

      -- % NDE (nde_id)
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'porcentaje_nde')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN 
        SELECT id INTO v_nde_id FROM lukeapp.cat_porcentaje_nde WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod; 
        IF v_nde_id IS NULL AND NOT lukeapp.importar_num_valido(v_cod) THEN
          RAISE EXCEPTION 'Fila %: código de porcentaje NDE "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod;
        END IF; 
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_juntas 
          (proyecto_id, spool_id, linea_id, id_spool, numero_junta, tipo_union_id, nps_id, nps_texto, 
           proceso_soldadura, material_base, requiere_pwht, requiere_pmi, porcentaje_nde, nde_id, creado_por) 
        VALUES 
          (v_lote.proyecto_id, v_spool_id, v_linea_id, trim(v_fila.payload ->> 'id_spool'), trim(v_fila.payload ->> 'numero_junta'), 
           v_tipo_union_id, v_nps_id, NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), 
           NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), ''), NULLIF(trim(v_fila.payload ->> 'material_base'), ''), 
           COALESCE((v_fila.payload ->> 'requiere_pwht')::boolean, false), COALESCE((v_fila.payload ->> 'requiere_pmi')::boolean, false), 
           lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje_nde'), v_nde_id, v_uid); 
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_juntas SET 
          spool_id = v_spool_id, 
          linea_id = v_linea_id, 
          tipo_union_id = v_tipo_union_id, 
          nps_id = v_nps_id,
          nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), 
          proceso_soldadura = NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), ''), 
          material_base = NULLIF(trim(v_fila.payload ->> 'material_base'), ''), 
          requiere_pwht = COALESCE((v_fila.payload ->> 'requiere_pwht')::boolean, false), 
          requiere_pmi = COALESCE((v_fila.payload ->> 'requiere_pmi')::boolean, false), 
          porcentaje_nde = lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje_nde'), 
          nde_id = v_nde_id,
          ausente_en_revision = false, 
          activo = true, 
          actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool || '_' || numero_junta)) = v_fila.clave_natural; 
        n_upd := n_upd + 1;
      ELSE
        UPDATE lukeapp.list_juntas SET ausente_en_revision = true, activo = false, actualizado_por = v_uid 
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool || '_' || numero_junta)) = v_fila.clave_natural; 
        n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'cat_fluido_servicio' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_fluido_servicio (proyecto_id, codigo, descripcion, nombre, color_nombre, color_ral, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
                NULLIF(trim(v_fila.payload ->> 'nombre'), ''), NULLIF(trim(v_fila.payload ->> 'color_nombre'), ''),
                NULLIF(trim(v_fila.payload ->> 'color_ral'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_fluido_servicio SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          nombre = NULLIF(trim(v_fila.payload ->> 'nombre'), ''), 
          color_nombre = NULLIF(trim(v_fila.payload ->> 'color_nombre'), ''), 
          color_ral = NULLIF(trim(v_fila.payload ->> 'color_ral'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_clase_piping' THEN
      v_fluido_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      IF v_cod IS NOT NULL THEN
        IF position(',' in v_cod) > 0 THEN
          SELECT id INTO v_fluido_id FROM lukeapp.cat_fluido_servicio
          WHERE proyecto_id = v_lote.proyecto_id
            AND upper(codigo) = ANY(SELECT upper(trim(val)) FROM unnest(string_to_array(v_cod, ',')) AS val)
          LIMIT 1;
        ELSE
          SELECT id INTO v_fluido_id FROM lukeapp.cat_fluido_servicio
          WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod;
        END IF;
        IF v_fluido_id IS NULL THEN
          RAISE EXCEPTION 'Fila %: fluido "%" no existe en el catálogo del proyecto. Regístralo primero.', v_fila.nro_fila, v_cod;
        END IF;
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_clase_piping 
          (proyecto_id, codigo, descripcion, fluido_id, presion_max, temp_max, material, presion_psi, aplicacion, creado_por)
        VALUES 
          (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_fluido_id,
           lukeapp.importar_a_num(v_fila.payload ->> 'presion_max'), lukeapp.importar_a_num(v_fila.payload ->> 'temp_max'),
           NULLIF(trim(v_fila.payload ->> 'material'), ''), lukeapp.importar_a_num(v_fila.payload ->> 'presion_psi'),
           NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_clase_piping SET
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          fluido_id = v_fluido_id,
          presion_max = lukeapp.importar_a_num(v_fila.payload ->> 'presion_max'),
          temp_max = lukeapp.importar_a_num(v_fila.payload ->> 'temp_max'),
          material = NULLIF(trim(v_fila.payload ->> 'material'), ''), 
          presion_psi = lukeapp.importar_a_num(v_fila.payload ->> 'presion_psi'), 
          aplicacion = NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_diametros_nps' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_diametros_nps (proyecto_id, nps, nps_mm, tipo_material, unidad_medida, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'nps'), lukeapp.importar_a_num(v_fila.payload ->> 'nps_mm'),
                NULLIF(trim(v_fila.payload ->> 'tipo_material'), ''), NULLIF(trim(v_fila.payload ->> 'unidad_medida'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_diametros_nps SET 
          nps_mm = lukeapp.importar_a_num(v_fila.payload ->> 'nps_mm'), 
          tipo_material = NULLIF(trim(v_fila.payload ->> 'tipo_material'), ''), 
          unidad_medida = NULLIF(trim(v_fila.payload ->> 'unidad_medida'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(nps)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_esquema_pintura' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_esquema_pintura 
          (proyecto_id, codigo, descripcion, capas, sistema_aplicacion, preparacion_superficie, espesor_total_um, detalle_capas, creado_por)
        VALUES 
          (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
           (lukeapp.importar_a_num(v_fila.payload ->> 'capas'))::int, NULLIF(trim(v_fila.payload ->> 'sistema_aplicacion'), ''),
           NULLIF(trim(v_fila.payload ->> 'preparacion_superficie'), ''), lukeapp.importar_a_num(v_fila.payload ->> 'espesor_total_um'),
           NULLIF(trim(v_fila.payload ->> 'detalle_capas'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_esquema_pintura SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          capas = (lukeapp.importar_a_num(v_fila.payload ->> 'capas'))::int, 
          sistema_aplicacion = NULLIF(trim(v_fila.payload ->> 'sistema_aplicacion'), ''), 
          preparacion_superficie = NULLIF(trim(v_fila.payload ->> 'preparacion_superficie'), ''), 
          espesor_total_um = lukeapp.importar_a_num(v_fila.payload ->> 'espesor_total_um'), 
          detalle_capas = NULLIF(trim(v_fila.payload ->> 'detalle_capas'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_aislacion_ext' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_aislacion_ext (proyecto_id, codigo, descripcion, restriccion_pintura, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
                NULLIF(trim(v_fila.payload ->> 'restriccion_pintura'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_aislacion_ext SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          restriccion_pintura = NULLIF(trim(v_fila.payload ->> 'restriccion_pintura'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_porcentaje_nde' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_porcentaje_nde (proyecto_id, codigo, porcentaje, descripcion, metodo, aplicacion, norma, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje'), 
                NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), NULLIF(trim(v_fila.payload ->> 'metodo'), ''),
                NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), NULLIF(trim(v_fila.payload ->> 'norma'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_porcentaje_nde SET 
          porcentaje = lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje'), 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          metodo = NULLIF(trim(v_fila.payload ->> 'metodo'), ''), 
          aplicacion = NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), 
          norma = NULLIF(trim(v_fila.payload ->> 'norma'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_tipo_prueba' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_tipo_prueba (proyecto_id, codigo, descripcion, aplicacion, condicion_diseno, medio_fluido, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
                NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), NULLIF(trim(v_fila.payload ->> 'condicion_diseno'), ''),
                NULLIF(trim(v_fila.payload ->> 'medio_fluido'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_tipo_prueba SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          aplicacion = NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), 
          condicion_diseno = NULLIF(trim(v_fila.payload ->> 'condicion_diseno'), ''), 
          medio_fluido = NULLIF(trim(v_fila.payload ->> 'medio_fluido'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_tipo_union' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_tipo_union (proyecto_id, codigo, descripcion, acronimo, tipo_uniones, metodo_trabajo, nde_requerido, aplicacion, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
                NULLIF(trim(v_fila.payload ->> 'acronimo'), ''), NULLIF(trim(v_fila.payload ->> 'tipo_uniones'), ''),
                NULLIF(trim(v_fila.payload ->> 'metodo_trabajo'), ''), NULLIF(trim(v_fila.payload ->> 'nde_requerido'), ''),
                NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_tipo_union SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          acronimo = NULLIF(trim(v_fila.payload ->> 'acronimo'), ''), 
          tipo_uniones = NULLIF(trim(v_fila.payload ->> 'tipo_uniones'), ''), 
          metodo_trabajo = NULLIF(trim(v_fila.payload ->> 'metodo_trabajo'), ''), 
          nde_requerido = NULLIF(trim(v_fila.payload ->> 'nde_requerido'), ''), 
          aplicacion = NULLIF(trim(v_fila.payload ->> 'aplicacion'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_revestimiento_int' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_revestimiento_int (proyecto_id, codigo, descripcion, especificacion, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
                NULLIF(trim(v_fila.payload ->> 'especificacion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_revestimiento_int SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          especificacion = NULLIF(trim(v_fila.payload ->> 'especificacion'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_personal' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_personal (proyecto_id, rut, nombre, estampa, cargo, area, supervisor, estado, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'rut'), trim(v_fila.payload ->> 'nombre'), trim(v_fila.payload ->> 'estampa'),
                NULLIF(trim(v_fila.payload ->> 'cargo'), ''), NULLIF(trim(v_fila.payload ->> 'area'), ''),
                NULLIF(trim(v_fila.payload ->> 'supervisor'), ''), NULLIF(trim(v_fila.payload ->> 'estado'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_personal SET 
          nombre = trim(v_fila.payload ->> 'nombre'), 
          estampa = trim(v_fila.payload ->> 'estampa'),
          cargo = NULLIF(trim(v_fila.payload ->> 'cargo'), ''), 
          area = NULLIF(trim(v_fila.payload ->> 'area'), ''), 
          supervisor = NULLIF(trim(v_fila.payload ->> 'supervisor'), ''), 
          estado = NULLIF(trim(v_fila.payload ->> 'estado'), ''), 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(rut) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_iwp' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_iwp (proyecto_id, codigo, descripcion, fecha_inicio, fecha_fin, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
                NULLIF(trim(v_fila.payload ->> 'fecha_inicio'), '')::date, NULLIF(trim(v_fila.payload ->> 'fecha_fin'), '')::date, v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_iwp SET 
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), 
          fecha_inicio = NULLIF(trim(v_fila.payload ->> 'fecha_inicio'), '')::date, 
          fecha_fin = NULLIF(trim(v_fila.payload ->> 'fecha_fin'), '')::date, 
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    END IF;
  END LOOP;

  v_resumen := COALESCE(v_lote.resumen, '{}'::jsonb) || jsonb_build_object('aplicadas_nuevas', n_ins, 'aplicadas_modificadas', n_upd, 'marcadas_ausentes', n_aus, 'aplicado_en', now(), 'aplicado_por', v_uid);
  UPDATE lukeapp.import_lotes SET estado = 'aplicado', resumen = v_resumen, actualizado_por = v_uid WHERE id = p_lote_id;
  RETURN v_resumen;
END;
$$;

GRANT EXECUTE ON FUNCTION lukeapp.importar_aplicar_lote(UUID) TO authenticated, service_role;

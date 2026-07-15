-- ─── Redefinir importar_calcular_diff con soporte completo para catálogos IA ───
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
  v_cod TEXT; v_presion TEXT; v_temp TEXT;
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

      SELECT m.id, m.descripcion, m.cantidad, m.unidad, m.nps_texto, m.ausente_en_revision INTO v_act
      FROM lukeapp.list_mto m WHERE m.proyecto_id = v_lote.proyecto_id AND upper(trim(m.item)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'cantidad', v_act.cantidad::text, lukeapp.importar_a_num(v_num)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'unidad', v_act.unidad, v_unidad);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_texto', v_act.nps_texto, v_nps);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_isos' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      v_rev := NULLIF(trim(v_fila.payload ->> 'revision'), '');
      v_pdf := NULLIF(trim(v_fila.payload ->> 'pdf_path'), '');

      SELECT i.id, i.descripcion, upper(l.id_linea) AS linea_codigo, i.revision, i.pdf_path, i.ausente_en_revision INTO v_act
      FROM lukeapp.list_isos i LEFT JOIN lukeapp.list_lineas l ON l.id = i.linea_id
      WHERE i.proyecto_id = v_lote.proyecto_id AND upper(trim(i.id_iso)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea', v_act.linea_codigo, v_linea_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'revision', v_act.revision, v_rev);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'pdf_path', v_act.pdf_path, v_pdf);
        IF v_act.ausente_en_revision THEN v_diff := v_diff || jsonb_build_object('ausente_en_revision', jsonb_build_object('antes', 'true', 'despues', 'false')); END IF;
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'list_spools' THEN
      v_num := v_fila.payload ->> 'peso_kilogramos';
      IF v_num IS NOT NULL AND NOT lukeapp.importar_num_valido(v_num) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false, error_detalle = 'peso_kilogramos no es numérico' WHERE id = v_fila.id; CONTINUE;
      END IF;

      v_iso_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_iso')), '');
      v_tag := NULLIF(trim(v_fila.payload ->> 'tag_gestion'), '');
      v_estado := NULLIF(trim(v_fila.payload ->> 'estado_montaje'), '');

      SELECT s.id, upper(i.id_iso) AS iso_codigo, s.tag_gestion, s.peso_kilogramos, s.estado_montaje, s.ausente_en_revision INTO v_act
      FROM lukeapp.list_spools s LEFT JOIN lukeapp.list_isos i ON i.id = s.iso_id
      WHERE s.proyecto_id = v_lote.proyecto_id AND upper(trim(s.id_spool)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_iso', v_act.iso_codigo, v_iso_ref);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tag_gestion', v_act.tag_gestion, v_tag);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'peso_kilogramos', v_act.peso_kilogramos::text, lukeapp.importar_a_num(v_num)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'estado_montaje', v_act.estado_montaje, v_estado);
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

    ELSIF v_tabla = 'cat_fluido_servicio' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      SELECT id, descripcion INTO v_act FROM lukeapp.cat_fluido_servicio
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_clase_piping' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_fluido := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      v_presion := NULLIF(trim(v_fila.payload ->> 'presion_max'), '');
      v_temp := NULLIF(trim(v_fila.payload ->> 'temp_max'), '');

      SELECT cp.id, cp.descripcion, upper(f.codigo) AS fluido_codigo, cp.presion_max, cp.temp_max INTO v_act
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

-- ─── Extender la extracción IA de catálogos a 6 tablas nuevas ───
-- Hasta ahora el pipeline de extracción IA (import_perfiles/import_lotes/import_filas)
-- solo soportaba cat_fluido_servicio y cat_clase_piping. Esta migración agrega:
--   cat_diametros_nps (clave natural: nps, no codigo), cat_esquema_pintura,
--   cat_aislacion_ext, cat_porcentaje_nde, cat_tipo_prueba, cat_tipo_union.
-- De paso se corrige una regresión real: importar_aplicar_lote perdió las ramas
-- de cat_fluido_servicio/cat_clase_piping desde la migración 20260713_010 (las
-- tenía 20260713_007) y nunca se recuperaron, pese a que importar_calcular_diff
-- sí las tiene (20260715_020). Hoy nadie invoca importar_aplicar_lote sobre un
-- lote de catálogo (el frontend aprueba con INSERT directo por fila), pero se
-- corrige aquí ya que se están tocando las mismas funciones.

-- ─── 1. importar_crear_lote_ia: whitelist ampliada + clave natural por tabla ───
CREATE OR REPLACE FUNCTION lukeapp.importar_crear_lote_ia(
  p_proyecto_id     UUID,
  p_tabla_destino   TEXT,
  p_documento_id    UUID,
  p_filas           JSONB   -- array de { payload: {...}, fuente: {...}, confianza: number }
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_perfil_id  UUID;
  v_lote_id    UUID;
  v_campo_clave TEXT;
  v_doc        RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Se requiere un usuario autenticado';
  END IF;
  IF NOT lukeapp.importar_es_editor(p_proyecto_id) THEN
    RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto para importar';
  END IF;
  IF p_tabla_destino NOT IN (
    'cat_fluido_servicio', 'cat_clase_piping', 'cat_diametros_nps', 'cat_esquema_pintura',
    'cat_aislacion_ext', 'cat_porcentaje_nde', 'cat_tipo_prueba', 'cat_tipo_union'
  ) THEN
    RAISE EXCEPTION 'Tabla destino no soportada para extracción IA: %', p_tabla_destino;
  END IF;
  IF p_filas IS NULL OR jsonb_typeof(p_filas) <> 'array' OR jsonb_array_length(p_filas) = 0 THEN
    RAISE EXCEPTION 'El lote no contiene filas';
  END IF;

  SELECT * INTO v_doc FROM lukeapp.doc_biblioteca
  WHERE id = p_documento_id AND proyecto_id = p_proyecto_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento % no existe en el proyecto', p_documento_id;
  END IF;

  v_campo_clave := CASE WHEN p_tabla_destino = 'cat_diametros_nps' THEN 'nps' ELSE 'codigo' END;

  SELECT id INTO v_perfil_id FROM lukeapp.import_perfiles
  WHERE proyecto_id = p_proyecto_id AND tabla_destino = p_tabla_destino AND activo
  ORDER BY creado_en DESC LIMIT 1;

  IF v_perfil_id IS NULL THEN
    INSERT INTO lukeapp.import_perfiles (proyecto_id, nombre, tabla_destino, mapeo, creado_por)
    VALUES (p_proyecto_id, 'Extracción IA — ' || p_tabla_destino, p_tabla_destino, '{}'::jsonb, v_uid)
    RETURNING id INTO v_perfil_id;
  END IF;

  INSERT INTO lukeapp.import_lotes
    (proyecto_id, perfil_id, estado, origen, documento_id, creado_por, resumen)
  VALUES
    (p_proyecto_id, v_perfil_id, 'cargado', 'extraccion_ia', p_documento_id, v_uid,
     jsonb_build_object('documento', v_doc.titulo, 'n_filas_archivo', jsonb_array_length(p_filas)))
  RETURNING id INTO v_lote_id;

  INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, fuente, confianza)
  SELECT v_lote_id, t.ord::int, t.value -> 'payload',
         NULLIF(upper(trim((t.value -> 'payload') ->> v_campo_clave)), ''),
         t.value -> 'fuente',
         NULLIF(t.value ->> 'confianza', '')::numeric
  FROM jsonb_array_elements(p_filas) WITH ORDINALITY AS t(value, ord);

  PERFORM lukeapp.importar_calcular_diff(v_lote_id);

  UPDATE lukeapp.doc_biblioteca SET lote_ia_id = v_lote_id, actualizado_por = v_uid
  WHERE id = p_documento_id;

  RETURN v_lote_id;
END;
$$;

-- ─── 2. importar_calcular_diff: agrega ramas para los 6 catálogos nuevos ───
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
  v_capas TEXT; v_porcentaje TEXT;
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

    ELSIF v_tabla = 'cat_diametros_nps' THEN
      v_num := v_fila.payload ->> 'nps_mm';
      SELECT id, nps_mm INTO v_act FROM lukeapp.cat_diametros_nps
      WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(nps)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_mm', v_act.nps_mm::text, v_num);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_esquema_pintura' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_capas := v_fila.payload ->> 'capas';
      SELECT id, descripcion, capas INTO v_act FROM lukeapp.cat_esquema_pintura
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'capas', v_act.capas::text, v_capas);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_aislacion_ext' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      SELECT id, descripcion INTO v_act FROM lukeapp.cat_aislacion_ext
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_porcentaje_nde' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_porcentaje := v_fila.payload ->> 'porcentaje';
      SELECT id, descripcion, porcentaje INTO v_act FROM lukeapp.cat_porcentaje_nde
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'porcentaje', v_act.porcentaje::text, v_porcentaje);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_tipo_prueba' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      SELECT id, descripcion INTO v_act FROM lukeapp.cat_tipo_prueba
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        IF v_diff = '{}'::jsonb THEN UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL WHERE id = v_fila.id;
        ELSE UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff WHERE id = v_fila.id; END IF;
      END IF;

    ELSIF v_tabla = 'cat_tipo_union' THEN
      v_desc := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      SELECT id, descripcion INTO v_act FROM lukeapp.cat_tipo_union
      WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
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

-- ─── 3. importar_aplicar_lote: restaura ramas cat_fluido/clase + agrega las 6 nuevas ───
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
        INSERT INTO lukeapp.list_juntas (proyecto_id, spool_id, linea_id, id_spool, numero_junta, tipo_union_id, nps_texto, proceso_soldadura, material_base, requiere_pwht, requiere_pmi, porcentaje_nde, creado_por) VALUES (v_lote.proyecto_id, v_spool_id, v_linea_id, trim(v_fila.payload ->> 'id_spool'), trim(v_fila.payload ->> 'numero_junta'), v_tipo_union_id, NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), ''), NULLIF(trim(v_fila.payload ->> 'material_base'), ''), COALESCE((v_fila.payload ->> 'requiere_pwht')::boolean, false), COALESCE((v_fila.payload ->> 'requiere_pmi')::boolean, false), lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje_nde'), v_uid); n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_juntas SET spool_id = v_spool_id, linea_id = v_linea_id, tipo_union_id = v_tipo_union_id, nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''), proceso_soldadura = NULLIF(trim(v_fila.payload ->> 'proceso_soldadura'), ''), material_base = NULLIF(trim(v_fila.payload ->> 'material_base'), ''), requiere_pwht = COALESCE((v_fila.payload ->> 'requiere_pwht')::boolean, false), requiere_pmi = COALESCE((v_fila.payload ->> 'requiere_pmi')::boolean, false), porcentaje_nde = lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje_nde'), ausente_en_revision = false, activo = true, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool || '_' || numero_junta)) = v_fila.clave_natural; n_upd := n_upd + 1;
      ELSE
        -- Soft Delete
        UPDATE lukeapp.list_juntas SET ausente_en_revision = true, activo = false, actualizado_por = v_uid WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_spool || '_' || numero_junta)) = v_fila.clave_natural; n_aus := n_aus + 1;
      END IF;

    ELSIF v_tabla = 'cat_fluido_servicio' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_fluido_servicio (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_fluido_servicio SET descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), activo = true, actualizado_por = v_uid
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
          IF v_fluido_id IS NULL THEN
            RAISE EXCEPTION 'Fila %: ninguno de los fluidos (%) existe en el catálogo del proyecto. Debes registrarlos primero.', v_fila.nro_fila, v_cod;
          END IF;
        ELSE
          SELECT id INTO v_fluido_id FROM lukeapp.cat_fluido_servicio
          WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod;
          IF v_fluido_id IS NULL THEN
            RAISE EXCEPTION 'Fila %: fluido "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod;
          END IF;
        END IF;
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_clase_piping (proyecto_id, codigo, descripcion, fluido_id, presion_max, temp_max, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_fluido_id,
                lukeapp.importar_a_num(v_fila.payload ->> 'presion_max'), lukeapp.importar_a_num(v_fila.payload ->> 'temp_max'), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_clase_piping SET
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), fluido_id = v_fluido_id,
          presion_max = lukeapp.importar_a_num(v_fila.payload ->> 'presion_max'),
          temp_max = lukeapp.importar_a_num(v_fila.payload ->> 'temp_max'),
          activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_diametros_nps' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_diametros_nps (proyecto_id, nps, nps_mm, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'nps'), lukeapp.importar_a_num(v_fila.payload ->> 'nps_mm'), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_diametros_nps SET nps_mm = lukeapp.importar_a_num(v_fila.payload ->> 'nps_mm'), activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(nps)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_esquema_pintura' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_esquema_pintura (proyecto_id, codigo, descripcion, capas, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), (lukeapp.importar_a_num(v_fila.payload ->> 'capas'))::int, v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_esquema_pintura SET descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), capas = (lukeapp.importar_a_num(v_fila.payload ->> 'capas'))::int, activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_aislacion_ext' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_aislacion_ext (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_aislacion_ext SET descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_porcentaje_nde' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_porcentaje_nde (proyecto_id, codigo, porcentaje, descripcion, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_porcentaje_nde SET porcentaje = lukeapp.importar_a_num(v_fila.payload ->> 'porcentaje'), descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_tipo_prueba' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_tipo_prueba (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_tipo_prueba SET descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    ELSIF v_tabla = 'cat_tipo_union' THEN
      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.cat_tipo_union (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_lote.proyecto_id, trim(v_fila.payload ->> 'codigo'), NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.cat_tipo_union SET descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(codigo)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      END IF;

    END IF;
  END LOOP;

  v_resumen := COALESCE(v_lote.resumen, '{}'::jsonb) || jsonb_build_object('aplicadas_nuevas', n_ins, 'aplicadas_modificadas', n_upd, 'marcadas_ausentes', n_aus, 'aplicado_en', now(), 'aplicado_por', v_uid);
  UPDATE lukeapp.import_lotes SET estado = 'aplicado', resumen = v_resumen, actualizado_por = v_uid WHERE id = p_lote_id;
  RETURN v_resumen;
END;
$$;

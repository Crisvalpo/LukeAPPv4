-- ============================================================
-- LukeAPP v4 — Migración 005: Wizard de Creación de Proyecto
-- Schema: lukeapp
-- Aplica sobre: Supabase self-hosted (lukeserver)
-- Rev. B — Julio 2026
--
-- Contenido:
--   1. Función lukeapp.crear_proyecto_wizard: crea proyecto +
--      config + membresía ADMIN del creador + permisos_rol
--      plantilla + instancia catálogos desde plantillas_catalogo
--      de la industria. Transaccional (todo o nada).
--   2. Vista lukeapp.v_cartera_kpis (security_invoker): cartera
--      con KPIs básicos para el dashboard, respetando RLS.
-- ============================================================

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
  v_clases_pwht TEXT[] := '{}';
  v_usa_pmi     BOOLEAN := false;
BEGIN
  -- El creador es siempre el usuario autenticado; p_creador_id solo
  -- se usa en contextos sin JWT (tests/ops directos sobre la BD).
  v_creador := COALESCE(auth.uid(), p_creador_id);
  IF v_creador IS NULL THEN
    RAISE EXCEPTION 'crear_proyecto_wizard requiere un usuario autenticado';
  END IF;

  -- 1. Proyecto
  INSERT INTO lukeapp.proyectos (codigo, nombre, mandante_id, industria, estado, creado_por)
  VALUES (upper(trim(p_codigo)), trim(p_nombre), p_mandante_id, p_industria, 'activo', v_creador)
  RETURNING id INTO v_proyecto_id;

  -- 2. Instanciar catálogos desde plantillas_catalogo de la industria
  FOR v_plantilla IN
    SELECT tabla, payload FROM lukeapp.plantillas_catalogo
    WHERE industria = p_industria AND activo = true
  LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_plantilla.payload)
    LOOP
      IF v_plantilla.tabla = 'cat_fluido_servicio' THEN
        INSERT INTO lukeapp.cat_fluido_servicio (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_proyecto_id, v_item->>'codigo', v_item->>'descripcion', v_creador)
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_clase_piping' THEN
        INSERT INTO lukeapp.cat_clase_piping (proyecto_id, codigo, descripcion, presion_max, temp_max, creado_por)
        VALUES (
          v_proyecto_id,
          v_item->>'codigo',
          v_item->>'descripcion',
          (v_item->>'presion_max')::numeric,
          (v_item->>'temp_max')::numeric,
          v_creador
        )
        ON CONFLICT DO NOTHING;
        -- Los flags PWHT/PMI de la plantilla alimentan proyecto_config (paso 3)
        IF COALESCE((v_item->>'usa_pwht')::boolean, false) THEN
          v_clases_pwht := v_clases_pwht || (v_item->>'codigo');
        END IF;
        IF COALESCE((v_item->>'usa_pmi')::boolean, false) THEN
          v_usa_pmi := true;
        END IF;

      ELSIF v_plantilla.tabla = 'cat_diametros_nps' THEN
        INSERT INTO lukeapp.cat_diametros_nps (proyecto_id, nps, nps_mm, creado_por)
        VALUES (v_proyecto_id, v_item->>'nps', (v_item->>'nps_mm')::numeric, v_creador)
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_aislacion_ext' THEN
        INSERT INTO lukeapp.cat_aislacion_ext (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_proyecto_id, v_item->>'codigo', v_item->>'descripcion', v_creador)
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_esquema_pintura' THEN
        INSERT INTO lukeapp.cat_esquema_pintura (proyecto_id, codigo, descripcion, capas, creado_por)
        VALUES (v_proyecto_id, v_item->>'codigo', v_item->>'descripcion', (v_item->>'capas')::integer, v_creador)
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_porcentaje_nde' THEN
        INSERT INTO lukeapp.cat_porcentaje_nde (proyecto_id, codigo, porcentaje, descripcion, creado_por)
        VALUES (
          v_proyecto_id,
          v_item->>'codigo',
          COALESCE((v_item->>'porcentaje')::numeric, 100.0),
          v_item->>'descripcion',
          v_creador
        )
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_revestimiento_int' THEN
        INSERT INTO lukeapp.cat_revestimiento_int (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_proyecto_id, v_item->>'codigo', v_item->>'descripcion', v_creador)
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_tipo_prueba' THEN
        INSERT INTO lukeapp.cat_tipo_prueba (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_proyecto_id, v_item->>'codigo', v_item->>'descripcion', v_creador)
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_tipo_soporte' THEN
        INSERT INTO lukeapp.cat_tipo_soporte (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_proyecto_id, v_item->>'codigo', v_item->>'descripcion', v_creador)
        ON CONFLICT DO NOTHING;

      ELSIF v_plantilla.tabla = 'cat_tipo_union' THEN
        INSERT INTO lukeapp.cat_tipo_union (proyecto_id, codigo, descripcion, creado_por)
        VALUES (v_proyecto_id, v_item->>'codigo', v_item->>'descripcion', v_creador)
        ON CONFLICT DO NOTHING;

      END IF;
    END LOOP;
  END LOOP;

  -- 3. Config del proyecto (flags derivados de las clases de la industria)
  INSERT INTO lukeapp.proyecto_config (proyecto_id, usa_pwht, clases_con_pwht, usa_pmi, creado_por)
  VALUES (v_proyecto_id, cardinality(v_clases_pwht) > 0, v_clases_pwht, v_usa_pmi, v_creador);

  -- 4. Membresía del creador como ADMIN
  INSERT INTO lukeapp.membresias (usuario_id, proyecto_id, rol, activo, creado_por)
  VALUES (v_creador, v_proyecto_id, 'ADMIN', true, v_creador);

  -- 5. Permisos de rol plantilla
  INSERT INTO lukeapp.permisos_rol (proyecto_id, rol, tabla, puede_agregar, puede_actualizar, puede_eliminar, creado_por)
  VALUES
    -- ADMIN
    (v_proyecto_id, 'ADMIN', 'list_lineas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_isos', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_spools', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_juntas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_mto', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_soportes', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'list_valvulas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'reg_ejecucion_juntas', true, true, true, v_creador),
    (v_proyecto_id, 'ADMIN', 'reg_inspeccion_visual', true, true, true, v_creador),
    -- OT
    (v_proyecto_id, 'OT', 'list_lineas', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_isos', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_spools', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_juntas', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_mto', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_soportes', true, true, false, v_creador),
    (v_proyecto_id, 'OT', 'list_valvulas', true, true, false, v_creador),
    -- QAQC
    (v_proyecto_id, 'QAQC', 'reg_inspeccion_visual', true, true, false, v_creador),
    (v_proyecto_id, 'QAQC', 'reg_dimensional_spool', true, true, false, v_creador),
    (v_proyecto_id, 'QAQC', 'reg_pintura_spool', true, true, false, v_creador),
    -- SUPERVISOR
    (v_proyecto_id, 'SUPERVISOR', 'reg_ejecucion_juntas', true, true, false, v_creador),
    (v_proyecto_id, 'SUPERVISOR', 'reg_montaje_valvulas', true, true, false, v_creador),
    (v_proyecto_id, 'SUPERVISOR', 'reg_montaje_soportes', true, true, false, v_creador);

  RETURN v_proyecto_id;
END;
$$;

-- Solo usuarios autenticados pueden ejecutar el wizard
REVOKE ALL ON FUNCTION lukeapp.crear_proyecto_wizard(TEXT, TEXT, UUID, lukeapp.industria_tipo, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lukeapp.crear_proyecto_wizard(TEXT, TEXT, UUID, lukeapp.industria_tipo, UUID) TO authenticated, service_role;

-- ============================================================
-- Vista de cartera con KPIs básicos (dashboard P2).
-- security_invoker => la RLS de proyectos/empresas filtra por
-- membresía del usuario que consulta (o acceso_global GERENCIA).
-- ============================================================
CREATE OR REPLACE VIEW lukeapp.v_cartera_kpis
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.codigo,
  p.nombre,
  p.industria,
  p.estado,
  p.fecha_inicio,
  e.nombre AS mandante,
  (SELECT count(*) FROM lukeapp.list_lineas t WHERE t.proyecto_id = p.id)  AS n_lineas,
  (SELECT count(*) FROM lukeapp.list_isos t WHERE t.proyecto_id = p.id)    AS n_isos,
  (SELECT count(*) FROM lukeapp.list_spools t WHERE t.proyecto_id = p.id)  AS n_spools,
  (SELECT count(*) FROM lukeapp.list_juntas t WHERE t.proyecto_id = p.id)  AS n_juntas,
  (SELECT count(*) FROM lukeapp.list_mto t WHERE t.proyecto_id = p.id)     AS n_mto,
  (SELECT count(*) FROM lukeapp.reg_ejecucion_juntas t WHERE t.proyecto_id = p.id) AS n_juntas_ejecutadas
FROM lukeapp.proyectos p
LEFT JOIN lukeapp.empresas e ON e.id = p.mandante_id;

GRANT SELECT ON lukeapp.v_cartera_kpis TO authenticated;

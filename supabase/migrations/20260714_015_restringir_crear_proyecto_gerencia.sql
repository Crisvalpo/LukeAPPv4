-- ============================================================
-- LukeAPP v4 — Migración 015: Restringir creación de proyectos a GERENCIA
-- Schema: lukeapp
-- Depende de: 20260713_001_nucleo.sql, 20260713_005_wizard_proyecto.sql
--
-- crear_proyecto_wizard() era SECURITY DEFINER sin ningún chequeo de
-- rol (solo exigía auth.uid() IS NOT NULL), así que cualquier usuario
-- autenticado -- incluyendo un ADMIN de un solo proyecto o un rol OT --
-- podía crear proyectos nuevos y auto-asignarse ADMIN sobre ellos.
-- La política proyectos_insert tenía el mismo problema (defensa en
-- profundidad, aunque la RPC SECURITY DEFINER ya la esquivaba).
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

  -- Solo GERENCIA (acceso_global) puede crear proyectos nuevos.
  IF NOT EXISTS (
    SELECT 1 FROM lukeapp.usuarios u
    WHERE u.id = v_creador AND u.acceso_global = true
  ) THEN
    RAISE EXCEPTION 'Solo usuarios GERENCIA pueden crear proyectos nuevos';
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

  RETURN v_proyecto_id;
END;
$$;

-- Cierra el hueco de RLS como defensa adicional (la RPC ya es la
-- barrera real, pero un futuro insert directo debe quedar bloqueado).
DROP POLICY IF EXISTS "proyectos_insert" ON lukeapp.proyectos;
CREATE POLICY "proyectos_insert" ON lukeapp.proyectos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM lukeapp.usuarios u WHERE u.id = auth.uid() AND u.acceso_global = true)
  );

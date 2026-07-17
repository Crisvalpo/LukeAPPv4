-- ============================================================
-- LukeAPP v4 — Migración 027: Wizard de Creación 100% Limpio (Sin sembrado NPS)
-- Schema: lukeapp
-- Depende de: 20260715_021_wizard_inicio_limpio_total.sql
-- Rev. A — Julio 2026
-- ============================================================

CREATE OR REPLACE FUNCTION lukeapp.crear_proyecto_wizard(
  p_codigo       TEXT,
  p_nombre       TEXT,
  p_mandante_id  UUID,
  p_industria    TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_creador      UUID := auth.uid();
  v_proyecto_id  UUID;
  v_es_gerente   BOOLEAN;
BEGIN
  -- Validar que el creador tenga acceso_global = true (rol GERENCIA)
  SELECT acceso_global INTO v_es_gerente FROM lukeapp.usuarios WHERE id = v_creador;
  IF COALESCE(v_es_gerente, false) = false THEN
    RAISE EXCEPTION 'Solo usuarios GERENCIA pueden crear proyectos nuevos';
  END IF;

  -- 1. Crear Proyecto
  INSERT INTO lukeapp.proyectos (codigo, nombre, mandante_id, industria, estado, creado_por)
  VALUES (upper(trim(p_codigo)), trim(p_nombre), p_mandante_id, p_industria::lukeapp.industria_tipo, 'activo', v_creador)
  RETURNING id INTO v_proyecto_id;

  -- 2. Configuración inicial del proyecto (vaciado limpio por defecto, se define en construcción)
  INSERT INTO lukeapp.proyecto_config (proyecto_id, usa_pwht, clases_con_pwht, usa_pmi, creado_por)
  VALUES (v_proyecto_id, false, '{}'::text[], false, v_creador);

  -- 3. Membresía del creador como ADMIN
  INSERT INTO lukeapp.membresias (usuario_id, proyecto_id, rol, activo, creado_por)
  VALUES (v_creador, v_proyecto_id, 'ADMIN', true, v_creador);

  -- 4. Permisos de rol plantilla
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

GRANT EXECUTE ON FUNCTION lukeapp.crear_proyecto_wizard(TEXT, TEXT, UUID, TEXT) TO authenticated, service_role;

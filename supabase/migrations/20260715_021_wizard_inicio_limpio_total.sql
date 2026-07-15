-- ─── Redefinir crear_proyecto_wizard para Inicio Limpio Total de Catálogos (Excepto NPS) ───
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
  v_plantilla    RECORD;
  v_item         RECORD;
  v_es_gerente   BOOLEAN;
BEGIN
  -- Validar que el creador tenga acceso_global = true (rol GERENCIA)
  SELECT acceso_global INTO v_es_gerente FROM lukeapp.usuarios WHERE id = v_creador;
  IF COALESCE(v_es_gerente, false) = false THEN
    RAISE EXCEPTION 'Solo usuarios GERENCIA pueden crear proyectos nuevos';
  END IF;

  -- 1. Crear Proyecto
  INSERT INTO lukeapp.proyectos (codigo, nombre, mandante_id, industria, estado, creado_por)
  VALUES (upper(trim(p_codigo)), trim(p_nombre), p_mandante_id, p_industria, 'activo', v_creador)
  RETURNING id INTO v_proyecto_id;

  -- 2. Instanciar únicamente diámetros NPS normalizados (geometría universal estándar)
  FOR v_plantilla IN
    SELECT tabla, payload FROM lukeapp.plantillas_catalogo
    WHERE industria = p_industria AND activo = true AND tabla = 'cat_diametros_nps'
  LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_plantilla.payload)
    LOOP
      INSERT INTO lukeapp.cat_diametros_nps (proyecto_id, nps, nps_mm, creado_por)
      VALUES (v_proyecto_id, v_item->>'nps', (v_item->>'nps_mm')::numeric, v_creador)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 3. Configuración inicial del proyecto (vaciado limpio por defecto, se define en construcción)
  INSERT INTO lukeapp.proyecto_config (proyecto_id, usa_pwht, clases_con_pwht, usa_pmi, creado_por)
  VALUES (v_proyecto_id, false, '{}'::text[], false, v_creador);

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

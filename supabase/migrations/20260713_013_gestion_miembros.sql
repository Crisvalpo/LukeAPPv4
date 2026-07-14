-- ============================================================
-- LukeAPP v4 — Migración 013: Gestión de Miembros y Roles
-- Schema: lukeapp
-- Depende de: 20260713_009_auth_registro_aprobacion.sql
-- ============================================================

-- ─── 1. RPC: Agregar miembro a un proyecto ────────────────────
CREATE OR REPLACE FUNCTION lukeapp.agregar_miembro(
  p_usuario_id UUID,
  p_proyecto_id UUID,
  p_rol lukeapp.rol_usuario
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar autorización (debe ser ADMIN de este proyecto o GERENCIA/acceso_global)
  IF NOT lukeapp.puede_administrar_accesos(p_proyecto_id) THEN
    RAISE EXCEPTION 'No autorizado para administrar accesos en este proyecto';
  END IF;

  -- Insertar o reactivar membresía
  INSERT INTO lukeapp.membresias (usuario_id, proyecto_id, rol, activo, creado_por, creado_en)
  VALUES (p_usuario_id, p_proyecto_id, p_rol, true, auth.uid(), now())
  ON CONFLICT (usuario_id, proyecto_id)
  DO UPDATE SET
    rol = EXCLUDED.rol,
    activo = true,
    actualizado_por = auth.uid(),
    actualizado_en = now();
END;
$$;

COMMENT ON FUNCTION lukeapp.agregar_miembro(UUID, UUID, lukeapp.rol_usuario) IS
  'Agrega o reactiva un miembro en un proyecto específico con un rol determinado.';

-- ─── 2. RPC: Actualizar membresía de un proyecto ───────────────
CREATE OR REPLACE FUNCTION lukeapp.actualizar_miembro(
  p_membresia_id UUID,
  p_rol lukeapp.rol_usuario,
  p_activo BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proyecto_id UUID;
BEGIN
  -- Obtener proyecto de la membresía
  SELECT proyecto_id INTO v_proyecto_id
  FROM lukeapp.membresias
  WHERE id = p_membresia_id;

  IF v_proyecto_id IS NULL THEN
    RAISE EXCEPTION 'Membresía no encontrada';
  END IF;

  -- Validar autorización
  IF NOT lukeapp.puede_administrar_accesos(v_proyecto_id) THEN
    RAISE EXCEPTION 'No autorizado para administrar accesos en este proyecto';
  END IF;

  -- Actualizar membresía
  UPDATE lukeapp.membresias
  SET
    rol = p_rol,
    activo = p_activo,
    actualizado_por = auth.uid(),
    actualizado_en = now()
  WHERE id = p_membresia_id;
END;
$$;

COMMENT ON FUNCTION lukeapp.actualizar_miembro(UUID, lukeapp.rol_usuario, BOOLEAN) IS
  'Modifica el rol o estado activo de una membresía de proyecto.';

-- ─── 3. RPC: Eliminar membresía (quitar miembro) ───────────────
CREATE OR REPLACE FUNCTION lukeapp.quitar_miembro(
  p_membresia_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proyecto_id UUID;
BEGIN
  -- Obtener proyecto
  SELECT proyecto_id INTO v_proyecto_id
  FROM lukeapp.membresias
  WHERE id = p_membresia_id;

  IF v_proyecto_id IS NULL THEN
    RAISE EXCEPTION 'Membresía no encontrada';
  END IF;

  -- Validar autorización
  IF NOT lukeapp.puede_administrar_accesos(v_proyecto_id) THEN
    RAISE EXCEPTION 'No autorizado para administrar accesos en este proyecto';
  END IF;

  -- Eliminar membresía físicamente (el historial está en RLS y triggers de auditoría si fuera necesario,
  -- pero para limpieza física hacemos DELETE ya que el cascade limpia)
  DELETE FROM lukeapp.membresias WHERE id = p_membresia_id;
END;
$$;

COMMENT ON FUNCTION lukeapp.quitar_miembro(UUID) IS
  'Elimina de forma permanente la membresía de un usuario en un proyecto.';

-- ─── 4. RPC: Actualización de usuario global (Solo GERENCIA) ─────
CREATE OR REPLACE FUNCTION lukeapp.actualizar_usuario_global(
  p_usuario_id UUID,
  p_estado_cuenta TEXT,
  p_acceso_global BOOLEAN,
  p_activo BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que el llamante sea GERENCIA/acceso_global
  IF NOT EXISTS (
    SELECT 1 FROM lukeapp.usuarios
    WHERE id = auth.uid() AND acceso_global = true
  ) THEN
    RAISE EXCEPTION 'No autorizado: requiere acceso global / GERENCIA';
  END IF;

  -- Impedir auto-modificación de acceso_global para evitar dejarse sin acceso
  IF p_usuario_id = auth.uid() AND p_acceso_global = false THEN
    RAISE EXCEPTION 'No puedes revocar tu propio acceso global';
  END IF;

  -- Actualizar usuario
  UPDATE lukeapp.usuarios
  SET
    estado_cuenta = p_estado_cuenta,
    acceso_global = p_acceso_global,
    activo = p_activo,
    actualizado_por = auth.uid(),
    actualizado_en = now()
  WHERE id = p_usuario_id;
END;
$$;

COMMENT ON FUNCTION lukeapp.actualizar_usuario_global(UUID, TEXT, BOOLEAN, BOOLEAN) IS
  'Permite a un usuario de GERENCIA modificar el estado de cuenta, el acceso global y la activación de cualquier usuario en el sistema.';

-- Revocar y asignar privilegios
REVOKE ALL ON FUNCTION lukeapp.agregar_miembro(UUID, UUID, lukeapp.rol_usuario) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.actualizar_miembro(UUID, lukeapp.rol_usuario, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.quitar_miembro(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.actualizar_usuario_global(UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION lukeapp.agregar_miembro(UUID, UUID, lukeapp.rol_usuario) TO authenticated;
GRANT EXECUTE ON FUNCTION lukeapp.actualizar_miembro(UUID, lukeapp.rol_usuario, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION lukeapp.quitar_miembro(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION lukeapp.actualizar_usuario_global(UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

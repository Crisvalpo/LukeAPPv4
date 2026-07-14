-- ============================================================
-- LukeAPP v4 — Migración 016: Selector real de proyecto en registro
-- + acotar visibilidad de solicitudes por proyecto
-- Schema: lukeapp
-- Depende de: 20260713_009_auth_registro_aprobacion.sql
--
-- Problema: el formulario de auto-registro pedía "empresa/proyecto"
-- como texto libre, pero nunca completaba proyecto_solicitado_id
-- (columna que ya existía). Además solicitudes_pendientes() y
-- rechazar_usuario() no filtraban por proyecto: cualquier ADMIN de
-- cualquier proyecto veía/rechazaba solicitudes de otros proyectos
-- ajenos, exponiendo nombre/email/teléfono/mensaje de terceros.
--
-- Fix:
-- 1. RPC pública (anon + authenticated) que lista proyectos activos
--    con datos mínimos (id, codigo, nombre) para poblar un <select>
--    real en el formulario de registro, sin exponer KPIs/financieros.
-- 2. solicitudes_pendientes(): GERENCIA ve todo; un ADMIN de proyecto
--    solo ve solicitudes cuyo proyecto_solicitado_id administra.
--    Solicitudes sin proyecto declarado (NULL) solo las ve GERENCIA.
-- 3. rechazar_usuario(): misma regla de scoping antes de rechazar.
-- ============================================================

-- ─── 1. Listado público de proyectos para el formulario de registro ──
CREATE OR REPLACE FUNCTION lukeapp.proyectos_publicos_registro()
RETURNS TABLE (id UUID, codigo TEXT, nombre TEXT)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT p.id, p.codigo, p.nombre
  FROM lukeapp.proyectos p
  WHERE p.estado = 'activo'
  ORDER BY p.codigo;
$$;

COMMENT ON FUNCTION lukeapp.proyectos_publicos_registro() IS
  'Listado mínimo (id, código, nombre) de proyectos activos, expuesto a anon '
  'para poblar el selector de proyecto en el formulario público de registro. '
  'No expone KPIs, mandante ni ningún otro dato sensible.';

REVOKE ALL ON FUNCTION lukeapp.proyectos_publicos_registro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lukeapp.proyectos_publicos_registro() TO anon, authenticated;

-- ─── 2. solicitudes_pendientes() acotada por proyecto ─────────
CREATE OR REPLACE FUNCTION lukeapp.solicitudes_pendientes()
RETURNS TABLE (
  id UUID, email TEXT, nombre TEXT, telefono TEXT,
  mensaje_solicitud TEXT, proyecto_solicitado_id UUID, solicitado_en TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.email, u.nombre, u.telefono,
           u.mensaje_solicitud, u.proyecto_solicitado_id, u.solicitado_en
    FROM lukeapp.usuarios u
    WHERE u.estado_cuenta = 'pendiente'
      AND (
        EXISTS (SELECT 1 FROM lukeapp.usuarios me WHERE me.id = auth.uid() AND me.acceso_global = true)
        OR (u.proyecto_solicitado_id IS NOT NULL AND lukeapp.puede_administrar_accesos(u.proyecto_solicitado_id))
      )
    ORDER BY u.solicitado_en;
END;
$$;

-- ─── 3. rechazar_usuario() acotada por proyecto ───────────────
CREATE OR REPLACE FUNCTION lukeapp.rechazar_usuario(p_usuario_id UUID, p_motivo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_proyecto_solicitado UUID;
  v_autorizado BOOLEAN;
BEGIN
  SELECT proyecto_solicitado_id INTO v_proyecto_solicitado
  FROM lukeapp.usuarios WHERE id = p_usuario_id;

  v_autorizado :=
    EXISTS (SELECT 1 FROM lukeapp.usuarios u WHERE u.id = auth.uid() AND u.acceso_global = true)
    OR (v_proyecto_solicitado IS NOT NULL AND lukeapp.puede_administrar_accesos(v_proyecto_solicitado));

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  UPDATE lukeapp.usuarios
  SET estado_cuenta = 'rechazado', activo = false, motivo_rechazo = p_motivo,
      revisado_por = auth.uid(), revisado_en = now()
  WHERE id = p_usuario_id;
END;
$$;

COMMENT ON FUNCTION lukeapp.solicitudes_pendientes() IS
  'Lista las cuentas pendientes de aprobación. GERENCIA ve todas; un ADMIN de '
  'proyecto solo ve las que declararon ese proyecto al registrarse. Las '
  'solicitudes sin proyecto declarado solo las ve GERENCIA.';
COMMENT ON FUNCTION lukeapp.rechazar_usuario(UUID, TEXT) IS
  'Rechaza una cuenta pendiente con motivo. Mismo scoping por proyecto que '
  'solicitudes_pendientes().';

REVOKE ALL ON FUNCTION lukeapp.solicitudes_pendientes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.rechazar_usuario(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lukeapp.solicitudes_pendientes() TO authenticated;
GRANT EXECUTE ON FUNCTION lukeapp.rechazar_usuario(UUID, TEXT) TO authenticated;

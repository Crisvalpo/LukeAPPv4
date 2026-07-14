-- ============================================================
-- LukeAPP v4 — Migración 009: registro público con aprobación
-- + recuperación de contraseña (P5)
-- Schema: lukeapp
-- Depende de: 001_nucleo (usuarios, membresias, crear_perfil_usuario,
--             tiene_membresia, tiene_acceso_lectura)
--
-- Regla dura: una cuenta recién registrada no debe poder leer ni
-- escribir ningún dato de ningún proyecto hasta que un administrador
-- la apruebe y le dé membresía. RLS ya lo garantiza (activo=false +
-- sin membresía); esto agrega el flujo de estados y las RPCs para
-- gestionarlo sin exponer el padrón de usuarios vía RLS directa.
-- ============================================================

-- ─── A1. Estado de cuenta en usuarios ────────────────────────
-- Backfill: los usuarios existentes (admin/seeds) quedan aprobados;
-- solo los NUEVOS registros entrarán como 'pendiente' (vía el trigger).
ALTER TABLE lukeapp.usuarios
  ADD COLUMN IF NOT EXISTS estado_cuenta TEXT NOT NULL DEFAULT 'aprobado'
    CHECK (estado_cuenta IN ('pendiente','aprobado','rechazado')),
  ADD COLUMN IF NOT EXISTS mensaje_solicitud TEXT,
  ADD COLUMN IF NOT EXISTS proyecto_solicitado_id UUID REFERENCES lukeapp.proyectos(id),
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revisado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revisado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON lukeapp.usuarios(estado_cuenta)
  WHERE estado_cuenta = 'pendiente';

COMMENT ON COLUMN lukeapp.usuarios.estado_cuenta IS
  'pendiente (recién registrado, sin acceso) | aprobado | rechazado. '
  'Los usuarios existentes antes de esta migración quedan aprobado por defecto.';

-- ─── A2. El trigger de alta ahora marca 'pendiente' ──────────
-- Reemplaza el cuerpo de crear_perfil_usuario(); el trigger
-- trg_auth_crear_perfil ya existe (001_nucleo), no se recrea.
CREATE OR REPLACE FUNCTION lukeapp.crear_perfil_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO lukeapp.usuarios (
    id, email, nombre, telefono,
    estado_cuenta, activo,
    mensaje_solicitud, proyecto_solicitado_id, solicitado_en
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefono',
    'pendiente',            -- clave: nadie entra aprobado por auto-registro
    false,
    NEW.raw_user_meta_data->>'mensaje_solicitud',
    NULLIF(NEW.raw_user_meta_data->>'proyecto_solicitado_id', '')::uuid,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── A3. Helper: ¿el llamante puede aprobar accesos? ─────────
CREATE OR REPLACE FUNCTION lukeapp.puede_administrar_accesos(p_proyecto_id UUID DEFAULT NULL)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    EXISTS (SELECT 1 FROM lukeapp.usuarios u
            WHERE u.id = auth.uid() AND u.acceso_global = true)
    OR EXISTS (SELECT 1 FROM lukeapp.membresias m
               WHERE m.usuario_id = auth.uid() AND m.rol = 'ADMIN' AND m.activo
                 AND (p_proyecto_id IS NULL OR m.proyecto_id = p_proyecto_id));
$$;

COMMENT ON FUNCTION lukeapp.puede_administrar_accesos(UUID) IS
  'true si el usuario actual tiene acceso_global, o es ADMIN activo del proyecto dado '
  '(o de algún proyecto, si p_proyecto_id es NULL). Usado para autorizar las RPCs de aprobación.';

-- ─── A4. RPCs de registro/aprobación ──────────────────────────
-- Todo pasa por RPC SECURITY DEFINER en vez de abrir la RLS de
-- usuarios, para no exponer el padrón de usuarios. El frontend
-- nunca usa service_role.

CREATE OR REPLACE FUNCTION lukeapp.solicitudes_pendientes()
RETURNS TABLE (
  id UUID, email TEXT, nombre TEXT, telefono TEXT,
  mensaje_solicitud TEXT, proyecto_solicitado_id UUID, solicitado_en TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT lukeapp.puede_administrar_accesos() THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email, u.nombre, u.telefono,
           u.mensaje_solicitud, u.proyecto_solicitado_id, u.solicitado_en
    FROM lukeapp.usuarios u
    WHERE u.estado_cuenta = 'pendiente'
    ORDER BY u.solicitado_en;
END;
$$;

CREATE OR REPLACE FUNCTION lukeapp.aprobar_usuario(
  p_usuario_id UUID, p_proyecto_id UUID, p_rol lukeapp.rol_usuario
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT lukeapp.puede_administrar_accesos(p_proyecto_id) THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  UPDATE lukeapp.usuarios
  SET estado_cuenta = 'aprobado', activo = true,
      revisado_por = auth.uid(), revisado_en = now()
  WHERE id = p_usuario_id;

  INSERT INTO lukeapp.membresias (usuario_id, proyecto_id, rol, activo, invitado_por, creado_por)
  VALUES (p_usuario_id, p_proyecto_id, p_rol, true, auth.uid(), auth.uid())
  ON CONFLICT (usuario_id, proyecto_id) DO UPDATE SET rol = EXCLUDED.rol, activo = true;

  IF p_rol = 'GERENCIA' THEN
    UPDATE lukeapp.usuarios SET acceso_global = true WHERE id = p_usuario_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION lukeapp.rechazar_usuario(p_usuario_id UUID, p_motivo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT lukeapp.puede_administrar_accesos() THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  UPDATE lukeapp.usuarios
  SET estado_cuenta = 'rechazado', activo = false, motivo_rechazo = p_motivo,
      revisado_por = auth.uid(), revisado_en = now()
  WHERE id = p_usuario_id;
END;
$$;

CREATE OR REPLACE FUNCTION lukeapp.mi_perfil()
RETURNS TABLE (
  estado_cuenta TEXT, motivo_rechazo TEXT, acceso_global BOOLEAN,
  tiene_membresia_activa BOOLEAN, puede_administrar_accesos BOOLEAN
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    u.estado_cuenta,
    u.motivo_rechazo,
    u.acceso_global,
    EXISTS (SELECT 1 FROM lukeapp.membresias m
            WHERE m.usuario_id = auth.uid() AND m.activo) AS tiene_membresia_activa,
    lukeapp.puede_administrar_accesos()                   AS puede_administrar_accesos
  FROM lukeapp.usuarios u WHERE u.id = auth.uid();
$$;

COMMENT ON FUNCTION lukeapp.solicitudes_pendientes() IS
  'Lista las cuentas pendientes de aprobación. Solo ADMIN/GERENCIA.';
COMMENT ON FUNCTION lukeapp.aprobar_usuario(UUID, UUID, lukeapp.rol_usuario) IS
  'Aprueba una cuenta pendiente y crea su membresía en el proyecto dado. Solo ADMIN/GERENCIA.';
COMMENT ON FUNCTION lukeapp.rechazar_usuario(UUID, TEXT) IS
  'Rechaza una cuenta pendiente con motivo. Solo ADMIN/GERENCIA.';
COMMENT ON FUNCTION lukeapp.mi_perfil() IS
  'Estado de cuenta del usuario actual, para el gate de acceso del frontend tras el login.';

REVOKE ALL ON FUNCTION lukeapp.solicitudes_pendientes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.aprobar_usuario(UUID, UUID, lukeapp.rol_usuario) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.rechazar_usuario(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.mi_perfil() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lukeapp.solicitudes_pendientes() TO authenticated;
GRANT EXECUTE ON FUNCTION lukeapp.aprobar_usuario(UUID, UUID, lukeapp.rol_usuario) TO authenticated;
GRANT EXECUTE ON FUNCTION lukeapp.rechazar_usuario(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lukeapp.mi_perfil() TO authenticated;

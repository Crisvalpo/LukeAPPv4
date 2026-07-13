-- ============================================================
-- LukeAPP v4 — Migración 001: Núcleo transversal (CORREGIDA)
-- Schema: lukeapp (NUNCA public)
-- Aplica sobre: Supabase self-hosted (lukeserver)
-- Rev. B — Julio 2026
--
-- ORDEN:
-- 1. Schema + ENUMs + permisos
-- 2. Función de auditoría (no referencia otras tablas)
-- 3. Todas las tablas (sin políticas RLS aún)
-- 4. Función tiene_membresia (DESPUÉS de crear membresias)
-- 5. Función tiene_permiso_escritura (DESPUÉS de permisos_rol)
-- 6. Políticas RLS sobre todas las tablas
-- 7. Trigger de creación de perfil de usuario
-- ============================================================

-- ─── 1. Schema + ENUMs + permisos ────────────────────────────
CREATE SCHEMA IF NOT EXISTS lukeapp;

GRANT USAGE ON SCHEMA lukeapp TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lukeapp
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA lukeapp
  GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lukeapp
  GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lukeapp
  GRANT ALL ON FUNCTIONS TO authenticated, service_role;

CREATE TYPE lukeapp.industria_tipo AS ENUM ('mineria', 'refineria', 'celulosa');
CREATE TYPE lukeapp.empresa_tipo   AS ENUM ('mandante', 'contratista', 'subcontratista');
CREATE TYPE lukeapp.rol_usuario    AS ENUM ('ADMIN', 'OT', 'QAQC', 'LOGISTICA', 'SUPERVISOR');
CREATE TYPE lukeapp.estado_proyecto AS ENUM ('activo', 'en_pausa', 'cerrado', 'borrador');
CREATE TYPE lukeapp.estado_lote    AS ENUM (
  'cargado', 'validado', 'diff_listo', 'aprobado', 'aplicado', 'rechazado'
);
CREATE TYPE lukeapp.accion_fila    AS ENUM (
  'nueva', 'modificada', 'ausente', 'sin_cambio', 'error'
);
CREATE TYPE lukeapp.tipo_evidencia AS ENUM (
  'FOTO', 'PDF_ISO', 'PDF_PID', 'FOTO_EVIDENCIA', 'PDF_PROTOCOLO', 'OTRO'
);

-- ─── 2. Función de auditoría (no referencia otras tablas) ─────
CREATE OR REPLACE FUNCTION lukeapp.set_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.actualizado_en := now();
  NEW.actualizado_por := auth.uid();
  RETURN NEW;
END;
$$;

-- ─── 3. Tablas en orden de dependencias (SIN políticas RLS aún) ──

-- 3.1 empresas
CREATE TABLE lukeapp.empresas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  rut             TEXT UNIQUE,
  tipo            lukeapp.empresa_tipo NOT NULL DEFAULT 'contratista',
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_empresas_tipo ON lukeapp.empresas(tipo);
CREATE TRIGGER trg_empresas_auditoria
  BEFORE UPDATE ON lukeapp.empresas
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.empresas ENABLE ROW LEVEL SECURITY;

-- 3.2 proyectos
CREATE TABLE lukeapp.proyectos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          TEXT NOT NULL UNIQUE,
  nombre          TEXT NOT NULL,
  mandante_id     UUID NOT NULL REFERENCES lukeapp.empresas(id),
  contratista_id  UUID REFERENCES lukeapp.empresas(id),
  contrato        TEXT,
  industria       lukeapp.industria_tipo NOT NULL,
  fecha_inicio    DATE,
  fecha_cierre    DATE,
  estado          lukeapp.estado_proyecto NOT NULL DEFAULT 'borrador',
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proyectos_estado    ON lukeapp.proyectos(estado);
CREATE INDEX idx_proyectos_industria ON lukeapp.proyectos(industria);
CREATE TRIGGER trg_proyectos_auditoria
  BEFORE UPDATE ON lukeapp.proyectos
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.proyectos ENABLE ROW LEVEL SECURITY;

-- 3.3 proyecto_config
CREATE TABLE lukeapp.proyecto_config (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id      UUID NOT NULL UNIQUE REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  usa_awp          BOOLEAN NOT NULL DEFAULT false,
  usa_pwht         BOOLEAN NOT NULL DEFAULT false,
  clases_con_pwht  TEXT[],
  usa_pmi          BOOLEAN NOT NULL DEFAULT false,
  usa_sublineas    BOOLEAN NOT NULL DEFAULT false,
  usa_test_pack    BOOLEAN NOT NULL DEFAULT false,
  usa_mecanica     BOOLEAN NOT NULL DEFAULT false,
  fila_encabezado  INT NOT NULL DEFAULT 1,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_proyecto_config_auditoria
  BEFORE UPDATE ON lukeapp.proyecto_config
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.proyecto_config ENABLE ROW LEVEL SECURITY;

-- 3.4 usuarios
CREATE TABLE lukeapp.usuarios (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  telefono        TEXT,
  telegram_id     TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usuarios_email ON lukeapp.usuarios(email);
CREATE TRIGGER trg_usuarios_auditoria
  BEFORE UPDATE ON lukeapp.usuarios
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.usuarios ENABLE ROW LEVEL SECURITY;

-- 3.5 membresias
CREATE TABLE lukeapp.membresias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES lukeapp.usuarios(id) ON DELETE CASCADE,
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  rol             lukeapp.rol_usuario NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT true,
  invitado_por    UUID REFERENCES auth.users(id),
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, proyecto_id)
);
CREATE INDEX idx_membresias_usuario  ON lukeapp.membresias(usuario_id);
CREATE INDEX idx_membresias_proyecto ON lukeapp.membresias(proyecto_id);
CREATE INDEX idx_membresias_activo   ON lukeapp.membresias(activo);
CREATE TRIGGER trg_membresias_auditoria
  BEFORE UPDATE ON lukeapp.membresias
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.membresias ENABLE ROW LEVEL SECURITY;

-- 3.6 permisos_rol
CREATE TABLE lukeapp.permisos_rol (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id       UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  rol               lukeapp.rol_usuario NOT NULL,
  tabla             TEXT NOT NULL,
  puede_agregar     BOOLEAN NOT NULL DEFAULT false,
  puede_actualizar  BOOLEAN NOT NULL DEFAULT false,
  puede_eliminar    BOOLEAN NOT NULL DEFAULT false,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, rol, tabla)
);
CREATE INDEX idx_permisos_rol_proyecto ON lukeapp.permisos_rol(proyecto_id);
CREATE INDEX idx_permisos_rol_rol      ON lukeapp.permisos_rol(rol);
CREATE TRIGGER trg_permisos_rol_auditoria
  BEFORE UPDATE ON lukeapp.permisos_rol
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.permisos_rol ENABLE ROW LEVEL SECURITY;

-- 3.7 plantillas_catalogo
CREATE TABLE lukeapp.plantillas_catalogo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industria    lukeapp.industria_tipo NOT NULL,
  dominio      TEXT NOT NULL,
  tabla        TEXT NOT NULL,
  payload      JSONB NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  activo       BOOLEAN NOT NULL DEFAULT true,
  creado_por   UUID REFERENCES auth.users(id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plantillas_industria ON lukeapp.plantillas_catalogo(industria);
CREATE INDEX idx_plantillas_tabla     ON lukeapp.plantillas_catalogo(tabla);
CREATE TRIGGER trg_plantillas_auditoria
  BEFORE UPDATE ON lukeapp.plantillas_catalogo
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.plantillas_catalogo ENABLE ROW LEVEL SECURITY;

-- 3.8 evidencias
CREATE TABLE lukeapp.evidencias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  entidad         TEXT NOT NULL,
  registro_id     UUID NOT NULL,
  tipo            lukeapp.tipo_evidencia NOT NULL,
  storage_path    TEXT NOT NULL,
  hash            TEXT,
  nombre_original TEXT,
  tamanio_bytes   BIGINT,
  mime_type       TEXT,
  subida_pendiente BOOLEAN NOT NULL DEFAULT false,
  subida_en        TIMESTAMPTZ,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidencias_proyecto  ON lukeapp.evidencias(proyecto_id);
CREATE INDEX idx_evidencias_entidad   ON lukeapp.evidencias(entidad, registro_id);
CREATE INDEX idx_evidencias_pendiente ON lukeapp.evidencias(subida_pendiente) WHERE subida_pendiente;
CREATE TRIGGER trg_evidencias_auditoria
  BEFORE UPDATE ON lukeapp.evidencias
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.evidencias ENABLE ROW LEVEL SECURITY;

-- 3.9 import_perfiles
CREATE TABLE lukeapp.import_perfiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  tabla_destino   TEXT NOT NULL,
  mapeo           JSONB NOT NULL,
  opciones        JSONB,
  version         INT NOT NULL DEFAULT 1,
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_perfiles_proyecto ON lukeapp.import_perfiles(proyecto_id);
CREATE INDEX idx_import_perfiles_tabla    ON lukeapp.import_perfiles(tabla_destino);
CREATE TRIGGER trg_import_perfiles_auditoria
  BEFORE UPDATE ON lukeapp.import_perfiles
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.import_perfiles ENABLE ROW LEVEL SECURITY;

-- 3.10 import_lotes
CREATE TABLE lukeapp.import_lotes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id          UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  perfil_id            UUID NOT NULL REFERENCES lukeapp.import_perfiles(id),
  archivo_storage_path TEXT,
  hash_archivo         TEXT,
  estado               lukeapp.estado_lote NOT NULL DEFAULT 'cargado',
  resumen              JSONB,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_lotes_proyecto ON lukeapp.import_lotes(proyecto_id);
CREATE INDEX idx_import_lotes_estado   ON lukeapp.import_lotes(estado);
CREATE INDEX idx_import_lotes_perfil   ON lukeapp.import_lotes(perfil_id);
CREATE TRIGGER trg_import_lotes_auditoria
  BEFORE UPDATE ON lukeapp.import_lotes
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.import_lotes ENABLE ROW LEVEL SECURITY;

-- 3.11 import_filas
CREATE TABLE lukeapp.import_filas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id         UUID NOT NULL REFERENCES lukeapp.import_lotes(id) ON DELETE CASCADE,
  nro_fila        INT NOT NULL,
  payload         JSONB NOT NULL,
  clave_natural   TEXT,
  accion          lukeapp.accion_fila,
  diff            JSONB,
  error_detalle   TEXT,
  aprobada        BOOLEAN,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_filas_lote   ON lukeapp.import_filas(lote_id);
CREATE INDEX idx_import_filas_accion ON lukeapp.import_filas(accion);
CREATE INDEX idx_import_filas_clave  ON lukeapp.import_filas(clave_natural);
ALTER TABLE lukeapp.import_filas ENABLE ROW LEVEL SECURITY;

-- ─── 4. Funciones RLS (DESPUÉS de que existen las tablas) ─────

CREATE OR REPLACE FUNCTION lukeapp.tiene_membresia(p_proyecto_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM lukeapp.membresias m
    WHERE m.usuario_id = auth.uid()
      AND m.proyecto_id = p_proyecto_id
      AND m.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION lukeapp.tiene_permiso_escritura(
  p_proyecto_id UUID,
  p_tabla TEXT,
  p_accion TEXT
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM lukeapp.membresias m
    JOIN lukeapp.permisos_rol pr ON pr.proyecto_id = m.proyecto_id AND pr.rol = m.rol
    WHERE m.usuario_id = auth.uid()
      AND m.proyecto_id = p_proyecto_id
      AND m.activo = true
      AND pr.tabla = p_tabla
      AND CASE p_accion
        WHEN 'agregar'     THEN pr.puede_agregar
        WHEN 'actualizar'  THEN pr.puede_actualizar
        WHEN 'eliminar'    THEN pr.puede_eliminar
        ELSE false
      END
  );
$$;

-- ─── 5. Políticas RLS (DESPUÉS de que existen las funciones) ──

-- empresas
CREATE POLICY "empresas_select" ON lukeapp.empresas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresas_insert" ON lukeapp.empresas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "empresas_update" ON lukeapp.empresas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- proyectos
CREATE POLICY "proyectos_select" ON lukeapp.proyectos
  FOR SELECT TO authenticated USING (lukeapp.tiene_membresia(id));
CREATE POLICY "proyectos_insert" ON lukeapp.proyectos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "proyectos_update" ON lukeapp.proyectos
  FOR UPDATE TO authenticated USING (lukeapp.tiene_membresia(id));

-- proyecto_config
CREATE POLICY "proyecto_config_select" ON lukeapp.proyecto_config
  FOR SELECT TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "proyecto_config_insert" ON lukeapp.proyecto_config
  FOR INSERT TO authenticated WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "proyecto_config_update" ON lukeapp.proyecto_config
  FOR UPDATE TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

-- usuarios
CREATE POLICY "usuarios_select" ON lukeapp.usuarios
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "usuarios_update_self" ON lukeapp.usuarios
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "usuarios_insert" ON lukeapp.usuarios
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- membresias
CREATE POLICY "membresias_select_self" ON lukeapp.membresias
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "membresias_select_admin" ON lukeapp.membresias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.membresias m2
      WHERE m2.usuario_id = auth.uid()
        AND m2.proyecto_id = membresias.proyecto_id
        AND m2.rol = 'ADMIN'
        AND m2.activo
    )
  );
CREATE POLICY "membresias_insert" ON lukeapp.membresias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lukeapp.membresias m2
      WHERE m2.usuario_id = auth.uid()
        AND m2.proyecto_id = membresias.proyecto_id
        AND m2.rol = 'ADMIN'
        AND m2.activo
    )
  );
CREATE POLICY "membresias_update" ON lukeapp.membresias
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.membresias m2
      WHERE m2.usuario_id = auth.uid()
        AND m2.proyecto_id = membresias.proyecto_id
        AND m2.rol = 'ADMIN'
        AND m2.activo
    )
  );

-- permisos_rol
CREATE POLICY "permisos_rol_select" ON lukeapp.permisos_rol
  FOR SELECT TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "permisos_rol_manage" ON lukeapp.permisos_rol
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.membresias m
      WHERE m.usuario_id = auth.uid()
        AND m.proyecto_id = permisos_rol.proyecto_id
        AND m.rol = 'ADMIN'
        AND m.activo
    )
  );

-- plantillas_catalogo
CREATE POLICY "plantillas_select" ON lukeapp.plantillas_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "plantillas_manage" ON lukeapp.plantillas_catalogo
  FOR ALL TO service_role USING (true);

-- evidencias
CREATE POLICY "evidencias_select" ON lukeapp.evidencias
  FOR SELECT TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "evidencias_insert" ON lukeapp.evidencias
  FOR INSERT TO authenticated WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "evidencias_update" ON lukeapp.evidencias
  FOR UPDATE TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

-- import_perfiles
CREATE POLICY "import_perfiles_select" ON lukeapp.import_perfiles
  FOR SELECT TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "import_perfiles_manage" ON lukeapp.import_perfiles
  FOR ALL TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

-- import_lotes
CREATE POLICY "import_lotes_select" ON lukeapp.import_lotes
  FOR SELECT TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "import_lotes_insert" ON lukeapp.import_lotes
  FOR INSERT TO authenticated WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "import_lotes_update" ON lukeapp.import_lotes
  FOR UPDATE TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

-- import_filas (RLS via join a lote → proyecto)
CREATE POLICY "import_filas_select" ON lukeapp.import_filas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.import_lotes l
      WHERE l.id = import_filas.lote_id
        AND lukeapp.tiene_membresia(l.proyecto_id)
    )
  );
CREATE POLICY "import_filas_insert" ON lukeapp.import_filas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lukeapp.import_lotes l
      WHERE l.id = import_filas.lote_id
        AND lukeapp.tiene_membresia(l.proyecto_id)
    )
  );
CREATE POLICY "import_filas_update" ON lukeapp.import_filas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.import_lotes l
      WHERE l.id = import_filas.lote_id
        AND lukeapp.tiene_membresia(l.proyecto_id)
    )
  );

-- ─── 6. Trigger: crear perfil al registrar usuario ─────────────
CREATE OR REPLACE FUNCTION lukeapp.crear_perfil_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO lukeapp.usuarios (id, email, nombre)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_crear_perfil
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION lukeapp.crear_perfil_usuario();

-- ─── 7. Comentarios de documentación ──────────────────────────
COMMENT ON SCHEMA lukeapp IS 'LukeAPP v4 — Schema principal. NUNCA usar public.';
COMMENT ON TABLE lukeapp.empresas            IS 'Empresas mandantes y contratistas del sistema';
COMMENT ON TABLE lukeapp.proyectos           IS 'Proyectos industriales: un codigo único por contrato';
COMMENT ON TABLE lukeapp.proyecto_config     IS 'Flags de workflow por proyecto (PWHT, PMI, AWP, etc.)';
COMMENT ON TABLE lukeapp.usuarios            IS 'Perfil de usuario (espejo de auth.users)';
COMMENT ON TABLE lukeapp.membresias          IS 'Pertenencia usuario-proyecto con rol';
COMMENT ON TABLE lukeapp.permisos_rol        IS 'Permisos CRUD por rol y tabla dentro del proyecto';
COMMENT ON TABLE lukeapp.plantillas_catalogo IS 'Catálogos base por industria para clonar al crear proyecto';
COMMENT ON TABLE lukeapp.evidencias          IS 'Fotos y PDFs en Supabase Storage (nunca binarios en BD)';
COMMENT ON TABLE lukeapp.import_perfiles     IS 'Configuración de mapeo Excel → BD por proyecto';
COMMENT ON TABLE lukeapp.import_lotes        IS 'Lotes de importación con estado y resumen';
COMMENT ON TABLE lukeapp.import_filas        IS 'Filas individuales del lote con diff campo a campo';

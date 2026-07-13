-- ============================================================
-- LukeAPP v4 — Migración 002: Dominios piping + mecánica
-- Schema: lukeapp
-- Depende de: 20260713_001_nucleo.sql
-- Rev. A — Julio 2026
-- ============================================================
-- Convenciones:
--   - Toda tabla lleva proyecto_id
--   - UNIQUE (proyecto_id, id_negocio) — nunca único global
--   - RLS via lukeapp.tiene_membresia()
--   - Auditoría via trigger lukeapp.set_auditoria()
--   - Índice mínimo: (proyecto_id) en todas las tablas
-- ============================================================

-- ============================================================
-- HELPER: macro para triggers de auditoría
-- ============================================================
-- Patrón: se crea el trigger después de cada CREATE TABLE

-- ============================================================
-- ── CATÁLOGOS (cat_*) ────────────────────────────────────────
-- 14 tablas — datos de referencia por proyecto
-- Claves naturales declarativas (usadas por el importador)
-- ============================================================

-- 1. cat_fluido_servicio
CREATE TABLE lukeapp.cat_fluido_servicio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_fluido_proyecto ON lukeapp.cat_fluido_servicio(proyecto_id);
CREATE TRIGGER trg_cat_fluido_auditoria BEFORE UPDATE ON lukeapp.cat_fluido_servicio
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_fluido_servicio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_fluido_select" ON lukeapp.cat_fluido_servicio FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_fluido_write" ON lukeapp.cat_fluido_servicio FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 2. cat_clase_piping
CREATE TABLE lukeapp.cat_clase_piping (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  fluido_id     UUID REFERENCES lukeapp.cat_fluido_servicio(id),
  presion_max   NUMERIC,
  temp_max      NUMERIC,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_clase_proyecto ON lukeapp.cat_clase_piping(proyecto_id);
CREATE TRIGGER trg_cat_clase_auditoria BEFORE UPDATE ON lukeapp.cat_clase_piping
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_clase_piping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_clase_select" ON lukeapp.cat_clase_piping FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_clase_write" ON lukeapp.cat_clase_piping FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 3. cat_diametros_nps
CREATE TABLE lukeapp.cat_diametros_nps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  nps           TEXT NOT NULL,          -- ej: '2"', '6"', '1/2"'
  nps_mm        NUMERIC,                -- diámetro nominal en mm
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, nps)
);
CREATE INDEX idx_cat_nps_proyecto ON lukeapp.cat_diametros_nps(proyecto_id);
CREATE TRIGGER trg_cat_nps_auditoria BEFORE UPDATE ON lukeapp.cat_diametros_nps
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_diametros_nps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_nps_select" ON lukeapp.cat_diametros_nps FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_nps_write" ON lukeapp.cat_diametros_nps FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 4. cat_aislacion_ext
CREATE TABLE lukeapp.cat_aislacion_ext (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_aislacion_proyecto ON lukeapp.cat_aislacion_ext(proyecto_id);
CREATE TRIGGER trg_cat_aislacion_auditoria BEFORE UPDATE ON lukeapp.cat_aislacion_ext
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_aislacion_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_aislacion_select" ON lukeapp.cat_aislacion_ext FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_aislacion_write" ON lukeapp.cat_aislacion_ext FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 5. cat_revestimiento_int
CREATE TABLE lukeapp.cat_revestimiento_int (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_revestimiento_proyecto ON lukeapp.cat_revestimiento_int(proyecto_id);
CREATE TRIGGER trg_cat_revestimiento_auditoria BEFORE UPDATE ON lukeapp.cat_revestimiento_int
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_revestimiento_int ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_revestimiento_select" ON lukeapp.cat_revestimiento_int FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_revestimiento_write" ON lukeapp.cat_revestimiento_int FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 6. cat_esquema_pintura
CREATE TABLE lukeapp.cat_esquema_pintura (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  capas         INT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_pintura_proyecto ON lukeapp.cat_esquema_pintura(proyecto_id);
CREATE TRIGGER trg_cat_pintura_auditoria BEFORE UPDATE ON lukeapp.cat_esquema_pintura
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_esquema_pintura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_pintura_select" ON lukeapp.cat_esquema_pintura FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_pintura_write" ON lukeapp.cat_esquema_pintura FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 7. cat_porcentaje_nde
CREATE TABLE lukeapp.cat_porcentaje_nde (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  porcentaje    NUMERIC NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_nde_proyecto ON lukeapp.cat_porcentaje_nde(proyecto_id);
CREATE TRIGGER trg_cat_nde_auditoria BEFORE UPDATE ON lukeapp.cat_porcentaje_nde
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_porcentaje_nde ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_nde_select" ON lukeapp.cat_porcentaje_nde FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_nde_write" ON lukeapp.cat_porcentaje_nde FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 8. cat_tipo_prueba
CREATE TABLE lukeapp.cat_tipo_prueba (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_prueba_proyecto ON lukeapp.cat_tipo_prueba(proyecto_id);
CREATE TRIGGER trg_cat_prueba_auditoria BEFORE UPDATE ON lukeapp.cat_tipo_prueba
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_tipo_prueba ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_prueba_select" ON lukeapp.cat_tipo_prueba FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_prueba_write" ON lukeapp.cat_tipo_prueba FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 9. cat_tipo_soporte
CREATE TABLE lukeapp.cat_tipo_soporte (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_soporte_proyecto ON lukeapp.cat_tipo_soporte(proyecto_id);
CREATE TRIGGER trg_cat_soporte_auditoria BEFORE UPDATE ON lukeapp.cat_tipo_soporte
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_tipo_soporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_soporte_select" ON lukeapp.cat_tipo_soporte FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_soporte_write" ON lukeapp.cat_tipo_soporte FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 10. cat_tipo_union
CREATE TABLE lukeapp.cat_tipo_union (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_union_proyecto ON lukeapp.cat_tipo_union(proyecto_id);
CREATE TRIGGER trg_cat_union_auditoria BEFORE UPDATE ON lukeapp.cat_tipo_union
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_tipo_union ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_union_select" ON lukeapp.cat_tipo_union FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_union_write" ON lukeapp.cat_tipo_union FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 11. cat_personal
CREATE TABLE lukeapp.cat_personal (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  estampa       TEXT NOT NULL,          -- código de soldador/inspector
  nombre        TEXT NOT NULL,
  especialidad  TEXT,
  certificacion TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, estampa)
);
CREATE INDEX idx_cat_personal_proyecto ON lukeapp.cat_personal(proyecto_id);
CREATE TRIGGER trg_cat_personal_auditoria BEFORE UPDATE ON lukeapp.cat_personal
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_personal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_personal_select" ON lukeapp.cat_personal FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_personal_write" ON lukeapp.cat_personal FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 12. cat_cwa (Construction Work Area)
CREATE TABLE lukeapp.cat_cwa (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_cwa_proyecto ON lukeapp.cat_cwa(proyecto_id);
CREATE TRIGGER trg_cat_cwa_auditoria BEFORE UPDATE ON lukeapp.cat_cwa
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_cwa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_cwa_select" ON lukeapp.cat_cwa FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_cwa_write" ON lukeapp.cat_cwa FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 13. cat_cwp (Construction Work Package)
CREATE TABLE lukeapp.cat_cwp (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  cwa_id        UUID REFERENCES lukeapp.cat_cwa(id),
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_cwp_proyecto ON lukeapp.cat_cwp(proyecto_id);
CREATE TRIGGER trg_cat_cwp_auditoria BEFORE UPDATE ON lukeapp.cat_cwp
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_cwp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_cwp_select" ON lukeapp.cat_cwp FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_cwp_write" ON lukeapp.cat_cwp FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 14. cat_iwp (Installation Work Package)
CREATE TABLE lukeapp.cat_iwp (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  codigo        TEXT NOT NULL,
  cwp_id        UUID REFERENCES lukeapp.cat_cwp(id),
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, codigo)
);
CREATE INDEX idx_cat_iwp_proyecto ON lukeapp.cat_iwp(proyecto_id);
CREATE TRIGGER trg_cat_iwp_auditoria BEFORE UPDATE ON lukeapp.cat_iwp
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.cat_iwp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_iwp_select" ON lukeapp.cat_iwp FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "cat_iwp_write" ON lukeapp.cat_iwp FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- ============================================================
-- ── MAESTROS (list_*) ────────────────────────────────────────
-- Cadena de FKs: lineas → isos → spools → juntas
-- ============================================================

-- 1. list_lineas (LIST_Lineas_MS_ en v1, 17 columnas de referencia)
CREATE TABLE lukeapp.list_lineas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  -- Clave natural del negocio
  id_linea        TEXT NOT NULL,
  -- Datos de ingeniería
  descripcion     TEXT,
  fluido_id       UUID REFERENCES lukeapp.cat_fluido_servicio(id),
  clase_id        UUID REFERENCES lukeapp.cat_clase_piping(id),
  nps_id          UUID REFERENCES lukeapp.cat_diametros_nps(id),
  nps_texto       TEXT,           -- valor raw del cubicador (se resuelve a nps_id)
  aislacion_id    UUID REFERENCES lukeapp.cat_aislacion_ext(id),
  revestimiento_id UUID REFERENCES lukeapp.cat_revestimiento_int(id),
  pintura_id      UUID REFERENCES lukeapp.cat_esquema_pintura(id),
  prueba_id       UUID REFERENCES lukeapp.cat_tipo_prueba(id),
  nde_id          UUID REFERENCES lukeapp.cat_porcentaje_nde(id),
  cwa_id          UUID REFERENCES lukeapp.cat_cwa(id),
  cwp_id          UUID REFERENCES lukeapp.cat_cwp(id),
  iwp_id          UUID REFERENCES lukeapp.cat_iwp(id),
  -- Campos operativos
  usa_pwht        BOOLEAN NOT NULL DEFAULT false,
  usa_pmi         BOOLEAN NOT NULL DEFAULT false,
  longitud_total  NUMERIC,
  -- Estado
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Clave natural de negocio única por proyecto
  UNIQUE (proyecto_id, id_linea)
);
CREATE INDEX idx_list_lineas_proyecto ON lukeapp.list_lineas(proyecto_id);
CREATE INDEX idx_list_lineas_cwa      ON lukeapp.list_lineas(cwa_id);
CREATE TRIGGER trg_list_lineas_auditoria BEFORE UPDATE ON lukeapp.list_lineas
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_lineas_select" ON lukeapp.list_lineas FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_lineas_write" ON lukeapp.list_lineas FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 2. list_isos (LIST_Isos_MS_ en v1)
-- Clave natural: proyecto_id + id_linea + sheet (número de hoja del isométrico)
CREATE TABLE lukeapp.list_isos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  linea_id        UUID NOT NULL REFERENCES lukeapp.list_lineas(id),
  -- Clave natural
  id_linea        TEXT NOT NULL,    -- desnormalizado para consultas rápidas
  sheet           TEXT NOT NULL,    -- número de hoja: '01', '02', …
  id_iso          TEXT GENERATED ALWAYS AS (id_linea || '-' || sheet) STORED,
  -- Datos
  descripcion     TEXT,
  revision        TEXT,             -- rev del plano: '0', 'A', 'B', …
  estado          TEXT,             -- v1: 'Emitido', 'Aprobado', …
  pdf_path        TEXT,             -- referencia a Supabase Storage
  -- Auditoría
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_linea, sheet)
);
CREATE INDEX idx_list_isos_proyecto ON lukeapp.list_isos(proyecto_id);
CREATE INDEX idx_list_isos_linea    ON lukeapp.list_isos(linea_id);
CREATE TRIGGER trg_list_isos_auditoria BEFORE UPDATE ON lukeapp.list_isos
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_isos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_isos_select" ON lukeapp.list_isos FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_isos_write" ON lukeapp.list_isos FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 3. list_spools (LIST_Spools_MS_ en v1)
CREATE TABLE lukeapp.list_spools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  iso_id          UUID NOT NULL REFERENCES lukeapp.list_isos(id),
  linea_id        UUID NOT NULL REFERENCES lukeapp.list_lineas(id),
  -- Clave natural
  id_spool        TEXT NOT NULL,
  tag_gestion     TEXT,           -- código corto para pantallas (v1: TAG GESTION)
  -- Datos de fabricación
  longitud        NUMERIC,
  peso            NUMERIC,
  nro_juntas      INT DEFAULT 0,
  -- Estado de montaje
  estado_montaje  TEXT,           -- En Fabricación / QAQC / Por Montar / Posicionado / Montado
  -- Ubicación en terreno
  sector          TEXT,
  -- Auditoría
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_spool)
);
CREATE INDEX idx_list_spools_proyecto ON lukeapp.list_spools(proyecto_id);
CREATE INDEX idx_list_spools_iso      ON lukeapp.list_spools(iso_id);
CREATE INDEX idx_list_spools_estado   ON lukeapp.list_spools(proyecto_id, estado_montaje);
CREATE TRIGGER trg_list_spools_auditoria BEFORE UPDATE ON lukeapp.list_spools
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_spools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_spools_select" ON lukeapp.list_spools FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_spools_write" ON lukeapp.list_spools FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 4. list_juntas (LIST_Juntas_MS_ en v1)
-- Clave natural: proyecto_id + id_spool + numero_junta
CREATE TABLE lukeapp.list_juntas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  spool_id        UUID NOT NULL REFERENCES lukeapp.list_spools(id),
  linea_id        UUID NOT NULL REFERENCES lukeapp.list_lineas(id),
  -- Clave natural
  id_spool        TEXT NOT NULL,      -- desnormalizado
  numero_junta    TEXT NOT NULL,
  -- Datos técnicos
  tipo_union_id   UUID REFERENCES lukeapp.cat_tipo_union(id),
  nps_id          UUID REFERENCES lukeapp.cat_diametros_nps(id),
  nps_texto       TEXT,
  proceso_soldadura TEXT,             -- SMAW, GTAW, GMAW, etc.
  material_base   TEXT,
  -- QA/QC
  requiere_pwht   BOOLEAN NOT NULL DEFAULT false,
  requiere_pmi    BOOLEAN NOT NULL DEFAULT false,
  porcentaje_nde  NUMERIC,
  -- Estado (se actualiza con reg_*)
  estado          TEXT NOT NULL DEFAULT 'Pendiente',
  -- Auditoría
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_spool, numero_junta)
);
CREATE INDEX idx_list_juntas_proyecto ON lukeapp.list_juntas(proyecto_id);
CREATE INDEX idx_list_juntas_spool    ON lukeapp.list_juntas(spool_id);
CREATE INDEX idx_list_juntas_estado   ON lukeapp.list_juntas(proyecto_id, estado);
CREATE TRIGGER trg_list_juntas_auditoria BEFORE UPDATE ON lukeapp.list_juntas
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_juntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_juntas_select" ON lukeapp.list_juntas FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_juntas_write" ON lukeapp.list_juntas FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 5. list_mto (LIST_MTO_MS en v1, 33 columnas de referencia)
-- Clave natural: proyecto_id + item
CREATE TABLE lukeapp.list_mto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  linea_id        UUID REFERENCES lukeapp.list_lineas(id),
  -- Clave natural
  item            TEXT NOT NULL,
  -- Datos de material
  descripcion     TEXT,
  tag             TEXT,
  cantidad        NUMERIC,
  unidad          TEXT,
  nps_id          UUID REFERENCES lukeapp.cat_diametros_nps(id),
  nps_texto       TEXT,
  clase_id        UUID REFERENCES lukeapp.cat_clase_piping(id),
  material        TEXT,
  norma           TEXT,
  schedule        TEXT,
  -- Adicional v4
  heat_number     TEXT,             -- opcional, para trazabilidad metalúrgica
  -- Estado
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, item)
);
CREATE INDEX idx_list_mto_proyecto ON lukeapp.list_mto(proyecto_id);
CREATE INDEX idx_list_mto_linea    ON lukeapp.list_mto(linea_id);
CREATE TRIGGER trg_list_mto_auditoria BEFORE UPDATE ON lukeapp.list_mto
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_mto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_mto_select" ON lukeapp.list_mto FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_mto_write" ON lukeapp.list_mto FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 6. list_soportes
CREATE TABLE lukeapp.list_soportes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  linea_id        UUID REFERENCES lukeapp.list_lineas(id),
  -- Clave natural
  id_soporte      TEXT NOT NULL,
  tipo_soporte_id UUID REFERENCES lukeapp.cat_tipo_soporte(id),
  descripcion     TEXT,
  -- Ubicación
  sector          TEXT,
  cwa_id          UUID REFERENCES lukeapp.cat_cwa(id),
  -- Estado
  estado          TEXT NOT NULL DEFAULT 'Pendiente',
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_soporte)
);
CREATE INDEX idx_list_soportes_proyecto ON lukeapp.list_soportes(proyecto_id);
CREATE TRIGGER trg_list_soportes_auditoria BEFORE UPDATE ON lukeapp.list_soportes
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_soportes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_soportes_select" ON lukeapp.list_soportes FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_soportes_write" ON lukeapp.list_soportes FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 7. list_valvulas
CREATE TABLE lukeapp.list_valvulas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  linea_id        UUID REFERENCES lukeapp.list_lineas(id),
  -- Clave natural
  id_valvula      TEXT NOT NULL,
  tag             TEXT,
  tipo            TEXT,
  nps_id          UUID REFERENCES lukeapp.cat_diametros_nps(id),
  nps_texto       TEXT,
  clase_id        UUID REFERENCES lukeapp.cat_clase_piping(id),
  actuador        TEXT,           -- manual, neumático, eléctrico, hidráulico
  -- Estado
  estado          TEXT NOT NULL DEFAULT 'Pendiente',
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_valvula)
);
CREATE INDEX idx_list_valvulas_proyecto ON lukeapp.list_valvulas(proyecto_id);
CREATE TRIGGER trg_list_valvulas_auditoria BEFORE UPDATE ON lukeapp.list_valvulas
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_valvulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_valvulas_select" ON lukeapp.list_valvulas FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_valvulas_write" ON lukeapp.list_valvulas FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 8. list_equipos
CREATE TABLE lukeapp.list_equipos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  -- Clave natural
  id_equipo       TEXT NOT NULL,
  tag             TEXT,
  descripcion     TEXT,
  tipo            TEXT,
  area            TEXT,
  -- Estado
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_equipo)
);
CREATE INDEX idx_list_equipos_proyecto ON lukeapp.list_equipos(proyecto_id);
CREATE TRIGGER trg_list_equipos_auditoria BEFORE UPDATE ON lukeapp.list_equipos
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_equipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_equipos_select" ON lukeapp.list_equipos FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_equipos_write" ON lukeapp.list_equipos FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 9. list_tie_ins
CREATE TABLE lukeapp.list_tie_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  linea_id        UUID REFERENCES lukeapp.list_lineas(id),
  -- Clave natural
  id_tie_in       TEXT NOT NULL,
  descripcion     TEXT,
  tipo            TEXT,
  nps_id          UUID REFERENCES lukeapp.cat_diametros_nps(id),
  -- Estado
  estado          TEXT NOT NULL DEFAULT 'Pendiente',
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_tie_in)
);
CREATE INDEX idx_list_tie_ins_proyecto ON lukeapp.list_tie_ins(proyecto_id);
CREATE TRIGGER trg_list_tie_ins_auditoria BEFORE UPDATE ON lukeapp.list_tie_ins
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_tie_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_tie_ins_select" ON lukeapp.list_tie_ins FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_tie_ins_write" ON lukeapp.list_tie_ins FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 10. list_pid (Piping and Instrumentation Diagrams)
CREATE TABLE lukeapp.list_pid (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  -- Clave natural
  id_pid          TEXT NOT NULL,
  revision        TEXT,
  descripcion     TEXT,
  estado          TEXT,
  pdf_path        TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_pid)
);
CREATE INDEX idx_list_pid_proyecto ON lukeapp.list_pid(proyecto_id);
CREATE TRIGGER trg_list_pid_auditoria BEFORE UPDATE ON lukeapp.list_pid
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_pid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_pid_select" ON lukeapp.list_pid FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_pid_write" ON lukeapp.list_pid FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 11. list_bim (LIST_Bim_MS en v1 — GUID Revit ↔ spool/soporte/válvula)
CREATE TABLE lukeapp.list_bim (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  -- Clave natural: GUID del elemento en Revit/Navisworks
  elemento_guid   TEXT NOT NULL,
  -- Vinculación con entidades
  spool_id        UUID REFERENCES lukeapp.list_spools(id),
  soporte_id      UUID REFERENCES lukeapp.list_soportes(id),
  valvula_id      UUID REFERENCES lukeapp.list_valvulas(id),
  -- Datos del modelo
  descripcion     TEXT,
  linea_numero    TEXT,
  tag             TEXT,
  autocad_size    TEXT,
  cwp_codigo      TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, elemento_guid)
);
CREATE INDEX idx_list_bim_proyecto ON lukeapp.list_bim(proyecto_id);
CREATE INDEX idx_list_bim_spool    ON lukeapp.list_bim(spool_id);
CREATE TRIGGER trg_list_bim_auditoria BEFORE UPDATE ON lukeapp.list_bim
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_bim ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_bim_select" ON lukeapp.list_bim FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_bim_write" ON lukeapp.list_bim FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 12. list_mec (mecánica — LIST_Mec_MS en v1)
CREATE TABLE lukeapp.list_mec (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  -- Clave natural
  id_mec          TEXT NOT NULL,
  tag             TEXT,
  descripcion     TEXT,
  tipo            TEXT,
  equipo_id       UUID REFERENCES lukeapp.list_equipos(id),
  -- Estado
  estado          TEXT NOT NULL DEFAULT 'Pendiente',
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_mec)
);
CREATE INDEX idx_list_mec_proyecto ON lukeapp.list_mec(proyecto_id);
CREATE TRIGGER trg_list_mec_auditoria BEFORE UPDATE ON lukeapp.list_mec
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_mec ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_mec_select" ON lukeapp.list_mec FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_mec_write" ON lukeapp.list_mec FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 13. list_esp_elem (elementos especiales mecánicos)
CREATE TABLE lukeapp.list_esp_elem (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  mec_id          UUID REFERENCES lukeapp.list_mec(id),
  -- Clave natural
  id_esp_elem     TEXT NOT NULL,
  descripcion     TEXT,
  tipo            TEXT,
  -- Estado
  estado          TEXT NOT NULL DEFAULT 'Pendiente',
  activo          BOOLEAN NOT NULL DEFAULT true,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, id_esp_elem)
);
CREATE INDEX idx_list_esp_elem_proyecto ON lukeapp.list_esp_elem(proyecto_id);
CREATE TRIGGER trg_list_esp_elem_auditoria BEFORE UPDATE ON lukeapp.list_esp_elem
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.list_esp_elem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_esp_elem_select" ON lukeapp.list_esp_elem FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "list_esp_elem_write" ON lukeapp.list_esp_elem FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- ============================================================
-- ── LOGÍSTICA (log_*) ────────────────────────────────────────
-- 6 tablas — movimientos de material y documentos
-- ============================================================

-- 1. log_spool (LOG_Spool_MS en v1)
CREATE TABLE lukeapp.log_spool (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  spool_id        UUID NOT NULL REFERENCES lukeapp.list_spools(id),
  -- Clave natural para importador
  id_spool        TEXT NOT NULL,
  -- Movimiento
  estado          TEXT NOT NULL,    -- En Fabricación / QAQC / … / Montado
  sector          TEXT,
  observacion     TEXT,
  foto_path       TEXT,             -- referencia a evidencias
  mts_montados    NUMERIC,
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Quién registra
  usuario_id      UUID REFERENCES lukeapp.usuarios(id),
  estampa         TEXT,             -- código personal para trazabilidad
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_spool_proyecto ON lukeapp.log_spool(proyecto_id);
CREATE INDEX idx_log_spool_spool    ON lukeapp.log_spool(spool_id);
CREATE INDEX idx_log_spool_estado   ON lukeapp.log_spool(proyecto_id, estado);
CREATE TRIGGER trg_log_spool_auditoria BEFORE UPDATE ON lukeapp.log_spool
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.log_spool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_spool_select" ON lukeapp.log_spool FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "log_spool_insert" ON lukeapp.log_spool FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "log_spool_update" ON lukeapp.log_spool FOR UPDATE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 2. log_materiales (LOG_Materiales_MS en v1)
CREATE TABLE lukeapp.log_materiales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  mto_id          UUID REFERENCES lukeapp.list_mto(id),
  -- Movimiento
  tipo_movimiento TEXT NOT NULL,    -- entrada, salida, ajuste, devolucion
  cantidad        NUMERIC NOT NULL,
  guia_numero     TEXT,
  observacion     TEXT,
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id      UUID REFERENCES lukeapp.usuarios(id),
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_materiales_proyecto ON lukeapp.log_materiales(proyecto_id);
CREATE INDEX idx_log_materiales_mto      ON lukeapp.log_materiales(mto_id);
CREATE TRIGGER trg_log_materiales_auditoria BEFORE UPDATE ON lukeapp.log_materiales
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.log_materiales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_materiales_select" ON lukeapp.log_materiales FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "log_materiales_insert" ON lukeapp.log_materiales FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));

-- 3. log_guia (LOG_Guia_MS en v1 — guías de despacho)
CREATE TABLE lukeapp.log_guia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  -- Clave natural
  numero_guia     TEXT NOT NULL,
  tipo            TEXT,             -- despacho, devolución, transferencia
  fecha_emision   DATE,
  origen          TEXT,
  destino         TEXT,
  observacion     TEXT,
  pdf_path        TEXT,
  usuario_id      UUID REFERENCES lukeapp.usuarios(id),
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, numero_guia)
);
CREATE INDEX idx_log_guia_proyecto ON lukeapp.log_guia(proyecto_id);
CREATE TRIGGER trg_log_guia_auditoria BEFORE UPDATE ON lukeapp.log_guia
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.log_guia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_guia_select" ON lukeapp.log_guia FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "log_guia_write" ON lukeapp.log_guia FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 4. log_pid (LOG_Pid_MS en v1)
CREATE TABLE lukeapp.log_pid (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  pid_id          UUID REFERENCES lukeapp.list_pid(id),
  evento          TEXT NOT NULL,    -- emision, revision, aprobacion, rechazo
  revision        TEXT,
  comentario      TEXT,
  usuario_id      UUID REFERENCES lukeapp.usuarios(id),
  fecha_evento    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_pid_proyecto ON lukeapp.log_pid(proyecto_id);
CREATE TRIGGER trg_log_pid_auditoria BEFORE UPDATE ON lukeapp.log_pid
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.log_pid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_pid_select" ON lukeapp.log_pid FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "log_pid_write" ON lukeapp.log_pid FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 5. log_iso (LOG_Iso_MS en v1 — gestión de isométricos)
CREATE TABLE lukeapp.log_iso (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  iso_id          UUID REFERENCES lukeapp.list_isos(id),
  evento          TEXT NOT NULL,    -- emision, revision, aprobacion, rechazo, en_construccion
  revision        TEXT,
  comentario      TEXT,
  pdf_path        TEXT,
  usuario_id      UUID REFERENCES lukeapp.usuarios(id),
  fecha_evento    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_iso_proyecto ON lukeapp.log_iso(proyecto_id);
CREATE INDEX idx_log_iso_iso      ON lukeapp.log_iso(iso_id);
CREATE TRIGGER trg_log_iso_auditoria BEFORE UPDATE ON lukeapp.log_iso
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.log_iso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_iso_select" ON lukeapp.log_iso FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "log_iso_write" ON lukeapp.log_iso FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 6. log_sdi (LOG_Sdi_MS en v1 — Solicitud de Información)
CREATE TABLE lukeapp.log_sdi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  -- Clave natural
  numero_sdi      TEXT NOT NULL,
  descripcion     TEXT,
  estado          TEXT NOT NULL DEFAULT 'Abierta',
  prioridad       TEXT,
  fecha_emision   DATE,
  fecha_respuesta DATE,
  responsable_id  UUID REFERENCES lukeapp.usuarios(id),
  respuesta       TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, numero_sdi)
);
CREATE INDEX idx_log_sdi_proyecto ON lukeapp.log_sdi(proyecto_id);
CREATE TRIGGER trg_log_sdi_auditoria BEFORE UPDATE ON lukeapp.log_sdi
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.log_sdi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_sdi_select" ON lukeapp.log_sdi FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "log_sdi_write" ON lukeapp.log_sdi FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- ============================================================
-- ── REGISTROS TERRENO (reg_*) ────────────────────────────────
-- 8 tablas — escritas desde PWA offline (PowerSync → Supabase)
-- ============================================================

-- 1. reg_ejecucion_juntas (REG_EjecucionJuntas_MS en v1)
CREATE TABLE lukeapp.reg_ejecucion_juntas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  junta_id        UUID NOT NULL REFERENCES lukeapp.list_juntas(id),
  -- Registro
  fecha_ejecucion DATE NOT NULL,
  soldador_id     UUID REFERENCES lukeapp.cat_personal(id),
  estampa_soldador TEXT,           -- desnormalizado para consultas rápidas
  proceso         TEXT,            -- SMAW, GTAW, etc.
  estado          TEXT NOT NULL,   -- Ejecutada, Aprobada, Rechazada, Reparada
  -- QA/QC
  observacion     TEXT,
  numero_rt       TEXT,            -- número de radiografía
  -- Auditoría (offline-friendly: no trigger de UPDATE frecuente)
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Sync PowerSync
  sincronizado_en TIMESTAMPTZ
);
CREATE INDEX idx_reg_ejec_proyecto ON lukeapp.reg_ejecucion_juntas(proyecto_id);
CREATE INDEX idx_reg_ejec_junta    ON lukeapp.reg_ejecucion_juntas(junta_id);
CREATE INDEX idx_reg_ejec_estado   ON lukeapp.reg_ejecucion_juntas(proyecto_id, estado);
CREATE TRIGGER trg_reg_ejec_auditoria BEFORE UPDATE ON lukeapp.reg_ejecucion_juntas
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_ejecucion_juntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_ejec_select" ON lukeapp.reg_ejecucion_juntas FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_ejec_insert" ON lukeapp.reg_ejecucion_juntas FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_ejec_update" ON lukeapp.reg_ejecucion_juntas FOR UPDATE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 2. reg_junta_adicional
CREATE TABLE lukeapp.reg_junta_adicional (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  spool_id        UUID NOT NULL REFERENCES lukeapp.list_spools(id),
  -- Datos
  numero_junta    TEXT NOT NULL,
  tipo_union_id   UUID REFERENCES lukeapp.cat_tipo_union(id),
  nps_id          UUID REFERENCES lukeapp.cat_diametros_nps(id),
  proceso         TEXT,
  soldador_id     UUID REFERENCES lukeapp.cat_personal(id),
  fecha_ejecucion DATE,
  estado          TEXT NOT NULL DEFAULT 'Ejecutada',
  observacion     TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_junta_adic_proyecto ON lukeapp.reg_junta_adicional(proyecto_id);
CREATE INDEX idx_reg_junta_adic_spool    ON lukeapp.reg_junta_adicional(spool_id);
CREATE TRIGGER trg_reg_junta_adic_auditoria BEFORE UPDATE ON lukeapp.reg_junta_adicional
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_junta_adicional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_junta_adic_select" ON lukeapp.reg_junta_adicional FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_junta_adic_insert" ON lukeapp.reg_junta_adicional FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_junta_adic_update" ON lukeapp.reg_junta_adicional FOR UPDATE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 3. reg_inspeccion_visual (QAQC)
CREATE TABLE lukeapp.reg_inspeccion_visual (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  junta_id        UUID NOT NULL REFERENCES lukeapp.list_juntas(id),
  -- Inspección
  inspector_id    UUID REFERENCES lukeapp.cat_personal(id),
  fecha_inspeccion DATE NOT NULL,
  resultado       TEXT NOT NULL,    -- Aprobada, Rechazada
  tipo_defecto    TEXT,             -- si rechazada
  proxima_etapa   TEXT,             -- NDE, PWHT, Reparar, …
  tipo_nde        TEXT,             -- RT, UT, PT, MT, …
  observacion     TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sincronizado_en TIMESTAMPTZ
);
CREATE INDEX idx_reg_insp_proyecto ON lukeapp.reg_inspeccion_visual(proyecto_id);
CREATE INDEX idx_reg_insp_junta    ON lukeapp.reg_inspeccion_visual(junta_id);
CREATE INDEX idx_reg_insp_estado   ON lukeapp.reg_inspeccion_visual(proyecto_id, resultado);
CREATE TRIGGER trg_reg_insp_auditoria BEFORE UPDATE ON lukeapp.reg_inspeccion_visual
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_inspeccion_visual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_insp_select" ON lukeapp.reg_inspeccion_visual FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_insp_insert" ON lukeapp.reg_inspeccion_visual FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_insp_update" ON lukeapp.reg_inspeccion_visual FOR UPDATE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 4. reg_dimensional_spool
CREATE TABLE lukeapp.reg_dimensional_spool (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  spool_id        UUID NOT NULL REFERENCES lukeapp.list_spools(id),
  inspector_id    UUID REFERENCES lukeapp.cat_personal(id),
  fecha_inspeccion DATE NOT NULL,
  resultado       TEXT NOT NULL,    -- Aprobado, Rechazado
  observacion     TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_dimensional_proyecto ON lukeapp.reg_dimensional_spool(proyecto_id);
CREATE INDEX idx_reg_dimensional_spool    ON lukeapp.reg_dimensional_spool(spool_id);
CREATE TRIGGER trg_reg_dimensional_auditoria BEFORE UPDATE ON lukeapp.reg_dimensional_spool
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_dimensional_spool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_dim_select" ON lukeapp.reg_dimensional_spool FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_dim_insert" ON lukeapp.reg_dimensional_spool FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));

-- 5. reg_pintura_spool
CREATE TABLE lukeapp.reg_pintura_spool (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  spool_id        UUID NOT NULL REFERENCES lukeapp.list_spools(id),
  pintura_id      UUID REFERENCES lukeapp.cat_esquema_pintura(id),
  etapa           TEXT NOT NULL,    -- Primer, Intermedia, Acabado, …
  fecha_aplicacion DATE NOT NULL,
  espesor_seco    NUMERIC,         -- micrones
  aplicador_id    UUID REFERENCES lukeapp.cat_personal(id),
  resultado       TEXT NOT NULL DEFAULT 'Aprobado',
  observacion     TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_pintura_proyecto ON lukeapp.reg_pintura_spool(proyecto_id);
CREATE INDEX idx_reg_pintura_spool    ON lukeapp.reg_pintura_spool(spool_id);
CREATE TRIGGER trg_reg_pintura_auditoria BEFORE UPDATE ON lukeapp.reg_pintura_spool
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_pintura_spool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_pintura_select" ON lukeapp.reg_pintura_spool FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_pintura_insert" ON lukeapp.reg_pintura_spool FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));

-- 6. reg_montaje_valvulas
CREATE TABLE lukeapp.reg_montaje_valvulas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  valvula_id      UUID NOT NULL REFERENCES lukeapp.list_valvulas(id),
  spool_id        UUID REFERENCES lukeapp.list_spools(id),
  responsable_id  UUID REFERENCES lukeapp.cat_personal(id),
  fecha_montaje   DATE NOT NULL,
  estado          TEXT NOT NULL,    -- Posicionada, Montada, Apretada
  torque          NUMERIC,
  observacion     TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sincronizado_en TIMESTAMPTZ
);
CREATE INDEX idx_reg_montaje_val_proyecto ON lukeapp.reg_montaje_valvulas(proyecto_id);
CREATE INDEX idx_reg_montaje_val_valvula  ON lukeapp.reg_montaje_valvulas(valvula_id);
CREATE TRIGGER trg_reg_montaje_val_auditoria BEFORE UPDATE ON lukeapp.reg_montaje_valvulas
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_montaje_valvulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_montaje_val_select" ON lukeapp.reg_montaje_valvulas FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_montaje_val_insert" ON lukeapp.reg_montaje_valvulas FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_montaje_val_update" ON lukeapp.reg_montaje_valvulas FOR UPDATE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 7. reg_montaje_soportes
CREATE TABLE lukeapp.reg_montaje_soportes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  soporte_id      UUID NOT NULL REFERENCES lukeapp.list_soportes(id),
  responsable_id  UUID REFERENCES lukeapp.cat_personal(id),
  fecha_montaje   DATE NOT NULL,
  estado          TEXT NOT NULL,    -- Posicionado, Montado, Inspeccionado
  observacion     TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sincronizado_en TIMESTAMPTZ
);
CREATE INDEX idx_reg_montaje_sop_proyecto ON lukeapp.reg_montaje_soportes(proyecto_id);
CREATE INDEX idx_reg_montaje_sop_soporte  ON lukeapp.reg_montaje_soportes(soporte_id);
CREATE TRIGGER trg_reg_montaje_sop_auditoria BEFORE UPDATE ON lukeapp.reg_montaje_soportes
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_montaje_soportes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_montaje_sop_select" ON lukeapp.reg_montaje_soportes FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_montaje_sop_insert" ON lukeapp.reg_montaje_soportes FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_montaje_sop_update" ON lukeapp.reg_montaje_soportes FOR UPDATE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 8. reg_esp_elem (mecánica)
CREATE TABLE lukeapp.reg_esp_elem (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  esp_elem_id     UUID NOT NULL REFERENCES lukeapp.list_esp_elem(id),
  responsable_id  UUID REFERENCES lukeapp.cat_personal(id),
  fecha_registro  DATE NOT NULL,
  estado          TEXT NOT NULL,
  observacion     TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_esp_elem_proyecto ON lukeapp.reg_esp_elem(proyecto_id);
CREATE INDEX idx_reg_esp_elem_elem     ON lukeapp.reg_esp_elem(esp_elem_id);
CREATE TRIGGER trg_reg_esp_elem_auditoria BEFORE UPDATE ON lukeapp.reg_esp_elem
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();
ALTER TABLE lukeapp.reg_esp_elem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_esp_elem_select" ON lukeapp.reg_esp_elem FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "reg_esp_elem_insert" ON lukeapp.reg_esp_elem FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));

-- ============================================================
-- ── RELACIONES (rel_*) ───────────────────────────────────────
-- ============================================================

-- 1. rel_pid_lineas (N:M entre PIDs y líneas)
CREATE TABLE lukeapp.rel_pid_lineas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  pid_id        UUID NOT NULL REFERENCES lukeapp.list_pid(id) ON DELETE CASCADE,
  linea_id      UUID NOT NULL REFERENCES lukeapp.list_lineas(id) ON DELETE CASCADE,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, pid_id, linea_id)
);
CREATE INDEX idx_rel_pid_lineas_proyecto ON lukeapp.rel_pid_lineas(proyecto_id);
ALTER TABLE lukeapp.rel_pid_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rel_pid_lineas_select" ON lukeapp.rel_pid_lineas FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "rel_pid_lineas_write" ON lukeapp.rel_pid_lineas FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 2. rel_sdi_iso (N:M entre SDIs e isométricos afectados)
CREATE TABLE lukeapp.rel_sdi_iso (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  sdi_id        UUID NOT NULL REFERENCES lukeapp.log_sdi(id) ON DELETE CASCADE,
  iso_id        UUID NOT NULL REFERENCES lukeapp.list_isos(id) ON DELETE CASCADE,
  creado_por    UUID REFERENCES auth.users(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, sdi_id, iso_id)
);
CREATE INDEX idx_rel_sdi_iso_proyecto ON lukeapp.rel_sdi_iso(proyecto_id);
ALTER TABLE lukeapp.rel_sdi_iso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rel_sdi_iso_select" ON lukeapp.rel_sdi_iso FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "rel_sdi_iso_write" ON lukeapp.rel_sdi_iso FOR ALL TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- ============================================================
-- ── DOCUMENTAL (doc_*) ───────────────────────────────────────
-- ============================================================

-- 1. doc_revision_events (log de revisiones de documentos)
CREATE TABLE lukeapp.doc_revision_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id),
  entidad         TEXT NOT NULL,    -- 'list_isos', 'list_pid', etc.
  registro_id     UUID NOT NULL,
  revision        TEXT,
  evento          TEXT NOT NULL,    -- emision, aprobacion, rechazo, revision
  comentario      TEXT,
  usuario_id      UUID REFERENCES lukeapp.usuarios(id),
  fecha_evento    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Auditoría
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_revision_proyecto ON lukeapp.doc_revision_events(proyecto_id);
CREATE INDEX idx_doc_revision_entidad  ON lukeapp.doc_revision_events(entidad, registro_id);
ALTER TABLE lukeapp.doc_revision_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_revision_select" ON lukeapp.doc_revision_events FOR SELECT TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));
CREATE POLICY "doc_revision_insert" ON lukeapp.doc_revision_events FOR INSERT TO authenticated
  WITH CHECK (lukeapp.tiene_membresia(proyecto_id));

-- ============================================================
-- Comentarios de documentación
-- ============================================================
COMMENT ON TABLE lukeapp.cat_fluido_servicio    IS 'Catálogo de fluidos de servicio por proyecto';
COMMENT ON TABLE lukeapp.cat_clase_piping       IS 'Clases de piping (especificaciones de materiales) por proyecto';
COMMENT ON TABLE lukeapp.cat_diametros_nps      IS 'Diámetros nominales NPS disponibles por proyecto';
COMMENT ON TABLE lukeapp.cat_personal           IS 'Catálogo de personal con estampa de soldador/inspector';
COMMENT ON TABLE lukeapp.list_lineas            IS 'Maestro de líneas de proceso (17 atributos de ingeniería)';
COMMENT ON TABLE lukeapp.list_isos             IS 'Isométricos: una hoja (sheet) por registro, clave id_linea+sheet';
COMMENT ON TABLE lukeapp.list_spools           IS 'Spools fabricados: unidad básica de trazabilidad';
COMMENT ON TABLE lukeapp.list_juntas           IS 'Juntas soldadas: clave id_spool+numero_junta, nunca se borran';
COMMENT ON TABLE lukeapp.list_mto              IS 'Lista de materiales (MTO): 33 atributos + heat_number opcional';
COMMENT ON TABLE lukeapp.list_bim              IS 'Vinculación GUID Revit ↔ spool/soporte/válvula';
COMMENT ON TABLE lukeapp.reg_ejecucion_juntas  IS 'Registro de soldadura: escrito desde PWA offline, sync via PowerSync';
COMMENT ON TABLE lukeapp.reg_inspeccion_visual IS 'Inspección visual QAQC por junta';
COMMENT ON TABLE lukeapp.doc_revision_events   IS 'Log de revisiones de documentos (ISOs, PIDs)';

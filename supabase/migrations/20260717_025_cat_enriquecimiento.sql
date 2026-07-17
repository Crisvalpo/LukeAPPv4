-- ============================================================
-- LukeAPP v4 — Migración 025: Enriquecimiento de catálogos (CAT)
-- Schema: lukeapp
-- Depende de: 20260713_002_dominios.sql, 20260715_024_importador_base_firme.sql
-- Rev. A — Julio 2026
-- ============================================================
-- (Reemplaza a un borrador previo mal numerado como 20260713_010, que
--  colisionaba con 010_importador_cubicador_fase2. Renumerada a 025.)
--
-- Motivo:
--   Los cat_* se aplanaron a codigo+descripcion y perdieron atributos de
--   ingeniería que el modelo real (piloto EIMI00413) sí usa. La extracción
--   IA de base firme (024) ya PROPONE estos valores, pero hoy no hay columnas
--   donde persistirlos. Esta migración las agrega de forma ADITIVA y nullable
--   (solo ADD COLUMN IF NOT EXISTS). No rompe el wizard de clonado (005) ni
--   las funciones del importador (usan columnas explícitas).
--
--   Tras aplicarla: cablear GestionCatalogos.tsx y el apply del importador/IA
--   para leer/escribir estos campos (ver nota de auditoría P6).
-- ============================================================

-- ─── cat_fluido_servicio ──────────────────────────────────────
ALTER TABLE lukeapp.cat_fluido_servicio
  ADD COLUMN IF NOT EXISTS nombre       TEXT,
  ADD COLUMN IF NOT EXISTS color_nombre TEXT,
  ADD COLUMN IF NOT EXISTS color_ral    TEXT;
COMMENT ON COLUMN lukeapp.cat_fluido_servicio.color_ral IS 'Código RAL de pintura del fluido (piloto: COLOR_PINTURA)';

-- ─── cat_clase_piping ─────────────────────────────────────────
ALTER TABLE lukeapp.cat_clase_piping
  ADD COLUMN IF NOT EXISTS material     TEXT,
  ADD COLUMN IF NOT EXISTS presion_psi  NUMERIC,
  ADD COLUMN IF NOT EXISTS aplicacion   TEXT;
COMMENT ON COLUMN lukeapp.cat_clase_piping.presion_max IS 'Presión de diseño en kg/cm² (piloto: PRESION_DISENO_KG)';
COMMENT ON COLUMN lukeapp.cat_clase_piping.presion_psi IS 'Presión de diseño en PSI (piloto: PRESION_DISENO_PSI)';

-- ─── cat_diametros_nps ────────────────────────────────────────
ALTER TABLE lukeapp.cat_diametros_nps
  ADD COLUMN IF NOT EXISTS tipo_material  TEXT,
  ADD COLUMN IF NOT EXISTS unidad_medida  TEXT;

-- ─── cat_aislacion_ext ────────────────────────────────────────
ALTER TABLE lukeapp.cat_aislacion_ext
  ADD COLUMN IF NOT EXISTS restriccion_pintura TEXT;

-- ─── cat_revestimiento_int ────────────────────────────────────
ALTER TABLE lukeapp.cat_revestimiento_int
  ADD COLUMN IF NOT EXISTS especificacion TEXT;

-- ─── cat_esquema_pintura ──────────────────────────────────────
ALTER TABLE lukeapp.cat_esquema_pintura
  ADD COLUMN IF NOT EXISTS sistema_aplicacion     TEXT,
  ADD COLUMN IF NOT EXISTS preparacion_superficie TEXT,
  ADD COLUMN IF NOT EXISTS espesor_total_um       NUMERIC,
  ADD COLUMN IF NOT EXISTS detalle_capas          TEXT;

-- ─── cat_porcentaje_nde ───────────────────────────────────────
ALTER TABLE lukeapp.cat_porcentaje_nde
  ADD COLUMN IF NOT EXISTS metodo     TEXT,
  ADD COLUMN IF NOT EXISTS aplicacion TEXT,
  ADD COLUMN IF NOT EXISTS norma      TEXT;

-- ─── cat_tipo_prueba ──────────────────────────────────────────
ALTER TABLE lukeapp.cat_tipo_prueba
  ADD COLUMN IF NOT EXISTS aplicacion      TEXT,
  ADD COLUMN IF NOT EXISTS condicion_diseno TEXT,
  ADD COLUMN IF NOT EXISTS medio_fluido    TEXT;

-- ─── cat_tipo_union ───────────────────────────────────────────
ALTER TABLE lukeapp.cat_tipo_union
  ADD COLUMN IF NOT EXISTS acronimo       TEXT,
  ADD COLUMN IF NOT EXISTS tipo_uniones   TEXT,
  ADD COLUMN IF NOT EXISTS metodo_trabajo TEXT,
  ADD COLUMN IF NOT EXISTS nde_requerido  TEXT,
  ADD COLUMN IF NOT EXISTS aplicacion     TEXT;

-- ─── cat_personal ─────────────────────────────────────────────
ALTER TABLE lukeapp.cat_personal
  ADD COLUMN IF NOT EXISTS rut        TEXT,
  ADD COLUMN IF NOT EXISTS cargo      TEXT,
  ADD COLUMN IF NOT EXISTS area       TEXT,
  ADD COLUMN IF NOT EXISTS supervisor TEXT,
  ADD COLUMN IF NOT EXISTS estado     TEXT;

-- ─── cat_iwp ──────────────────────────────────────────────────
ALTER TABLE lukeapp.cat_iwp
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin    DATE;

-- cat_tipo_soporte / cat_cwa / cat_cwp: coinciden con el modelo. Sin cambios.

-- ============================================================
-- Fin migración 025. Todas las columnas nullable y aditivas.
-- ============================================================

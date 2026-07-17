-- ============================================================
-- LukeAPP v4 — Migración 026: MTO↔Spool y Junta↔NDE (FK de catálogo)
-- Schema: lukeapp
-- Depende de: 20260713_002_dominios.sql, 20260717_025_cat_enriquecimiento.sql
-- Rev. A — Julio 2026
-- ============================================================
-- (Reemplaza a un borrador previo mal numerado como 20260713_011, que
--  colisionaba con 011_permiso_eliminar_proyecto. Renumerada a 026.)
--
-- Motivo (confirmado con Cristian):
--   1. list_mto.spool_id — material trazable a nivel de spool (además de línea).
--      Nullable: puede haber MTO de línea sin spool.
--   2. list_juntas.nde_id — FK a cat_porcentaje_nde (método/norma/aplicación).
--      list_juntas ya tiene porcentaje_nde numérico crudo, que se conserva.
--   Ambos ADITIVOS y nullable.
--
--   PENDIENTE de cablear (ver auditoría P6): el importador hoy escribe
--   porcentaje_nde numérico en juntas y no mapea spool en MTO. Para poblar
--   estas FK hay que extender importar_aplicar_lote (resolver el % NDE contra
--   cat_porcentaje_nde y el ID_SPOOL contra list_spools).
-- ============================================================

ALTER TABLE lukeapp.list_mto
  ADD COLUMN IF NOT EXISTS spool_id UUID REFERENCES lukeapp.list_spools(id);
CREATE INDEX IF NOT EXISTS idx_list_mto_spool ON lukeapp.list_mto(spool_id);
COMMENT ON COLUMN lukeapp.list_mto.spool_id IS 'Spool al que pertenece el material (piloto: ID_SPOOL). Nullable.';

ALTER TABLE lukeapp.list_juntas
  ADD COLUMN IF NOT EXISTS nde_id UUID REFERENCES lukeapp.cat_porcentaje_nde(id);
CREATE INDEX IF NOT EXISTS idx_list_juntas_nde ON lukeapp.list_juntas(nde_id);
COMMENT ON COLUMN lukeapp.list_juntas.nde_id IS 'Catálogo de % NDE. porcentaje_nde numérico se conserva como valor crudo.';

-- ============================================================
-- Fin migración 026.
-- ============================================================

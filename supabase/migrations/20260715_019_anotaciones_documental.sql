-- ============================================================
-- LukeAPP v4 — Migración 019: Agregar anotaciones a doc_biblioteca
-- Schema: lukeapp
-- Depende de: 004_documental_ia
-- ============================================================

ALTER TABLE lukeapp.doc_biblioteca
  ADD COLUMN IF NOT EXISTS anotaciones JSONB;

COMMENT ON COLUMN lukeapp.doc_biblioteca.anotaciones IS
  'Trazos del destacador fluorescente en el visor de documentos (canvas).';

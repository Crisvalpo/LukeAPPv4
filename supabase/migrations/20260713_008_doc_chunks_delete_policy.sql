-- ============================================================
-- LukeAPP v4 — Migración 008: política de borrado para doc_chunks
-- Schema: lukeapp
-- Depende de: 004_documental_ia
--
-- doc_chunks tenía SELECT + INSERT pero ninguna política de DELETE;
-- con RLS habilitado eso hace que cualquier DELETE sea un no-op
-- silencioso (0 filas afectadas, sin error). El ia-worker (P4) borra
-- los chunks de un documento antes de reindexarlo al reprocesar con
-- IA, así que necesita poder borrar sus propios chunks.
-- ============================================================

CREATE POLICY "doc_chunks_delete" ON lukeapp.doc_chunks
  FOR DELETE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

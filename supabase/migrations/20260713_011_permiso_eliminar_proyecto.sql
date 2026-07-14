-- ============================================================
-- LukeAPP v4 — Migración 011: Permiso de borrado de proyectos
-- Aplica sobre: Supabase self-hosted (lukeserver)
-- ============================================================

-- Solo los usuarios con acceso_global pueden eliminar proyectos en cascada.
CREATE POLICY "proyectos_delete_global" ON lukeapp.proyectos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.usuarios u
      WHERE u.id = auth.uid() AND u.acceso_global = true
    )
  );

-- ============================================================
-- LukeAPP v4 — Migración 014: Fix recursión infinita en RLS de membresias
-- Schema: lukeapp
-- Depende de: 20260713_003_gerencia_acceso_global.sql, 20260713_009_auth_registro_aprobacion.sql
--
-- La política "membresias_select" (migración 003) hacía un subquery
-- directo sobre lukeapp.membresias dentro de su propia USING clause
-- para verificar si el usuario es ADMIN del proyecto. Ese subquery
-- vuelve a evaluar la misma política RLS sobre membresias, que a su
-- vez repite el subquery — Postgres detecta esto y lanza
-- "infinite recursion detected in policy for relation membresias".
--
-- Fix: reemplazar el subquery directo por lukeapp.puede_administrar_accesos(),
-- que es SECURITY DEFINER y por lo tanto no re-evalúa RLS al consultar
-- membresias internamente (mismo patrón ya usado en las RPCs de P5).
-- ============================================================

DROP POLICY IF EXISTS "membresias_select" ON lukeapp.membresias;

CREATE POLICY "membresias_select" ON lukeapp.membresias
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR lukeapp.puede_administrar_accesos(proyecto_id)
  );

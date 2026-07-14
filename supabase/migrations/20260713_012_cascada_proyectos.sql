-- ============================================================
-- LukeAPP v4 — Migración 012: Habilitar borrado en cascada para registros y logs
-- Aplica sobre: Supabase self-hosted (lukeserver)
-- ============================================================

DO $$ 
DECLARE
  tabla text;
  tablas text[] := ARRAY[
    'evidencias',
    'import_lotes',
    'log_spool',
    'log_materiales',
    'log_guia',
    'log_pid',
    'log_iso',
    'log_sdi',
    'reg_ejecucion_juntas',
    'reg_junta_adicional',
    'reg_inspeccion_visual',
    'reg_dimensional_spool',
    'reg_pintura_spool',
    'reg_montaje_valvulas',
    'reg_montaje_soportes',
    'reg_esp_elem',
    'rel_pid_lineas',
    'rel_sdi_iso',
    'doc_revision_events',
    'doc_chunks'
  ];
BEGIN
  FOREACH tabla IN ARRAY tablas
  LOOP
    -- Validamos que la tabla exista para evitar errores
    IF to_regclass('lukeapp.' || tabla) IS NOT NULL THEN
      -- Eliminar la restricción actual
      EXECUTE format('ALTER TABLE lukeapp.%I DROP CONSTRAINT IF EXISTS %I_proyecto_id_fkey', tabla, tabla);
      
      -- Volver a crearla con ON DELETE CASCADE
      EXECUTE format('ALTER TABLE lukeapp.%I ADD CONSTRAINT %I_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE', tabla, tabla);
    END IF;
  END LOOP;
  
  -- Para los usuarios que hayan solicitado unirse a un proyecto que luego fue borrado, 
  -- seteamos el proyecto solicitado a NULL en lugar de borrar al usuario.
  IF to_regclass('lukeapp.usuarios') IS NOT NULL THEN
    ALTER TABLE lukeapp.usuarios DROP CONSTRAINT IF EXISTS usuarios_proyecto_solicitado_id_fkey;
    ALTER TABLE lukeapp.usuarios ADD CONSTRAINT usuarios_proyecto_solicitado_id_fkey 
      FOREIGN KEY (proyecto_solicitado_id) REFERENCES lukeapp.proyectos(id) ON DELETE SET NULL;
  END IF;
END $$;

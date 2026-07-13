-- ============================================================
-- LukeAPP v4 — Migración 003: Rol GERENCIA + acceso_global
-- Schema: lukeapp
-- Depende de: 20260713_001_nucleo.sql, 20260713_002_dominios.sql
-- Rev. B — Julio 2026
--
-- Cambios:
-- 1. Agregar 'GERENCIA' al ENUM lukeapp.rol_usuario
-- 2. Agregar columna acceso_global en lukeapp.usuarios
-- 3. Crear función tiene_acceso_lectura() que reemplaza
--    tiene_membresia() en todas las políticas SELECT
--    (acceso si membresía activa OR acceso_global = true)
-- 4. Actualizar políticas SELECT de todas las tablas con proyecto_id
-- 5. La función tiene_membresia() queda para políticas de ESCRITURA
--    (escritura NUNCA global, siempre requiere membresía)
-- ============================================================

-- ─── 1. Agregar GERENCIA al ENUM ─────────────────────────────
ALTER TYPE lukeapp.rol_usuario ADD VALUE IF NOT EXISTS 'GERENCIA';

-- ─── 2. Columna acceso_global en usuarios ─────────────────────
ALTER TABLE lukeapp.usuarios
  ADD COLUMN IF NOT EXISTS acceso_global BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN lukeapp.usuarios.acceso_global IS
  'Si true, el usuario tiene LECTURA de toda la cartera sin membresía por proyecto (rol GERENCIA). Escritura siempre requiere membresía.';

-- ─── 3. Función de lectura: membresía OR acceso_global ────────
CREATE OR REPLACE FUNCTION lukeapp.tiene_acceso_lectura(p_proyecto_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    -- Opción A: tiene membresía activa en el proyecto
    EXISTS (
      SELECT 1 FROM lukeapp.membresias m
      WHERE m.usuario_id = auth.uid()
        AND m.proyecto_id = p_proyecto_id
        AND m.activo = true
    )
    OR
    -- Opción B: acceso global (lectura de toda la cartera)
    EXISTS (
      SELECT 1 FROM lukeapp.usuarios u
      WHERE u.id = auth.uid()
        AND u.acceso_global = true
    );
$$;

-- ─── 4. Actualizar políticas SELECT de todas las tablas ───────
-- Usamos tiene_acceso_lectura() para SELECT y mantenemos
-- tiene_membresia() para INSERT/UPDATE/DELETE (escritura nunca global)

-- == NÚCLEO ==

-- proyectos: SELECT con acceso_global (el id del proyecto ES p_proyecto_id)
DROP POLICY IF EXISTS "proyectos_select" ON lukeapp.proyectos;
CREATE POLICY "proyectos_select" ON lukeapp.proyectos
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(id));

-- proyecto_config
DROP POLICY IF EXISTS "proyecto_config_select" ON lukeapp.proyecto_config;
CREATE POLICY "proyecto_config_select" ON lukeapp.proyecto_config
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- membresias: el acceso_global puede ver todas las membresías de todos los proyectos
DROP POLICY IF EXISTS "membresias_select_self" ON lukeapp.membresias;
DROP POLICY IF EXISTS "membresias_select_admin" ON lukeapp.membresias;
CREATE POLICY "membresias_select" ON lukeapp.membresias
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM lukeapp.membresias m2
      WHERE m2.usuario_id = auth.uid()
        AND m2.proyecto_id = membresias.proyecto_id
        AND m2.rol = 'ADMIN'
        AND m2.activo
    )
    OR EXISTS (
      SELECT 1 FROM lukeapp.usuarios u
      WHERE u.id = auth.uid() AND u.acceso_global = true
    )
  );

-- permisos_rol
DROP POLICY IF EXISTS "permisos_rol_select" ON lukeapp.permisos_rol;
CREATE POLICY "permisos_rol_select" ON lukeapp.permisos_rol
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- evidencias
DROP POLICY IF EXISTS "evidencias_select" ON lukeapp.evidencias;
CREATE POLICY "evidencias_select" ON lukeapp.evidencias
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- import_perfiles
DROP POLICY IF EXISTS "import_perfiles_select" ON lukeapp.import_perfiles;
CREATE POLICY "import_perfiles_select" ON lukeapp.import_perfiles
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- import_lotes
DROP POLICY IF EXISTS "import_lotes_select" ON lukeapp.import_lotes;
CREATE POLICY "import_lotes_select" ON lukeapp.import_lotes
  FOR SELECT TO authenticated
  USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- import_filas (via join a lote)
DROP POLICY IF EXISTS "import_filas_select" ON lukeapp.import_filas;
CREATE POLICY "import_filas_select" ON lukeapp.import_filas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lukeapp.import_lotes l
      WHERE l.id = import_filas.lote_id
        AND lukeapp.tiene_acceso_lectura(l.proyecto_id)
    )
  );

-- == CATÁLOGOS (cat_*) ==

DROP POLICY IF EXISTS "cat_fluido_select"        ON lukeapp.cat_fluido_servicio;
DROP POLICY IF EXISTS "cat_clase_select"         ON lukeapp.cat_clase_piping;
DROP POLICY IF EXISTS "cat_nps_select"           ON lukeapp.cat_diametros_nps;
DROP POLICY IF EXISTS "cat_aislacion_select"     ON lukeapp.cat_aislacion_ext;
DROP POLICY IF EXISTS "cat_revestimiento_select" ON lukeapp.cat_revestimiento_int;
DROP POLICY IF EXISTS "cat_pintura_select"       ON lukeapp.cat_esquema_pintura;
DROP POLICY IF EXISTS "cat_nde_select"           ON lukeapp.cat_porcentaje_nde;
DROP POLICY IF EXISTS "cat_prueba_select"        ON lukeapp.cat_tipo_prueba;
DROP POLICY IF EXISTS "cat_soporte_select"       ON lukeapp.cat_tipo_soporte;
DROP POLICY IF EXISTS "cat_union_select"         ON lukeapp.cat_tipo_union;
DROP POLICY IF EXISTS "cat_personal_select"      ON lukeapp.cat_personal;
DROP POLICY IF EXISTS "cat_cwa_select"           ON lukeapp.cat_cwa;
DROP POLICY IF EXISTS "cat_cwp_select"           ON lukeapp.cat_cwp;
DROP POLICY IF EXISTS "cat_iwp_select"           ON lukeapp.cat_iwp;

CREATE POLICY "cat_fluido_select"        ON lukeapp.cat_fluido_servicio   FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_clase_select"         ON lukeapp.cat_clase_piping      FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_nps_select"           ON lukeapp.cat_diametros_nps     FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_aislacion_select"     ON lukeapp.cat_aislacion_ext     FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_revestimiento_select" ON lukeapp.cat_revestimiento_int FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_pintura_select"       ON lukeapp.cat_esquema_pintura   FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_nde_select"           ON lukeapp.cat_porcentaje_nde    FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_prueba_select"        ON lukeapp.cat_tipo_prueba       FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_soporte_select"       ON lukeapp.cat_tipo_soporte      FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_union_select"         ON lukeapp.cat_tipo_union        FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_personal_select"      ON lukeapp.cat_personal          FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_cwa_select"           ON lukeapp.cat_cwa               FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_cwp_select"           ON lukeapp.cat_cwp               FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "cat_iwp_select"           ON lukeapp.cat_iwp               FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- == MAESTROS (list_*) ==

DROP POLICY IF EXISTS "list_lineas_select"    ON lukeapp.list_lineas;
DROP POLICY IF EXISTS "list_isos_select"      ON lukeapp.list_isos;
DROP POLICY IF EXISTS "list_spools_select"    ON lukeapp.list_spools;
DROP POLICY IF EXISTS "list_juntas_select"    ON lukeapp.list_juntas;
DROP POLICY IF EXISTS "list_mto_select"       ON lukeapp.list_mto;
DROP POLICY IF EXISTS "list_soportes_select"  ON lukeapp.list_soportes;
DROP POLICY IF EXISTS "list_valvulas_select"  ON lukeapp.list_valvulas;
DROP POLICY IF EXISTS "list_equipos_select"   ON lukeapp.list_equipos;
DROP POLICY IF EXISTS "list_tie_ins_select"   ON lukeapp.list_tie_ins;
DROP POLICY IF EXISTS "list_pid_select"       ON lukeapp.list_pid;
DROP POLICY IF EXISTS "list_bim_select"       ON lukeapp.list_bim;
DROP POLICY IF EXISTS "list_mec_select"       ON lukeapp.list_mec;
DROP POLICY IF EXISTS "list_esp_elem_select"  ON lukeapp.list_esp_elem;

CREATE POLICY "list_lineas_select"   ON lukeapp.list_lineas    FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_isos_select"     ON lukeapp.list_isos      FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_spools_select"   ON lukeapp.list_spools    FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_juntas_select"   ON lukeapp.list_juntas    FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_mto_select"      ON lukeapp.list_mto       FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_soportes_select" ON lukeapp.list_soportes  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_valvulas_select" ON lukeapp.list_valvulas  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_equipos_select"  ON lukeapp.list_equipos   FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_tie_ins_select"  ON lukeapp.list_tie_ins   FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_pid_select"      ON lukeapp.list_pid       FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_bim_select"      ON lukeapp.list_bim       FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_mec_select"      ON lukeapp.list_mec       FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "list_esp_elem_select" ON lukeapp.list_esp_elem  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- == LOGÍSTICA (log_*) ==

DROP POLICY IF EXISTS "log_spool_select"      ON lukeapp.log_spool;
DROP POLICY IF EXISTS "log_materiales_select" ON lukeapp.log_materiales;
DROP POLICY IF EXISTS "log_guia_select"       ON lukeapp.log_guia;
DROP POLICY IF EXISTS "log_pid_select"        ON lukeapp.log_pid;
DROP POLICY IF EXISTS "log_iso_select"        ON lukeapp.log_iso;
DROP POLICY IF EXISTS "log_sdi_select"        ON lukeapp.log_sdi;

CREATE POLICY "log_spool_select"      ON lukeapp.log_spool      FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "log_materiales_select" ON lukeapp.log_materiales FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "log_guia_select"       ON lukeapp.log_guia       FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "log_pid_select"        ON lukeapp.log_pid        FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "log_iso_select"        ON lukeapp.log_iso        FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "log_sdi_select"        ON lukeapp.log_sdi        FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- == REGISTROS TERRENO (reg_*) ==

DROP POLICY IF EXISTS "reg_ejec_select"           ON lukeapp.reg_ejecucion_juntas;
DROP POLICY IF EXISTS "reg_junta_adic_select"     ON lukeapp.reg_junta_adicional;
DROP POLICY IF EXISTS "reg_insp_select"           ON lukeapp.reg_inspeccion_visual;
DROP POLICY IF EXISTS "reg_dim_select"            ON lukeapp.reg_dimensional_spool;
DROP POLICY IF EXISTS "reg_pintura_select"        ON lukeapp.reg_pintura_spool;
DROP POLICY IF EXISTS "reg_montaje_val_select"    ON lukeapp.reg_montaje_valvulas;
DROP POLICY IF EXISTS "reg_montaje_sop_select"    ON lukeapp.reg_montaje_soportes;
DROP POLICY IF EXISTS "reg_esp_elem_select"       ON lukeapp.reg_esp_elem;

CREATE POLICY "reg_ejec_select"        ON lukeapp.reg_ejecucion_juntas FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "reg_junta_adic_select"  ON lukeapp.reg_junta_adicional  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "reg_insp_select"        ON lukeapp.reg_inspeccion_visual FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "reg_dim_select"         ON lukeapp.reg_dimensional_spool FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "reg_pintura_select"     ON lukeapp.reg_pintura_spool     FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "reg_montaje_val_select" ON lukeapp.reg_montaje_valvulas  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "reg_montaje_sop_select" ON lukeapp.reg_montaje_soportes  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "reg_esp_elem_select"    ON lukeapp.reg_esp_elem          FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- == RELACIONES (rel_*) ==

DROP POLICY IF EXISTS "rel_pid_lineas_select" ON lukeapp.rel_pid_lineas;
DROP POLICY IF EXISTS "rel_sdi_iso_select"    ON lukeapp.rel_sdi_iso;

CREATE POLICY "rel_pid_lineas_select" ON lukeapp.rel_pid_lineas FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));
CREATE POLICY "rel_sdi_iso_select"    ON lukeapp.rel_sdi_iso    FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- == DOCUMENTAL (doc_*) ==

DROP POLICY IF EXISTS "doc_revision_select" ON lukeapp.doc_revision_events;
CREATE POLICY "doc_revision_select" ON lukeapp.doc_revision_events FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

-- ─── 5. Comentarios ───────────────────────────────────────────
COMMENT ON FUNCTION lukeapp.tiene_acceso_lectura(UUID) IS
  'Lectura permitida si: (a) membresía activa en el proyecto, o (b) acceso_global = true en usuarios (rol GERENCIA). Escritura SIEMPRE requiere membresía — usar tiene_membresia().';

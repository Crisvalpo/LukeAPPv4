-- ============================================================
-- LukeAPP v4 — Migración 006: Importador Excel del cubicador (M3 / P3)
-- Schema: lukeapp
-- Aplica sobre: Supabase self-hosted (lukeserver)
--
-- Motor de staging + diff + aplicación transaccional para
-- list_lineas y list_mto (extensible a más tablas).
-- Claves naturales: lineas → id_linea; mto → item.
-- Reglas (AGENTS.md):
--   - Nunca se escribe directo del Excel a list_*: todo pasa por
--     import_lotes/import_filas.
--   - Filas ausentes NUNCA se borran: se marcan ausente_en_revision
--     y requieren aprobación explícita; con avance de terreno son
--     conflicto bloqueante.
--   - Aplicar un lote es transaccional: todo el diff aprobado o nada.
-- ============================================================

-- ─── 1. Columna de marcado de ausentes (nunca borrar) ───────
ALTER TABLE lukeapp.list_lineas ADD COLUMN IF NOT EXISTS ausente_en_revision BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lukeapp.list_mto    ADD COLUMN IF NOT EXISTS ausente_en_revision BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Helpers ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lukeapp.importar_es_editor(p_proyecto_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lukeapp.membresias m
    WHERE m.usuario_id = auth.uid() AND m.proyecto_id = p_proyecto_id
      AND m.activo AND m.rol IN ('ADMIN', 'OT')
  );
$$;

CREATE OR REPLACE FUNCTION lukeapp.importar_num_valido(p_valor TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_valor IS NULL OR trim(p_valor) = ''
         OR trim(p_valor) ~ '^[-+]?[0-9]+([.,][0-9]+)?$';
$$;

CREATE OR REPLACE FUNCTION lukeapp.importar_a_num(p_valor TEXT)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN p_valor IS NULL OR trim(p_valor) = '' THEN NULL
              ELSE replace(trim(p_valor), ',', '.')::numeric END;
$$;

-- Campo a campo: agrega {campo:{antes,despues}} si difieren
CREATE OR REPLACE FUNCTION lukeapp.importar_diff_campo(
  p_diff JSONB, p_campo TEXT, p_antes TEXT, p_despues TEXT
) RETURNS JSONB LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_antes IS DISTINCT FROM p_despues
    THEN p_diff || jsonb_build_object(p_campo, jsonb_build_object('antes', p_antes, 'despues', p_despues))
    ELSE p_diff END;
$$;

-- ─── 3. Crear lote de importación (staging) ──────────────────
-- p_filas: array JSONB de payloads ya mapeados a campos canónicos.
--   list_lineas: id_linea*, descripcion, fluido_codigo, clase_codigo, nps_texto, longitud_total
--   list_mto:    item*, id_linea, descripcion, tag, cantidad, unidad, nps_texto,
--                clase_codigo, material, norma, schedule, heat_number
CREATE OR REPLACE FUNCTION lukeapp.importar_crear_lote(
  p_proyecto_id     UUID,
  p_tabla_destino   TEXT,
  p_archivo_nombre  TEXT,
  p_hash_archivo    TEXT,
  p_storage_path    TEXT,
  p_mapeo           JSONB,
  p_filas           JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_perfil_id  UUID;
  v_lote_id    UUID;
  v_campo_clave TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Se requiere un usuario autenticado';
  END IF;
  IF NOT lukeapp.importar_es_editor(p_proyecto_id) THEN
    RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto para importar';
  END IF;
  IF p_tabla_destino NOT IN ('list_lineas', 'list_mto') THEN
    RAISE EXCEPTION 'Tabla destino no soportada: %', p_tabla_destino;
  END IF;
  IF p_filas IS NULL OR jsonb_typeof(p_filas) <> 'array' OR jsonb_array_length(p_filas) = 0 THEN
    RAISE EXCEPTION 'El lote no contiene filas';
  END IF;

  v_campo_clave := CASE p_tabla_destino WHEN 'list_lineas' THEN 'id_linea' ELSE 'item' END;

  -- Perfil: reusar el vigente del proyecto+tabla o crear uno
  SELECT id INTO v_perfil_id FROM lukeapp.import_perfiles
  WHERE proyecto_id = p_proyecto_id AND tabla_destino = p_tabla_destino AND activo
  ORDER BY creado_en DESC LIMIT 1;

  IF v_perfil_id IS NULL THEN
    INSERT INTO lukeapp.import_perfiles (proyecto_id, nombre, tabla_destino, mapeo, creado_por)
    VALUES (p_proyecto_id, 'Cubicador — ' || p_tabla_destino, p_tabla_destino, COALESCE(p_mapeo, '{}'::jsonb), v_uid)
    RETURNING id INTO v_perfil_id;
  ELSIF p_mapeo IS NOT NULL THEN
    UPDATE lukeapp.import_perfiles
    SET mapeo = p_mapeo, actualizado_por = v_uid
    WHERE id = v_perfil_id;
  END IF;

  INSERT INTO lukeapp.import_lotes
    (proyecto_id, perfil_id, archivo_storage_path, hash_archivo, estado, origen, creado_por,
     resumen)
  VALUES
    (p_proyecto_id, v_perfil_id, p_storage_path, p_hash_archivo, 'cargado', 'manual', v_uid,
     jsonb_build_object('archivo', p_archivo_nombre, 'n_filas_archivo', jsonb_array_length(p_filas)))
  RETURNING id INTO v_lote_id;

  INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural)
  SELECT v_lote_id, t.ord::int, t.value, NULLIF(upper(trim(t.value ->> v_campo_clave)), '')
  FROM jsonb_array_elements(p_filas) WITH ORDINALITY AS t(value, ord);

  PERFORM lukeapp.importar_calcular_diff(v_lote_id);
  RETURN v_lote_id;
END;
$$;

-- ─── 4. Motor de diff ────────────────────────────────────────
CREATE OR REPLACE FUNCTION lukeapp.importar_calcular_diff(p_lote_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_lote   RECORD;
  v_tabla  TEXT;
  v_fila   RECORD;
  v_act    RECORD;
  v_diff   JSONB;
  v_desc   TEXT; v_fluido TEXT; v_clase TEXT; v_nps TEXT; v_num TEXT;
  v_tag TEXT; v_unidad TEXT; v_material TEXT; v_norma TEXT; v_sched TEXT;
  v_heat TEXT; v_linea_ref TEXT;
BEGIN
  SELECT l.*, p.tabla_destino INTO v_lote
  FROM lukeapp.import_lotes l JOIN lukeapp.import_perfiles p ON p.id = l.perfil_id
  WHERE l.id = p_lote_id FOR UPDATE OF l;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lote % no existe', p_lote_id; END IF;
  IF NOT lukeapp.importar_es_editor(v_lote.proyecto_id) THEN
    RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto';
  END IF;
  IF v_lote.estado NOT IN ('cargado', 'validado', 'diff_listo') THEN
    RAISE EXCEPTION 'El lote está en estado % y no admite recálculo', v_lote.estado;
  END IF;
  v_tabla := v_lote.tabla_destino;

  -- Limpiar ausentes sintéticos de un cálculo anterior (nro_fila negativo)
  DELETE FROM lukeapp.import_filas WHERE lote_id = p_lote_id AND nro_fila < 0;

  -- Errores estructurales: sin clave / clave duplicada en el archivo
  UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false,
    error_detalle = 'Falta el valor de la clave (' || CASE v_tabla WHEN 'list_lineas' THEN 'id_linea' ELSE 'item' END || ')'
  WHERE lote_id = p_lote_id AND (clave_natural IS NULL OR clave_natural = '');

  UPDATE lukeapp.import_filas f SET accion = 'error', aprobada = false,
    error_detalle = 'Clave duplicada en el archivo (primera aparición en fila ' ||
      (SELECT min(f2.nro_fila) FROM lukeapp.import_filas f2
       WHERE f2.lote_id = f.lote_id AND f2.clave_natural = f.clave_natural) || ')'
  WHERE f.lote_id = p_lote_id AND f.clave_natural IS NOT NULL AND f.clave_natural <> ''
    AND EXISTS (
      SELECT 1 FROM lukeapp.import_filas f2
      WHERE f2.lote_id = f.lote_id AND f2.clave_natural = f.clave_natural
        AND f2.nro_fila < f.nro_fila
    );

  -- Clasificación fila a fila
  FOR v_fila IN
    SELECT id, nro_fila, payload, clave_natural FROM lukeapp.import_filas
    WHERE lote_id = p_lote_id AND nro_fila > 0
      AND (accion IS NULL OR accion NOT IN ('error'))
    ORDER BY nro_fila
  LOOP
    IF v_tabla = 'list_lineas' THEN
      v_num := v_fila.payload ->> 'longitud_total';
      IF NOT lukeapp.importar_num_valido(v_num) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false,
          error_detalle = 'longitud_total no es numérico: "' || v_num || '"'
        WHERE id = v_fila.id;
        CONTINUE;
      END IF;

      v_desc   := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_fluido := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      v_clase  := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      v_nps    := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');

      SELECT l.id, l.descripcion, upper(fc.codigo) AS fluido_codigo, upper(cp.codigo) AS clase_codigo,
             l.nps_texto, l.longitud_total, l.ausente_en_revision, l.activo
      INTO v_act
      FROM lukeapp.list_lineas l
      LEFT JOIN lukeapp.cat_fluido_servicio fc ON fc.id = l.fluido_id
      LEFT JOIN lukeapp.cat_clase_piping cp    ON cp.id = l.clase_id
      WHERE l.proyecto_id = v_lote.proyecto_id AND upper(trim(l.id_linea)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL
        WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion',    v_act.descripcion,             v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'fluido_codigo',  v_act.fluido_codigo,           v_fluido);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'clase_codigo',   v_act.clase_codigo,            v_clase);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_texto',      v_act.nps_texto,               v_nps);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'longitud_total', v_act.longitud_total::text,
                                              lukeapp.importar_a_num(v_num)::text);
        IF v_act.ausente_en_revision THEN
          v_diff := v_diff || jsonb_build_object('ausente_en_revision',
                      jsonb_build_object('antes', 'true', 'despues', 'false'));
        END IF;

        IF v_diff = '{}'::jsonb THEN
          UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL, error_detalle = NULL
          WHERE id = v_fila.id;
        ELSE
          UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff, error_detalle = NULL
          WHERE id = v_fila.id;
        END IF;
      END IF;

    ELSE  -- list_mto
      v_num := v_fila.payload ->> 'cantidad';
      IF NOT lukeapp.importar_num_valido(v_num) THEN
        UPDATE lukeapp.import_filas SET accion = 'error', aprobada = false,
          error_detalle = 'cantidad no es numérica: "' || v_num || '"'
        WHERE id = v_fila.id;
        CONTINUE;
      END IF;

      v_desc      := NULLIF(trim(v_fila.payload ->> 'descripcion'), '');
      v_tag       := NULLIF(trim(v_fila.payload ->> 'tag'), '');
      v_unidad    := NULLIF(trim(v_fila.payload ->> 'unidad'), '');
      v_nps       := NULLIF(trim(v_fila.payload ->> 'nps_texto'), '');
      v_clase     := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      v_material  := NULLIF(trim(v_fila.payload ->> 'material'), '');
      v_norma     := NULLIF(trim(v_fila.payload ->> 'norma'), '');
      v_sched     := NULLIF(trim(v_fila.payload ->> 'schedule'), '');
      v_heat      := NULLIF(trim(v_fila.payload ->> 'heat_number'), '');
      v_linea_ref := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');

      SELECT m.id, m.descripcion, m.tag, m.cantidad, m.unidad, m.nps_texto,
             upper(cp.codigo) AS clase_codigo, m.material, m.norma, m.schedule, m.heat_number,
             upper(trim(l.id_linea)) AS linea_codigo, m.ausente_en_revision, m.activo
      INTO v_act
      FROM lukeapp.list_mto m
      LEFT JOIN lukeapp.cat_clase_piping cp ON cp.id = m.clase_id
      LEFT JOIN lukeapp.list_lineas l       ON l.id = m.linea_id
      WHERE m.proyecto_id = v_lote.proyecto_id AND upper(trim(m.item)) = v_fila.clave_natural;

      IF NOT FOUND THEN
        UPDATE lukeapp.import_filas SET accion = 'nueva', aprobada = true, diff = NULL, error_detalle = NULL
        WHERE id = v_fila.id;
      ELSE
        v_diff := '{}'::jsonb;
        v_diff := lukeapp.importar_diff_campo(v_diff, 'descripcion', v_act.descripcion, v_desc);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'tag',         v_act.tag,         v_tag);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'cantidad',    v_act.cantidad::text,
                                              lukeapp.importar_a_num(v_num)::text);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'unidad',      v_act.unidad,      v_unidad);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'nps_texto',   v_act.nps_texto,   v_nps);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'clase_codigo',v_act.clase_codigo,v_clase);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'material',    v_act.material,    v_material);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'norma',       v_act.norma,       v_norma);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'schedule',    v_act.schedule,    v_sched);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'heat_number', v_act.heat_number, v_heat);
        v_diff := lukeapp.importar_diff_campo(v_diff, 'id_linea',    v_act.linea_codigo, v_linea_ref);
        IF v_act.ausente_en_revision THEN
          v_diff := v_diff || jsonb_build_object('ausente_en_revision',
                      jsonb_build_object('antes', 'true', 'despues', 'false'));
        END IF;

        IF v_diff = '{}'::jsonb THEN
          UPDATE lukeapp.import_filas SET accion = 'sin_cambio', aprobada = false, diff = NULL, error_detalle = NULL
          WHERE id = v_fila.id;
        ELSE
          UPDATE lukeapp.import_filas SET accion = 'modificada', aprobada = true, diff = v_diff, error_detalle = NULL
          WHERE id = v_fila.id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Ausentes: filas activas del destino que no vienen en el archivo.
  -- Nunca se borran; requieren aprobación explícita. Con avance → conflicto.
  IF v_tabla = 'list_lineas' THEN
    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, aprobada, error_detalle)
    SELECT p_lote_id,
           -row_number() OVER (ORDER BY l.id_linea),
           jsonb_build_object('id_linea', l.id_linea, 'descripcion', l.descripcion,
                              'nps_texto', l.nps_texto, 'longitud_total', l.longitud_total),
           upper(trim(l.id_linea)), 'ausente', false,
           CASE WHEN a.avance > 0
                THEN 'CONFLICTO: la línea tiene ' || a.avance || ' junta(s) con avance de terreno — resolver con OT antes de marcar ausente'
           END
    FROM lukeapp.list_lineas l
    LEFT JOIN LATERAL (
      SELECT count(*) AS avance
      FROM lukeapp.list_juntas j
      JOIN lukeapp.reg_ejecucion_juntas rj ON rj.junta_id = j.id
      WHERE j.linea_id = l.id
    ) a ON true
    WHERE l.proyecto_id = v_lote.proyecto_id AND l.activo AND NOT l.ausente_en_revision
      AND upper(trim(l.id_linea)) NOT IN (
        SELECT clave_natural FROM lukeapp.import_filas
        WHERE lote_id = p_lote_id AND nro_fila > 0 AND clave_natural IS NOT NULL
      );
  ELSE
    INSERT INTO lukeapp.import_filas (lote_id, nro_fila, payload, clave_natural, accion, aprobada)
    SELECT p_lote_id,
           -row_number() OVER (ORDER BY m.item),
           jsonb_build_object('item', m.item, 'descripcion', m.descripcion,
                              'cantidad', m.cantidad, 'unidad', m.unidad, 'nps_texto', m.nps_texto),
           upper(trim(m.item)), 'ausente', false
    FROM lukeapp.list_mto m
    WHERE m.proyecto_id = v_lote.proyecto_id AND m.activo AND NOT m.ausente_en_revision
      AND upper(trim(m.item)) NOT IN (
        SELECT clave_natural FROM lukeapp.import_filas
        WHERE lote_id = p_lote_id AND nro_fila > 0 AND clave_natural IS NOT NULL
      );
  END IF;

  -- Resumen y estado
  UPDATE lukeapp.import_lotes SET
    estado = 'diff_listo',
    actualizado_por = v_uid,
    resumen = COALESCE(resumen, '{}'::jsonb) || (
      SELECT jsonb_build_object(
        'n_nuevas',     count(*) FILTER (WHERE accion = 'nueva'),
        'n_modificadas',count(*) FILTER (WHERE accion = 'modificada'),
        'n_ausentes',   count(*) FILTER (WHERE accion = 'ausente'),
        'n_sin_cambio', count(*) FILTER (WHERE accion = 'sin_cambio'),
        'n_errores',    count(*) FILTER (WHERE accion = 'error'),
        'n_conflictos', count(*) FILTER (WHERE accion = 'ausente' AND error_detalle LIKE 'CONFLICTO%')
      ) FROM lukeapp.import_filas WHERE lote_id = p_lote_id
    )
  WHERE id = p_lote_id;
END;
$$;

-- ─── 5. Aprobar / desaprobar filas ───────────────────────────
CREATE OR REPLACE FUNCTION lukeapp.importar_aprobar_filas(
  p_lote_id UUID, p_fila_ids UUID[], p_aprobada BOOLEAN
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_lote RECORD;
  v_n INT;
BEGIN
  SELECT * INTO v_lote FROM lukeapp.import_lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote % no existe', p_lote_id; END IF;
  IF NOT lukeapp.importar_es_editor(v_lote.proyecto_id) THEN
    RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto';
  END IF;
  IF v_lote.estado <> 'diff_listo' THEN
    RAISE EXCEPTION 'El lote está en estado % y no admite cambios de aprobación', v_lote.estado;
  END IF;

  UPDATE lukeapp.import_filas SET aprobada = p_aprobada
  WHERE lote_id = p_lote_id AND id = ANY(p_fila_ids)
    AND accion IN ('nueva', 'modificada', 'ausente')
    -- Los conflictos bloqueantes no se pueden aprobar (COALESCE: error_detalle NULL es el caso normal, no un conflicto)
    AND NOT (accion = 'ausente' AND p_aprobada AND COALESCE(error_detalle, '') LIKE 'CONFLICTO%');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ─── 6. Aplicación transaccional del lote aprobado ───────────
CREATE OR REPLACE FUNCTION lukeapp.importar_aplicar_lote(p_lote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = lukeapp, public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_lote  RECORD;
  v_tabla TEXT;
  v_fila  RECORD;
  v_fluido_id UUID; v_clase_id UUID; v_linea_id UUID;
  v_cod TEXT;
  n_ins INT := 0; n_upd INT := 0; n_aus INT := 0;
  v_resumen JSONB;
BEGIN
  SELECT l.*, p.tabla_destino INTO v_lote
  FROM lukeapp.import_lotes l JOIN lukeapp.import_perfiles p ON p.id = l.perfil_id
  WHERE l.id = p_lote_id FOR UPDATE OF l;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lote % no existe', p_lote_id; END IF;
  IF NOT lukeapp.importar_es_editor(v_lote.proyecto_id) THEN
    RAISE EXCEPTION 'Requiere rol ADMIN u OT en el proyecto';
  END IF;
  IF v_lote.estado <> 'diff_listo' THEN
    RAISE EXCEPTION 'El lote está en estado %; solo se aplica desde diff_listo', v_lote.estado;
  END IF;
  v_tabla := v_lote.tabla_destino;

  -- Guardia: un conflicto jamás llega aprobado, pero el lote es todo-o-nada
  IF EXISTS (SELECT 1 FROM lukeapp.import_filas
             WHERE lote_id = p_lote_id AND aprobada AND error_detalle LIKE 'CONFLICTO%') THEN
    RAISE EXCEPTION 'El lote tiene filas en conflicto aprobadas; resolver antes de aplicar';
  END IF;

  FOR v_fila IN
    SELECT * FROM lukeapp.import_filas
    WHERE lote_id = p_lote_id AND aprobada AND accion IN ('nueva', 'modificada', 'ausente')
    ORDER BY accion, nro_fila
  LOOP
    IF v_tabla = 'list_lineas' THEN
      -- Resolver FKs por código de catálogo (error => aborta todo el lote)
      v_fluido_id := NULL; v_clase_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'fluido_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN
        SELECT id INTO v_fluido_id FROM lukeapp.cat_fluido_servicio
        WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod;
        IF v_fluido_id IS NULL THEN
          RAISE EXCEPTION 'Fila %: fluido "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod;
        END IF;
      END IF;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN
        SELECT id INTO v_clase_id FROM lukeapp.cat_clase_piping
        WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod;
        IF v_clase_id IS NULL THEN
          RAISE EXCEPTION 'Fila %: clase "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod;
        END IF;
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_lineas
          (proyecto_id, id_linea, descripcion, fluido_id, clase_id, nps_texto, longitud_total, creado_por)
        VALUES
          (v_lote.proyecto_id, trim(v_fila.payload ->> 'id_linea'),
           NULLIF(trim(v_fila.payload ->> 'descripcion'), ''), v_fluido_id, v_clase_id,
           NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''),
           lukeapp.importar_a_num(v_fila.payload ->> 'longitud_total'), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_lineas SET
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
          fluido_id = v_fluido_id, clase_id = v_clase_id,
          nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''),
          longitud_total = lukeapp.importar_a_num(v_fila.payload ->> 'longitud_total'),
          ausente_en_revision = false, activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      ELSE  -- ausente aprobada: marcar, NUNCA borrar
        UPDATE lukeapp.list_lineas SET ausente_en_revision = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_fila.clave_natural;
        n_aus := n_aus + 1;
      END IF;

    ELSE  -- list_mto
      v_clase_id := NULL; v_linea_id := NULL;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'clase_codigo')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN
        SELECT id INTO v_clase_id FROM lukeapp.cat_clase_piping
        WHERE proyecto_id = v_lote.proyecto_id AND upper(codigo) = v_cod;
        IF v_clase_id IS NULL THEN
          RAISE EXCEPTION 'Fila %: clase "%" no existe en el catálogo del proyecto', v_fila.nro_fila, v_cod;
        END IF;
      END IF;
      v_cod := NULLIF(upper(trim(v_fila.payload ->> 'id_linea')), '');
      IF v_cod IS NOT NULL AND v_fila.accion <> 'ausente' THEN
        SELECT id INTO v_linea_id FROM lukeapp.list_lineas
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(id_linea)) = v_cod;
        IF v_linea_id IS NULL THEN
          RAISE EXCEPTION 'Fila %: la línea "%" no existe en list_lineas — importar primero el line list', v_fila.nro_fila, v_cod;
        END IF;
      END IF;

      IF v_fila.accion = 'nueva' THEN
        INSERT INTO lukeapp.list_mto
          (proyecto_id, linea_id, item, descripcion, tag, cantidad, unidad, nps_texto,
           clase_id, material, norma, schedule, heat_number, creado_por)
        VALUES
          (v_lote.proyecto_id, v_linea_id, trim(v_fila.payload ->> 'item'),
           NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
           NULLIF(trim(v_fila.payload ->> 'tag'), ''),
           lukeapp.importar_a_num(v_fila.payload ->> 'cantidad'),
           NULLIF(trim(v_fila.payload ->> 'unidad'), ''),
           NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''),
           v_clase_id,
           NULLIF(trim(v_fila.payload ->> 'material'), ''),
           NULLIF(trim(v_fila.payload ->> 'norma'), ''),
           NULLIF(trim(v_fila.payload ->> 'schedule'), ''),
           NULLIF(trim(v_fila.payload ->> 'heat_number'), ''), v_uid);
        n_ins := n_ins + 1;
      ELSIF v_fila.accion = 'modificada' THEN
        UPDATE lukeapp.list_mto SET
          linea_id = v_linea_id,
          descripcion = NULLIF(trim(v_fila.payload ->> 'descripcion'), ''),
          tag = NULLIF(trim(v_fila.payload ->> 'tag'), ''),
          cantidad = lukeapp.importar_a_num(v_fila.payload ->> 'cantidad'),
          unidad = NULLIF(trim(v_fila.payload ->> 'unidad'), ''),
          nps_texto = NULLIF(trim(v_fila.payload ->> 'nps_texto'), ''),
          clase_id = v_clase_id,
          material = NULLIF(trim(v_fila.payload ->> 'material'), ''),
          norma = NULLIF(trim(v_fila.payload ->> 'norma'), ''),
          schedule = NULLIF(trim(v_fila.payload ->> 'schedule'), ''),
          heat_number = NULLIF(trim(v_fila.payload ->> 'heat_number'), ''),
          ausente_en_revision = false, activo = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(item)) = v_fila.clave_natural;
        n_upd := n_upd + 1;
      ELSE
        UPDATE lukeapp.list_mto SET ausente_en_revision = true, actualizado_por = v_uid
        WHERE proyecto_id = v_lote.proyecto_id AND upper(trim(item)) = v_fila.clave_natural;
        n_aus := n_aus + 1;
      END IF;
    END IF;
  END LOOP;

  v_resumen := COALESCE(v_lote.resumen, '{}'::jsonb) || jsonb_build_object(
    'aplicadas_nuevas', n_ins, 'aplicadas_modificadas', n_upd, 'marcadas_ausentes', n_aus,
    'aplicado_en', now(), 'aplicado_por', v_uid);

  UPDATE lukeapp.import_lotes
  SET estado = 'aplicado', resumen = v_resumen, actualizado_por = v_uid
  WHERE id = p_lote_id;

  RETURN v_resumen;
END;
$$;

-- ─── 7. Grants (solo usuarios autenticados) ──────────────────
REVOKE ALL ON FUNCTION lukeapp.importar_crear_lote(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.importar_calcular_diff(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.importar_aprobar_filas(UUID, UUID[], BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lukeapp.importar_aplicar_lote(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lukeapp.importar_crear_lote(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION lukeapp.importar_calcular_diff(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION lukeapp.importar_aprobar_filas(UUID, UUID[], BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION lukeapp.importar_aplicar_lote(UUID) TO authenticated, service_role;

-- ─── 8. Bucket privado para archivos originales ──────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('importaciones', 'importaciones', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'lukeapp_importaciones_insert') THEN
    CREATE POLICY "lukeapp_importaciones_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'importaciones'
                  AND lukeapp.tiene_membresia(((storage.foldername(name))[1])::uuid));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'lukeapp_importaciones_select') THEN
    CREATE POLICY "lukeapp_importaciones_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'importaciones'
             AND lukeapp.tiene_membresia(((storage.foldername(name))[1])::uuid));
  END IF;
END $$;

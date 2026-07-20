-- ============================================================
-- LukeAPP v4 — Migración 029: Gestión de Personal, Asistencia y Cuadrillas
-- Schema: lukeapp
-- Depende de: 20260717_028_referencias_documentos.sql
-- ============================================================

-- 1. Modificaciones en lukeapp.cat_personal para actuar como espejo de Buk
-- Hacemos estampa opcional, agregamos teléfono, centro de costo y la restricción de RUT único por proyecto.

-- Primero eliminamos la restricción de que estampa sea NOT NULL
ALTER TABLE lukeapp.cat_personal ALTER COLUMN estampa DROP NOT NULL;

-- Agregamos teléfono y centro_costo
ALTER TABLE lukeapp.cat_personal
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS centro_costo TEXT;

-- Añadimos la clave única por proyecto y rut para el espejo de identidad
ALTER TABLE lukeapp.cat_personal ADD CONSTRAINT cat_personal_proyecto_rut_key UNIQUE (proyecto_id, rut);


-- 2. Tabla log_asistencia (Registro de presencia diaria)
CREATE TABLE lukeapp.log_asistencia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  trabajador_id   UUID NOT NULL REFERENCES lukeapp.cat_personal(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada    TIMESTAMPTZ,
  hora_salida     TIMESTAMPTZ,
  estado          TEXT NOT NULL DEFAULT 'presente', -- 'presente', 'licencia', 'vacaciones', 'falta'
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, trabajador_id, fecha)
);

CREATE INDEX idx_log_asistencia_proyecto ON lukeapp.log_asistencia(proyecto_id);
CREATE INDEX idx_log_asistencia_trabajador ON lukeapp.log_asistencia(trabajador_id);
CREATE INDEX idx_log_asistencia_fecha ON lukeapp.log_asistencia(fecha);

CREATE TRIGGER trg_log_asistencia_auditoria BEFORE UPDATE ON lukeapp.log_asistencia
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();

ALTER TABLE lukeapp.log_asistencia ENABLE ROW LEVEL SECURITY;


-- 3. Tabla list_cuadrillas (Definición de cuadrillas de terreno)
CREATE TABLE lukeapp.list_cuadrillas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  capataz_id      UUID REFERENCES lukeapp.cat_personal(id) ON DELETE SET NULL,
  supervisor_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  especialidad    TEXT NOT NULL, -- 'piping', 'civiles', 'mecanica', etc.
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_por      UUID REFERENCES auth.users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID REFERENCES auth.users(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, nombre)
);

CREATE INDEX idx_list_cuadrillas_proyecto ON lukeapp.list_cuadrillas(proyecto_id);
CREATE INDEX idx_list_cuadrillas_capataz ON lukeapp.list_cuadrillas(capataz_id);
CREATE INDEX idx_list_cuadrillas_supervisor ON lukeapp.list_cuadrillas(supervisor_id);

CREATE TRIGGER trg_list_cuadrillas_auditoria BEFORE UPDATE ON lukeapp.list_cuadrillas
  FOR EACH ROW EXECUTE FUNCTION lukeapp.set_auditoria();

ALTER TABLE lukeapp.list_cuadrillas ENABLE ROW LEVEL SECURITY;


-- 4. Tabla rel_cuadrilla_trabajadores (Asignación diaria de personal a cuadrillas)
CREATE TABLE lukeapp.rel_cuadrilla_trabajadores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     UUID NOT NULL REFERENCES lukeapp.proyectos(id) ON DELETE CASCADE,
  cuadrilla_id    UUID NOT NULL REFERENCES lukeapp.list_cuadrillas(id) ON DELETE CASCADE,
  trabajador_id   UUID NOT NULL REFERENCES lukeapp.cat_personal(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  asignado_por    UUID REFERENCES auth.users(id),
  metodo          TEXT NOT NULL DEFAULT 'kanban', -- 'kanban', 'bot_whatsapp', 'qr'
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, trabajador_id, fecha)
);

CREATE INDEX idx_rel_cuadrilla_proyecto ON lukeapp.rel_cuadrilla_trabajadores(proyecto_id);
CREATE INDEX idx_rel_cuadrilla_cuadrilla ON lukeapp.rel_cuadrilla_trabajadores(cuadrilla_id);
CREATE INDEX idx_rel_cuadrilla_trabajador ON lukeapp.rel_cuadrilla_trabajadores(trabajador_id);
CREATE INDEX idx_rel_cuadrilla_fecha ON lukeapp.rel_cuadrilla_trabajadores(fecha);

ALTER TABLE lukeapp.rel_cuadrilla_trabajadores ENABLE ROW LEVEL SECURITY;


-- 5. Políticas RLS (Row Level Security)

-- log_asistencia
CREATE POLICY "log_asistencia_select" ON lukeapp.log_asistencia
  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

CREATE POLICY "log_asistencia_write" ON lukeapp.log_asistencia
  FOR ALL TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

-- list_cuadrillas
CREATE POLICY "list_cuadrillas_select" ON lukeapp.list_cuadrillas
  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

CREATE POLICY "list_cuadrillas_write" ON lukeapp.list_cuadrillas
  FOR ALL TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

-- rel_cuadrilla_trabajadores
CREATE POLICY "rel_cuadrilla_trabajadores_select" ON lukeapp.rel_cuadrilla_trabajadores
  FOR SELECT TO authenticated USING (lukeapp.tiene_acceso_lectura(proyecto_id));

CREATE POLICY "rel_cuadrilla_trabajadores_write" ON lukeapp.rel_cuadrilla_trabajadores
  FOR ALL TO authenticated USING (lukeapp.tiene_membresia(proyecto_id));

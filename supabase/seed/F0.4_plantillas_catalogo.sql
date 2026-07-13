-- ============================================================
-- LukeAPP v4 — Seed: plantillas_catalogo (3 industrias) — CORREGIDO
-- Schema: lukeapp
-- Depende de: 001_nucleo (tabla plantillas_catalogo)
-- Rev. C — Julio 2026
--
-- MINERÍA: Regenerado desde cat_413_mineria_real.json (Piloto 413 real)
--   Conteo de registros minería:
--   - cat_fluido_servicio: 6
--   - cat_clase_piping: 8
--   - cat_diametros_nps: 22
--   - cat_aislacion_ext: 4
--   - cat_esquema_pintura: 5
--   - cat_porcentaje_nde: 5
--   - cat_revestimiento_int: 4
--   - cat_tipo_prueba: 3
--   - cat_tipo_soporte: 9
--   - cat_tipo_union: 10
--
-- REFINERÍA: plantilla base (borrador — validar con OT)
-- CELULOSA: plantilla base (borrador — validar con OT)
-- ============================================================

-- ─── Función helper: upsert de plantilla ────────────────────
-- Elimina el registro anterior de la industria + tabla para evitar duplicidad
CREATE OR REPLACE FUNCTION lukeapp.seed_plantilla(
  p_industria   lukeapp.industria_tipo,
  p_dominio     TEXT,
  p_tabla       TEXT,
  p_payload     JSONB,
  p_version     INT DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  DELETE FROM lukeapp.plantillas_catalogo
  WHERE industria = p_industria AND tabla = p_tabla;

  INSERT INTO lukeapp.plantillas_catalogo
    (industria, dominio, tabla, payload, version, activo)
  VALUES
    (p_industria, p_dominio, p_tabla, p_payload, p_version, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ██████████████  MINERÍA (REAL DEL PILOTO 413)  ██████████████
-- ============================================================

-- 1. cat_fluido_servicio (minería) — 6 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_fluido_servicio', 'cat_fluido_servicio', jsonb_build_array(
  '{"codigo":"CT","descripcion":"Concentrado Cu - Mo"}',
  '{"codigo":"PW","descripcion":"Agua de Proceso"}',
  '{"codigo":"GW","descripcion":"Agua de Sello"}',
  '{"codigo":"RW","descripcion":"Agua Recuperada"}',
  '{"codigo":"IA","descripcion":"Aire de Instrumentacion"}',
  '{"codigo":"FP","descripcion":"Agua Contra Incendio"}'
)::jsonb);

-- 2. cat_clase_piping (minería) — 8 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_clase_piping', 'cat_clase_piping', jsonb_build_array(
  '{"codigo":"C1","descripcion":"Acero carbono ASTM A106/A53 Gr B","presion_max":285,"temp_max":38,"usa_pwht":false,"usa_pmi":false}',
  '{"codigo":"C2","descripcion":"Acero carbono ASTM A53 Gr B (liso)","presion_max":285,"temp_max":38,"usa_pwht":false,"usa_pmi":false}',
  '{"codigo":"C3","descripcion":"Acero carbono + Neopreno interior (R3)","presion_max":285,"temp_max":38,"usa_pwht":false,"usa_pmi":false}',
  '{"codigo":"C5","descripcion":"Acero carbono ASTM A53 Gr B (incendio)","presion_max":175,"temp_max":40,"usa_pwht":false,"usa_pmi":false}',
  '{"codigo":"C11","descripcion":"Acero carbono + Goma natural interior","presion_max":285,"temp_max":38,"usa_pwht":false,"usa_pmi":false}',
  '{"codigo":"G1","descripcion":"Acero galvanizado ASTMA53","presion_max":285,"temp_max":38,"usa_pwht":false,"usa_pmi":false}',
  '{"codigo":"H1","descripcion":"HDPE PE100 PN6","presion_max":90,"temp_max":20,"usa_pwht":false,"usa_pmi":false}',
  '{"codigo":"H2","descripcion":"HDPE PE100 PN10","presion_max":145,"temp_max":20,"usa_pwht":false,"usa_pmi":false}'
)::jsonb);

-- 3. cat_diametros_nps (minería) — 22 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_diametros_nps', 'cat_diametros_nps', jsonb_build_array(
  '{"nps":"3/4","nps_mm":19.05}',
  '{"nps":"1","nps_mm":25.4}',
  '{"nps":"1.1/4","nps_mm":31.75}',
  '{"nps":"1.1/2","nps_mm":38.1}',
  '{"nps":"2","nps_mm":50.8}',
  '{"nps":"3","nps_mm":76.2}',
  '{"nps":"4","nps_mm":101.6}',
  '{"nps":"6","nps_mm":152.4}',
  '{"nps":"8","nps_mm":203.2}',
  '{"nps":"10","nps_mm":254.0}',
  '{"nps":"12","nps_mm":304.8}',
  '{"nps":"16","nps_mm":406.4}',
  '{"nps":"18","nps_mm":457.2}',
  '{"nps":"24","nps_mm":609.6}',
  '{"nps":"50","nps_mm":50.0}',
  '{"nps":"110","nps_mm":110.0}',
  '{"nps":"160","nps_mm":160.0}',
  '{"nps":"200","nps_mm":200.0}',
  '{"nps":"250","nps_mm":250.0}',
  '{"nps":"315","nps_mm":315.0}',
  '{"nps":"400","nps_mm":400.0}',
  '{"nps":"450","nps_mm":450.0}'
)::jsonb);

-- 4. cat_aislacion_ext (minería) — 4 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_aislacion_ext', 'cat_aislacion_ext', jsonb_build_array(
  '{"codigo":"N","descripcion":"Sin Aislación"}',
  '{"codigo":"HC","descripcion":"Conservación de Calor"}',
  '{"codigo":"PP","descripcion":"Protección Personal"}',
  '{"codigo":"ET","descripcion":"Electrical Tracing"}'
)::jsonb);

-- 5. cat_esquema_pintura (minería) — 5 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_esquema_pintura', 'cat_esquema_pintura', jsonb_build_array(
  '{"codigo":"EPC-9","descripcion":"Acero Superficial (Cordillerano)","capas":4,"espesor_total_um":275}',
  '{"codigo":"TRICAPA","descripcion":"Acero Enterrado (FBE)","capas":3,"espesor_total_um":2125}',
  '{"codigo":"C209","descripcion":"Acero Enterrado (Cintas)","capas":2,"espesor_total_um":0}',
  '{"codigo":"C210","descripcion":"Acero Enterrado (Líquido)","capas":0,"espesor_total_um":0}',
  '{"codigo":"N/A","descripcion":"Sin Esquema Pintura","capas":0,"espesor_total_um":0}'
)::jsonb);

-- 6. cat_porcentaje_nde (minería) — 5 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_porcentaje_nde', 'cat_porcentaje_nde', jsonb_build_array(
  '{"codigo":"VT","descripcion":"Inspección Visual","porcentaje":100}',
  '{"codigo":"RT","descripcion":"Radiografía","porcentaje":100}',
  '{"codigo":"PT","descripcion":"Líquidos Penetrantes","porcentaje":100}',
  '{"codigo":"UT","descripcion":"Ultrasonido","porcentaje":100}',
  '{"codigo":"DT","descripcion":"Ensayo Destructivo Aleatorio","porcentaje":5}'
)::jsonb);

-- 7. cat_revestimiento_int (minería) — 4 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_revestimiento_int', 'cat_revestimiento_int', jsonb_build_array(
  '{"codigo":"N","descripcion":"Sin Revestimiento Interior"}',
  '{"codigo":"R1","descripcion":"Rubber Lined (6mm)"}',
  '{"codigo":"R2","descripcion":"Rubber Lined (12mm)"}',
  '{"codigo":"R3","descripcion":"Poliuretano (15mm)"}'
)::jsonb);

-- 8. cat_tipo_prueba (minería) — 3 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_tipo_prueba', 'cat_tipo_prueba', jsonb_build_array(
  '{"codigo":"Hidrostatica","descripcion":"Prueba hidrostática acero"}',
  '{"codigo":"Hidrostatica HDPE","descripcion":"Prueba hidrostática plásticos"}',
  '{"codigo":"Neumática","descripcion":"Prueba neumática gas"}'
)::jsonb);

-- 9. cat_tipo_soporte (minería) — 9 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_tipo_soporte', 'cat_tipo_soporte', jsonb_build_array(
  '{"codigo":"ES-02","descripcion":"SOPORTE TRUNNION"}',
  '{"codigo":"MS-06","descripcion":"MARCO SOPORTE TIPO \"L\""}',
  '{"codigo":"PU-01","descripcion":"PERNO U LARGO"}',
  '{"codigo":"SA-10","descripcion":"ABRAZADERA ESTANDAR"}',
  '{"codigo":"SE-01","descripcion":"SOPORTE ESCUADRA"}',
  '{"codigo":"SL-01","descripcion":"ANGULO ANCLAJE LATERAL"}',
  '{"codigo":"SL-02","descripcion":"ANGULO ANCLAJE LATERAL"}',
  '{"codigo":"SP-05","descripcion":"SOPORTE PUNTUAL APOYO CAÑERIAS"}',
  '{"codigo":"ST-01","descripcion":"TRAPECIO ANGULO TIPO A"}'
)::jsonb);

-- 10. cat_tipo_union (minería) — 10 registros
SELECT lukeapp.seed_plantilla('mineria', 'cat_tipo_union', 'cat_tipo_union', jsonb_build_array(
  '{"codigo":"BW","descripcion":"Butt Weld"}',
  '{"codigo":"SW","descripcion":"Socket Weld"}',
  '{"codigo":"THD","descripcion":"Threaded"}',
  '{"codigo":"VIC","descripcion":"Grooved"}',
  '{"codigo":"TF","descripcion":"Butt Fusion"}',
  '{"codigo":"BT","descripcion":"Flanged"}',
  '{"codigo":"SO","descripcion":"Slip On"}',
  '{"codigo":"LET","descripcion":"Fillet Weld"}',
  '{"codigo":"TW","descripcion":"TACK WELD"}',
  '{"codigo":"BRW","descripcion":"Branch Weld"}'
)::jsonb);


-- ============================================================
-- ██████████████  REFINERÍA (BASE BORRADOR)  ██████████████
-- ============================================================

SELECT lukeapp.seed_plantilla('refineria', 'cat_fluido_servicio', 'cat_fluido_servicio', jsonb_build_array(
  '{"codigo":"CV","descripcion":"Crudo / Vacío","borrador":true}',
  '{"codigo":"GS","descripcion":"Gas de proceso","borrador":true}',
  '{"codigo":"HV","descripcion":"Hidrocarburos vaporizados","borrador":true}',
  '{"codigo":"AG","descripcion":"Agua de refrigeración","borrador":true}',
  '{"codigo":"VS","descripcion":"Vapor de servicio","borrador":true}',
  '{"codigo":"VA","descripcion":"Vapor de alta presión","borrador":true}',
  '{"codigo":"CO","descripcion":"Condensado","borrador":true}',
  '{"codigo":"H2","descripcion":"Hidrógeno","borrador":true}',
  '{"codigo":"H2S","descripcion":"Sulfuro de hidrógeno","borrador":true}',
  '{"codigo":"AM","descripcion":"Aminas","borrador":true}',
  '{"codigo":"AI","descripcion":"Aire instrumental","borrador":true}',
  '{"codigo":"DR","descripcion":"Drenaje / efluente","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_clase_piping', 'cat_clase_piping', jsonb_build_array(
  '{"codigo":"A1R","descripcion":"CS A106-B Sch40 300# — servicios no corrosivos <200°C","presion_max":5172,"temp_max":200,"usa_pwht":false,"usa_pmi":false,"borrador":true}',
  '{"codigo":"B1R","descripcion":"1.25Cr-0.5Mo P11 Sch80 600# — alta temperatura","presion_max":10342,"temp_max":540,"usa_pwht":true,"usa_pmi":true,"borrador":true}',
  '{"codigo":"B2R","descripcion":"2.25Cr-1Mo P22 Sch80 900# — vapor alta presión + H2","presion_max":15513,"temp_max":570,"usa_pwht":true,"usa_pmi":true,"borrador":true}',
  '{"codigo":"C1R","descripcion":"5Cr-0.5Mo P5 — servicio H2S / H2 alta temp","presion_max":10342,"temp_max":600,"usa_pwht":true,"usa_pmi":true,"borrador":true}',
  '{"codigo":"D1R","descripcion":"SS316L — aminas / soluciones acuosas corrosivas","presion_max":5172,"temp_max":300,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"E1R","descripcion":"Duplex 2205 — alta corrosión + erosión","presion_max":8620,"temp_max":280,"usa_pwht":false,"usa_pmi":true,"borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_diametros_nps', 'cat_diametros_nps', jsonb_build_array(
  '{"nps":"1/2\"","nps_mm":15}',
  '{"nps":"3/4\"","nps_mm":20}',
  '{"nps":"1\"","nps_mm":25}',
  '{"nps":"1 1/2\"","nps_mm":40}',
  '{"nps":"2\"","nps_mm":50}',
  '{"nps":"3\"","nps_mm":80}',
  '{"nps":"4\"","nps_mm":100}',
  '{"nps":"6\"","nps_mm":150}',
  '{"nps":"8\"","nps_mm":200}',
  '{"nps":"10\"","nps_mm":250}',
  '{"nps":"12\"","nps_mm":300}',
  '{"nps":"14\"","nps_mm":350}',
  '{"nps":"16\"","nps_mm":400}',
  '{"nps":"18\"","nps_mm":450}',
  '{"nps":"20\"","nps_mm":500}',
  '{"nps":"24\"","nps_mm":600}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_tipo_union', 'cat_tipo_union', jsonb_build_array(
  '{"codigo":"BW","descripcion":"Soldadura a tope (Butt Weld)","borrador":true}',
  '{"codigo":"SW","descripcion":"Soldadura en socket ≤NPS2 (Socket Weld)","borrador":true}',
  '{"codigo":"FL","descripcion":"Bridada (Flanged)","borrador":true}',
  '{"codigo":"TH","descripcion":"Roscada ≤NPS1 (no en servicio H2)","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_porcentaje_nde', 'cat_porcentaje_nde', jsonb_build_array(
  '{"codigo":"NDE10","descripcion":"10% — servicios categoría D","porcentaje":10,"borrador":true}',
  '{"codigo":"NDE20","descripcion":"20% — categoría normal","porcentaje":20,"borrador":true}',
  '{"codigo":"NDE40","descripcion":"40% — alta temperatura","porcentaje":40,"borrador":true}',
  '{"codigo":"NDE100","descripcion":"100% — Cr-Mo + H2 + vapor alta presión","porcentaje":100,"borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_tipo_prueba', 'cat_tipo_prueba', jsonb_build_array(
  '{"codigo":"HID","descripcion":"Prueba hidrostática (ASME B31.3 §345.4)","borrador":true}',
  '{"codigo":"NEU","descripcion":"Prueba neumática (aprobación adicional requerida)","borrador":true}',
  '{"codigo":"SS","descripcion":"Leak test en servicio (categoría D)","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_esquema_pintura', 'cat_esquema_pintura', jsonb_build_array(
  '{"codigo":"ZN2","descripcion":"Zinc inorgánico + epoxi + poliuretano — exterior","capas":3,"borrador":true}',
  '{"codigo":"HT1","descripcion":"Pintura alta temperatura (silicona) ≤650°C — líneas vapor","capas":2,"borrador":true}',
  '{"codigo":"NA","descripcion":"Sin pintura (SS / Duplex / Cu-Ni)","capas":0,"borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_aislacion_ext', 'cat_aislacion_ext', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin aislación","borrador":true}',
  '{"codigo":"LM","descripcion":"Lana mineral (calor > 100°C)","borrador":true}',
  '{"codigo":"CA","descripcion":"Cañería aislada — conservación calor (tracing)","borrador":true}',
  '{"codigo":"FR","descripcion":"Aislación refractaria — superficies > 600°C","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_revestimiento_int', 'cat_revestimiento_int', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin revestimiento","borrador":true}',
  '{"codigo":"EP","descripcion":"Epoxi — protección anticorrosiva interior","borrador":true}',
  '{"codigo":"GL","descripcion":"Vidrio fusionado — ácidos fuertes","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('refineria', 'cat_tipo_soporte', 'cat_tipo_soporte', jsonb_build_array(
  '{"codigo":"SOP","descripcion":"Soporte simple","borrador":true}',
  '{"codigo":"ANC","descripcion":"Anclaje (fijo)","borrador":true}',
  '{"codigo":"GIA","descripcion":"Guía axial","borrador":true}',
  '{"codigo":"RES","descripcion":"Resorte de carga variable","borrador":true}',
  '{"codigo":"COL","descripcion":"Colgante (hanger)","borrador":true}',
  '{"codigo":"ESP","descripcion":"Soporte especial (análisis de flexibilidad)","borrador":true}'
)::jsonb);


-- ============================================================
-- ██████████████  CELULOSA (BASE BORRADOR)  ██████████████
-- ============================================================

SELECT lukeapp.seed_plantilla('celulosa', 'cat_fluido_servicio', 'cat_fluido_servicio', jsonb_build_array(
  '{"codigo":"LIC","descripcion":"Licor verde (digestión kraft)","borrador":true}',
  '{"codigo":"LIB","descripcion":"Licor blanco","borrador":true}',
  '{"codigo":"LIN","descripcion":"Licor negro","borrador":true}',
  '{"codigo":"CL2","descripcion":"Cloro / dióxido de cloro (blanqueo)","borrador":true}',
  '{"codigo":"NA","descripcion":"Soda cáustica (NaOH)","borrador":true}',
  '{"codigo":"H2SO4","descripcion":"Ácido sulfúrico (blanqueo pH)","borrador":true}',
  '{"codigo":"VN","descripcion":"Vapor","borrador":true}',
  '{"codigo":"AG","descripcion":"Agua de proceso / dilución","borrador":true}',
  '{"codigo":"AI","descripcion":"Aire instrumental","borrador":true}',
  '{"codigo":"DR","descripcion":"Drenaje / efluente","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_clase_piping', 'cat_clase_piping', jsonb_build_array(
  '{"codigo":"A1C","descripcion":"CS Sch40 150# — agua / drenaje no corrosivo","presion_max":1034,"temp_max":93,"usa_pwht":false,"usa_pmi":false,"borrador":true}',
  '{"codigo":"B1C","descripcion":"SS 316L Sch10S — licores / aguas de proceso","presion_max":1034,"temp_max":120,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"B2C","descripcion":"SS 316L Sch40 300# — vapor condensado / agua caliente","presion_max":5172,"temp_max":180,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"C1C","descripcion":"Duplex 2205 Sch40 — ambientes altamente corrosivos (CL2)","presion_max":5172,"temp_max":200,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"D1C","descripcion":"FRP/GRP — ácido sulfúrico diluido / ambientes ácidos","presion_max":690,"temp_max":60,"usa_pwht":false,"usa_pmi":false,"borrador":true}',
  '{"codigo":"E1C","descripcion":"HDPE SDR11 — efluentes / agua industrial","presion_max":1241,"temp_max":40,"usa_pwht":false,"usa_pmi":false,"borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_diametros_nps', 'cat_diametros_nps', jsonb_build_array(
  '{"nps":"1/2\"","nps_mm":15}',
  '{"nps":"3/4\"","nps_mm":20}',
  '{"nps":"1\"","nps_mm":25}',
  '{"nps":"1 1/2\"","nps_mm":40}',
  '{"nps":"2\"","nps_mm":50}',
  '{"nps":"3\"","nps_mm":80}',
  '{"nps":"4\"","nps_mm":100}',
  '{"nps":"6\"","nps_mm":150}',
  '{"nps":"8\"","nps_mm":200}',
  '{"nps":"10\"","nps_mm":250}',
  '{"nps":"12\"","nps_mm":300}',
  '{"nps":"14\"","nps_mm":350}',
  '{"nps":"16\"","nps_mm":400}',
  '{"nps":"20\"","nps_mm":500}',
  '{"nps":"24\"","nps_mm":600}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_tipo_union', 'cat_tipo_union', jsonb_build_array(
  '{"codigo":"BW","descripcion":"Soldadura a tope — SS/Duplex (requiere PMI post-soldadura)","borrador":true}',
  '{"codigo":"FL","descripcion":"Bridada — grandes diámetros y mantenimiento","borrador":true}',
  '{"codigo":"GL","descripcion":"Pegada — FRP/HDPE","borrador":true}',
  '{"codigo":"ER","descripcion":"Electrofusión — HDPE","borrador":true}',
  '{"codigo":"TH","descripcion":"Roscada ≤NPS1 — servicios auxiliares no corrosivos","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_porcentaje_nde', 'cat_porcentaje_nde', jsonb_build_array(
  '{"codigo":"NDE0","descripcion":"Sin NDE — HDPE/FRP","porcentaje":0,"borrador":true}',
  '{"codigo":"NDE10","descripcion":"10% — CS servicios auxiliares","porcentaje":10,"borrador":true}',
  '{"codigo":"NDE20","descripcion":"20% — SS316L servicios de proceso","porcentaje":20,"borrador":true}',
  '{"codigo":"NDE100","descripcion":"100% — Duplex / alta corrosividad / ASME B31.3 Cat M","porcentaje":100,"borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_tipo_prueba', 'cat_tipo_prueba', jsonb_build_array(
  '{"codigo":"HID","descripcion":"Prueba hidrostática","borrador":true}',
  '{"codigo":"NEU","descripcion":"Prueba neumática (autorización especial)","borrador":true}',
  '{"codigo":"FUG","descripcion":"Prueba de fuga — HDPE/FRP","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_esquema_pintura', 'cat_esquema_pintura', jsonb_build_array(
  '{"codigo":"EP2","descripcion":"Epoxi 2 capas — exterior CS no corrosivo","capas":2,"borrador":true}',
  '{"codigo":"EP3","descripcion":"Epoxi 3 capas + poliuretano — ambiente húmedo industrial","capas":3,"borrador":true}',
  '{"codigo":"NA","descripcion":"Sin pintura — SS / Duplex / HDPE / FRP","capas":0,"borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_aislacion_ext', 'cat_aislacion_ext', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin aislación","borrador":true}',
  '{"codigo":"LM","descripcion":"Lana mineral — tuberías de vapor > 80°C","borrador":true}',
  '{"codigo":"CA","descripcion":"Aislación con tracing eléctrico — licores cristalizables","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_revestimiento_int', 'cat_revestimiento_int', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin revestimiento — SS/Duplex","borrador":true}',
  '{"codigo":"GR","descripcion":"Goma natural — pulpa de madera / abrasivos","borrador":true}',
  '{"codigo":"EP","descripcion":"Epoxi interior — CS con fluidos corrosivos","borrador":true}'
)::jsonb);

SELECT lukeapp.seed_plantilla('celulosa', 'cat_tipo_soporte', 'cat_tipo_soporte', jsonb_build_array(
  '{"codigo":"SOP","descripcion":"Soporte simple","borrador":true}',
  '{"codigo":"ANC","descripcion":"Anclaje (fijo)","borrador":true}',
  '{"codigo":"GIA","descripcion":"Guía axial","borrador":true}',
  '{"codigo":"COL","descripcion":"Colgante (hanger)","borrador":true}',
  '{"codigo":"ESP","descripcion":"Soporte especial","borrador":true}'
)::jsonb);


-- ─── Limpiar función helper (no dejar en el schema) ─────────
DROP FUNCTION IF EXISTS lukeapp.seed_plantilla(lukeapp.industria_tipo, TEXT, TEXT, JSONB, INT);

-- ─── Reporte final simplificado para verificar conteos ──────
SELECT
  industria,
  tabla,
  jsonb_array_length(payload) as total_elementos
FROM lukeapp.plantillas_catalogo
ORDER BY industria, tabla;

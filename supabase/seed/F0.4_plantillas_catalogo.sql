-- ============================================================
-- LukeAPP v4 — Seed: plantillas_catalogo (3 industrias)
-- Schema: lukeapp
-- Depende de: 001_nucleo (tabla plantillas_catalogo)
-- Rev. B — Julio 2026
--
-- MINERÍA: basado en CAT reales del 413 (EIMI00413 Andina)
--   Clases carbono, presiones medias, PWHT según clase
-- REFINERÍA: plantilla base — clases aleadas + PWHT extensivo + PMI
--   marcada "borrador — validar con OT" en metadata
-- CELULOSA: plantilla base — inox/dúplex + PMI obligatorio
--   marcada "borrador — validar con OT" en metadata
--
-- NO incluye: cat_personal, cat_cwa, cat_cwp, cat_iwp
-- (se cargan por proyecto, no son plantillas de industria)
-- ============================================================

-- ─── Función helper: insertar plantilla ──────────────────────
-- Evita duplicados en re-ejecución (idempotente)
CREATE OR REPLACE FUNCTION lukeapp.seed_plantilla(
  p_industria   lukeapp.industria_tipo,
  p_dominio     TEXT,
  p_tabla       TEXT,
  p_payload     JSONB,
  p_version     INT DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  INSERT INTO lukeapp.plantillas_catalogo
    (industria, dominio, tabla, payload, version, activo)
  VALUES
    (p_industria, p_dominio, p_tabla, p_payload, p_version, true)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ██████████████  MINERÍA  ██████████████
-- Fuente: CAT reales del 413 (EIMI00413 Andina, minería del cobre)
-- ============================================================

-- ── cat_fluido_servicio (minería) ─────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_fluido_servicio', 'cat_fluido_servicio', jsonb_build_array(
  '{"codigo":"AG","descripcion":"Agua de servicio"}',
  '{"codigo":"AP","descripcion":"Agua potable"}',
  '{"codigo":"AI","descripcion":"Aire instrumental"}',
  '{"codigo":"AS","descripcion":"Aire de servicio"}',
  '{"codigo":"PF","descripcion":"Pulpa de flotación"}',
  '{"codigo":"PR","descripcion":"Pulpa de relaves"}',
  '{"codigo":"AC","descripcion":"Ácido sulfúrico"}',
  '{"codigo":"HG","descripcion":"Hipoclorito de sodio"}',
  '{"codigo":"HV","descripcion":"Hidróxido de cal"}',
  '{"codigo":"CU","descripcion":"Cobre electrolítico (slurry)"}',
  '{"codigo":"GN","descripcion":"Gas natural"}',
  '{"codigo":"VN","descripcion":"Vapor"}',
  '{"codigo":"CO","descripcion":"Condensado"}',
  '{"codigo":"DR","descripcion":"Drenaje"}',
  '{"codigo":"VA","descripcion":"Ventilación / alivio"}'
)::jsonb);

-- ── cat_clase_piping (minería) ─────────────────────────────────
-- Clases típicas de proyecto minero (carbono/ASTM A106/A53, medias presiones)
SELECT lukeapp.seed_plantilla('mineria', 'cat_clase_piping', 'cat_clase_piping', jsonb_build_array(
  '{"codigo":"A1","descripcion":"Carbono Sch40 150# — Agua, drenaje","presion_max":1034,"temp_max":93,"usa_pwht":false}',
  '{"codigo":"A2","descripcion":"Carbono Sch80 300# — Agua a presión","presion_max":2068,"temp_max":120,"usa_pwht":false}',
  '{"codigo":"B1","descripcion":"Carbono HDPE — Pulpa abrasiva NPS≤12","presion_max":690,"temp_max":60,"usa_pwht":false}',
  '{"codigo":"B2","descripcion":"Carbono AR400 — Pulpa abrasiva NPS>12","presion_max":690,"temp_max":60,"usa_pwht":false}',
  '{"codigo":"C1","descripcion":"FRP/GRP — Ácido sulfúrico diluido","presion_max":690,"temp_max":60,"usa_pwht":false}',
  '{"codigo":"D1","descripcion":"Carbono Sch40 — Vapor 150#","presion_max":1034,"temp_max":186,"usa_pwht":false}',
  '{"codigo":"D2","descripcion":"Carbono Sch80 — Vapor 300# (PWHT >NPS2)","presion_max":2068,"temp_max":232,"usa_pwht":true}',
  '{"codigo":"E1","descripcion":"Carbono Sch40 — Gas / Hidrocarburo 150#","presion_max":1034,"temp_max":120,"usa_pwht":false}',
  '{"codigo":"E2","descripcion":"Carbono Sch80 — Gas / Hidrocarburo 300# (PWHT)","presion_max":2068,"temp_max":120,"usa_pwht":true}',
  '{"codigo":"F1","descripcion":"HDPE SDR11 — Agua industrial subterránea","presion_max":1241,"temp_max":40,"usa_pwht":false}'
)::jsonb);

-- ── cat_diametros_nps (minería — estándar ASME, pulgadas) ─────
SELECT lukeapp.seed_plantilla('mineria', 'cat_diametros_nps', 'cat_diametros_nps', jsonb_build_array(
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
  '{"nps":"24\"","nps_mm":600}',
  '{"nps":"30\"","nps_mm":750}',
  '{"nps":"36\"","nps_mm":900}'
)::jsonb);

-- ── cat_aislacion_ext (minería) ────────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_aislacion_ext', 'cat_aislacion_ext', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin aislación"}',
  '{"codigo":"TH","descripcion":"Aislación térmica — lana mineral"}',
  '{"codigo":"TP","descripcion":"Aislación térmica — poliuretano"}',
  '{"codigo":"PO","descripcion":"Protección personal (solo chaqueta)"}',
  '{"codigo":"CR","descripcion":"Aislación criogénica — espuma celular"}'
)::jsonb);

-- ── cat_revestimiento_int (minería) ────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_revestimiento_int', 'cat_revestimiento_int', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin revestimiento"}',
  '{"codigo":"GR","descripcion":"Goma natural — abrasivos gruesos"}',
  '{"codigo":"GS","descripcion":"Goma sintética — abrasivos finos"}',
  '{"codigo":"EP","descripcion":"Epoxi interior — fluidos corrosivos"}',
  '{"codigo":"CE","descripcion":"Cerámica (azulejo) — alta abrasión"}'
)::jsonb);

-- ── cat_esquema_pintura (minería) ──────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_esquema_pintura', 'cat_esquema_pintura', jsonb_build_array(
  '{"codigo":"EP1","descripcion":"Epoxi 2 capas — interior seco","capas":2}',
  '{"codigo":"EP2","descripcion":"Epoxi 3 capas — exterior industrial","capas":3}',
  '{"codigo":"PU1","descripcion":"Poliuretano — acabado exterior UV","capas":2}',
  '{"codigo":"ZN1","descripcion":"Zinc inorgánico primer + epoxi — ambiente marino","capas":3}',
  '{"codigo":"NA","descripcion":"Sin pintura (acero inox / HDPE / FRP)","capas":0}'
)::jsonb);

-- ── cat_porcentaje_nde (minería) ───────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_porcentaje_nde', 'cat_porcentaje_nde', jsonb_build_array(
  '{"codigo":"NDE0","descripcion":"Sin NDE (juntas no inspeccionadas)","porcentaje":0}',
  '{"codigo":"NDE5","descripcion":"5% — servicios no críticos","porcentaje":5}',
  '{"codigo":"NDE10","descripcion":"10% — servicios de proceso","porcentaje":10}',
  '{"codigo":"NDE20","descripcion":"20% — vapor / gas clase E","porcentaje":20}',
  '{"codigo":"NDE100","descripcion":"100% — PWHT obligatorio / presión alta","porcentaje":100}'
)::jsonb);

-- ── cat_tipo_prueba (minería) ──────────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_tipo_prueba', 'cat_tipo_prueba', jsonb_build_array(
  '{"codigo":"HID","descripcion":"Prueba hidrostática (1.5x presión diseño)"}',
  '{"codigo":"NEU","descripcion":"Prueba neumática (1.1x — servicios sensibles a agua)"}',
  '{"codigo":"FUG","descripcion":"Prueba de fuga (servicio)"}',
  '{"codigo":"NA","descripcion":"Sin prueba de presión requerida"}'
)::jsonb);

-- ── cat_tipo_soporte (minería) ─────────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_tipo_soporte', 'cat_tipo_soporte', jsonb_build_array(
  '{"codigo":"SOP","descripcion":"Soporte simple (carga gravitacional)"}',
  '{"codigo":"GIA","descripcion":"Guía axial"}',
  '{"codigo":"GIL","descripcion":"Guía lateral"}',
  '{"codigo":"ANC","descripcion":"Anclaje (fijo)"}',
  '{"codigo":"RES","descripcion":"Resorte (carga variable)"}',
  '{"codigo":"COL","descripcion":"Colgante (hanger)"}',
  '{"codigo":"ESP","descripcion":"Soporte especial (diseño específico)"}'
)::jsonb);

-- ── cat_tipo_union (minería) ───────────────────────────────────
SELECT lukeapp.seed_plantilla('mineria', 'cat_tipo_union', 'cat_tipo_union', jsonb_build_array(
  '{"codigo":"BW","descripcion":"Soldadura a tope (Butt Weld)"}',
  '{"codigo":"SW","descripcion":"Soldadura en socket (Socket Weld)"}',
  '{"codigo":"TH","descripcion":"Roscada (Threaded)"}',
  '{"codigo":"FL","descripcion":"Bridada (Flanged)"}',
  '{"codigo":"CA","descripcion":"Victaulic / Acoplamiento ranurado"}',
  '{"codigo":"GL","descripcion":"Pegada (Glued — HDPE/FRP)"}',
  '{"codigo":"ER","descripcion":"Electrofusión (HDPE)"}'
)::jsonb);

-- ============================================================
-- ██████████████  REFINERÍA  ██████████████
-- Plantilla base — marcada como borrador (validar con OT)
-- Característica: aleaciones Cr-Mo para alta temp + PWHT + PMI
-- ============================================================

-- ── cat_fluido_servicio (refinería) ───────────────────────────
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

-- ── cat_clase_piping (refinería) ───────────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_clase_piping', 'cat_clase_piping', jsonb_build_array(
  '{"codigo":"A1R","descripcion":"CS A106-B Sch40 300# — servicios no corrosivos <200°C","presion_max":5172,"temp_max":200,"usa_pwht":false,"usa_pmi":false,"borrador":true}',
  '{"codigo":"B1R","descripcion":"1.25Cr-0.5Mo P11 Sch80 600# — alta temperatura","presion_max":10342,"temp_max":540,"usa_pwht":true,"usa_pmi":true,"borrador":true}',
  '{"codigo":"B2R","descripcion":"2.25Cr-1Mo P22 Sch80 900# — vapor alta presión + H2","presion_max":15513,"temp_max":570,"usa_pwht":true,"usa_pmi":true,"borrador":true}',
  '{"codigo":"C1R","descripcion":"5Cr-0.5Mo P5 — servicio H2S / H2 alta temp","presion_max":10342,"temp_max":600,"usa_pwht":true,"usa_pmi":true,"borrador":true}',
  '{"codigo":"D1R","descripcion":"SS316L — aminas / soluciones acuosas corrosivas","presion_max":5172,"temp_max":300,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"E1R","descripcion":"Duplex 2205 — alta corrosión + erosión","presion_max":8620,"temp_max":280,"usa_pwht":false,"usa_pmi":true,"borrador":true}'
)::jsonb);

-- ── cat_diametros_nps (refinería — igual estándar ASME) ────────
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

-- ── cat_tipo_union (refinería) ─────────────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_tipo_union', 'cat_tipo_union', jsonb_build_array(
  '{"codigo":"BW","descripcion":"Soldadura a tope (Butt Weld)","borrador":true}',
  '{"codigo":"SW","descripcion":"Soldadura en socket ≤NPS2 (Socket Weld)","borrador":true}',
  '{"codigo":"FL","descripcion":"Bridada (Flanged)","borrador":true}',
  '{"codigo":"TH","descripcion":"Roscada ≤NPS1 (no en servicio H2)","borrador":true}'
)::jsonb);

-- ── cat_porcentaje_nde (refinería) ─────────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_porcentaje_nde', 'cat_porcentaje_nde', jsonb_build_array(
  '{"codigo":"NDE10","descripcion":"10% — servicios categoría D","porcentaje":10,"borrador":true}',
  '{"codigo":"NDE20","descripcion":"20% — categoría normal","porcentaje":20,"borrador":true}',
  '{"codigo":"NDE40","descripcion":"40% — alta temperatura","porcentaje":40,"borrador":true}',
  '{"codigo":"NDE100","descripcion":"100% — Cr-Mo + H2 + vapor alta presión","porcentaje":100,"borrador":true}'
)::jsonb);

-- ── cat_tipo_prueba (refinería) ────────────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_tipo_prueba', 'cat_tipo_prueba', jsonb_build_array(
  '{"codigo":"HID","descripcion":"Prueba hidrostática (ASME B31.3 §345.4)","borrador":true}',
  '{"codigo":"NEU","descripcion":"Prueba neumática (aprobación adicional requerida)","borrador":true}',
  '{"codigo":"SS","descripcion":"Leak test en servicio (categoría D)","borrador":true}'
)::jsonb);

-- ── cat_esquema_pintura (refinería) ────────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_esquema_pintura', 'cat_esquema_pintura', jsonb_build_array(
  '{"codigo":"ZN2","descripcion":"Zinc inorgánico + epoxi + poliuretano — exterior","capas":3,"borrador":true}',
  '{"codigo":"HT1","descripcion":"Pintura alta temperatura (silicona) ≤650°C — líneas vapor","capas":2,"borrador":true}',
  '{"codigo":"NA","descripcion":"Sin pintura (SS / Duplex / Cu-Ni)","capas":0,"borrador":true}'
)::jsonb);

-- ── cat_aislacion_ext (refinería) ──────────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_aislacion_ext', 'cat_aislacion_ext', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin aislación","borrador":true}',
  '{"codigo":"LM","descripcion":"Lana mineral (calor > 100°C)","borrador":true}',
  '{"codigo":"CA","descripcion":"Cañería aislada — conservación calor (tracing)","borrador":true}',
  '{"codigo":"FR","descripcion":"Aislación refractaria — superficies > 600°C","borrador":true}'
)::jsonb);

-- ── cat_revestimiento_int (refinería) ──────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_revestimiento_int', 'cat_revestimiento_int', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin revestimiento","borrador":true}',
  '{"codigo":"EP","descripcion":"Epoxi — protección anticorrosiva interior","borrador":true}',
  '{"codigo":"GL","descripcion":"Vidrio fusionado — ácidos fuertes","borrador":true}'
)::jsonb);

-- ── cat_tipo_soporte (refinería) ───────────────────────────────
SELECT lukeapp.seed_plantilla('refineria', 'cat_tipo_soporte', 'cat_tipo_soporte', jsonb_build_array(
  '{"codigo":"SOP","descripcion":"Soporte simple","borrador":true}',
  '{"codigo":"ANC","descripcion":"Anclaje (fijo)","borrador":true}',
  '{"codigo":"GIA","descripcion":"Guía axial","borrador":true}',
  '{"codigo":"RES","descripcion":"Resorte de carga variable","borrador":true}',
  '{"codigo":"COL","descripcion":"Colgante (hanger)","borrador":true}',
  '{"codigo":"ESP","descripcion":"Soporte especial (análisis de flexibilidad)","borrador":true}'
)::jsonb);

-- ============================================================
-- ██████████████  CELULOSA  ██████████████
-- Plantilla base — marcada como borrador (validar con OT)
-- Característica: inox 316L + dúplex + PMI obligatorio
-- ============================================================

-- ── cat_fluido_servicio (celulosa) ────────────────────────────
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

-- ── cat_clase_piping (celulosa) ────────────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_clase_piping', 'cat_clase_piping', jsonb_build_array(
  '{"codigo":"A1C","descripcion":"CS Sch40 150# — agua / drenaje no corrosivo","presion_max":1034,"temp_max":93,"usa_pwht":false,"usa_pmi":false,"borrador":true}',
  '{"codigo":"B1C","descripcion":"SS 316L Sch10S — licores / aguas de proceso","presion_max":1034,"temp_max":120,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"B2C","descripcion":"SS 316L Sch40 300# — vapor condensado / agua caliente","presion_max":5172,"temp_max":180,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"C1C","descripcion":"Duplex 2205 Sch40 — ambientes altamente corrosivos (CL2)","presion_max":5172,"temp_max":200,"usa_pwht":false,"usa_pmi":true,"borrador":true}',
  '{"codigo":"D1C","descripcion":"FRP/GRP — ácido sulfúrico diluido / ambientes ácidos","presion_max":690,"temp_max":60,"usa_pwht":false,"usa_pmi":false,"borrador":true}',
  '{"codigo":"E1C","descripcion":"HDPE SDR11 — efluentes / agua industrial","presion_max":1241,"temp_max":40,"usa_pwht":false,"usa_pmi":false,"borrador":true}'
)::jsonb);

-- ── cat_diametros_nps (celulosa) ───────────────────────────────
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

-- ── cat_tipo_union (celulosa) ─────────────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_tipo_union', 'cat_tipo_union', jsonb_build_array(
  '{"codigo":"BW","descripcion":"Soldadura a tope — SS/Duplex (requiere PMI post-soldadura)","borrador":true}',
  '{"codigo":"FL","descripcion":"Bridada — grandes diámetros y mantenimiento","borrador":true}',
  '{"codigo":"GL","descripcion":"Pegada — FRP/HDPE","borrador":true}',
  '{"codigo":"ER","descripcion":"Electrofusión — HDPE","borrador":true}',
  '{"codigo":"TH","descripcion":"Roscada ≤NPS1 — servicios auxiliares no corrosivos","borrador":true}'
)::jsonb);

-- ── cat_porcentaje_nde (celulosa) ─────────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_porcentaje_nde', 'cat_porcentaje_nde', jsonb_build_array(
  '{"codigo":"NDE0","descripcion":"Sin NDE — HDPE/FRP","porcentaje":0,"borrador":true}',
  '{"codigo":"NDE10","descripcion":"10% — CS servicios auxiliares","porcentaje":10,"borrador":true}',
  '{"codigo":"NDE20","descripcion":"20% — SS316L servicios de proceso","porcentaje":20,"borrador":true}',
  '{"codigo":"NDE100","descripcion":"100% — Duplex / alta corrosividad / ASME B31.3 Cat M","porcentaje":100,"borrador":true}'
)::jsonb);

-- ── cat_tipo_prueba (celulosa) ────────────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_tipo_prueba', 'cat_tipo_prueba', jsonb_build_array(
  '{"codigo":"HID","descripcion":"Prueba hidrostática","borrador":true}',
  '{"codigo":"NEU","descripcion":"Prueba neumática (autorización especial)","borrador":true}',
  '{"codigo":"FUG","descripcion":"Prueba de fuga — HDPE/FRP","borrador":true}'
)::jsonb);

-- ── cat_esquema_pintura (celulosa) ────────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_esquema_pintura', 'cat_esquema_pintura', jsonb_build_array(
  '{"codigo":"EP2","descripcion":"Epoxi 2 capas — exterior CS no corrosivo","capas":2,"borrador":true}',
  '{"codigo":"EP3","descripcion":"Epoxi 3 capas + poliuretano — ambiente húmedo industrial","capas":3,"borrador":true}',
  '{"codigo":"NA","descripcion":"Sin pintura — SS / Duplex / HDPE / FRP","capas":0,"borrador":true}'
)::jsonb);

-- ── cat_aislacion_ext (celulosa) ──────────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_aislacion_ext', 'cat_aislacion_ext', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin aislación","borrador":true}',
  '{"codigo":"LM","descripcion":"Lana mineral — tuberías de vapor > 80°C","borrador":true}',
  '{"codigo":"CA","descripcion":"Aislación con tracing eléctrico — licores cristalizables","borrador":true}'
)::jsonb);

-- ── cat_revestimiento_int (celulosa) ──────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_revestimiento_int', 'cat_revestimiento_int', jsonb_build_array(
  '{"codigo":"NA","descripcion":"Sin revestimiento — SS/Duplex","borrador":true}',
  '{"codigo":"GR","descripcion":"Goma natural — pulpa de madera / abrasivos","borrador":true}',
  '{"codigo":"EP","descripcion":"Epoxi interior — CS con fluidos corrosivos","borrador":true}'
)::jsonb);

-- ── cat_tipo_soporte (celulosa) ────────────────────────────────
SELECT lukeapp.seed_plantilla('celulosa', 'cat_tipo_soporte', 'cat_tipo_soporte', jsonb_build_array(
  '{"codigo":"SOP","descripcion":"Soporte simple","borrador":true}',
  '{"codigo":"ANC","descripcion":"Anclaje (fijo)","borrador":true}',
  '{"codigo":"GIA","descripcion":"Guía axial","borrador":true}',
  '{"codigo":"COL","descripcion":"Colgante (hanger)","borrador":true}',
  '{"codigo":"ESP","descripcion":"Soporte especial","borrador":true}'
)::jsonb);

-- ─── Limpiar función helper (no la dejar en schema) ──────────
DROP FUNCTION IF EXISTS lukeapp.seed_plantilla(lukeapp.industria_tipo, TEXT, TEXT, JSONB, INT);

-- ─── Reporte de lo insertado ──────────────────────────────────
SELECT
  industria,
  tabla,
  count(*) as n_plantillas,
  jsonb_array_length(payload) as n_registros
FROM lukeapp.plantillas_catalogo
GROUP BY industria, tabla
ORDER BY industria, tabla;

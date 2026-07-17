# P6 — Generar datos nuevos: CAT → LIST end-to-end (base firme y cadena de ingeniería)

**Para:** agente Antigravity · **Alcance:** `supabase/migrations`, `apps/ia-worker`, `apps/dashboard/src/components/cubicador` + `documental` · **Prioridad:** alta (habilita que un proyecto nuevo genere su propia data de cero).

## Objetivo y alcance (leer primero)

**No se migra el piloto 413.** La meta es que la plataforma **genere datos nuevos**: crear un proyecto, construir su base CAT y su line list desde cero por los flujos propios de la app. El 413 se usa **solo como modelo de referencia** (justificó el esquema y los campos de las migraciones 010/011); su Excel no se carga como dato.

Cómo se generan los datos nuevos, en orden:
- **CAT:** plantilla de industria (wizard) + IA del spec (contrato) + **edición manual** en la app. Ver Parte C y la nueva Parte E (editor CAT).
- **LIST:** vía el **importador del cubicador** con el Excel propio del proyecto nuevo (decisión firme: el cubicador se mantiene en Excel con diff, no digitación masiva) y/o alta puntual manual.

La idea rectora sigue siendo **CAT primero, LIST después**: `list_lineas` tiene 11 FK a catálogos y al aplicar un lote, si un código no existe en el catálogo del proyecto, el import **aborta** (`RAISE EXCEPTION '... no existe en el catálogo del proyecto'`). Eso ya está enforced para fluido/clase. El trabajo de P6 es **cerrar la cobertura**: hoy solo 2 de 14 catálogos tienen camino de generación y el importador resuelve solo 2 de los 11 FK.

Referencia del modelo (no cargar): estructura y encabezados reales en `…/1 - APP/1_Tablas_MS/` (`CAT_Piping_MS.xlsx`, `LIST_Piping_MS.xlsx`). Sirve para derivar mapeos de columnas, no como fixture.

## ⚠️ Estado tras auditoría (17-jul) — leer antes

Al auditar el repo real (que ya iba en la migración **024**), gran parte de P6 **ya estaba implementada** antes de esta instrucción:
- ✅ Importador soporta la cadena isos→spools→juntas (desde `010_importador_cubicador_fase2`).
- ✅ `024_importador_base_firme` ya resuelve los FK ricos de la línea (`prueba_id`, `pintura_id`, `revestimiento_id`, `aislacion_id`, `nde_id`) y trae la RPC `obtener_estado_catalogos`.
- ✅ Editor manual `GestionCatalogos.tsx` creado y ruteado; extracción IA extendida a 9 catálogos (022/023).

**Estado a 17-jul tras 2ª auditoría — todo lo anterior ya está hecho y verificado:**
1. ✅ Migraciones 025 y 026 aplicadas a lukeserver; tipos regenerados (columnas presentes en `database.ts`).
2. ✅ Columnas ricas de CAT cableadas en `GestionCatalogos.tsx` (edición) y en el apply IA (`INSERT cat_fluido_servicio ... color_ral`, etc.).
3. ✅ `nde_id` (juntas) y `spool_id` (MTO) resueltos en `importar_aplicar_lote` de la 024 (spool con chequeo de existencia y abort).
4. ✅ Test de integración `test_flujo_completo.py`: list_lineas resuelve los 7 FK y aborta con clase inexistente.

**Notas menores (no bloqueantes):**
- Orden conceptual: las funciones del importador (024) referencian columnas creadas en 025/026, que van después. Funciona porque plpgsql difiere la resolución de nombres hasta ejecución; un build desde cero aplica bien. Si 024 se editó después de aplicarse a lukeserver, vigilar un warning de checksum de migración en el próximo `db push`.
- Cobertura de test: el automatizado solo ejercita `list_lineas`. Falta una prueba de un lote de **juntas + MTO** para confirmar que `nde_id`/`spool_id` se pueblan en la práctica.

Las Partes A–E de abajo quedan como referencia del diseño; ya están implementadas.

## Migraciones 025 y 026 — ya escritas (revisar y aplicar)

Las escribió Claude; ambas **aditivas y nullable** (seguras sobre datos existentes). Renumeradas de un borrador previo (010/011) que **colisionaba** con migraciones existentes — ya corregido. No las reescribas: revísalas, aplícalas y regenera tipos TS (`generate_typescript_types`).
- `20260717_025_cat_enriquecimiento.sql` — restaura a los `cat_*` los campos del modelo (material, presion_psi, aplicacion, color_ral, restriccion_pintura, especificacion, metodo/norma NDE, acronimo/metodo_trabajo/nde_requerido de unión, rut/cargo/area/supervisor de personal, fecha_inicio/fin de IWP, etc.).
- `20260717_026_mto_spool_junta_nde.sql` — agrega `list_mto.spool_id` (material a nivel de spool) y `list_juntas.nde_id` (FK a cat_porcentaje_nde; `porcentaje_nde` numérico se conserva).

Actualiza el wizard de clonado (005) y las plantillas por industria solo si quieres que los campos nuevos se propaguen al crear proyectos (opcional, no bloqueante).

---

## Parte A — Importador de `list_lineas`: mapear y resolver los FK que faltan

Hoy `list_lineas` solo mapea/resuelve `fluido`, `clase` y `nps_texto`. El Excel de la línea **ya trae** el resto de las referencias de catálogo. Mapea y resuelve estas columnas del cubicador a sus FK (extiende `SUGERENCIAS_ENCABEZADOS`/mapeo en `CubicadorImport.tsx` y la resolución por código en `importar_aplicar_lote`):

| Columna Excel (LIST_Lineas_MS) | Campo importador | FK destino en list_lineas | Catálogo a resolver |
|---|---|---|---|
| SERVICIO | fluido_codigo | fluido_id | cat_fluido_servicio ✅ (ya) |
| CLASE | clase_codigo | clase_id | cat_clase_piping ✅ (ya) |
| NPS | nps_texto | nps_id | cat_diametros_nps (resolver, hoy solo guarda texto) |
| TIPO PRUEBA | prueba_codigo | prueba_id | cat_tipo_prueba |
| ESQUEMA | pintura_codigo | pintura_id | cat_esquema_pintura |
| REVESTIMIENTO INTERIOR | revestimiento_codigo | revestimiento_id | cat_revestimiento_int |
| AISLACION | aislacion_codigo | aislacion_id | cat_aislacion_ext |
| MTS | longitud_total | longitud_total | — |

Regla de resolución (igual que fluido/clase): si el código viene no-vacío y **no** existe en el catálogo del proyecto → **abortar el lote** con mensaje claro por fila. Así se mantiene la "base firme": no se cargan líneas con referencias inventadas. Los campos sin catálogo directo (FROM, TO, TEMP_DISEÑO_C, PRESION_DISEÑO_KG, PLANO_CODELCO, TIPO MATERIAL, OBSERVACIONES) quedan fuera de alcance de FK; si quieres persistirlos, agrégalos como columnas simples a `list_lineas` en una migración aparte (no en la 010). `cwa_id/cwp_id/iwp_id/nde_id` de la línea **no** salen del line list (vienen de MTO/AWP y de juntas) — dejarlos nulos aquí.

## Parte B — Cadena isos → spools → juntas → MTO en el importador

El frontend ya ofrece `list_isos`, `list_spools`, `list_juntas` en el dropdown, pero las RPC `importar_crear_lote`/`importar_calcular_diff`/`importar_aplicar_lote` **solo soportan `list_lineas` y `list_mto`** (lanzan "Tabla destino no soportada"). Hay que implementarlas, respetando el orden de dependencia:

1. **list_isos** — OJO: `id_iso` es **columna generada** (`id_linea || '-' || sheet`), no se importa directo. Clave de import = ID_LINEA + SHEET. FK `linea_id` ← ID_LINEA (resolver contra list_lineas; abortar si la línea no existe).
2. **list_spools** (clave: `id_spool`) — FK `iso_id` ← ID_ISO y `linea_id` ← ID_LINEA (ambos NOT NULL, resolver los dos).
3. **list_juntas** (clave: `id_spool`+`numero_junta`) — FK `spool_id` ← ID_SPOOL y `linea_id` ← ID_LINEA (NOT NULL), `tipo_union_id` ← TIPO UNION (cat_tipo_union), `nps_id` ← NPS (cat_diametros_nps), `nde_id` ← % NDE (cat_porcentaje_nde, agregado en migración 011). Guarda además `porcentaje_nde` numérico crudo si viene.
4. **list_mto** (clave: `item`) — ya soportado; resuelve `linea_id`, `nps_id`, `clase_id`. Ahora también **`spool_id` ← ID_SPOOL** (agregado en migración 011: material a nivel de spool). Resolver el spool contra list_spools del proyecto; nullable si el MTO es de línea sin spool.

Cada nueva tabla sigue el mismo patrón que list_lineas: perfil de import, staging en `import_filas`, diff (nueva/modificada/sin_cambio/ausente), aprobación y aplicación transaccional. Reusa las funciones genéricas (`importar_diff_campo`, `importar_a_num`, etc.). Mantén la regla de **ausentes nunca se borran solos** (solo se marcan) que ya existe para líneas/MTO.

Los encabezados reales de cada hoja están en `LIST_Piping_MS.xlsx` (isos 14 cols, spools 33 cols, juntas 65 cols) — deriva el mapeo completo de ahí; arriba van solo las claves y FK imprescindibles.

## Parte C — IA híbrida: completar catálogos desde el spec (decisión de Cristian)

Estrategia elegida: **plantilla + IA del spec** (no derivar del Excel, que no es autoritativo). Extiende el extractor de P4 (`apps/ia-worker`) para que, además de fluidos y clases, extraiga del PDF de especificación los catálogos que son **específicos del contrato** y vienen descritos en el spec, con la misma trazabilidad (página + cita + confianza) y el mismo flujo diff/aprobación de `importar_crear_lote_ia`:

- **Sí extraer del spec:** clase (enriquecida: material, presión, temp, aplicación), tipo de prueba, esquema de pintura, aislación, revestimiento, % NDE (método/norma), tipo de unión.
- **De plantilla/manual (estándar, no vale la pena IA):** diámetros NPS, CWA/CWP/IWP, personal (esos vienen del proyecto/AWP, no del spec técnico).

Reusa el patrón de P4: cada catálogo es un "lote IA" con `origen='extraccion_ia'`, `fuente`/`confianza` por fila, sin detección de "ausente" (un spec no es fuente exhaustiva). Generaliza el diff de la 007 a estos catálogos nuevos.

## Parte D — Orden de carga y "CAT lista"

Guía visible en el dashboard, y en este orden estricto:

1. **CAT** (plantilla + IA del spec, revisado y aprobado) — los 14 catálogos.
2. `list_lineas` → 3. `list_isos` → 4. `list_spools` → 5. `list_juntas` → 6. `list_mto` → 7. soportes/válvulas.
8. Después, LOG/REG de terreno (fase 2).

Agrega un chequeo **"base CAT lista"** antes de habilitar la carga de LIST: una vista/RPC que reporte, por proyecto, cuántas filas tiene cada `cat_*` y marque en rojo los vacíos que el line list va a referenciar (fluido, clase, nps, prueba, pintura, revestimiento, aislación, tipo_union, nde). En `CubicadorImport.tsx`, si la base CAT relevante está vacía, mostrar aviso "Carga primero los catálogos" en vez de dejar importar y fallar fila por fila.

## Parte E — Edición manual de catálogos (generar CAT sin Excel)

Como los datos se generan nuevos (no se migran), hace falta poder **crear y editar catálogos a mano** en el dashboard, no solo por plantilla/IA. Pantalla de gestión CAT por proyecto: listar cada `cat_*`, alta/edición/desactivación de filas (respetando RLS de escritura por rol vía `tiene_membresia`), con los campos enriquecidos de la migración 010. Los "ausentes" nunca se borran: usar `activo=false`. Esta pantalla + la IA del spec + la plantilla son los tres generadores de la base CAT.

## Prueba (con datos nuevos, no el 413)

Validar con un **proyecto nuevo pequeño y sintético**, no cargando el piloto:
1. Crear proyecto demo (wizard) → clona catálogos de plantilla.
2. Completar/crear a mano y/o por IA del spec unas pocas filas en cada `cat_*` relevante.
3. Armar un Excel de cubicador mínimo (5–10 líneas, con sus isos/spools/juntas/MTO coherentes) e importarlo por la cadena completa.
4. Probar el caso de error: una línea con un código de catálogo inexistente debe **abortar** el lote.

El `LIST_Piping_MS.xlsx` del 413 puede usarse puntualmente como prueba de estrés de rendimiento si quieres, pero **no** es el objetivo ni queda cargado.

## Definition of Done

- [ ] Migraciones 010 y 011 aplicadas; tipos TS regenerados; `list_tables` muestra los campos/FK nuevos (`cat_*` enriquecidos, `list_mto.spool_id`, `list_juntas.nde_id`).
- [ ] Editor manual de catálogos operativo (alta/edición/desactivación por rol) para los 14 `cat_*` con campos enriquecidos.
- [ ] Importar una línea del cubicador resuelve los 7 FK mapeados; un código de prueba/pintura/aislación inexistente **aborta** el lote con mensaje por fila (base firme verificada).
- [ ] `list_isos`, `list_spools`, `list_juntas` soportados end-to-end en el importador (crear lote → diff → aprobar → aplicar), con FK resueltos (incl. `nde_id` en juntas, `spool_id` en MTO) y "ausentes" solo marcados.
- [ ] Un proyecto nuevo demo genera su cadena CAT→línea→iso→spool→junta→MTO sin huérfanos: cero spools sin iso, cero juntas sin spool.
- [ ] IA del spec extrae los catálogos específicos del contrato con página+cita+confianza y pasan por diff/aprobación.
- [ ] Chequeo "base CAT lista" visible; el importador de LIST avisa si faltan catálogos en vez de fallar fila por fila.

## Cómo reportar

Al terminar cada parte, deja el conteo de filas generadas por catálogo y por tabla LIST en el proyecto demo, y confirma que el caso de error (código inexistente) aborta correctamente.

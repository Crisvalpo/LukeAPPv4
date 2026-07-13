# Corrección F0.5 — DIFERIDA, ya no bloqueante (decisión 2026-07-13)

> **Cambio de prioridad**: Andina (413) opera con los datos y estructura actuales como piloto. Esta corrección se ejecuta más adelante, en la ventana de corte de F1.2, usando el ETL ya reescrito (que quedó correcto: lee Excel, alcance completo, sin placeholders, con conciliación). Commitear el ETL corregido ahora; la re-carga completa y el reporte de conciliación quedan pendientes para el corte. La prioridad actual es habilitar la creación de proyectos nuevos (ver INSTRUCCIONES_DESARROLLO.md § Reprioritización).

## Hallazgos

Comparación fuente v1 (libros Excel de la carpeta OneDrive del 413, medidos directamente) vs. lo cargado en `lukeserver`:

| Tabla | Fuente v1 | Cargado v4 | Brecha |
|---|---|---|---|
| `list_lineas` | ~107 | 109 | ✓ ok |
| `list_isos` | ~203–216 | 154 | ~25% faltante |
| `list_spools` | ~525 | 340 (incluye placeholders) | ~35% faltante |
| `list_juntas` | ~1.687 | 1.084 | ~36% faltante |
| `list_mto` | ~3.091 | 2.783 | ~10% faltante |
| `reg_ejecucion_juntas` | ~612 (hoja principal 453 + hoja "(2)" 161, deduplicar) | 99 | **~84% faltante** |
| `reg_inspeccion_visual` | ~364 | 0 | no migrada |
| `list_valvulas` | ~167 | 0 | no migrada |
| `list_soportes` | ~515 | 0 | no migrada |
| `list_equipos` / `list_tie_ins` / `list_pid` | 23 / 6 / 6 | 0 | no migradas |
| `log_spool` / `log_materiales` / `log_iso` / `log_pid` / `log_sdi` | ~527 / ~761 / ~163 / 7 / 35 | 0 | no migradas |
| `rel_pid_lineas` / `rel_sdi_iso` | ~123 / 1 | 0 | no migradas |
| `doc_revision_events` | 2 | 0 | no migrada |
| Mecánica (`list_mec`, `list_esp_elem`, `reg_esp_elem`) | ~467 / 69 / 8 | 0 | no migradas |
| Evidencias (fotos/PDF en carpetas `Archivos/`) | ~800 archivos | 0 | no migradas |

Los conteos de fuente son aproximados (±1–2 por filas vacías al final de tabla); las brechas superan por mucho ese margen.

## Causas raíz identificadas

1. **Fuente equivocada**: el ETL leyó "CSV de AppSheet" (dumps parciales/antiguos) en lugar de los **libros Excel** de la carpeta OneDrive, que son la fuente definida en F0.5.
2. **Placeholders enmascaran pérdida**: la autogeneración de ISOs/spools "huérfanos" hace que la verificación "0 huérfanos" salga verde aunque falte un tercio de los datos. Un check de integridad que no puede fallar no verifica nada.
3. **Alcance parcial**: solo se migraron 6 de las ~25 tablas operativas del alcance.

## Correcciones requeridas

1. **Fuente única**: leer los libros Excel de `EIMI00413 - Andina - .../1 - APP/` — `LIST_Piping_MS.xlsx`, `REG_Piping_MS.xlsx`, `LOG_Piping_MS.xlsx`, `REL_Piping_MS.xlsx`, `DOC_Piping_MS.xlsx`, `CAT_Piping_MS.xlsx`, `LIST_Mecanica_MS.xlsx`, `0_UX/LIST_uxApp_MS.xlsx`. No usar CSV intermedios.
2. **Consolidar hojas espejo**: `REG_EjecucionJuntas_MS` + `REG_EjecucionJuntas_MS (2)` se unen deduplicando por `ID_juntaEjecutada`.
3. **Alcance completo**: todas las tablas de la comparación anterior, más las evidencias: subir archivos de las carpetas `Archivos/` a Storage parseando el nombre v1 (`hash.TIPO.timestamp.ext` → tipo y timestamp) y poblar `evidencias` vinculando al registro por el hash presente en la celda correspondiente.
4. **Eliminar placeholders**: un padre faltante (ISO/spool inexistente) es un hallazgo que el `--dry-run` reporta con detalle (tabla, fila, clave) para resolución humana; no se autogeneran registros. Excepción única: si OT aprueba explícitamente una lista de excepciones, se cargan marcadas `origen_dato = 'reconstruido'`.
5. **Criterio de aceptación real**: el ETL termina con un reporte de conciliación **tabla por tabla: filas fuente = filas cargadas + filas rechazadas (con motivo)**. Cero filas sin clasificar. "0 huérfanos" deja de ser criterio.
6. **Fuente viva**: el 413 sigue operando en AppSheet (la fuente creció hoy). El ETL debe ser idempotente y re-ejecutable; la carga definitiva se hace en la ventana de corte que define F1.2.

## Definition of done de esta corrección
- [ ] ETL reescrito leyendo Excel directo (openpyxl), sin CSV intermedios.
- [ ] Reporte de conciliación tabla por tabla adjunto al walkthrough (fuente / cargado / rechazado+motivo).
- [ ] Todas las tablas del alcance migradas, evidencias en Storage con metadatos.
- [ ] Sin placeholders autogenerados; huérfanos reportados en `--dry-run`.
- [ ] Re-ejecución del ETL no duplica (verificado dos corridas seguidas).

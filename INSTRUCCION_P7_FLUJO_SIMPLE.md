# P7 — Flujo simple: crear proyecto → cargar documentos → IA propone catálogos

**Para:** agente Antigravity · **Alcance:** `apps/dashboard` (navegación/UX) + una migración menor para dejar de sembrar catálogos en el wizard. El motor de ingesta IA ya existe y no se toca.

## Principio

La lógica debe ser **simple y lineal**. Después de crear un proyecto, el único siguiente paso es **cargar los documentos del proyecto**; de esa carga, la IA (Gemini) **propone los catálogos detectados** y el usuario los aprueba. Todo lo demás (line list, planos, AWP, dotación, sync SharePoint) es secundario y viene después.

## Lo que YA existe y funciona (no reconstruir)

En `Especificaciones` → **Ingesta Documental**: subir PDF → Gemini indexa y extrae → **"Revisión de Extracción Asistida por IA"** con una pestaña por catálogo (Diámetros NPS, Esquemas de Pintura, Aislación, Tipos de Prueba, Tipos de Unión, Fluidos, Clases de Piping), cada propuesta con página de origen, cita textual, % de confianza, edición por fila y Aprobar/Rechazar + "Aprobar y Aplicar Catálogo". Esto es exactamente el flujo deseado; **solo hay que ponerlo al frente.**

## Cambios (solo UX/navegación)

1. **Al crear un proyecto, llevar directo a "Cargar documentos".** Hoy el wizard, al terminar, cae en el dashboard del proyecto (métricas en 0). Cambiarlo: tras `Crear Proyecto`, navegar directo a la Ingesta Documental del proyecto nuevo, con un encabezado guía claro, p. ej.: *"Paso 1 — Sube las especificaciones y documentos del proyecto. La IA detectará los catálogos automáticamente."* y el botón **+ Subir Documento PDF** destacado.

2. **Estado vacío guiado.** Si el proyecto no tiene documentos aún, la pantalla del proyecto debe mostrar como acción principal "Cargar documentos" (no las 6 pestañas ni métricas en 0). Un solo call-to-action.

3. **Ordenar la navegación en pasos, no en módulos sueltos.** Secuencia sugerida y visible como progreso del proyecto:
   1. **Documentos** (Especificaciones / Ingesta Documental) — subir PDFs.
   2. **Catálogos** (la Revisión de Extracción IA) — revisar y aprobar lo detectado. Que sea un destino claro tras aprobar, no algo escondido dentro de "Especificaciones".
   3. **Datos / Line List** (la sync/importador) — recién cuando los catálogos están listos.
   4. Resto (Planos P&ID, AWP, Dotación) — opcionales/avanzados, menos prominentes.

4. **Bajar el ruido de los módulos que confunden hoy:**
   - `Datos` (sync SharePoint/OneDrive): mantener, pero **no** como primer paso ni pre-apuntado a la carpeta del piloto 413 en proyectos nuevos. Un proyecto nuevo no debe heredar ese origen.
   - `Integración`: **quitar por completo** (botón de navegación + vista/ruta). No tiene futuro por ahora (decidido por Cristian); no aportaba vista distinta a `Datos`.
   - `AWP` y `Dotación`: son editores manuales de catálogos que la IA no detecta del spec (CWA/CWP/IWP y personal). Dejarlos como "avanzado", fuera del camino principal.

5. **El proyecto nace 100% limpio — NO sembrar nada (decidido por Cristian).** Hoy el wizard clona catálogos de plantilla por industria (al menos NPS) dentro de su RPC (`crear_proyecto...`, migración 005) y el paso 3 dice *"inicializará los diámetros normalizados NPS"*. Quitar ambas cosas:
   - **Backend:** en una migración nueva, redefinir la función del wizard para que **NO clone** `plantillas_catalogo` (eliminar ese bloque). El proyecto se crea sin filas en ningún `cat_*`.
   - **Frontend:** quitar del paso 3 del wizard el texto sobre inicializar catálogos/NPS.
   - Los 14 catálogos se llenan exclusivamente desde los documentos vía IA (y edición manual puntual donde aplique). Esto además hace más limpio el diff de la IA: no hay filas plantilla que reconciliar.

## Definition of Done

- [ ] Al terminar el wizard, el usuario cae directo en "Cargar documentos" del proyecto nuevo, con el mensaje guía de Paso 1.
- [ ] Un proyecto sin documentos muestra un único call-to-action "Cargar documentos", no métricas en 0 ni 6 pestañas.
- [ ] Tras aprobar propuestas de la IA, los catálogos quedan aplicados y hay un camino claro al siguiente paso (Datos/Line List).
- [ ] Proyecto nuevo **no** hereda la carpeta SharePoint del 413.
- [ ] Un proyecto recién creado tiene **cero filas** en todos los `cat_*` (el wizard ya no siembra plantillas) y el paso 3 no menciona inicializar catálogos.
- [ ] La navegación comunica los pasos (Documentos → Catálogos → Datos → resto), no una lista plana de módulos.

## Nota

Todo esto es reordenar y guiar; el motor (ingesta IA, propuestas con cita/página/confianza, aprobación y aplicación al catálogo) ya está y funciona en PROY-001. No romper ese flujo — solo hacerlo el camino principal.

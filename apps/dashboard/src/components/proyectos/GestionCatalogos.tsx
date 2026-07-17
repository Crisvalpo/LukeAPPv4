import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

interface GestionCatalogosProps {
  proyectoId: string;
}

interface CampoCatalogo {
  key: string;
  label: string;
  tipo: 'text' | 'number' | 'select' | 'date';
  placeholder?: string;
  requerido?: boolean;
  esClave?: boolean;
  refCatalogoId?: string; // id de otro catálogo en CATALOGOS_CONFIG
  columnaFk?: string;     // columna UUID real en base de datos a resolver
}

interface CatalogoConfig {
  id: string;
  tabla: string;
  claveNatural: string;
  label: string;
  labelSingular: string;
  selectQuery: string;
  campos: CampoCatalogo[];
}

interface FilaTabla {
  key: string;
  id: string | null;
  valores: Record<string, string>;
  esNueva: boolean;
  dirty: boolean;
  activo: boolean;
}

const CATALOGOS_CONFIG: CatalogoConfig[] = [
  {
    id: 'fluido', tabla: 'cat_fluido_servicio', claveNatural: 'codigo',
    label: 'Fluidos de Servicio', labelSingular: 'Fluido',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: AG' },
      { key: 'nombre', label: 'Nombre', tipo: 'text', requerido: true, placeholder: 'ej: Agua de Procesos' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Agua para refrigeración' },
      { key: 'color_nombre', label: 'Nombre Color', tipo: 'text', placeholder: 'ej: Verde' },
      { key: 'color_ral', label: 'Color RAL', tipo: 'text', placeholder: 'ej: RAL 6018' },
    ],
  },
  {
    id: 'clase', tabla: 'cat_clase_piping', claveNatural: 'codigo',
    label: 'Clases de Piping', labelSingular: 'Clase',
    selectQuery: '*, cat_fluido_servicio(codigo)',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: A1A' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Acero carbono Sch 40' },
      { key: 'fluido_codigo', label: 'Fluido', tipo: 'select', refCatalogoId: 'fluido', columnaFk: 'fluido_id' },
      { key: 'material', label: 'Material', tipo: 'text', placeholder: 'ej: Carbon Steel' },
      { key: 'presion_max', label: 'Presión Máx (kg/cm²)', tipo: 'number', placeholder: 'ej: 10' },
      { key: 'presion_psi', label: 'Presión (PSI)', tipo: 'number', placeholder: 'ej: 150' },
      { key: 'temp_max', label: 'Temp Máx (°C)', tipo: 'number', placeholder: 'ej: 120' },
      { key: 'aplicacion', label: 'Aplicación', tipo: 'text', placeholder: 'ej: Servicios Generales' },
    ],
  },
  {
    id: 'nps', tabla: 'cat_diametros_nps', claveNatural: 'nps',
    label: 'Diámetros NPS', labelSingular: 'NPS',
    selectQuery: '*',
    campos: [
      { key: 'nps', label: 'Diámetro Nominal', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: 2"' },
      { key: 'nps_mm', label: 'Equivalencia mm', tipo: 'number', placeholder: 'ej: 50' },
      { key: 'tipo_material', label: 'Tipo Material', tipo: 'text', placeholder: 'ej: Seamless' },
      { key: 'unidad_medida', label: 'Unidad de Medida', tipo: 'text', placeholder: 'ej: INCH' },
    ],
  },
  {
    id: 'aislacion', tabla: 'cat_aislacion_ext', claveNatural: 'codigo',
    label: 'Aislación Exterior', labelSingular: 'Aislación',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: IH' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Conservación Calor' },
      { key: 'restriccion_pintura', label: 'Restricción Pintura', tipo: 'text', placeholder: 'ej: No pintar' },
    ],
  },
  {
    id: 'revestimiento', tabla: 'cat_revestimiento_int', claveNatural: 'codigo',
    label: 'Revestimiento Interior', labelSingular: 'Revestimiento',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: RL' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Goma Natural' },
      { key: 'especificacion', label: 'Especificación', tipo: 'text', placeholder: 'ej: Espesor 1/4"' },
    ],
  },
  {
    id: 'pintura', tabla: 'cat_esquema_pintura', claveNatural: 'codigo',
    label: 'Esquemas de Pintura', labelSingular: 'Esquema',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: P01' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Epóxico - Poliuretano' },
      { key: 'capas', label: 'N° Capas', tipo: 'number', placeholder: 'ej: 3' },
      { key: 'sistema_aplicacion', label: 'Sistema Aplicación', tipo: 'text', placeholder: 'ej: Airless' },
      { key: 'preparacion_superficie', label: 'Preparación Super.', tipo: 'text', placeholder: 'ej: SSPC-SP10' },
      { key: 'espesor_total_um', label: 'Espesor Seco (µm)', tipo: 'number', placeholder: 'ej: 250' },
      { key: 'detalle_capas', label: 'Detalle Capas', tipo: 'text', placeholder: 'ej: Imprimación zinc 75µm, Enlace 125µm...' },
    ],
  },
  {
    id: 'nde', tabla: 'cat_porcentaje_nde', claveNatural: 'codigo',
    label: 'Porcentajes NDE', labelSingular: 'Porcentaje NDE',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: RT10' },
      { key: 'porcentaje', label: 'Porcentaje (%)', tipo: 'number', requerido: true, placeholder: 'ej: 10' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Inspección radiográfica 10%' },
      { key: 'metodo', label: 'Método NDE', tipo: 'text', placeholder: 'ej: RT' },
      { key: 'aplicacion', label: 'Aplicación', tipo: 'text', placeholder: 'ej: Taller / Terreno' },
      { key: 'norma', label: 'Norma Reguladora', tipo: 'text', placeholder: 'ej: ASME B31.3' },
    ],
  },
  {
    id: 'prueba', tabla: 'cat_tipo_prueba', claveNatural: 'codigo',
    label: 'Tipos de Prueba', labelSingular: 'Prueba',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: HY' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Prueba Hidrostática' },
      { key: 'aplicacion', label: 'Aplicación', tipo: 'text', placeholder: 'ej: Cañerías de Proceso' },
      { key: 'condicion_diseno', label: 'Condición Diseño', tipo: 'text', placeholder: 'ej: 1.5 x Presión Diseño' },
      { key: 'medio_fluido', label: 'Medio Fluido', tipo: 'text', placeholder: 'ej: Agua Limpia' },
    ],
  },
  {
    id: 'union', tabla: 'cat_tipo_union', claveNatural: 'codigo',
    label: 'Tipos de Unión', labelSingular: 'Tipo Unión',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: BW' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Soldadura a tope' },
      { key: 'acronimo', label: 'Acrónimo', tipo: 'text', placeholder: 'ej: BW' },
      { key: 'tipo_uniones', label: 'Detalle Conexión', tipo: 'text', placeholder: 'ej: Buttweld' },
      { key: 'metodo_trabajo', label: 'Método Trabajo', tipo: 'text', placeholder: 'ej: GTAW + SMAW' },
      { key: 'nde_requerido', label: 'NDE por Defecto', tipo: 'text', placeholder: 'ej: RT10' },
      { key: 'aplicacion', label: 'Aplicación', tipo: 'text', placeholder: 'ej: Diámetros >= 2"' },
    ],
  },
  {
    id: 'soporte', tabla: 'cat_tipo_soporte', claveNatural: 'codigo',
    label: 'Tipos de Soporte', labelSingular: 'Soporte',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: S-01' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Soporte guía deslizante' },
    ],
  },
  {
    id: 'personal', tabla: 'cat_personal', claveNatural: 'rut',
    label: 'Personal de Obra', labelSingular: 'Trabajador',
    selectQuery: '*',
    campos: [
      { key: 'rut', label: 'RUT / ID', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: 12.345.678-9' },
      { key: 'nombre', label: 'Nombre Completo', tipo: 'text', requerido: true, placeholder: 'ej: Juan Pérez' },
      { key: 'estampa', label: 'Estampa (Soldador)', tipo: 'text', placeholder: 'ej: JP' },
      { key: 'cargo', label: 'Cargo', tipo: 'text', placeholder: 'ej: Soldador 6G' },
      { key: 'area', label: 'Área', tipo: 'text', placeholder: 'ej: Prefabricación' },
      { key: 'supervisor', label: 'Supervisor a Cargo', tipo: 'text', placeholder: 'ej: Supervisor Montaje' },
      { key: 'estado', label: 'Estado', tipo: 'text', placeholder: 'ej: HABILITADO' },
    ],
  },
  {
    id: 'cwa', tabla: 'cat_cwa', claveNatural: 'codigo',
    label: 'Áreas de Trabajo (CWA)', labelSingular: 'CWA',
    selectQuery: '*',
    campos: [
      { key: 'codigo', label: 'Código CWA', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: CWA-01' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Planta Concentradora' },
    ],
  },
  {
    id: 'cwp', tabla: 'cat_cwp', claveNatural: 'codigo',
    label: 'Paquetes de Trabajo (CWP)', labelSingular: 'CWP',
    selectQuery: '*, cat_cwa(codigo)',
    campos: [
      { key: 'codigo', label: 'Código CWP', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: CWP-100' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Prefabricación Piping' },
      { key: 'cwa_codigo', label: 'Área (CWA)', tipo: 'select', refCatalogoId: 'cwa', columnaFk: 'cwa_id' },
    ],
  },
  {
    id: 'iwp', tabla: 'cat_iwp', claveNatural: 'codigo',
    label: 'Paquetes de Instalación (IWP)', labelSingular: 'IWP',
    selectQuery: '*, cat_cwp(codigo)',
    campos: [
      { key: 'codigo', label: 'Código IWP', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: IWP-100-01' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Montaje cañerías espesador' },
      { key: 'cwp_codigo', label: 'CWP', tipo: 'select', refCatalogoId: 'cwp', columnaFk: 'cwp_id' },
      { key: 'fecha_inicio', label: 'Fecha Inicio', tipo: 'date' },
      { key: 'fecha_fin', label: 'Fecha Fin', tipo: 'date' },
    ],
  },
];

const catalogoPorId = (id: string): CatalogoConfig => CATALOGOS_CONFIG.find((c) => c.id === id) ?? CATALOGOS_CONFIG[0];

const filaVaciaDesde = (campos: CampoCatalogo[]): Record<string, string> =>
  Object.fromEntries(campos.map((c) => [c.key, '']));

const valoresDesdeObjeto = (campos: CampoCatalogo[], obj: Record<string, any>): Record<string, string> =>
  Object.fromEntries(
    campos.map((c) => {
      if (c.tipo === 'select' && c.refCatalogoId) {
        const refCat = catalogoPorId(c.refCatalogoId);
        const joined = obj[refCat.tabla];
        const codigo = Array.isArray(joined) ? joined[0]?.codigo : joined?.codigo;
        return [c.key, codigo ?? ''];
      }
      return [c.key, obj[c.key] != null ? String(obj[c.key]) : ''];
    })
  );

interface RefPendiente {
  id: string;
  codigo_documento: string;
  titulo: string | null;
  catalogo_sugerido: string | null;
  pagina: number | null;
  cita: string | null;
  documento_origen_id: string;
  documento_origen_titulo: string;
}

interface EstadoCatalogoResumen {
  tabla: string;
  n_filas: number;
  referencias_pendientes: RefPendiente[];
}

export const GestionCatalogos: React.FC<GestionCatalogosProps> = ({ proyectoId }) => {
  const [pestana, setPestana] = useState<string>('fluido');
  const [datos, setDatos] = useState<Record<string, any[]>>({});
  const [resumenEstado, setResumenEstado] = useState<EstadoCatalogoResumen[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [filas, setFilas] = useState<FilaTabla[]>([]);
  const [guardandoKey, setGuardandoKey] = useState<string | null>(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const pestanaAnteriorRef = useRef(pestana);

  const catalogoActivo = catalogoPorId(pestana);

  const fetchResumenEstado = async () => {
    try {
      const { data, error } = await supabase.rpc('estado_catalogos_proyecto', { p_proyecto_id: proyectoId });
      if (error) throw error;
      if (data) {
        setResumenEstado(data as EstadoCatalogoResumen[]);
      }
    } catch (e) {
      console.error('Error al obtener el estado resumido de catálogos:', e);
    }
  };

  const fetchCatalogos = async () => {
    setLoadingCatalogos(true);
    try {
      const resultados = await Promise.all(
        CATALOGOS_CONFIG.map((cat) =>
          supabase.from(cat.tabla).select(cat.selectQuery).eq('proyecto_id', proyectoId).order(cat.claveNatural)
        )
      );
      const nuevo: Record<string, any[]> = {};
      resultados.forEach((res, idx) => {
        nuevo[CATALOGOS_CONFIG[idx].id] = res.data ?? [];
      });
      setDatos(nuevo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCatalogos(false);
    }
  };

  const handleDescartarReferencia = async (refId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas descartar esta referencia?')) return;
    try {
      const { error } = await supabase
        .from('documento_referencias')
        .update({ estado: 'descartada' })
        .eq('id', refId);
      if (error) throw error;
      
      await fetchResumenEstado();
    } catch (e: any) {
      alert(e.message || 'Error al descartar la referencia.');
    }
  };

  useEffect(() => {
    fetchCatalogos();
    fetchResumenEstado();
  }, [proyectoId]);

  useEffect(() => {
    const cambioDePestana = pestanaAnteriorRef.current !== pestana;
    pestanaAnteriorRef.current = pestana;

    setFilas((prev) => {
      const prevByKey = cambioDePestana ? new Map<string, FilaTabla>() : new Map(prev.map((f) => [f.key, f]));

      const registrados: FilaTabla[] = (datos[pestana] ?? []).map((item) => {
        const key = item.id as string;
        const prevFila = prevByKey.get(key);
        if (prevFila?.dirty) return prevFila;
        return {
          key,
          id: key,
          valores: valoresDesdeObjeto(catalogoActivo.campos, item),
          esNueva: false,
          dirty: false,
          activo: item.activo ?? true,
        };
      });

      const nuevasManuales = cambioDePestana ? [] : prev.filter((f) => f.esNueva);

      return [...registrados, ...nuevasManuales];
    });
  }, [pestana, datos, catalogoActivo]);

  const handleCambiarValor = (key: string, campoKey: string, valor: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.key === key ? { ...f, valores: { ...f.valores, [campoKey]: valor }, dirty: true } : f))
    );
  };

  const handleAgregarFilaManual = () => {
    const key = `nueva-${Date.now()}`;
    setFilas((prev) => [
      ...prev,
      { key, id: null, valores: filaVaciaDesde(catalogoActivo.campos), esNueva: true, dirty: true, activo: true }
    ]);
  };

  const handleGuardarFila = async (fila: FilaTabla) => {
    const camposRequeridos = catalogoActivo.campos.filter((c) => c.requerido);
    if (camposRequeridos.some((c) => !fila.valores[c.key]?.trim())) {
      alert('Completa los campos obligatorios antes de guardar.');
      return;
    }
    setGuardandoKey(fila.key);
    try {
      const payload: Record<string, any> = { proyecto_id: proyectoId, activo: true };
      for (const campo of catalogoActivo.campos) {
        const valorCrudo = fila.valores[campo.key]?.trim() ?? '';
        if (campo.tipo === 'select' && campo.columnaFk) {
          if (!valorCrudo) {
            payload[campo.columnaFk] = null;
          } else {
            const refCat = catalogoPorId(campo.refCatalogoId!);
            const match = (datos[campo.refCatalogoId!] ?? []).find(
              (item: any) => String(item.codigo).toUpperCase() === valorCrudo.toUpperCase()
            );
            if (!match) throw new Error(`"${valorCrudo}" no existe en ${refCat.label}. Regístralo primero.`);
            payload[campo.columnaFk] = match.id;
          }
        } else if (campo.tipo === 'number') {
          payload[campo.key] = valorCrudo ? Number(valorCrudo) : null;
        } else {
          payload[campo.key] = campo.esClave ? valorCrudo.toUpperCase() : (valorCrudo || null);
        }
      }

      if (fila.id) {
        const { error } = await supabase.from(catalogoActivo.tabla).update(payload).eq('id', fila.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(catalogoActivo.tabla).insert(payload);
        if (error) throw error;
      }

      setFilas((prev) => prev.filter((f) => f.key !== fila.key));
      await fetchCatalogos();
      await fetchResumenEstado();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la fila.');
    } finally {
      setGuardandoKey(null);
    }
  };

  const handleToggleActivo = async (fila: FilaTabla) => {
    if (!fila.id) {
      setFilas((prev) => prev.filter((f) => f.key !== fila.key));
      return;
    }
    const nuevoEstado = !fila.activo;
    const msg = nuevoEstado
      ? '¿Estás seguro de que deseas volver a activar este elemento?'
      : '¿Estás seguro de que deseas desactivar lógicamente este elemento? (No se eliminará físicamente para evitar romper la integridad)';
    if (!confirm(msg)) return;

    try {
      const { error } = await supabase
        .from(catalogoActivo.tabla)
        .update({ activo: nuevoEstado })
        .eq('id', fila.id);
      if (error) throw error;
      await fetchCatalogos();
      await fetchResumenEstado();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar el estado del elemento.');
    }
  };

  const filasVisibles = filas.filter((f) => mostrarInactivos || f.activo);
  const referenciasGlobales = resumenEstado.flatMap((r) => r.referencias_pendientes || []);

  return (
    <div className="flex-grow p-6 space-y-4 bg-background text-foreground font-sans flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b border-border pb-4 shrink-0">
        <h2 className="text-xl font-display font-extrabold text-white tracking-tight">Gestión de Catálogos (Base CAT)</h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Administración manual y detallada de los 14 catálogos de base firme y trazabilidad del proyecto. Modifica datos en línea o realiza desactivación lógica de registros obsoletos.
        </p>
      </div>

      {/* SECCIÓN DE REFERENCIAS PENDIENTES */}
      {referenciasGlobales.length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/20 shrink-0">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-grow">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Especificaciones Referenciadas Pendientes ({referenciasGlobales.length})
                </h3>
                <p className="text-[10px] text-muted mt-0.5">
                  Los siguientes documentos han sido citados en especificaciones técnicas cargadas pero no se han subido aún. Súbelos para autocompletar el catálogo asociado.
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                  {referenciasGlobales.map((ref) => {
                    const catTarget = CATALOGOS_CONFIG.find((c) => c.tabla === ref.catalogo_sugerido);
                    return (
                      <div key={ref.id} className="bg-background/40 p-2.5 rounded border border-border/60 flex flex-col justify-between gap-1 text-[10px]">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-amber-400 uppercase tracking-wide break-all">{ref.codigo_documento}</span>
                            <span className="text-[9px] text-muted-foreground uppercase">{catTarget?.labelSingular || 'Catálogo'}</span>
                          </div>
                          {ref.titulo && <p className="text-white font-semibold mt-0.5 leading-snug">{ref.titulo}</p>}
                          <p className="text-[9px] text-muted-foreground mt-1 break-all">
                            Citado en: <strong className="text-slate-300 font-medium">{ref.documento_origen_titulo}</strong> (pág. {ref.pagina || '—'})
                          </p>
                        </div>
                        <div className="flex justify-end gap-1.5 mt-2 pt-1.5 border-t border-border/40 shrink-0">
                          <button
                            onClick={() => handleDescartarReferencia(ref.id)}
                            className="px-2 py-0.5 rounded text-[9px] font-bold text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Descartar
                          </button>
                          <button
                            onClick={() => alert("Dirígete a la pestaña '1. Documentos' para subir el archivo: " + ref.codigo_documento)}
                            className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors"
                          >
                            Subir PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex border-b border-border overflow-x-auto shrink-0 py-0.5 gap-1 scrollbar-thin">
        {CATALOGOS_CONFIG.map((cat) => {
          const activosCount = datos[cat.id]?.filter((d) => d.activo !== false).length ?? 0;
          
          const resumen = resumenEstado.find((r) => r.tabla === cat.tabla);
          const nFilasActivas = resumen ? resumen.n_filas : activosCount;
          const refsPendientes = resumen?.referencias_pendientes ?? [];
          
          let estadoColor = 'bg-panel/40 text-muted/80 border-transparent';
          let tooltip = 'Vacío';
          let icon = '';
          
          if (nFilasActivas > 0) {
            estadoColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            icon = '●';
            tooltip = 'Poblado';
          } else if (refsPendientes.length > 0) {
            estadoColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse';
            icon = '⚠️';
            tooltip = `Falta cargar: ${refsPendientes.map(r => r.codigo_documento).join(', ')}`;
          } else {
            estadoColor = 'bg-slate-500/10 text-slate-400 border border-slate-500/10';
            icon = '';
            tooltip = 'Vacío';
          }

          return (
            <button
              key={cat.id}
              onClick={() => setPestana(cat.id)}
              title={tooltip}
              className={`shrink-0 px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                pestana === cat.id ? 'text-accent border-accent' : 'text-muted border-transparent hover:text-white hover:bg-panel/5 rounded-t-md'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 font-bold ${estadoColor}`}>
                {icon && <span>{icon}</span>}
                <span>{nFilasActivas}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between shrink-0 bg-panel/10 p-3 rounded-lg border border-border/40 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">{catalogoActivo.label}</h4>
          <label className="flex items-center gap-2 text-xs text-muted font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
              className="accent-accent"
            />
            Mostrar elementos inactivos
          </label>
        </div>
        <Button variant="outline" size="sm" onClick={handleAgregarFilaManual}>
          + Agregar Fila
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto border border-border rounded-xl bg-card">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr className="bg-panel/20 text-muted uppercase text-[9px] font-bold tracking-wider">
              <th className="p-3 w-8" />
              {catalogoActivo.campos.map((campo) => (
                <th key={campo.key} className="p-3 text-left">
                  {campo.label} {campo.requerido && <span className="text-red-400 font-bold">*</span>}
                </th>
              ))}
              <th className="p-3 w-28 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loadingCatalogos ? (
              <tr>
                <td colSpan={catalogoActivo.campos.length + 2} className="p-12 text-center text-muted">
                  Cargando datos del catálogo...
                </td>
              </tr>
            ) : filasVisibles.length === 0 ? (
              <tr>
                <td colSpan={catalogoActivo.campos.length + 2} className="p-12 text-center text-muted">
                  {mostrarInactivos ? 'El catálogo está vacío. Agrega una fila manualmente.' : 'No hay elementos activos. Activa "Mostrar elementos inactivos" o agrega una fila manual.'}
                </td>
              </tr>
            ) : (
              filasVisibles.map((fila) => (
                <tr
                  key={fila.key}
                  className={`hover:bg-panel/5 transition-colors ${fila.esNueva ? 'bg-emerald-500/5' : ''} ${
                    !fila.activo ? 'opacity-50 bg-red-500/5' : ''
                  }`}
                >
                  <td className="p-2 text-center align-middle">
                    {fila.esNueva && (
                      <span title="Fila nueva sin guardar" className="text-[10px] font-extrabold text-emerald-400">
                        +
                      </span>
                    )}
                    {!fila.esNueva && fila.dirty && (
                      <span title="Cambios sin guardar" className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    )}
                    {!fila.esNueva && !fila.dirty && !fila.activo && (
                      <span title="Inactivo" className="text-[10px] text-red-400 font-bold">✕</span>
                    )}
                  </td>
                  {catalogoActivo.campos.map((campo) => (
                    <td key={campo.key} className="p-2 align-middle">
                      {campo.tipo === 'select' ? (
                        <select
                          value={fila.valores[campo.key] ?? ''}
                          disabled={!fila.activo && !fila.esNueva}
                          onChange={(e) => handleCambiarValor(fila.key, campo.key, e.target.value)}
                          className="w-full bg-transparent border border-transparent px-2 py-1 rounded text-xs font-semibold text-foreground focus:outline-none focus:bg-panel focus:border-accent disabled:opacity-50"
                        >
                          <option value="" className="bg-card text-foreground">— Sin asignar —</option>
                          {(datos[campo.refCatalogoId!] ?? []).map((item: any) => (
                            <option key={item.id} value={item.codigo} className="bg-card text-foreground">
                              {item.codigo} {item.nombre ? `- ${item.nombre}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
                          placeholder={campo.placeholder}
                          value={fila.valores[campo.key] ?? ''}
                          disabled={!fila.activo && !fila.esNueva}
                          onChange={(e) => handleCambiarValor(fila.key, campo.key, e.target.value)}
                          className={`w-full bg-transparent border border-transparent px-2 py-1 rounded text-xs focus:outline-none focus:bg-panel focus:border-accent disabled:opacity-50 ${
                            campo.esClave ? 'uppercase font-extrabold text-white' : 'font-medium text-foreground'
                          }`}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2 text-right whitespace-nowrap align-middle">
                    {(fila.dirty || fila.esNueva) && (
                      <button
                        onClick={() => handleGuardarFila(fila)}
                        disabled={guardandoKey === fila.key}
                        className="text-[10px] font-extrabold text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded hover:bg-emerald-500/10 mr-1 disabled:opacity-40"
                      >
                        {guardandoKey === fila.key ? '...' : 'Guardar'}
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleActivo(fila)}
                      title={fila.activo ? 'Desactivar' : 'Activar'}
                      className={`p-1 rounded transition-colors focus:outline-none ${
                        fila.activo
                          ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/10'
                          : 'text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {fila.activo ? (
                        <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GestionCatalogos;

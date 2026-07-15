import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';

interface ConstructorEspecificacionesProps {
  proyectoId: string;
  documentoId: string;
  onBack: () => void;
}

interface CampoCatalogo {
  key: string;
  label: string;
  tipo: 'text' | 'number';
  placeholder?: string;
  requerido?: boolean;
  esClave?: boolean;
}

interface CatalogoConfig {
  id: string;
  tabla: string;
  claveNatural: string;
  label: string;
  labelSingular: string;
  campos: CampoCatalogo[];
}

interface SugerenciaIA {
  catalogoId: string;
  payload: Record<string, any>;
  confianza: number;
}

const CATALOGOS: CatalogoConfig[] = [
  {
    id: 'fluidos', tabla: 'cat_fluido_servicio', claveNatural: 'codigo',
    label: 'Fluidos de Servicio', labelSingular: 'Fluido',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: HC' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', requerido: true, placeholder: 'ej: Hidrocarburos Líquidos' },
    ],
  },
  {
    id: 'clases', tabla: 'cat_clase_piping', claveNatural: 'codigo',
    label: 'Clases de Piping', labelSingular: 'Clase',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: A1A' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', requerido: true, placeholder: 'ej: Acero al carbono' },
      { key: 'presion_max', label: 'Presión Máx (MPa)', tipo: 'number', placeholder: 'ej: 19.6' },
      { key: 'temp_max', label: 'Temp Máx (°C)', tipo: 'number', placeholder: 'ej: 200' },
    ],
  },
  {
    id: 'nps', tabla: 'cat_diametros_nps', claveNatural: 'nps',
    label: 'Diámetros NPS', labelSingular: 'Diámetro',
    campos: [
      { key: 'nps', label: 'NPS', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: 2"' },
      { key: 'nps_mm', label: 'Diámetro (mm)', tipo: 'number', placeholder: 'ej: 50' },
    ],
  },
  {
    id: 'pintura', tabla: 'cat_esquema_pintura', claveNatural: 'codigo',
    label: 'Esquemas de Pintura', labelSingular: 'Esquema',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: P01' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', requerido: true, placeholder: 'ej: Sistema epóxico externo' },
      { key: 'capas', label: 'N° Capas', tipo: 'number', placeholder: 'ej: 3' },
    ],
  },
  {
    id: 'aislacion', tabla: 'cat_aislacion_ext', claveNatural: 'codigo',
    label: 'Aislación Exterior', labelSingular: 'Aislación',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: IH' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', requerido: true, placeholder: 'ej: Conservación de calor' },
    ],
  },
  {
    id: 'nde', tabla: 'cat_porcentaje_nde', claveNatural: 'codigo',
    label: 'Porcentaje NDE', labelSingular: 'Ensayo NDE',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: RT-100' },
      { key: 'porcentaje', label: 'Porcentaje (%)', tipo: 'number', requerido: true, placeholder: 'ej: 100' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', placeholder: 'ej: Líneas críticas categoría D' },
    ],
  },
  {
    id: 'prueba', tabla: 'cat_tipo_prueba', claveNatural: 'codigo',
    label: 'Tipos de Prueba', labelSingular: 'Prueba',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: HY' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', requerido: true, placeholder: 'ej: Prueba hidrostática' },
    ],
  },
  {
    id: 'union', tabla: 'cat_tipo_union', claveNatural: 'codigo',
    label: 'Tipos de Unión', labelSingular: 'Unión',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: BW' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', requerido: true, placeholder: 'ej: Soldadura a tope' },
    ],
  },
];

const catalogoPorId = (id: string): CatalogoConfig => CATALOGOS.find((c) => c.id === id) ?? CATALOGOS[0];

export const ConstructorEspecificaciones: React.FC<ConstructorEspecificacionesProps> = ({ proyectoId, documentoId, onBack }) => {
  const [documentoUrl, setDocumentoUrl] = useState<string | null>(null);
  const [tituloDoc, setTituloDoc] = useState('');
  const [pestana, setPestana] = useState<string>('fluidos');

  // Catálogos locales, uno por cada CatalogoConfig.id
  const [datos, setDatos] = useState<Record<string, any[]>>({});
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  // Formulario de ingreso, genérico por campo.key de la pestaña activa
  const [form, setForm] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  // Sugerencias IA
  const [sugerencias, setSugerencias] = useState<SugerenciaIA[]>([]);
  const [loadingIA, setLoadingIA] = useState(true);

  const catalogoActivo = catalogoPorId(pestana);

  useEffect(() => {
    const fetchDoc = async () => {
      const { data, error } = await supabase
        .from('doc_biblioteca')
        .select('*')
        .eq('id', documentoId)
        .single();

      if (!error && data) {
        setTituloDoc(data.titulo);
        // Descargar URL firmada temporal (validez 1 hora)
        const { data: dataUrl, error: errSigned } = await supabase.storage
          .from('documentos')
          .createSignedUrl(data.storage_path, 3600);
        if (!errSigned && dataUrl) {
          setDocumentoUrl(dataUrl.signedUrl);
        } else {
          console.error('[ConstructorEspecificaciones] error generating signed URL:', errSigned);
        }
      }
    };

    fetchDoc();
  }, [documentoId]);

  const fetchCatalogos = async () => {
    setLoadingCatalogos(true);
    try {
      const resultados = await Promise.all(
        CATALOGOS.map((cat) =>
          supabase.from(cat.tabla).select('*').eq('proyecto_id', proyectoId).order(cat.claveNatural)
        )
      );
      const nuevo: Record<string, any[]> = {};
      resultados.forEach((res, idx) => {
        nuevo[CATALOGOS[idx].id] = res.data ?? [];
      });
      setDatos(nuevo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCatalogos(false);
    }
  };

  useEffect(() => {
    fetchCatalogos();
  }, [proyectoId]);

  useEffect(() => {
    setForm({});
  }, [pestana]);

  // Leer sugerencias reales de la IA desde las tablas de staging del documento
  useEffect(() => {
    const fetchSugerenciasIA = async () => {
      setLoadingIA(true);
      try {
        // 1. Buscar lotes asociados al documento
        const { data: lotes, error: errLotes } = await supabase
          .from('import_lotes')
          .select('id, import_perfiles(tabla_destino)')
          .eq('documento_id', documentoId);

        if (errLotes) throw errLotes;

        if (!lotes || lotes.length === 0) {
          setSugerencias([]);
          return;
        }

        const loteIds = lotes.map((l) => l.id);

        // 2. Traer las filas de esos lotes
        const { data: filas, error: errFilas } = await supabase
          .from('import_filas')
          .select('*, import_lotes(perfil_id, import_perfiles(tabla_destino))')
          .in('lote_id', loteIds)
          .order('nro_fila');

        if (errFilas) throw errFilas;

        // 3. Mapear las filas a sugerencias, resolviendo tabla_destino -> catálogo
        const mapeadas: SugerenciaIA[] = (filas || [])
          .map((f: any) => {
            const lote = Array.isArray(f.import_lotes) ? f.import_lotes[0] : f.import_lotes;
            const perfil = lote?.import_perfiles;
            const tablaDestino = Array.isArray(perfil) ? perfil[0]?.tabla_destino : perfil?.tabla_destino;
            const catalogo = CATALOGOS.find((c) => c.tabla === tablaDestino);
            if (!catalogo) return null;
            return {
              catalogoId: catalogo.id,
              payload: f.payload ?? {},
              confianza: f.confianza ?? 0.9,
            };
          })
          .filter((s: SugerenciaIA | null): s is SugerenciaIA => s !== null);

        setSugerencias(mapeadas);
      } catch (err) {
        console.error('[ConstructorEspecificaciones] error fetching real suggestions:', err);
        setSugerencias([]);
      } finally {
        setLoadingIA(false);
      }
    };
    fetchSugerenciasIA();
  }, [documentoId]);

  const handleAplicarSugerencia = (s: SugerenciaIA) => {
    setPestana(s.catalogoId);
    const catalogo = catalogoPorId(s.catalogoId);
    const nuevoForm: Record<string, string> = {};
    catalogo.campos.forEach((campo) => {
      const valor = s.payload[campo.key];
      nuevoForm[campo.key] = valor != null ? String(valor) : '';
    });
    setForm(nuevoForm);
  };

  const handleGuardarCatalogo = async (e: React.FormEvent) => {
    e.preventDefault();
    const camposRequeridos = catalogoActivo.campos.filter((c) => c.requerido);
    if (camposRequeridos.some((c) => !form[c.key]?.trim())) return;
    setGuardando(true);

    try {
      const payload: Record<string, any> = { proyecto_id: proyectoId };
      catalogoActivo.campos.forEach((campo) => {
        const valorCrudo = form[campo.key]?.trim() ?? '';
        if (campo.tipo === 'number') {
          payload[campo.key] = valorCrudo ? parseFloat(valorCrudo) : null;
        } else {
          payload[campo.key] = campo.esClave ? valorCrudo.toUpperCase() : (valorCrudo || null);
        }
      });

      const { error } = await supabase.from(catalogoActivo.tabla).insert(payload);
      if (error) throw error;

      setForm({});
      await fetchCatalogos();
    } catch (err: any) {
      alert(err.message || 'Error al guardar elemento del catálogo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarElemento = async (catalogoId: string, id: string) => {
    const catalogo = catalogoPorId(catalogoId);
    if (!confirm(`¿Estás seguro de que deseas eliminar este elemento de "${catalogo.label}" del catálogo del proyecto?`)) return;

    try {
      const { error } = await supabase.from(catalogo.tabla).delete().eq('id', id);
      if (error) throw error;
      await fetchCatalogos();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el elemento del catálogo.');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Subheader Acciones */}
      <div className="h-12 border-b border-border bg-panel px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← Volver
          </Button>
          <span className="text-sm font-bold text-white tracking-tight">{tituloDoc}</span>
        </div>
      </div>

      {/* Pantalla Dividida */}
      <div className="flex flex-grow overflow-hidden">
        {/* Visor PDF (Izquierda) */}
        <div className="w-[55%] h-full relative overflow-hidden bg-zinc-800 border-r border-border">
          {documentoUrl ? (
            <iframe
              src={documentoUrl}
              className="w-full h-full border-none"
              title="Visor Especificación"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
              Cargando visor de documento...
            </div>
          )}
        </div>

        {/* Panel Constructor de Catálogo (Derecha) */}
        <div className="w-[45%] h-full flex flex-col bg-panel overflow-y-auto p-6 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {CATALOGOS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setPestana(cat.id)}
                className={`shrink-0 px-4 text-center py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  pestana === cat.id ? 'text-accent border-accent' : 'text-muted-foreground border-transparent hover:text-white'
                }`}
              >
                {cat.label} ({datos[cat.id]?.length ?? 0})
              </button>
            ))}
          </div>

          {/* Constructor Formulario */}
          <div className="bg-card border border-border p-4 rounded-lg">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Agregar a {catalogoActivo.label}
            </h4>
            <form onSubmit={handleGuardarCatalogo} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {catalogoActivo.campos.map((campo) => (
                  <div
                    key={campo.key}
                    className={`flex flex-col gap-1 ${campo.esClave || campo.key === 'descripcion' ? 'col-span-2 sm:col-span-1' : ''}`}
                  >
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{campo.label}</label>
                    <input
                      type={campo.tipo}
                      step={campo.tipo === 'number' ? 'any' : undefined}
                      placeholder={campo.placeholder}
                      value={form[campo.key] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [campo.key]: e.target.value }))}
                      className={`bg-panel border border-border text-foreground px-3 py-1.5 rounded text-xs font-semibold focus:outline-none focus:border-accent ${campo.esClave ? 'uppercase' : ''}`}
                      required={campo.requerido}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : `Registrar ${catalogoActivo.labelSingular}`}
                </Button>
              </div>
            </form>
          </div>

          {/* Sugerencias de IA */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              💡 Sugerencias Extraídas por IA (Gemini)
            </h4>
            {loadingIA ? (
              <div className="text-xs text-muted-foreground font-medium py-2">Leyendo documento con IA...</div>
            ) : sugerencias.length === 0 ? (
              <div className="text-xs text-amber-400/90 bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg leading-relaxed font-medium">
                ⚠️ Este documento aún no ha sido procesado por IA. Ve a la <strong>Biblioteca Documental</strong> y haz clic en <strong>Procesar con IA</strong> para extraer los datos y generar las propuestas reales.
              </div>
            ) : (
              <div className="grid gap-2">
                {sugerencias
                  .filter((s) => s.catalogoId === pestana)
                  .map((s, idx) => {
                    const claveValor = String(s.payload[catalogoActivo.claveNatural] ?? '').toUpperCase();
                    const yaRegistrado = (datos[pestana] ?? []).some(
                      (item) => String(item[catalogoActivo.claveNatural] ?? '').toUpperCase() === claveValor
                    );
                    const extras = catalogoActivo.campos.filter(
                      (c) => c.key !== catalogoActivo.claveNatural && c.key !== 'descripcion' && s.payload[c.key] != null && s.payload[c.key] !== ''
                    );

                    return (
                      <div key={idx} className="bg-card border border-border/80 p-3 rounded flex items-center justify-between text-xs transition-colors hover:border-accent">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-accent bg-accent/10 px-1.5 py-0.5 rounded text-[10px]">
                              {claveValor}
                            </span>
                            {s.payload.descripcion && <span className="font-bold text-white">{s.payload.descripcion}</span>}
                          </div>
                          {extras.length > 0 && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {extras.map((c) => `${c.label}: ${s.payload[c.key]}`).join(' | ')}
                            </span>
                          )}
                          <span className="text-[9px] text-emerald-400 font-bold mt-0.5">
                            Confianza IA: {(s.confianza * 100).toFixed(0)}%
                          </span>
                        </div>
                        {yaRegistrado ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                            ✓ Agregado
                          </span>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleAplicarSugerencia(s)} className="py-1">
                            Usar
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Elementos Registrados en Catálogo */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              📋 Elementos en el Catálogo del Proyecto
            </h4>
            {loadingCatalogos ? (
              <div className="text-xs text-muted-foreground font-medium py-2">Cargando catálogo...</div>
            ) : (datos[pestana]?.length ?? 0) === 0 ? (
              <div className="text-xs text-muted-foreground font-medium py-2">No hay elementos registrados aún.</div>
            ) : (
              <div className="grid gap-1.5 max-h-56 overflow-y-auto">
                {(datos[pestana] ?? []).map((item) => {
                  const extras = catalogoActivo.campos.filter(
                    (c) => c.key !== catalogoActivo.claveNatural && c.key !== 'descripcion' && item[c.key] != null && item[c.key] !== ''
                  );
                  return (
                    <div key={item.id} className="bg-card/40 border border-border/60 px-3 py-2 rounded flex flex-col gap-0.5 text-xs font-medium text-foreground">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEliminarElemento(pestana, item.id)}
                            className="text-red-400/60 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10 focus:outline-none"
                            title="Eliminar de catálogo"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <span className="font-extrabold text-white">{String(item[catalogoActivo.claveNatural] ?? '').toUpperCase()}</span>
                        </div>
                        {item.descripcion && <span className="text-muted-foreground text-right">{item.descripcion}</span>}
                      </div>
                      {extras.length > 0 && (
                        <span className="text-[10px] text-muted-foreground mt-0.5 ml-6">
                          {extras.map((c) => `${c.label}: ${item[c.key]}`).join(' | ')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

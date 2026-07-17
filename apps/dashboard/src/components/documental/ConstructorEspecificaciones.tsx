import React, { useState, useEffect, useRef } from 'react';
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

type OrigenFila = 'registrado' | 'sugerencia' | 'nueva';

interface FilaTabla {
  key: string;
  id: string | null;
  valores: Record<string, string>;
  origen: OrigenFila;
  confianza?: number;
  dirty: boolean;
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
  {
    id: 'revestimiento', tabla: 'cat_revestimiento_int', claveNatural: 'codigo',
    label: 'Revestimiento Interno', labelSingular: 'Revestimiento',
    campos: [
      { key: 'codigo', label: 'Código', tipo: 'text', esClave: true, requerido: true, placeholder: 'ej: RG' },
      { key: 'descripcion', label: 'Descripción', tipo: 'text', requerido: true, placeholder: 'ej: Engomado interior' },
    ],
  },
];

const catalogoPorId = (id: string): CatalogoConfig => CATALOGOS.find((c) => c.id === id) ?? CATALOGOS[0];

const filaVaciaDesde = (campos: CampoCatalogo[]): Record<string, string> =>
  Object.fromEntries(campos.map((c) => [c.key, '']));

const valoresDesdeObjeto = (campos: CampoCatalogo[], obj: Record<string, any>): Record<string, string> =>
  Object.fromEntries(campos.map((c) => [c.key, obj[c.key] != null ? String(obj[c.key]) : '']));

export const ConstructorEspecificaciones: React.FC<ConstructorEspecificacionesProps> = ({ proyectoId, documentoId, onBack }) => {
  const [documentoUrl, setDocumentoUrl] = useState<string | null>(null);
  const [tituloDoc, setTituloDoc] = useState('');
  const [pestana, setPestana] = useState<string>('fluidos');
  const [pdfColapsado, setPdfColapsado] = useState(false);

  // Catálogos locales, uno por cada CatalogoConfig.id
  const [datos, setDatos] = useState<Record<string, any[]>>({});
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  // Sugerencias IA
  const [sugerencias, setSugerencias] = useState<SugerenciaIA[]>([]);
  const [loadingIA, setLoadingIA] = useState(true);

  // Tabla fusionada (registrados + sugerencias sin confirmar + filas nuevas) de la pestaña activa
  const [filas, setFilas] = useState<FilaTabla[]>([]);
  const [guardandoKey, setGuardandoKey] = useState<string | null>(null);
  const pestanaAnteriorRef = useRef(pestana);

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
        const { data: filasLote, error: errFilas } = await supabase
          .from('import_filas')
          .select('*, import_lotes(perfil_id, import_perfiles(tabla_destino))')
          .in('lote_id', loteIds)
          .order('nro_fila');

        if (errFilas) throw errFilas;

        // 3. Mapear las filas a sugerencias, resolviendo tabla_destino -> catálogo
        const mapeadas: SugerenciaIA[] = (filasLote || [])
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

  // Reconstruye la tabla fusionada de la pestaña activa: filas ya registradas +
  // sugerencias IA que aún no calzan con ningún registro + filas nuevas agregadas
  // a mano. Preserva ediciones locales no guardadas (dirty) al refrescar datos/sugerencias,
  // y descarta filas nuevas/dirty al cambiar de pestaña.
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
          origen: 'registrado',
          dirty: false,
        };
      });

      const clavesRegistradas = new Set(
        registrados.map((f) => (f.valores[catalogoActivo.claveNatural] || '').toUpperCase())
      );

      const sugeridos: FilaTabla[] = sugerencias
        .filter((s) => s.catalogoId === pestana)
        .filter((s) => !clavesRegistradas.has(String(s.payload[catalogoActivo.claveNatural] ?? '').toUpperCase()))
        .map((s, idx) => {
          const key = `sugerencia-${pestana}-${idx}`;
          const prevFila = prevByKey.get(key);
          if (prevFila?.dirty) return prevFila;
          return {
            key,
            id: null,
            valores: valoresDesdeObjeto(catalogoActivo.campos, s.payload),
            origen: 'sugerencia',
            confianza: s.confianza,
            dirty: false,
          };
        });

      const nuevasManuales = cambioDePestana ? [] : prev.filter((f) => f.origen === 'nueva');

      return [...registrados, ...sugeridos, ...nuevasManuales];
    });
  }, [pestana, datos, sugerencias, catalogoActivo]);

  const handleCambiarValor = (key: string, campoKey: string, valor: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.key === key ? { ...f, valores: { ...f.valores, [campoKey]: valor }, dirty: true } : f))
    );
  };

  const handleAgregarFilaManual = () => {
    const key = `nueva-${Date.now()}`;
    setFilas((prev) => [...prev, { key, id: null, valores: filaVaciaDesde(catalogoActivo.campos), origen: 'nueva', dirty: true }]);
  };

  const handleGuardarFila = async (fila: FilaTabla) => {
    const camposRequeridos = catalogoActivo.campos.filter((c) => c.requerido);
    if (camposRequeridos.some((c) => !fila.valores[c.key]?.trim())) {
      alert('Completa los campos obligatorios antes de guardar.');
      return;
    }
    setGuardandoKey(fila.key);
    try {
      const payload: Record<string, any> = { proyecto_id: proyectoId };
      catalogoActivo.campos.forEach((campo) => {
        const valorCrudo = fila.valores[campo.key]?.trim() ?? '';
        if (campo.tipo === 'number') {
          payload[campo.key] = valorCrudo ? parseFloat(valorCrudo) : null;
        } else {
          payload[campo.key] = campo.esClave ? valorCrudo.toUpperCase() : (valorCrudo || null);
        }
      });

      if (fila.id) {
        const { error } = await supabase.from(catalogoActivo.tabla).update(payload).eq('id', fila.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(catalogoActivo.tabla).insert(payload);
        if (error) throw error;
      }

      // Se quita la fila local (editada o temporal); el refetch la repone ya persistida.
      setFilas((prev) => prev.filter((f) => f.key !== fila.key));
      await fetchCatalogos();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la fila.');
    } finally {
      setGuardandoKey(null);
    }
  };

  const handleEliminarFila = async (fila: FilaTabla) => {
    if (!fila.id) {
      // Sugerencia o fila nueva sin guardar: solo se descarta localmente.
      setFilas((prev) => prev.filter((f) => f.key !== fila.key));
      return;
    }
    if (!confirm(`¿Estás seguro de que deseas eliminar este elemento de "${catalogoActivo.label}" del catálogo del proyecto?`)) return;

    try {
      const { error } = await supabase.from(catalogoActivo.tabla).delete().eq('id', fila.id);
      if (error) throw error;
      await fetchCatalogos();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el elemento del catálogo.');
    }
  };

  const pendientesPorCatalogo = (catId: string): number => {
    const cat = catalogoPorId(catId);
    const registrados = new Set((datos[catId] ?? []).map((item) => String(item[cat.claveNatural] ?? '').toUpperCase()));
    return sugerencias.filter(
      (s) => s.catalogoId === catId && !registrados.has(String(s.payload[cat.claveNatural] ?? '').toUpperCase())
    ).length;
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
        <div
          className={`h-full relative overflow-hidden bg-zinc-800 border-r border-border transition-all duration-200 ${
            pdfColapsado ? 'w-0' : 'w-[55%]'
          }`}
        >
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

        {/* Separador con botón para colapsar/expandir el PDF y dar más espacio a la tabla */}
        <button
          onClick={() => setPdfColapsado((v) => !v)}
          title={pdfColapsado ? 'Mostrar visor de PDF' : 'Ocultar visor de PDF para dar más espacio a la tabla'}
          className="w-5 shrink-0 h-full flex items-center justify-center bg-panel border-r border-border hover:bg-card text-muted-foreground hover:text-white transition-colors"
        >
          {pdfColapsado ? '▶' : '◀'}
        </button>

        {/* Panel Constructor de Catálogo (Derecha) */}
        <div className={`h-full flex flex-col bg-panel p-6 gap-4 min-h-0 ${pdfColapsado ? 'flex-grow' : 'w-[45%]'}`}>
          {/* Tabs */}
          <div className="flex border-b border-border overflow-x-auto shrink-0">
            {CATALOGOS.map((cat) => {
              const pendientes = pendientesPorCatalogo(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setPestana(cat.id)}
                  className={`shrink-0 px-4 text-center py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                    pestana === cat.id ? 'text-accent border-accent' : 'text-muted-foreground border-transparent hover:text-white'
                  }`}
                >
                  {cat.label} ({datos[cat.id]?.length ?? 0}{pendientes > 0 ? ` +${pendientes} IA` : ''})
                </button>
              );
            })}
          </div>

          {/* Header de la tabla activa */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">{catalogoActivo.label}</h4>
              {loadingIA && <p className="text-[10px] text-muted-foreground mt-0.5">Leyendo sugerencias de la IA...</p>}
            </div>
            <Button variant="outline" size="sm" onClick={handleAgregarFilaManual}>
              + Agregar Fila
            </Button>
          </div>

          {!loadingIA && sugerencias.length === 0 && (
            <div className="text-xs text-amber-400/90 bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg leading-relaxed font-medium shrink-0">
              ⚠️ Este documento aún no ha sido procesado por IA. Ve a la <strong>Biblioteca Documental</strong> y haz clic en <strong>Procesar con IA</strong> para extraer los datos y generar las propuestas reales.
            </div>
          )}

          {/* Tabla fusionada: registrados + sugerencias IA + filas nuevas */}
          <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-card z-10">
                <tr>
                  <th className="p-2 w-8 border-b border-border" />
                  {catalogoActivo.campos.map((campo) => (
                    <th key={campo.key} className="p-2 text-left font-bold text-white uppercase text-[10px] border-b border-border">
                      {campo.label}
                    </th>
                  ))}
                  <th className="p-2 w-28 border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {loadingCatalogos ? (
                  <tr>
                    <td colSpan={catalogoActivo.campos.length + 2} className="p-4 text-center text-muted-foreground">
                      Cargando catálogo...
                    </td>
                  </tr>
                ) : filas.length === 0 ? (
                  <tr>
                    <td colSpan={catalogoActivo.campos.length + 2} className="p-4 text-center text-muted-foreground">
                      Sin elementos. Procesa el documento con IA o agrega una fila manualmente.
                    </td>
                  </tr>
                ) : (
                  filas.map((fila) => (
                    <tr
                      key={fila.key}
                      className={`border-b border-border/40 ${
                        fila.origen === 'sugerencia' ? 'bg-accent/5' : fila.origen === 'nueva' ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="p-1 text-center align-middle">
                        {fila.origen === 'sugerencia' && (
                          <span
                            title={`Sugerido por IA — ${Math.round((fila.confianza ?? 0) * 100)}% confianza`}
                            className="text-[9px] font-extrabold text-accent"
                          >
                            IA
                          </span>
                        )}
                        {fila.origen === 'nueva' && (
                          <span title="Fila nueva sin guardar" className="text-[9px] font-extrabold text-emerald-400">
                            +
                          </span>
                        )}
                        {fila.origen === 'registrado' && fila.dirty && (
                          <span title="Cambios sin guardar" className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        )}
                      </td>
                      {catalogoActivo.campos.map((campo) => (
                        <td key={campo.key} className="p-1 align-middle">
                          <input
                            type={campo.tipo}
                            step={campo.tipo === 'number' ? 'any' : undefined}
                            placeholder={campo.placeholder}
                            value={fila.valores[campo.key] ?? ''}
                            onChange={(e) => handleCambiarValor(fila.key, campo.key, e.target.value)}
                            className={`w-full bg-transparent border border-transparent px-1.5 py-1 rounded text-xs focus:outline-none focus:bg-panel focus:border-accent ${
                              campo.esClave ? 'uppercase font-extrabold text-white' : 'font-medium text-foreground'
                            }`}
                          />
                        </td>
                      ))}
                      <td className="p-1 text-right whitespace-nowrap align-middle">
                        {(fila.dirty || fila.origen !== 'registrado') && (
                          <button
                            onClick={() => handleGuardarFila(fila)}
                            disabled={guardandoKey === fila.key}
                            className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-500/10 mr-1 disabled:opacity-40"
                          >
                            {guardandoKey === fila.key ? '...' : 'Guardar'}
                          </button>
                        )}
                        <button
                          onClick={() => handleEliminarFila(fila)}
                          title={fila.id ? 'Eliminar de catálogo' : 'Descartar'}
                          className="text-red-400/60 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10 focus:outline-none"
                        >
                          <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

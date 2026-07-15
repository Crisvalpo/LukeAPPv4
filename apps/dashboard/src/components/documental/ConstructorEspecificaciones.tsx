import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';

interface ConstructorEspecificacionesProps {
  proyectoId: string;
  documentoId: string;
  onBack: () => void;
}

interface Fluido {
  id: string;
  codigo: string;
  descripcion: string;
}

interface ClasePiping {
  id: string;
  codigo: string;
  descripcion: string;
  presion_max?: number;
  temp_max?: number;
}

interface SugerenciaIA {
  tipo: 'fluido' | 'clase';
  codigo: string;
  descripcion: string;
  presion_max?: number;
  temp_max?: number;
  confianza: number;
}

interface Trazo {
  color: 'green' | 'orange' | 'pink';
  puntos: { x: number; y: number }[];
}

export const ConstructorEspecificaciones: React.FC<ConstructorEspecificacionesProps> = ({ proyectoId, documentoId, onBack }) => {
  const [documentoUrl, setDocumentoUrl] = useState<string | null>(null);
  const [tituloDoc, setTituloDoc] = useState('');
  const [pestana, setPestana] = useState<'fluidos' | 'clases'>('fluidos');

  // Catálogos locales
  const [fluidos, setFluidos] = useState<Fluido[]>([]);
  const [clases, setClases] = useState<ClasePiping[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  // Formulario de ingreso
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [presionMax, setPresionMax] = useState('');
  const [tempMax, setTempMax] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Sugerencias IA
  const [sugerencias, setSugerencias] = useState<SugerenciaIA[]>([]);
  const [loadingIA, setLoadingIA] = useState(true);

  // Marcador Fluorescente Canvas
  const [colorMarcador, setColorMarcador] = useState<'green' | 'orange' | 'pink'>('green');
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [dibujando, setDibujando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [modoDibujo, setModoDibujo] = useState(false);

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

        // Cargar anotaciones previas
        if (data.anotaciones && Array.isArray(data.anotaciones)) {
          setTrazos(data.anotaciones as Trazo[]);
        }
      }
    };

    fetchDoc();
  }, [documentoId]);

  const fetchCatalogos = async () => {
    setLoadingCatalogos(true);
    try {
      const { data: fls } = await supabase
        .from('cat_fluido_servicio')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('codigo');
      setFluidos((fls as Fluido[]) || []);

      const { data: cls } = await supabase
        .from('cat_clase_piping')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('codigo');
      setClases((cls as ClasePiping[]) || []);
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
        const { data: filas, error: errFilas } = await supabase
          .from('import_filas')
          .select('*, import_lotes(perfil_id, import_perfiles(tabla_destino))')
          .in('lote_id', loteIds)
          .order('nro_fila');

        if (errFilas) throw errFilas;

        // 3. Mapear las filas a sugerencias
        const mapeadas: SugerenciaIA[] = (filas || []).map((f: any) => {
          const lote = Array.isArray(f.import_lotes) ? f.import_lotes[0] : f.import_lotes;
          const perfil = lote?.import_perfiles;
          const tabla = Array.isArray(perfil) ? perfil[0]?.tabla_destino : perfil?.tabla_destino;
          const esFluido = tabla === 'cat_fluido_servicio';

          return {
            tipo: esFluido ? 'fluido' : 'clase',
            codigo: (f.payload?.codigo || '').toUpperCase(),
            descripcion: f.payload?.descripcion || '',
            presion_max: f.payload?.presion_max != null ? parseFloat(f.payload.presion_max) : undefined,
            temp_max: f.payload?.temp_max != null ? parseFloat(f.payload.temp_max) : undefined,
            confianza: f.confianza ?? 0.9,
          };
        });

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

  // Redibujar trazos en el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    trazos.forEach((t) => {
      ctx.beginPath();
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Colores de destacado fluorescente
      if (t.color === 'green') ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
      else if (t.color === 'orange') ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      else ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';

      t.puntos.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  }, [trazos]);

  // Ajustar dimensiones del canvas al contenedor
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight || 750;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [documentoUrl]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDibujando(true);
    setTrazos((prev) => [...prev, { color: colorMarcador, puntos: [{ x, y }] }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dibujando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTrazos((prev) => {
      const list = [...prev];
      if (list.length === 0) return prev;
      const active = list[list.length - 1];
      active.puntos.push({ x, y });
      return list;
    });
  };

  const handleMouseUp = async () => {
    setDibujando(false);
    // Guardar anotaciones en Supabase
    await supabase
      .from('doc_biblioteca')
      .update({ anotaciones: trazos })
      .eq('id', documentoId);
  };

  const handleBorrarTrazos = async () => {
    setTrazos([]);
    await supabase
      .from('doc_biblioteca')
      .update({ anotaciones: null })
      .eq('id', documentoId);
  };

  const handleAplicarSugerencia = (s: SugerenciaIA) => {
    setPestana(s.tipo === 'fluido' ? 'fluidos' : 'clases');
    setNuevoCodigo(s.codigo);
    setNuevaDesc(s.descripcion);
    if (s.tipo === 'clase') {
      setPresionMax(s.presion_max?.toString() || '');
      setTempMax(s.temp_max?.toString() || '');
    }
  };

  const handleGuardarCatalogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCodigo.trim() || !nuevaDesc.trim()) return;
    setGuardando(true);

    try {
      if (pestana === 'fluidos') {
        const { error } = await supabase
          .from('cat_fluido_servicio')
          .insert({
            proyecto_id: proyectoId,
            codigo: nuevoCodigo.toUpperCase().trim(),
            descripcion: nuevaDesc.trim()
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cat_clase_piping')
          .insert({
            proyecto_id: proyectoId,
            codigo: nuevoCodigo.toUpperCase().trim(),
            descripcion: nuevaDesc.trim(),
            presion_max: presionMax ? parseFloat(presionMax) : null,
            temp_max: tempMax ? parseFloat(tempMax) : null
          });
        if (error) throw error;
      }

      setNuevoCodigo('');
      setNuevaDesc('');
      setPresionMax('');
      setTempMax('');
      await fetchCatalogos();
    } catch (err: any) {
      alert(err.message || 'Error al guardar elemento del catálogo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarElemento = async (id: string, tipo: 'fluido' | 'clase') => {
    if (!confirm(`¿Estás seguro de que deseas eliminar este ${tipo === 'fluido' ? 'fluido' : 'clase de piping'} del catálogo del proyecto?`)) return;

    try {
      const tabla = tipo === 'fluido' ? 'cat_fluido_servicio' : 'cat_clase_piping';
      const { error } = await supabase
        .from(tabla)
        .delete()
        .eq('id', id);

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

        {/* Herramientas Marcador Fluorescente */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setModoDibujo(!modoDibujo)}
            className={`px-3 py-1.5 text-xs font-extrabold rounded border transition-all flex items-center gap-1.5 ${
              modoDibujo
                ? 'bg-accent text-white border-accent shadow-md shadow-accent/20'
                : 'bg-card text-muted-foreground border-border hover:text-white'
            }`}
          >
            {modoDibujo ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                🎨 Modo Destacar: Activo
              </>
            ) : (
              '🔍 Modo Navegar (Scroll/Zoom)'
            )}
          </button>

          {modoDibujo && (
            <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-md animate-fade-in">
              {(['green', 'orange', 'pink'] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => setColorMarcador(color)}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    color === 'green' ? 'bg-emerald-500' : color === 'orange' ? 'bg-orange-500' : 'bg-pink-500'
                  } ${
                    colorMarcador === color 
                      ? 'ring-2 ring-accent scale-110 border-white' 
                      : 'border-transparent hover:scale-105'
                  }`}
                />
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleBorrarTrazos} className="py-1">
            Limpiar Destacados
          </Button>
        </div>
      </div>

      {/* Pantalla Dividida */}
      <div className="flex flex-grow overflow-hidden">
        {/* Visor PDF (Izquierda) */}
        <div ref={containerRef} className="w-[55%] h-full relative overflow-hidden bg-zinc-800 border-r border-border">
          {documentoUrl ? (
            <>
              {/* Contenedor PDF Iframe */}
              <iframe
                src={documentoUrl}
                className="w-full h-full border-none pointer-events-auto"
                title="Visor Especificación"
              />
              {/* Capa Canvas para dibujar destacador fluorescente */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`absolute inset-0 cursor-crosshair z-25 ${
                  modoDibujo ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
              Cargando visor de documento...
            </div>
          )}
        </div>

        {/* Panel Constructor de Catálogo (Derecha) */}
        <div className="w-[45%] h-full flex flex-col bg-panel overflow-y-auto p-6 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setPestana('fluidos')}
              className={`flex-1 text-center py-2.5 text-xs font-bold transition-all border-b-2 ${
                pestana === 'fluidos' ? 'text-accent border-accent' : 'text-muted-foreground border-transparent hover:text-white'
              }`}
            >
              Fluidos de Servicio ({fluidos.length})
            </button>
            <button
              onClick={() => setPestana('clases')}
              className={`flex-1 text-center py-2.5 text-xs font-bold transition-all border-b-2 ${
                pestana === 'clases' ? 'text-accent border-accent' : 'text-muted-foreground border-transparent hover:text-white'
              }`}
            >
              Clases de Piping ({clases.length})
            </button>
          </div>

          {/* Constructor Formulario */}
          <div className="bg-card border border-border p-4 rounded-lg">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Agregar a {pestana === 'fluidos' ? 'Fluidos' : 'Clases de Piping'}
            </h4>
            <form onSubmit={handleGuardarCatalogo} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Código</label>
                  <input
                    type="text"
                    placeholder={pestana === 'fluidos' ? 'ej: HC' : 'ej: A1A'}
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    className="bg-panel border border-border text-foreground px-3 py-1.5 rounded text-xs font-semibold focus:outline-none focus:border-accent uppercase"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Descripción</label>
                  <input
                    type="text"
                    placeholder="ej: Hidrocarburos Líquidos"
                    value={nuevaDesc}
                    onChange={(e) => setNuevaDesc(e.target.value)}
                    className="bg-panel border border-border text-foreground px-3 py-1.5 rounded text-xs font-semibold focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                {pestana === 'clases' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Presión Máx (MPa)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ej: 19.6"
                        value={presionMax}
                        onChange={(e) => setPresionMax(e.target.value)}
                        className="bg-panel border border-border text-foreground px-3 py-1.5 rounded text-xs font-semibold focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Temp Máx (°C)</label>
                      <input
                        type="number"
                        placeholder="ej: 200"
                        value={tempMax}
                        onChange={(e) => setTempMax(e.target.value)}
                        className="bg-panel border border-border text-foreground px-3 py-1.5 rounded text-xs font-semibold focus:outline-none focus:border-accent"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : `Registrar ${pestana === 'fluidos' ? 'Fluido' : 'Clase'}`}
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
                  .filter((s) => (pestana === 'fluidos' ? s.tipo === 'fluido' : s.tipo === 'clase'))
                  .map((s, idx) => {
                    const yaRegistrado = s.tipo === 'fluido'
                      ? fluidos.some((f) => f.codigo.toUpperCase() === s.codigo.toUpperCase())
                      : clases.some((c) => c.codigo.toUpperCase() === s.codigo.toUpperCase());

                    return (
                      <div key={idx} className="bg-card border border-border/80 p-3 rounded flex items-center justify-between text-xs transition-colors hover:border-accent">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-accent bg-accent/10 px-1.5 py-0.5 rounded text-[10px]">
                              {s.codigo}
                            </span>
                            <span className="font-bold text-white">{s.descripcion}</span>
                          </div>
                          {s.tipo === 'clase' && (s.presion_max || s.temp_max) && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              P. Max: {s.presion_max} MPa | T. Max: {s.temp_max}°C
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
            ) : pestana === 'fluidos' ? (
              fluidos.length === 0 ? (
                <div className="text-xs text-muted-foreground font-medium py-2">No hay fluidos registrados aún.</div>
              ) : (
                <div className="grid gap-1.5 max-h-56 overflow-y-auto">
                  {fluidos.map((f) => (
                    <div key={f.id} className="bg-card/40 border border-border/60 px-3 py-2 rounded flex justify-between items-center text-xs font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEliminarElemento(f.id, 'fluido')}
                          className="text-red-400/60 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10 focus:outline-none"
                          title="Eliminar de catálogo"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <span className="font-extrabold text-white">{f.codigo}</span>
                      </div>
                      <span className="text-muted-foreground text-right">{f.descripcion}</span>
                    </div>
                  ))}
                </div>
              )
            ) : clases.length === 0 ? (
              <div className="text-xs text-muted-foreground font-medium py-2">No hay clases de piping registradas aún.</div>
            ) : (
              <div className="grid gap-1.5 max-h-56 overflow-y-auto">
                {clases.map((c) => (
                  <div key={c.id} className="bg-card/40 border border-border/60 px-3 py-2 rounded flex flex-col gap-0.5 text-xs font-medium text-foreground">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEliminarElemento(c.id, 'clase')}
                          className="text-red-400/60 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10 focus:outline-none"
                          title="Eliminar de catálogo"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <span className="font-extrabold text-white">{c.codigo}</span>
                      </div>
                      <span className="text-muted-foreground text-right">{c.descripcion}</span>
                    </div>
                    {(c.presion_max || c.temp_max) && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 ml-6">
                        Límites: {c.presion_max || '—'} MPa | {c.temp_max || '—'} °C
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

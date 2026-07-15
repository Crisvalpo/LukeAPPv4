import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';

interface BibliotecaPIDsProps {
  proyectoId: string;
}

interface PID {
  id: string;
  id_pid: string;
  descripcion?: string | null;
  revision?: string | null;
  pdf_path?: string | null;
  activo: boolean;
  creado_en: string;
}

interface Linea {
  id: string;
  id_linea: string;
  descripcion?: string | null;
}

interface RelacionLinea {
  id: string;
  linea: {
    id: string;
    id_linea: string;
    descripcion: string;
  };
}

interface RevisionLog {
  id: string;
  revision: string;
  evento: string;
  comentario?: string | null;
  pdf_path?: string | null;
  fecha_evento: string;
  creado_por_email?: string;
}

interface CatItem {
  id: string;
  codigo: string;
  descripcion?: string;
}

export const BibliotecaPIDs: React.FC<BibliotecaPIDsProps> = ({ proyectoId }) => {
  const [pids, setPids] = useState<PID[]>([]);
  const [loading, setLoading] = useState(true);
  const [pidActivo, setPidActivo] = useState<PID | null>(null);

  // Formulario nuevo PID
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [nuevoIdPid, setNuevoIdPid] = useState('');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaRev, setNuevaRev] = useState('0');
  const [archivoPDF, setArchivoPDF] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Split screen data
  const [lineasAsociadas, setLineasAsociadas] = useState<RelacionLinea[]>([]);
  const [historialRevisiones, setHistorialRevisiones] = useState<RevisionLog[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  // Creación en caliente de Líneas
  const [mostrarModalLinea, setMostrarModalLinea] = useState(false);
  const [tagLinea, setTagLinea] = useState('');
  const [descLinea, setDescLinea] = useState('');
  const [fluidoId, setFluidoId] = useState('');
  const [claseId, setClaseId] = useState('');
  const [npsId, setNpsId] = useState('');
  
  // Catálogos para el formulario de línea
  const [catFluidos, setCatFluidos] = useState<CatItem[]>([]);
  const [catClases, setCatClases] = useState<CatItem[]>([]);
  const [catNps, setCatNps] = useState<CatItem[]>([]);
  
  // Buscador de líneas existentes
  const [filtroLinea, setFiltroLinea] = useState('');
  const [lineasExistentes, setLineasExistentes] = useState<Linea[]>([]);
  
  // Marcado virtual en Canvas
  const [colorMarcador, setColorMarcador] = useState<'green' | 'orange' | 'pink'>('green');
  const [trazos, setTrazos] = useState<any[]>([]);
  const [dibujando, setDibujando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchPids = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('list_pid')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('creado_en', { ascending: false });
    
    if (!error && data) setPids(data as PID[]);
    setLoading(false);
  }, [proyectoId]);

  useEffect(() => {
    fetchPids();
  }, [fetchPids]);

  // Cargar datos del PID seleccionado
  useEffect(() => {
    if (!pidActivo) {
      setPdfUrl(null);
      setTrazos([]);
      return;
    }

    const loadPidData = async () => {
      // 1. Obtener URL del PDF
      if (pidActivo.pdf_path) {
        const { data: dataUrl } = supabase.storage
          .from('documentos')
          .getPublicUrl(pidActivo.pdf_path);
        if (dataUrl) setPdfUrl(dataUrl.publicUrl);
      } else {
        setPdfUrl(null);
      }

      // 2. Cargar anotaciones canvas
      const { data: detail } = await supabase
        .from('list_pid')
        .select('anotaciones')
        .eq('id', pidActivo.id)
        .single();
      if (detail && detail.anotaciones && Array.isArray(detail.anotaciones)) {
        setTrazos(detail.anotaciones);
      } else {
        setTrazos([]);
      }

      // 3. Cargar líneas asociadas
      const { data: rels } = await supabase
        .from('rel_pid_lineas')
        .select(`
          id,
          linea:list_lineas(id, id_linea, descripcion)
        `)
        .eq('pid_id', pidActivo.id);
      
      setLineasAsociadas((rels as any) || []);

      // 4. Cargar Historial de Revisiones (LOGs)
      const { data: logs } = await supabase
        .from('log_pid')
        .select('*')
        .eq('pid_id', pidActivo.id)
        .order('fecha_evento', { ascending: false });
      setHistorialRevisiones((logs as RevisionLog[]) || []);
    };

    loadPidData();
  }, [pidActivo]);

  // Cargar catálogos para formulario en caliente
  useEffect(() => {
    if (!mostrarModalLinea) return;
    const fetchCats = async () => {
      const { data: fls } = await supabase.from('cat_fluido_servicio').select('id, codigo, descripcion').eq('proyecto_id', proyectoId).order('codigo');
      setCatFluidos((fls as CatItem[]) || []);

      const { data: cls } = await supabase.from('cat_clase_piping').select('id, codigo, descripcion').eq('proyecto_id', proyectoId).order('codigo');
      setCatClases((cls as CatItem[]) || []);

      const { data: nps } = await supabase.from('cat_diametros_nps').select('id, nps').eq('proyecto_id', proyectoId).order('nps_mm');
      setCatNps((nps as any[]).map(n => ({ id: n.id, codigo: n.nps })) || []);
    };
    fetchCats();
  }, [mostrarModalLinea, proyectoId]);

  // Buscador de líneas existentes
  useEffect(() => {
    if (filtroLinea.trim().length < 1) {
      setLineasExistentes([]);
      return;
    }
    const searchLineas = async () => {
      const { data } = await supabase
        .from('list_lineas')
        .select('id, id_linea, descripcion')
        .eq('proyecto_id', proyectoId)
        .eq('activo', true)
        .ilike('id_linea', `%${filtroLinea}%`)
        .limit(5);
      setLineasExistentes((data as Linea[]) || []);
    };
    searchLineas();
  }, [filtroLinea, proyectoId]);

  // Marcado virtual Canvas
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
      
      if (t.color === 'green') ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
      else if (t.color === 'orange') ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      else ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';

      t.puntos.forEach((p: any, idx: number) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  }, [trazos, pidActivo]);

  // Ajustar dimensiones canvas
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
  }, [pdfUrl, pidActivo]);

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
    if (pidActivo) {
      await supabase
        .from('list_pid')
        .update({ anotaciones: trazos })
        .eq('id', pidActivo.id);
    }
  };

  const handleBorrarTrazos = async () => {
    setTrazos([]);
    if (pidActivo) {
      await supabase
        .from('list_pid')
        .update({ anotaciones: null })
        .eq('id', pidActivo.id);
    }
  };

  const handleSubirPid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoIdPid.trim() || !archivoPDF) return;
    setGuardando(true);

    try {
      const storagePath = `${proyectoId}/doc/pid/${Date.now()}_${archivoPDF.name}`;
      const { error: errUpload } = await supabase.storage
        .from('documentos')
        .upload(storagePath, archivoPDF, { contentType: 'application/pdf' });
      if (errUpload) throw errUpload;

      // Crear o actualizar en list_pid
      // Dado que UNIQUE (proyecto_id, id_pid) está activo, busquemos si existe para aplicar lógica versionamiento
      const { data: existDoc } = await supabase
        .from('list_pid')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .eq('id_pid', nuevoIdPid.trim().toUpperCase())
        .maybeSingle();

      let finalPidId: string;
      if (existDoc) {
        finalPidId = existDoc.id;
        // 1. Guardar la revisión vieja en log_pid
        await supabase.from('log_pid').insert({
          proyecto_id: proyectoId,
          pid_id: existDoc.id,
          evento: 'revision',
          revision: existDoc.revision || '0',
          comentario: `Superado por nueva revisión ${nuevaRev}`,
          pdf_path: existDoc.pdf_path
        });

        // 2. Actualizar el registro vigente
        await supabase
          .from('list_pid')
          .update({
            revision: nuevaRev,
            pdf_path: storagePath,
            descripcion: nuevaDesc || existDoc.descripcion,
            activo: true
          })
          .eq('id', existDoc.id);
      } else {
        // Registrar P&ID nuevo
        const { data: newDoc, error: errInsert } = await supabase
          .from('list_pid')
          .insert({
            proyecto_id: proyectoId,
            id_pid: nuevoIdPid.trim().toUpperCase(),
            descripcion: nuevaDesc || null,
            revision: nuevaRev,
            pdf_path: storagePath,
            activo: true
          })
          .select('id')
          .single();
        if (errInsert) throw errInsert;
        finalPidId = newDoc.id;

        // Registrar primer evento log
        await supabase.from('log_pid').insert({
          proyecto_id: proyectoId,
          pid_id: finalPidId,
          evento: 'emision',
          revision: nuevaRev,
          comentario: 'Emisión inicial del plano',
          pdf_path: storagePath
        });
      }

      setMostrarModalNuevo(false);
      setNuevoIdPid('');
      setNuevaDesc('');
      setNuevaRev('0');
      setArchivoPDF(null);
      await fetchPids();
    } catch (err: any) {
      alert(err.message || 'Error al subir plano P&ID.');
    } finally {
      setGuardando(false);
    }
  };

  const handleAsociarLineaExistente = async (lineaId: string) => {
    if (!pidActivo) return;
    try {
      const { error } = await supabase
        .from('rel_pid_lineas')
        .insert({
          proyecto_id: proyectoId,
          pid_id: pidActivo.id,
          linea_id: lineaId
        });
      if (error) throw error;
      setFiltroLinea('');
      setLineasExistentes([]);

      // Recargar relaciones
      const { data: rels } = await supabase
        .from('rel_pid_lineas')
        .select(`id, linea:list_lineas(id, id_linea, descripcion)`)
        .eq('pid_id', pidActivo.id);
      setLineasAsociadas((rels as any) || []);
    } catch (e: any) {
      alert(e.message || 'Error al asociar línea.');
    }
  };

  const handleCrearLineaEnCaliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pidActivo || !tagLinea.trim() || !descLinea.trim()) return;
    setGuardando(true);

    try {
      // 1. Insertar línea en list_lineas
      const { data: newLinea, error: errLine } = await supabase
        .from('list_lineas')
        .insert({
          proyecto_id: proyectoId,
          id_linea: tagLinea.toUpperCase().trim(),
          descripcion: descLinea.trim(),
          fluido_id: fluidoId || null,
          clase_id: claseId || null,
          nps_id: npsId || null,
          activo: true
        })
        .select('id')
        .single();
      
      if (errLine) throw errLine;

      // 2. Asociar a rel_pid_lineas
      await supabase
        .from('rel_pid_lineas')
        .insert({
          proyecto_id: proyectoId,
          pid_id: pidActivo.id,
          linea_id: newLinea.id
        });

      setMostrarModalLinea(false);
      setTagLinea('');
      setDescLinea('');
      setFluidoId('');
      setClaseId('');
      setNpsId('');

      // Recargar relaciones
      const { data: rels } = await supabase
        .from('rel_pid_lineas')
        .select(`id, linea:list_lineas(id, id_linea, descripcion)`)
        .eq('pid_id', pidActivo.id);
      setLineasAsociadas((rels as any) || []);
    } catch (e: any) {
      alert(e.message || 'Error al crear y asociar línea.');
    } finally {
      setGuardando(false);
    }
  };

  const handleDesasociarLinea = async (relId: string) => {
    if (!pidActivo) return;
    try {
      await supabase.from('rel_pid_lineas').delete().eq('id', relId);
      setLineasAsociadas((prev) => prev.filter((r) => r.id !== relId));
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background text-foreground font-sans">
      {!pidActivo ? (
        // LISTADO DE P&IDs VIGENTES
        <div className="flex-grow p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Biblioteca de P&IDs y Planos</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Sube y versiona tus diagramas de piping e instrumentación (P&IDs) para asociar líneas en caliente.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setMostrarModalNuevo(true)}>
              + Registrar Plano PDF
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Cargando planos P&ID...</div>
          ) : pids.length === 0 ? (
            <div className="bg-card border border-border p-10 text-center rounded-lg">
              <span className="text-4xl">📋</span>
              <h3 className="text-sm font-bold text-white mt-4">Sin planos registrados</h3>
              <p className="text-xs text-muted-foreground mt-1">Sube tus primeros archivos PDF para iniciar el proyecto.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pids.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setPidActivo(p)}
                  className="bg-panel border border-border p-4 rounded-lg cursor-pointer hover:border-accent transition-all flex flex-col justify-between h-36"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-extrabold text-white tracking-tight">{p.id_pid}</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                        REV: {p.revision}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.descripcion || 'Sin descripción.'}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground border-t border-border/60 pt-2 flex justify-between items-center">
                    <span>Creado: {new Date(p.creado_en).toLocaleDateString()}</span>
                    <span className="text-accent font-bold hover:underline">Abrir visor →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // PANTALLA DIVIDIDA (SPLIT SCREEN) VISOR P&ID
        <div className="flex flex-col h-full">
          {/* Subheader Acciones */}
          <div className="h-12 border-b border-border bg-panel px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setPidActivo(null)}>
                ← Salir del Visor
              </Button>
              <span className="text-sm font-bold text-white tracking-tight">{pidActivo.id_pid} (REV: {pidActivo.revision})</span>
            </div>

            {/* Herramientas Marcador */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground">Marcador virtual:</span>
              <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-md">
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
              <Button variant="outline" size="sm" onClick={handleBorrarTrazos} className="py-1">
                Limpiar Marcas
              </Button>
            </div>
          </div>

          {/* Split */}
          <div className="flex flex-grow overflow-hidden">
            {/* Visor PDF (Izquierda) */}
            <div ref={containerRef} className="w-[60%] h-full relative overflow-hidden bg-zinc-800 border-r border-border">
              {pdfUrl ? (
                <>
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0`}
                    className="w-full h-full border-none pointer-events-auto"
                    title="Visor P&ID"
                  />
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="absolute inset-0 cursor-crosshair z-25 pointer-events-auto"
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
                  Este P&ID no posee archivo PDF cargado.
                </div>
              )}
            </div>

            {/* Panel de Relaciones y Líneas (Derecha) */}
            <div className="w-[40%] h-full flex flex-col bg-panel overflow-y-auto p-6 space-y-6">
              {/* Buscador y Asociación de Líneas */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">🔗 Líneas Asociadas a este Plano</h4>
                  <Button variant="outline" size="sm" onClick={() => setMostrarModalLinea(true)} className="py-0.5 text-[10px]">
                    + Crear en Caliente
                  </Button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar línea existente para asociar..."
                    value={filtroLinea}
                    onChange={(e) => setFiltroLinea(e.target.value)}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none focus:border-accent w-full"
                  />
                  {lineasExistentes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-card border border-border rounded shadow-2xl z-30 mt-1 max-h-40 overflow-y-auto">
                      {lineasExistentes.map((l) => (
                        <div
                          key={l.id}
                          onClick={() => handleAsociarLineaExistente(l.id)}
                          className="px-3 py-2 text-xs font-medium text-white hover:bg-accent hover:text-white cursor-pointer flex justify-between border-b border-border/40"
                        >
                          <span className="font-extrabold">{l.id_linea}</span>
                          <span className="text-muted-foreground truncate max-w-xs">{l.descripcion}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Listado de Líneas Asociadas */}
                {lineasAsociadas.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 font-medium">No hay líneas vinculadas a este P&ID actualmente.</div>
                ) : (
                  <div className="grid gap-2 max-h-56 overflow-y-auto">
                    {lineasAsociadas.map((r) => (
                      <div key={r.id} className="bg-card border border-border/80 p-3 rounded flex items-center justify-between text-xs transition-colors hover:border-accent">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-extrabold text-white">{r.linea.id_linea}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-xs">{r.linea.descripcion || 'Sin descripción.'}</span>
                        </div>
                        <button
                          onClick={() => handleDesasociarLinea(r.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial de Revisiones (LOGs) */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">🕒 Historial de Revisiones (REV)</h4>
                {historialRevisiones.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 font-medium">No se registran eventos de revisión anteriores.</div>
                ) : (
                  <div className="space-y-3">
                    {historialRevisiones.map((h) => (
                      <div key={h.id} className="bg-card/40 border border-border/60 p-3 rounded flex flex-col gap-1.5 text-xs text-foreground font-medium">
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                            h.revision === pidActivo.revision 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {h.revision === pidActivo.revision ? 'REV VIGENTE: ' : 'REV OBSOLETO: '} {h.revision}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{new Date(h.fecha_evento).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-sans">{h.comentario || 'Sin comentario.'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PLANO */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-border p-6 rounded-lg w-full max-w-md shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Registrar Plano PDF</h3>
              <p className="text-xs text-muted-foreground mt-1">Ingrese los detalles de la ingeniería del P&ID.</p>
            </div>
            <form onSubmit={handleSubirPid} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-white">Código de P&ID (Clave)</label>
                <input
                  type="text"
                  placeholder="ej: 413-PID-101"
                  value={nuevoIdPid}
                  onChange={(e) => setNuevoIdPid(e.target.value)}
                  className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold uppercase"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-white">Descripción / Título</label>
                <input
                  type="text"
                  placeholder="ej: Diagrama de Tuberías Espesador de Concentrado"
                  value={nuevaDesc}
                  onChange={(e) => setNuevaDesc(e.target.value)}
                  className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-white">Revisión (REV)</label>
                <input
                  type="text"
                  placeholder="ej: A, B, 0, 1"
                  value={nuevaRev}
                  onChange={(e) => setNuevaRev(e.target.value)}
                  className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold uppercase"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-white">Archivo PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setArchivoPDF(e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground file:bg-card file:text-white file:border file:border-border file:px-3 file:py-1.5 file:rounded file:text-xs file:font-semibold hover:file:bg-card/85 cursor-pointer file:cursor-pointer"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setMostrarModalNuevo(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={guardando}>
                  {guardando ? 'Subiendo...' : 'Registrar Plano'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR LÍNEA EN CALIENTE */}
      {mostrarModalLinea && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-border p-6 rounded-lg w-full max-w-lg shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Crear Línea en Caliente</h3>
              <p className="text-xs text-muted-foreground mt-1">Ingrese los detalles mínimos requeridos para dar de alta la línea en list_lineas.</p>
            </div>
            <form onSubmit={handleCrearLineaEnCaliente} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <label className="text-xs font-semibold text-white">Tag de Línea (Clave)</label>
                  <input
                    type="text"
                    placeholder="ej: 10-HC-1001-A1A"
                    value={tagLinea}
                    onChange={(e) => setTagLinea(e.target.value)}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold uppercase"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <label className="text-xs font-semibold text-white">Descripción de Línea</label>
                  <input
                    type="text"
                    placeholder="ej: Alimentación a Espesador"
                    value={descLinea}
                    onChange={(e) => setDescLinea(e.target.value)}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-white">Fluido de Servicio</label>
                  <select
                    value={fluidoId}
                    onChange={(e) => setFluidoId(e.target.value)}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {catFluidos.map(f => <option key={f.id} value={f.id}>{f.codigo} - {f.descripcion}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-white">Clase de Piping</label>
                  <select
                    value={claseId}
                    onChange={(e) => setClaseId(e.target.value)}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {catClases.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-white">Diámetro NPS</label>
                  <select
                    value={npsId}
                    onChange={(e) => setNpsId(e.target.value)}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {catNps.map(n => <option key={n.id} value={n.id}>{n.codigo}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setMostrarModalLinea(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Crear y Asociar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { sanitizarNombreArchivo } from '../../lib/storagePath';
import { Button } from '../ui/Button';
import { useHeaderActions } from '../../hooks/useHeaderActions';

export interface Documento {
  id: string;
  proyecto_id: string;
  tipo_documento: 'adenda' | 'especificacion_tecnica' | 'estandar' | 'cwp' | 'line_list' | 'pid' | 'plano' | 'procedimiento' | 'otro';
  titulo: string;
  descripcion?: string | null;
  revision?: string | null;
  storage_path: string;
  estado_procesamiento: 'pendiente' | 'procesando' | 'procesado' | 'extrayendo' | 'lote_generado' | 'completado' | 'error';
  n_paginas?: number | null;
  n_chunks?: number | null;
  error_detalle?: string | null;
  creado_en: string;
}

interface BibliotecaDocumentalProps {
  proyectoId: string;
  onSelectLote: (docId: string) => void;
  onAbrirConstructor?: (docId: string) => void;
}

interface ResultadoBusqueda {
  chunk_id: string;
  documento_id: string;
  titulo_doc: string;
  nro_chunk: number;
  pagina_inicio: number | null;
  contenido: string;
  similitud: number;
}

const IA_WORKER_URL = import.meta.env.VITE_IA_WORKER_URL as string | undefined;

export const BibliotecaDocumental: React.FC<BibliotecaDocumentalProps> = ({ proyectoId, onSelectLote, onAbrirConstructor }) => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const handleEliminar = async (docId: string, storagePath: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este documento? Se borrarán permanentemente el archivo y todo el conocimiento extraído (incluyendo chunks de búsqueda para el bot).')) {
      return;
    }
    setEliminandoId(docId);
    setError(null);
    try {
      // 1. Eliminar archivo físico de Supabase Storage
      const { error: errStorage } = await supabase.storage
        .from('documentos')
        .remove([storagePath]);
      if (errStorage) {
        console.warn('Error al eliminar archivo del storage (puede que ya no exista):', errStorage.message);
      }

      // 2. Eliminar registro de base de datos (con ON DELETE CASCADE en chunks e import_lotes)
      const { error: errDb } = await supabase
        .from('doc_biblioteca')
        .delete()
        .eq('id', docId);
      if (errDb) throw errDb;

      await fetchDocumentos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar el documento.');
    } finally {
      setEliminandoId(null);
    }
  };

  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<Documento['tipo_documento']>('especificacion_tecnica');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaRev, setNuevaRev] = useState('0');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  const [query, setQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | null>(null);

  const fetchDocumentos = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('doc_biblioteca')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('creado_en', { ascending: false });
    if (err) setError(err.message);
    else setDocumentos((data as Documento[]) ?? []);
    setLoading(false);
  }, [proyectoId]);

  useEffect(() => { fetchDocumentos(); }, [fetchDocumentos]);

  // Polling automático si hay documentos procesándose de fondo
  useEffect(() => {
    const hayProcesando = documentos.some(
      (doc) => doc.estado_procesamiento === 'procesando' || doc.estado_procesamiento === 'extrayendo'
    );
    if (!hayProcesando) return;

    const interval = setInterval(() => {
      fetchDocumentos();
    }, 4000);

    return () => clearInterval(interval);
  }, [documentos, fetchDocumentos]);

  const handleSubir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim() || !archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const storagePath = `${proyectoId}/doc/${nuevoTipo}/${Date.now()}_${sanitizarNombreArchivo(archivo.name)}`;
      const { error: errUpload } = await supabase.storage.from('documentos').upload(storagePath, archivo, {
        contentType: archivo.type || 'application/pdf',
      });
      if (errUpload) throw errUpload;

      const { error: errInsert } = await supabase.from('doc_biblioteca').insert({
        proyecto_id: proyectoId,
        tipo_documento: nuevoTipo,
        titulo: nuevoTitulo,
        codigo: nuevoCodigo.trim() ? nuevoCodigo.toUpperCase().trim() : null,
        descripcion: nuevaDesc || null,
        revision: nuevaRev || null,
        storage_path: storagePath,
        nombre_original: archivo.name,
        tamanio_bytes: archivo.size,
        mime_type: archivo.type || 'application/pdf',
      });
      if (errInsert) throw errInsert;

      setMostrarModal(false);
      setNuevoTitulo('');
      setNuevoCodigo('');
      setNuevaDesc('');
      setNuevaRev('0');
      setArchivo(null);
      await fetchDocumentos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el documento.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleProcesarIA = async (docId: string) => {
    if (!IA_WORKER_URL) {
      setError('VITE_IA_WORKER_URL no está configurado.');
      return;
    }
    setProcesandoId(docId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no válida.');

      const res = await fetch(`${IA_WORKER_URL}/procesar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ documento_id: docId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Error del worker IA (${res.status})`);
      await fetchDocumentos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar con IA.');
      await fetchDocumentos();
    } finally {
      setProcesandoId(null);
    }
  };

  const getStatusBadgeClass = (status: Documento['estado_procesamiento']) => {
    switch (status) {
      case 'pendiente': return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      case 'procesando': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'extrayendo': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'lote_generado': return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'procesado': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'completado': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'error': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  };

  const getStatusLabel = (status: Documento['estado_procesamiento']) => {
    switch (status) {
      case 'pendiente': return 'Pendiente IA';
      case 'procesando': return 'Preparando documento...';
      case 'extrayendo': return 'Gemini extrayendo datos...';
      case 'lote_generado': return 'Propuestas Listas (Staging)';
      case 'procesado': return 'Indexado (buscable)';
      case 'completado': return 'Aplicado (Catálogo)';
      case 'error': return 'Error Procesamiento';
      default: return status;
    }
  };

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!IA_WORKER_URL) { setError('VITE_IA_WORKER_URL no está configurado.'); return; }
    setBuscando(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no válida.');
      const res = await fetch(`${IA_WORKER_URL}/buscar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ proyecto_id: proyectoId, query }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Error del worker IA (${res.status})`);
      setResultados(body.resultados as ResultadoBusqueda[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar.');
    } finally {
      setBuscando(false);
    }
  };

  useHeaderActions(
    <Button variant="primary" size="sm" onClick={() => setMostrarModal(true)}>
      + Subir Documento PDF
    </Button>
  );

  return (
    <div className="flex-grow p-6 space-y-6 overflow-y-auto bg-background text-foreground font-sans">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Ingesta Documental</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {documentos.length === 0 
              ? "Paso 1 — Sube las especificaciones y documentos del proyecto. La IA detectará los catálogos automáticamente."
              : "Sube especificaciones y adendas en PDF para extraer las especificaciones."
            }
          </p>
        </div>
      </div>

      {documentos.length > 0 && (
        <form className="flex gap-2 items-center bg-card border border-border p-1.5 rounded-lg max-w-4xl" onSubmit={handleBuscar}>
          <input
            type="text"
            placeholder="Buscar en el contenido de todos los documentos indexados (ej: espesor mínimo de pared, PWHT, ensayos NDE...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-muted-foreground w-full focus:outline-none px-2"
          />
          <Button variant="secondary" size="sm" type="submit" disabled={buscando || !query.trim()}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </Button>
          {resultados !== null && (
            <Button variant="outline" size="sm" type="button" onClick={() => { setResultados(null); setQuery(''); }}>
              Limpiar
            </Button>
          )}
        </form>
      )}

      {resultados !== null && (
        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          {resultados.length === 0 ? (
            <p className="text-xs text-muted-foreground font-medium">Sin resultados relevantes para esta búsqueda.</p>
          ) : (
            resultados.map((r) => (
              <div key={r.chunk_id} className="bg-card border border-border/60 p-3 rounded-lg text-xs leading-relaxed">
                <div className="flex justify-between items-center mb-1 text-[10px] text-muted-foreground">
                  <span className="font-bold text-white">📄 {r.titulo_doc}{r.pagina_inicio != null ? ` — Pág. ${r.pagina_inicio}` : ''}</span>
                  <span className="text-accent font-extrabold">{Math.round(r.similitud * 100)}% relevante</span>
                </div>
                <p className="text-foreground/90 font-medium leading-relaxed font-sans">{r.contenido}</p>
              </div>
            ))
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-lg text-xs text-red-400 leading-relaxed">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12 text-sm text-muted-foreground font-medium gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
          Cargando biblioteca…
        </div>
      ) : documentos.length === 0 ? (
        <div className="max-w-xl mx-auto bg-gradient-to-b from-panel/40 to-panel/5 border border-border/80 p-8 rounded-xl shadow-2xl text-center space-y-6 mt-8">
          <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white text-base font-bold tracking-tight">Paso 1 — Cargar especificaciones y documentos</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              Sube las especificaciones técnicas o adendas en PDF de tu proyecto. Gemini IA procesará los documentos y extraerá de forma automática las propuestas de catálogos.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="bg-card/40 border border-border/60 p-3 rounded-lg flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-accent uppercase">Paso 1</span>
              <span className="text-[10px] text-white font-bold leading-snug">Subir PDF</span>
              <p className="text-[9px] text-muted-foreground leading-relaxed">Carga las especificaciones del cliente o del proyecto.</p>
            </div>
            <div className="bg-card/40 border border-border/60 p-3 rounded-lg flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-accent uppercase">Paso 2</span>
              <span className="text-[10px] text-white font-bold leading-snug">Gemini IA</span>
              <p className="text-[9px] text-muted-foreground leading-relaxed">El modelo extrae tablas de datos automáticamente.</p>
            </div>
            <div className="bg-card/40 border border-border/60 p-3 rounded-lg flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-accent uppercase">Paso 3</span>
              <span className="text-[10px] text-white font-bold leading-snug">OT Aprueba</span>
              <p className="text-[9px] text-muted-foreground leading-relaxed">Revisa las propuestas de la IA y aplícalas al catálogo.</p>
            </div>
          </div>

          <div className="pt-2">
            <Button 
              variant="primary" 
              size="md" 
              onClick={() => setMostrarModal(true)}
              className="px-8 py-3 text-sm font-bold bg-gradient-to-r from-accent to-indigo-600 hover:from-accent hover:to-indigo-500 shadow-lg shadow-accent/20"
            >
              + Subir Primer Documento PDF
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documentos.map((doc) => (
            <div key={doc.id} className="bg-panel border border-border rounded-xl overflow-hidden flex flex-col justify-between hover:border-accent transition-all min-h-72">
              <div className="p-4 pb-0 flex justify-between items-center">
                <button
                  onClick={() => handleEliminar(doc.id, doc.storage_path)}
                  disabled={eliminandoId !== null || procesandoId !== null}
                  title="Eliminar documento y conocimiento"
                  className="text-red-400/60 hover:text-red-400 disabled:opacity-30 transition-colors p-1 rounded hover:bg-red-500/10 focus:outline-none"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border ${getStatusBadgeClass(doc.estado_procesamiento)}`}>
                  {getStatusLabel(doc.estado_procesamiento)}
                </span>
              </div>

              <div className="p-4 flex-grow flex flex-col gap-2 justify-between">
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <h3 className="text-sm font-extrabold text-white tracking-tight leading-snug line-clamp-1">{doc.titulo}</h3>
                  {doc.descripcion && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1">{doc.descripcion}</p>}
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground border-t border-b border-border/40 py-2 my-2 font-medium">
                    <span><strong>Rev:</strong> {doc.revision || 'N/A'}</span>
                    <span className="truncate"><strong>Tipo:</strong> {doc.tipo_documento.replace('_', ' ').toUpperCase()}</span>
                    {doc.n_paginas != null && <span><strong>Págs:</strong> {doc.n_paginas}</span>}
                    {doc.n_chunks != null && <span className="truncate"><strong>Indexado:</strong> {doc.n_chunks} secc.</span>}
                  </div>

                  {doc.estado_procesamiento === 'error' && doc.error_detalle && (
                    <div className="text-red-400 text-[10px] leading-tight mb-2 truncate" title={doc.error_detalle}>{doc.error_detalle}</div>
                  )}

                  {(doc.estado_procesamiento === 'procesando' || doc.estado_procesamiento === 'extrayendo') && doc.error_detalle && (
                    <div className="text-accent text-[10px] font-semibold leading-tight mb-2 animate-pulse">{doc.error_detalle}</div>
                  )}

                  <div className="text-[9px] text-slate-500 font-medium">
                    Subido: {new Date(doc.creado_en).toLocaleString('es-CL')}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 flex flex-col gap-1.5">
                {(doc.estado_procesamiento === 'pendiente' || doc.estado_procesamiento === 'error') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleProcesarIA(doc.id)}
                    disabled={procesandoId !== null}
                    className="w-full"
                  >
                    {procesandoId === doc.id ? 'Procesando…' : 'Procesar con Gemini IA'}
                  </Button>
                )}
                {procesandoId === doc.id && (
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-accent py-1">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border border-accent border-t-transparent" />
                    <span>Gemini analizando PDF…</span>
                  </div>
                )}
                {doc.estado_procesamiento === 'lote_generado' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onSelectLote(doc.id)}
                    className="w-full"
                  >
                    Revisar y Aprobar Cambios
                  </Button>
                )}
                {onAbrirConstructor && (doc.tipo_documento === 'especificacion_tecnica' || doc.tipo_documento === 'adenda') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onAbrirConstructor(doc.id)}
                    className="w-full"
                  >
                    Abrir en Constructor
                  </Button>
                )}
                {doc.estado_procesamiento === 'completado' && (
                  <span className="text-[10px] font-bold text-emerald-400 text-center py-1 bg-emerald-500/10 border border-emerald-500/20 rounded">
                    ✓ Datos en Catálogo
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL SUBIR DOCUMENTO */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-border p-6 rounded-lg w-full max-w-lg shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Subir Especificación de Ingeniería</h3>
              <p className="text-xs text-muted-foreground mt-1">Carga el plano o documento PDF en el almacenamiento seguro.</p>
            </div>
            <form onSubmit={handleSubir} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">Título del Documento</label>
                <input
                  type="text"
                  placeholder="Ej: Especificación Técnica de Materiales de Cañerías"
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">Tipo de Documento</label>
                  <select
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value as Documento['tipo_documento'])}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none focus:border-accent"
                  >
                    <option value="especificacion_tecnica">Especificación Técnica</option>
                    <option value="adenda">Adenda / Anexo</option>
                    <option value="estandar">Estándar Mandante</option>
                    <option value="cwp">Construction Work Package (CWP)</option>
                    <option value="line_list">Line List (PDF)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">Revisión (REV)</label>
                  <input
                    type="text"
                    placeholder="Ej: A, 0, 1"
                    value={nuevaRev}
                    onChange={(e) => setNuevaRev(e.target.value)}
                    className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">Código del Documento (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: PROC-PINT-01 (la IA intentará detectarlo si se deja vacío)"
                  value={nuevoCodigo}
                  onChange={(e) => setNuevoCodigo(e.target.value)}
                  className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">Descripción / Notas</label>
                <textarea
                  placeholder="Agregue comentarios sobre el origen o cambios del documento..."
                  value={nuevaDesc}
                  onChange={(e) => setNuevaDesc(e.target.value)}
                  rows={2}
                  className="bg-card border border-border text-foreground px-3 py-2 rounded text-xs font-semibold focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">Archivo PDF (Almacenamiento Privado)</label>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-panel/10"
                  onClick={() => document.getElementById('doc-file-input')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setArchivo(f); }}
                >
                  <div className="text-2xl mb-1">📥</div>
                  <p className="text-xs font-semibold text-white text-center">
                    {archivo ? archivo.name : <>Arrastra tu PDF aquí o <strong className="text-accent hover:underline">haz clic para examinar</strong></>}
                  </p>
                  <span className="text-[9px] text-muted-foreground mt-1">Solo archivos PDF de ingeniería</span>
                  <input
                    id="doc-file-input"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40 mt-4">
                <Button variant="outline" size="sm" type="button" onClick={() => setMostrarModal(false)} disabled={subiendo}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={subiendo || !archivo}>
                  {subiendo ? 'Subiendo PDF...' : 'Subir Documento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default BibliotecaDocumental;

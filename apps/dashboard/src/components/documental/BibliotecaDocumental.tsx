import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import './documental.css';

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
}

const IA_WORKER_URL = import.meta.env.VITE_IA_WORKER_URL as string | undefined;

export const BibliotecaDocumental: React.FC<BibliotecaDocumentalProps> = ({ proyectoId, onSelectLote }) => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<Documento['tipo_documento']>('especificacion_tecnica');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaRev, setNuevaRev] = useState('0');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

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

  const handleSubir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim() || !archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const storagePath = `${proyectoId}/doc/${nuevoTipo}/${Date.now()}_${archivo.name}`;
      const { error: errUpload } = await supabase.storage.from('documentos').upload(storagePath, archivo, {
        contentType: archivo.type || 'application/pdf',
      });
      if (errUpload) throw errUpload;

      const { error: errInsert } = await supabase.from('doc_biblioteca').insert({
        proyecto_id: proyectoId,
        tipo_documento: nuevoTipo,
        titulo: nuevoTitulo,
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
      case 'pendiente': return 'badge status-pendiente';
      case 'procesando': return 'badge status-procesando';
      case 'extrayendo': return 'badge status-extrayendo';
      case 'lote_generado': return 'badge status-lote-generado';
      case 'completado': return 'badge status-completado';
      case 'error': return 'badge status-error';
      default: return 'badge';
    }
  };

  const getStatusLabel = (status: Documento['estado_procesamiento']) => {
    switch (status) {
      case 'pendiente': return 'Pendiente IA';
      case 'procesando': return 'Preparando documento...';
      case 'extrayendo': return 'Gemini extrayendo datos...';
      case 'lote_generado': return 'Propuestas Listas (Staging)';
      case 'completado': return 'Aplicado (Catálogo)';
      case 'error': return 'Error Procesamiento';
      default: return status;
    }
  };

  return (
    <div className="doc-section">
      <div className="doc-header">
        <div>
          <h2>Ingesta Documental con IA</h2>
          <p className="doc-subheader">Sube especificaciones y adendas en PDF para extraer clases de piping y fluidos con Gemini, y poblar catálogos con aprobación humana.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setMostrarModal(true)}>
          <span className="icon">+</span> Subir Documento PDF
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '0.875rem', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="loader-container"><div className="spinner"></div><span>Cargando biblioteca…</span></div>
      ) : documentos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
          No hay documentos subidos todavía para este proyecto.
        </div>
      ) : (
        <div className="doc-grid">
          {documentos.map((doc) => (
            <div key={doc.id} className="doc-card">
              <div className="doc-card-badge">
                <span className={getStatusBadgeClass(doc.estado_procesamiento)}>
                  {getStatusLabel(doc.estado_procesamiento)}
                </span>
              </div>

              <div className="doc-card-body">
                <div className="doc-pdf-icon">📄</div>
                <h3 className="doc-title">{doc.titulo}</h3>
                {doc.descripcion && <p className="doc-desc">{doc.descripcion}</p>}

                <div className="doc-meta-info">
                  <span><strong>Rev:</strong> {doc.revision || 'N/A'}</span>
                  <span><strong>Tipo:</strong> {doc.tipo_documento.replace('_', ' ').toUpperCase()}</span>
                  {doc.n_paginas != null && <span><strong>Págs:</strong> {doc.n_paginas}</span>}
                </div>

                {doc.estado_procesamiento === 'error' && doc.error_detalle && (
                  <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '8px' }}>{doc.error_detalle}</div>
                )}

                <div className="doc-date">
                  Subido el: {new Date(doc.creado_en).toLocaleString('es-CL')}
                </div>
              </div>

              <div className="doc-card-footer">
                {(doc.estado_procesamiento === 'pendiente' || doc.estado_procesamiento === 'error') && (
                  <button
                    className="btn btn-action btn-ia"
                    onClick={() => handleProcesarIA(doc.id)}
                    disabled={procesandoId !== null}
                  >
                    {procesandoId === doc.id ? 'Procesando…' : '✨ Procesar con Gemini IA'}
                  </button>
                )}
                {procesandoId === doc.id && (
                  <div className="loader-container" style={{ marginTop: '8px' }}>
                    <div className="spinner"></div>
                    <span>Gemini está leyendo el documento…</span>
                  </div>
                )}
                {doc.estado_procesamiento === 'lote_generado' && (
                  <button
                    className="btn btn-action btn-success"
                    onClick={() => onSelectLote(doc.id)}
                  >
                    👁️ Revisar y Aprobar Cambios
                  </button>
                )}
                {doc.estado_procesamiento === 'completado' && (
                  <span className="success-text">✓ Datos aplicados al Catálogo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Subir Especificación de Ingeniería</h3>
            <form onSubmit={handleSubir}>
              <div className="form-group">
                <label>Título del Documento</label>
                <input
                  type="text"
                  placeholder="Ej: Especificación Técnica de Materiales de Cañerías"
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de Documento</label>
                  <select
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value as Documento['tipo_documento'])}
                  >
                    <option value="especificacion_tecnica">Especificación Técnica</option>
                    <option value="adenda">Adenda / Anexo</option>
                    <option value="estandar">Estándar Mandante</option>
                    <option value="cwp">Construction Work Package (CWP)</option>
                    <option value="line_list">Line List (PDF)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Revisión</label>
                  <input
                    type="text"
                    placeholder="Ej: A, 0, 1"
                    value={nuevaRev}
                    onChange={(e) => setNuevaRev(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción / Notas</label>
                <textarea
                  placeholder="Agregue comentarios sobre el origen o cambios del documento..."
                  value={nuevaDesc}
                  onChange={(e) => setNuevaDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Archivo PDF (Storage Privado)</label>
                <div
                  className="file-dropzone"
                  onClick={() => document.getElementById('doc-file-input')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setArchivo(f); }}
                >
                  <div className="dropzone-icon">📥</div>
                  <p>{archivo ? archivo.name : <>Arrastra tu PDF aquí o <strong>haz clic para examinar</strong></>}</p>
                  <span className="dropzone-sub">Solo archivos PDF de ingeniería</span>
                  <input
                    id="doc-file-input"
                    type="file"
                    accept="application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarModal(false)} disabled={subiendo}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={subiendo || !archivo}>
                  {subiendo ? 'Subiendo PDF...' : 'Subir Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default BibliotecaDocumental;

import React, { useState } from 'react';
import './documental.css';

// Interfaces de tipos
export interface Documento {
  id: string;
  proyecto_id: string;
  tipo_documento: 'adenda' | 'especificacion_tecnica' | 'estandar' | 'cwp' | 'line_list' | 'pid' | 'plano' | 'procedimiento' | 'otro';
  titulo: string;
  descripcion?: string;
  revision?: string;
  storage_path: string;
  estado_procesamiento: 'pendiente' | 'procesando' | 'procesado' | 'extrayendo' | 'lote_generado' | 'completado' | 'error';
  n_paginas?: number;
  n_chunks?: number;
  error_detalle?: string;
  creado_en: string;
  lote_ia_id?: string;
}

interface BibliotecaDocumentalProps {
  proyectoId: string;
  onSelectLote: (loteId: string, docId: string) => void;
}

// Datos demo iniciales
const DATOS_DEMO: Documento[] = [
  {
    id: 'doc-001',
    proyecto_id: 'proj-413',
    tipo_documento: 'especificacion_tecnica',
    titulo: 'Espec. Técnica de Piping y Materiales',
    descripcion: 'Especificación general de piping y requerimientos de ensayos no destructivos',
    revision: 'B',
    storage_path: 'proj-413/doc/especificacion_tecnica/spec_piping_revB.pdf',
    estado_procesamiento: 'lote_generado',
    n_paginas: 3,
    n_chunks: 12,
    creado_en: '2026-07-13T10:30:00Z',
    lote_ia_id: 'lote-ia-999'
  },
  {
    id: 'doc-002',
    proyecto_id: 'proj-413',
    tipo_documento: 'adenda',
    titulo: 'Adenda 01 - Especificación QA/QC',
    descripcion: 'Modificaciones al porcentaje de radiografías en juntas clase A2',
    revision: '0',
    storage_path: 'proj-413/doc/adenda/adenda_01_qaqc.pdf',
    estado_procesamiento: 'pendiente',
    creado_en: '2026-07-13T12:15:00Z'
  }
];

export const BibliotecaDocumental: React.FC<BibliotecaDocumentalProps> = ({ proyectoId, onSelectLote }) => {
  const [documentos, setDocumentos] = useState<Documento[]>(DATOS_DEMO);
  const [subiendo, setSubiendo] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  
  // Estados para nuevo documento
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<Documento['tipo_documento']>('especificacion_tecnica');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaRev, setNuevaRev] = useState('0');
  const [mostrarModal, setMostrarModal] = useState(false);

  const handleSubir = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim()) return;

    setSubiendo(true);
    // Simular carga a Supabase Storage
    setTimeout(() => {
      const nuevoDoc: Documento = {
        id: `doc-${Date.now()}`,
        proyecto_id: proyectoId,
        tipo_documento: nuevoTipo,
        titulo: nuevoTitulo,
        descripcion: nuevaDesc || undefined,
        revision: nuevaRev || undefined,
        storage_path: `${proyectoId}/doc/${nuevoTipo}/${nuevoTitulo.toLowerCase().replace(/ /g, '_')}.pdf`,
        estado_procesamiento: 'pendiente',
        creado_en: new Date().toISOString()
      };
      
      setDocumentos([nuevoDoc, ...documentos]);
      setSubiendo(false);
      setMostrarModal(false);
      
      // Limpiar inputs
      setNuevoTitulo('');
      setNuevaDesc('');
      setNuevaRev('0');
    }, 1500);
  };

  const handleProcesarIA = (docId: string) => {
    setProcesandoId(docId);
    
    // Cambiar estado a 'procesando'
    setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, estado_procesamiento: 'procesando' } : d));
    
    // Simular las fases del pipeline IA: OCR/Chunks -> Extracción -> Generar Lote
    setTimeout(() => {
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, estado_procesamiento: 'extrayendo', n_paginas: 3, n_chunks: 8 } : d));
      
      setTimeout(() => {
        const loteId = `lote-ia-${Date.now()}`;
        setDocumentos(prev => prev.map(d => d.id === docId ? { 
          ...d, 
          estado_procesamiento: 'lote_generado',
          lote_ia_id: loteId
        } : d));
        setProcesandoId(null);
      }, 2000);
    }, 2000);
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
      case 'procesando': return 'Chunks & Embeddings...';
      case 'extrayendo': return 'Extrayendo con Gemini...';
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
          <p className="doc-subheader">Sube especificaciones y adendas en PDF para extraer clases de piping y poblar catálogos automáticamente con Gemini.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setMostrarModal(true)}>
          <span className="icon">+</span> Subir Documento PDF
        </button>
      </div>

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
                {doc.n_paginas && <span><strong>Págs:</strong> {doc.n_paginas}</span>}
                {doc.n_chunks && <span><strong>Chunks (RAG):</strong> {doc.n_chunks}</span>}
              </div>
              
              <div className="doc-date">
                Subido el: {new Date(doc.creado_en).toLocaleString('es-CL')}
              </div>
            </div>

            <div className="doc-card-footer">
              {doc.estado_procesamiento === 'pendiente' && (
                <button 
                  className="btn btn-action btn-ia" 
                  onClick={() => handleProcesarIA(doc.id)}
                  disabled={procesandoId !== null}
                >
                  ✨ Procesar con Gemini IA
                </button>
              )}
              {doc.estado_procesamiento === 'procesando' && (
                <div className="loader-container">
                  <div className="spinner"></div>
                  <span>Generando vectores RAG...</span>
                </div>
              )}
              {doc.estado_procesamiento === 'extrayendo' && (
                <div className="loader-container">
                  <div className="spinner pulse"></div>
                  <span>Gemini extrayendo datos...</span>
                </div>
              )}
              {doc.estado_procesamiento === 'lote_generado' && doc.lote_ia_id && (
                <button 
                  className="btn btn-action btn-success"
                  onClick={() => onSelectLote(doc.lote_ia_id!, doc.id)}
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

      {/* Modal de Carga */}
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
                <div className="file-dropzone">
                  <div className="dropzone-icon">📥</div>
                  <p>Arrastra tu PDF aquí o <strong>haz clic para examinar</strong></p>
                  <span className="dropzone-sub">Solo archivos PDF de ingeniería (Máx. 25MB)</span>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarModal(false)} disabled={subiendo}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={subiendo}>
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

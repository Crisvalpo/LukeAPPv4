import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';
import { useHeaderActions } from '../../hooks/useHeaderActions';
import './documental.css';

type TablaDestino = 'cat_fluido_servicio' | 'cat_clase_piping';
type Accion = 'nueva' | 'modificada' | 'sin_cambio' | 'error';

interface CampoDef {
  campo: string;
  label: string;
}

const CAMPOS_POR_TABLA: Record<TablaDestino, CampoDef[]> = {
  cat_fluido_servicio: [
    { campo: 'codigo', label: 'Código' },
    { campo: 'descripcion', label: 'Descripción' },
  ],
  cat_clase_piping: [
    { campo: 'codigo', label: 'Código' },
    { campo: 'descripcion', label: 'Descripción' },
    { campo: 'fluido_codigo', label: 'Fluido asociado' },
    { campo: 'presion_max', label: 'Presión máx.' },
    { campo: 'temp_max', label: 'Temp. máx.' },
  ],
};

const TABLA_LABEL: Record<TablaDestino, string> = {
  cat_fluido_servicio: 'Fluidos y Servicios',
  cat_clase_piping: 'Clases de Piping',
};

interface FilaImport {
  id: string;
  nro_fila: number;
  payload: Record<string, string | number | null>;
  clave_natural: string | null;
  accion: Accion | null;
  diff: Record<string, { antes: string | null; despues: string | null }> | null;
  error_detalle: string | null;
  aprobada: boolean | null;
  fuente: { paginas?: number[]; contexto?: string; titulo?: string } | null;
  confianza: number | null;
}

interface LoteInfo {
  id: string;
  estado: string;
  resumen: Record<string, number> | null;
  tabla_destino: TablaDestino;
}

interface RevisionLoteIAProps {
  docId: string;
  onBack: () => void;
  onCompletado: () => void;
}

const ACCION_META: Record<Accion, { label: string; color: string }> = {
  nueva: { label: 'Nueva', color: '#10b981' },
  modificada: { label: 'Modificada', color: '#eab308' },
  sin_cambio: { label: 'Sin cambio', color: '#64748b' },
  error: { label: 'Error', color: '#f87171' },
};

const getConfianzaClass = (conf: number | null) => {
  if (conf == null) return '';
  if (conf >= 0.95) return 'confianza-alta';
  if (conf >= 0.8) return 'confianza-media';
  return 'confianza-baja';
};

export const RevisionLoteIA: React.FC<RevisionLoteIAProps> = ({ docId, onBack, onCompletado }) => {
  const [docTitulo, setDocTitulo] = useState<string>('');
  const [lotes, setLotes] = useState<LoteInfo[]>([]);
  const [loteActivoId, setLoteActivoId] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaImport[]>([]);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarLotes = useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data: doc } = await supabase.from('doc_biblioteca').select('titulo').eq('id', docId).single();
    setDocTitulo(doc?.titulo ?? '');

    const { data, error: errLotes } = await supabase
      .from('import_lotes')
      .select('id, estado, resumen, import_perfiles(tabla_destino)')
      .eq('documento_id', docId);
    if (errLotes) { setError(errLotes.message); setCargando(false); return; }

    const parsed: LoteInfo[] = (data ?? []).map((l) => {
      const perfil = Array.isArray(l.import_perfiles) ? l.import_perfiles[0] : l.import_perfiles;
      return {
        id: l.id as string,
        estado: l.estado as string,
        resumen: l.resumen as Record<string, number> | null,
        tabla_destino: perfil?.tabla_destino as TablaDestino,
      };
    });
    setLotes(parsed);
    setLoteActivoId((prev) => prev ?? parsed[0]?.id ?? null);
    setCargando(false);
  }, [docId]);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  const cargarFilas = useCallback(async (loteId: string) => {
    const { data, error: errFilas } = await supabase
      .from('import_filas').select('*').eq('lote_id', loteId).order('nro_fila');
    if (errFilas) { setError(errFilas.message); return; }
    setFilas((data as FilaImport[]) ?? []);
    setSeleccionadaId((data as FilaImport[])?.[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (loteActivoId) cargarFilas(loteActivoId);
  }, [loteActivoId, cargarFilas]);

  const loteActivo = lotes.find((l) => l.id === loteActivoId) ?? null;
  const campos = loteActivo ? CAMPOS_POR_TABLA[loteActivo.tabla_destino] : [];

  const handleAprobarFila = async (fila: FilaImport, aprobar: boolean) => {
    if (!loteActivoId) return;
    const { error: errAp } = await supabase.rpc('importar_aprobar_filas', {
      p_lote_id: loteActivoId,
      p_fila_ids: [fila.id],
      p_aprobada: aprobar,
    });
    if (errAp) { setError(errAp.message); return; }
    setFilas((prev) => prev.map((f) => (f.id === fila.id ? { ...f, aprobada: aprobar } : f)));
  };

  const handleAplicarLote = async () => {
    if (!loteActivoId) return;
    setAplicando(true);
    setError(null);
    try {
      const { error: errAplicar } = await supabase.rpc('importar_aplicar_lote', { p_lote_id: loteActivoId });
      if (errAplicar) throw errAplicar;
      await cargarLotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aplicar el lote.');
    } finally {
      setAplicando(false);
    }
  };

  const todosAplicados = lotes.length > 0 && lotes.every((l) => l.estado === 'aplicado');

  const handleFinalizar = async () => {
    await supabase.from('doc_biblioteca').update({ estado_procesamiento: 'completado' }).eq('id', docId);
    onCompletado();
  };

  const seleccionada = filas.find((f) => f.id === seleccionadaId) ?? null;

  useHeaderActions(
    <Button variant="outline" size="sm" onClick={onBack}>
      ← Volver a Biblioteca
    </Button>
  );

  if (cargando) {
    return (
      <div className="rev-section">
        <div className="loader-container"><div className="spinner"></div><span>Cargando propuestas…</span></div>
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="rev-section">
        <div className="rev-header">
          <div><h2>Revisión de Extracción Asistida por IA</h2></div>
        </div>
        <p className="doc-subheader">Este documento todavía no tiene propuestas generadas.</p>
      </div>
    );
  }

  return (
    <div className="rev-section">
      <div className="rev-header">
        <div>
          <h2>Revisión de Extracción Asistida por IA</h2>
          <p className="doc-subheader">Verifica los datos propuestos por Gemini antes de insertarlos en el catálogo del proyecto. (Documento: {docTitulo})</p>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '0.875rem', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {lotes.length > 1 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {lotes.map((l) => (
            <button
              key={l.id}
              onClick={() => setLoteActivoId(l.id)}
              className={`btn ${l.id === loteActivoId ? 'btn-primary' : 'btn-secondary'}`}
            >
              {TABLA_LABEL[l.tabla_destino]} {l.estado === 'aplicado' ? '✓' : ''}
            </button>
          ))}
        </div>
      )}

      {loteActivo && (
        <div className="rev-layout">
          <div className="rev-panel-list">
            <div className="panel-actions">
              <span>Propuestas — {TABLA_LABEL[loteActivo.tabla_destino]} ({filas.length})</span>
            </div>

            <div className="propuestas-list">
              {filas.map((f) => (
                <div
                  key={f.id}
                  className={`propuesta-item ${f.id === seleccionadaId ? 'selected' : ''} ${f.aprobada === true ? 'aprobada' : f.aprobada === false && f.accion !== 'sin_cambio' ? 'rechazada' : ''}`}
                  onClick={() => setSeleccionadaId(f.id)}
                >
                  <div className="propuesta-item-header">
                    <span className="propuesta-tabla" style={{ color: ACCION_META[f.accion ?? 'sin_cambio'].color }}>
                      {ACCION_META[f.accion ?? 'sin_cambio'].label}
                    </span>
                    {f.confianza != null && (
                      <span className={`conf-dot ${getConfianzaClass(f.confianza)}`} title={`${Math.round(f.confianza * 100)}% de confianza`}></span>
                    )}
                  </div>
                  <div className="propuesta-item-key">Clave: <strong>{f.clave_natural ?? '—'}</strong></div>
                  {(loteActivo.estado === 'diff_listo') && (f.accion === 'nueva' || f.accion === 'modificada') && (
                    <div className="propuesta-item-actions">
                      <button className="btn-pill btn-pill-approve" onClick={(e) => { e.stopPropagation(); handleAprobarFila(f, true); }}>Aprobar</button>
                      <button className="btn-pill btn-pill-reject" onClick={(e) => { e.stopPropagation(); handleAprobarFila(f, false); }}>Rechazar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rev-panel-detail">
            {seleccionada ? (
              <div className="detail-container">
                <div className="detail-header">
                  <h3>{seleccionada.clave_natural ?? 'Sin clave'}</h3>
                  {seleccionada.confianza != null && (
                    <span className={`badge ${getConfianzaClass(seleccionada.confianza)}`}>
                      {Math.round(seleccionada.confianza * 100)}% de confianza
                    </span>
                  )}
                </div>

                {seleccionada.error_detalle && (
                  <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '16px' }}>{seleccionada.error_detalle}</div>
                )}

                {seleccionada.fuente?.contexto && (
                  <div className="source-card">
                    <div className="source-card-header">
                      <span>📖 Origen del PDF: <strong>Página(s) {(seleccionada.fuente.paginas ?? []).join(', ') || '—'}</strong></span>
                    </div>
                    <div className="source-card-body">
                      <p className="source-context">"{seleccionada.fuente.contexto}"</p>
                    </div>
                  </div>
                )}

                {seleccionada.diff && Object.keys(seleccionada.diff).length > 0 && (
                  <table className="cub-diff-table">
                    <thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
                    <tbody>
                      {Object.entries(seleccionada.diff).map(([campo, v]) => (
                        <tr key={campo}>
                          <td>{campo}</td>
                          <td className="cub-diff-antes">{v.antes ?? '—'}</td>
                          <td className="cub-diff-despues">{v.despues ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="payload-card">
                  <h4>Datos propuestos</h4>
                  <pre className="payload-json">
                    {JSON.stringify(
                      Object.fromEntries(campos.map((c) => [c.label, seleccionada.payload[c.campo] ?? null])),
                      null, 2
                    )}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="empty-detail"><p>Selecciona una propuesta a la izquierda.</p></div>
            )}
          </div>
        </div>
      )}

      <div className="rev-footer-bar">
        <div className="rev-summary">
          {lotes.map((l) => (
            <span key={l.id} style={{ marginRight: 16 }}>
              {TABLA_LABEL[l.tabla_destino]}: <strong>{l.estado}</strong>
            </span>
          ))}
        </div>
        {!todosAplicados ? (
          <button
            className="btn btn-primary btn-lg"
            disabled={aplicando || !loteActivo || loteActivo.estado !== 'diff_listo'}
            onClick={handleAplicarLote}
          >
            {aplicando ? 'Aplicando…' : `Aprobar y Aplicar (${loteActivo ? TABLA_LABEL[loteActivo.tabla_destino] : ''})`}
          </button>
        ) : (
          <button className="btn btn-success btn-lg" onClick={handleFinalizar}>Todo aplicado — Volver a Biblioteca</button>
        )}
      </div>
    </div>
  );
};
export default RevisionLoteIA;

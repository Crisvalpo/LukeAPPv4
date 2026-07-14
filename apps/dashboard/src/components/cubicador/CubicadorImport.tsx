import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import '../documental/documental.css';
import './cubicador.css';

type TablaDestino = 'list_lineas' | 'list_mto';
type Accion = 'nueva' | 'modificada' | 'ausente' | 'sin_cambio' | 'error';
type Fase = 'origen' | 'mapeo' | 'diff' | 'aplicado';

interface CampoCanonico {
  campo: string;
  label: string;
  requerido?: boolean;
  alias: string[];
}

const CAMPOS_POR_TABLA: Record<TablaDestino, CampoCanonico[]> = {
  list_lineas: [
    { campo: 'id_linea', label: 'ID Línea', requerido: true, alias: ['id_linea', 'idlinea', 'linea', 'line_id', 'lineno', 'lineno', 'line_no', 'line_number', 'nlinea'] },
    { campo: 'descripcion', label: 'Descripción', alias: ['descripcion', 'description', 'desc'] },
    { campo: 'fluido_codigo', label: 'Fluido (código)', alias: ['fluido', 'fluido_codigo', 'servicio', 'fluid', 'service'] },
    { campo: 'clase_codigo', label: 'Clase piping (código)', alias: ['clase', 'clase_codigo', 'class', 'pipingclass', 'clasepiping'] },
    { campo: 'nps_texto', label: 'NPS / Diámetro', alias: ['nps', 'diametro', 'size', 'npstexto'] },
    { campo: 'longitud_total', label: 'Longitud total', alias: ['longitud', 'longitudtotal', 'length', 'metros', 'lengthtotal'] },
  ],
  list_mto: [
    { campo: 'item', label: 'Ítem', requerido: true, alias: ['item', 'itemno', 'nitem', 'itemnumber'] },
    { campo: 'id_linea', label: 'ID Línea', alias: ['id_linea', 'idlinea', 'linea', 'lineid', 'lineno'] },
    { campo: 'descripcion', label: 'Descripción', alias: ['descripcion', 'description', 'desc'] },
    { campo: 'tag', label: 'Tag', alias: ['tag'] },
    { campo: 'cantidad', label: 'Cantidad', alias: ['cantidad', 'qty', 'quantity', 'cant'] },
    { campo: 'unidad', label: 'Unidad', alias: ['unidad', 'unit', 'uom'] },
    { campo: 'nps_texto', label: 'NPS / Diámetro', alias: ['nps', 'diametro', 'size', 'npstexto'] },
    { campo: 'clase_codigo', label: 'Clase piping (código)', alias: ['clase', 'clase_codigo', 'class', 'pipingclass'] },
    { campo: 'material', label: 'Material', alias: ['material', 'mat'] },
    { campo: 'norma', label: 'Norma', alias: ['norma', 'standard', 'spec'] },
    { campo: 'schedule', label: 'Schedule', alias: ['schedule', 'sch'] },
    { campo: 'heat_number', label: 'N° Colada (Heat)', alias: ['heatnumber', 'heat', 'colada', 'ncolada'] },
  ],
};

interface FilaImport {
  id: string;
  nro_fila: number;
  payload: Record<string, string | null>;
  clave_natural: string | null;
  accion: Accion | null;
  diff: Record<string, { antes: string | null; despues: string | null }> | null;
  error_detalle: string | null;
  aprobada: boolean | null;
}

interface LoteResumen {
  n_nuevas?: number;
  n_modificadas?: number;
  n_ausentes?: number;
  n_sin_cambio?: number;
  n_errores?: number;
  n_conflictos?: number;
  aplicadas_nuevas?: number;
  aplicadas_modificadas?: number;
  marcadas_ausentes?: number;
}

interface CubicadorImportProps {
  proyectoId: string;
  onBack: () => void;
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function hashArchivo(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const RESUMEN_KEY: Record<Accion, keyof LoteResumen> = {
  nueva: 'n_nuevas',
  modificada: 'n_modificadas',
  ausente: 'n_ausentes',
  sin_cambio: 'n_sin_cambio',
  error: 'n_errores',
};

const ACCION_META: Record<Accion, { label: string; color: string }> = {
  nueva: { label: 'Nueva', color: '#10b981' },
  modificada: { label: 'Modificada', color: '#eab308' },
  ausente: { label: 'Ausente', color: '#ef4444' },
  sin_cambio: { label: 'Sin cambio', color: '#64748b' },
  error: { label: 'Error', color: '#f87171' },
};

export const CubicadorImport: React.FC<CubicadorImportProps> = ({ proyectoId, onBack }) => {
  const [fase, setFase] = useState<Fase>('origen');
  const [tablaDestino, setTablaDestino] = useState<TablaDestino>('list_lineas');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filasCrudas, setFilasCrudas] = useState<Record<string, unknown>[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({}); // campo canónico -> header del archivo
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loteId, setLoteId] = useState<string | null>(null);
  const [estadoLote, setEstadoLote] = useState<string | null>(null);
  const [resumen, setResumen] = useState<LoteResumen | null>(null);
  const [filas, setFilas] = useState<FilaImport[]>([]);
  const [filtroAccion, setFiltroAccion] = useState<Accion | 'todas'>('todas');
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const campos = CAMPOS_POR_TABLA[tablaDestino];

  const handleArchivoSeleccionado = async (file: File) => {
    setError(null);
    setArchivo(file);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    const filasRaw: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
    if (filasRaw.length < 2) {
      setError('La planilla no tiene filas de datos.');
      return;
    }
    const encabezados = (filasRaw[0] as string[]).map((h) => String(h ?? '').trim());
    const datos = filasRaw.slice(1)
      .filter((fila) => fila.some((c) => String(c ?? '').trim() !== ''))
      .map((fila) => {
        const obj: Record<string, unknown> = {};
        encabezados.forEach((h, i) => { obj[h] = fila[i]; });
        return obj;
      });

    // Auto-mapeo por coincidencia de alias normalizados
    const autoMapeo: Record<string, string> = {};
    for (const c of campos) {
      const encontrado = encabezados.find((h) => c.alias.includes(normalizar(h)));
      if (encontrado) autoMapeo[c.campo] = encontrado;
    }

    setHeaders(encabezados);
    setFilasCrudas(datos);
    setMapeo(autoMapeo);
    setFase('mapeo');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleArchivoSeleccionado(file);
  };

  const mapeoCompleto = campos.filter((c) => c.requerido).every((c) => mapeo[c.campo]);

  const handleProcesar = async () => {
    if (!archivo || !mapeoCompleto) return;
    setProcesando(true);
    setError(null);
    try {
      const buf = await archivo.arrayBuffer();
      const hash = await hashArchivo(buf);
      const storagePath = `${proyectoId}/cubicador/${tablaDestino}/${Date.now()}_${archivo.name}`;

      const { error: errUpload } = await supabase.storage.from('importaciones').upload(storagePath, archivo, {
        contentType: archivo.type || 'application/octet-stream',
      });
      if (errUpload) throw errUpload;

      const filasPayload = filasCrudas.map((fila) => {
        const payload: Record<string, string> = {};
        for (const c of campos) {
          const header = mapeo[c.campo];
          const valor = header ? fila[header] : undefined;
          payload[c.campo] = valor === undefined || valor === null ? '' : String(valor).trim();
        }
        return payload;
      });

      const { data: nuevoLoteId, error: errRpc } = await supabase.rpc('importar_crear_lote', {
        p_proyecto_id: proyectoId,
        p_tabla_destino: tablaDestino,
        p_archivo_nombre: archivo.name,
        p_hash_archivo: hash,
        p_storage_path: storagePath,
        p_mapeo: mapeo,
        p_filas: filasPayload,
      });
      if (errRpc) throw errRpc;

      setLoteId(nuevoLoteId as string);
      await cargarLote(nuevoLoteId as string);
      setFase('diff');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar la planilla.');
    } finally {
      setProcesando(false);
    }
  };

  const cargarLote = useCallback(async (id: string) => {
    const { data: lote, error: errLote } = await supabase
      .from('import_lotes').select('estado, resumen').eq('id', id).single();
    if (errLote) { setError(errLote.message); return; }
    setEstadoLote(lote.estado);
    setResumen(lote.resumen as LoteResumen);

    const { data: filasData, error: errFilas } = await supabase
      .from('import_filas').select('*').eq('lote_id', id).order('nro_fila');
    if (errFilas) { setError(errFilas.message); return; }
    setFilas((filasData as FilaImport[]) ?? []);
    if ((filasData as FilaImport[])?.length) setSeleccionadaId((filasData as FilaImport[])[0].id);
  }, []);

  const handleAprobarFila = async (fila: FilaImport, aprobar: boolean) => {
    if (!loteId) return;
    const { error: errAp } = await supabase.rpc('importar_aprobar_filas', {
      p_lote_id: loteId,
      p_fila_ids: [fila.id],
      p_aprobada: aprobar,
    });
    if (errAp) { setError(errAp.message); return; }
    setFilas((prev) => prev.map((f) => (f.id === fila.id ? { ...f, aprobada: aprobar } : f)));
  };

  const handleAplicarLote = async () => {
    if (!loteId) return;
    setAplicando(true);
    setError(null);
    try {
      const { data, error: errAplicar } = await supabase.rpc('importar_aplicar_lote', { p_lote_id: loteId });
      if (errAplicar) throw errAplicar;
      setResumen(data as LoteResumen);
      setEstadoLote('aplicado');
      setFase('aplicado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aplicar el lote.');
    } finally {
      setAplicando(false);
    }
  };

  const reiniciar = () => {
    setFase('origen');
    setArchivo(null);
    setHeaders([]);
    setFilasCrudas([]);
    setMapeo({});
    setLoteId(null);
    setEstadoLote(null);
    setResumen(null);
    setFilas([]);
    setSeleccionadaId(null);
    setError(null);
  };

  const filasFiltradas = filtroAccion === 'todas' ? filas : filas.filter((f) => f.accion === filtroAccion);
  const seleccionada = filas.find((f) => f.id === seleccionadaId) ?? null;
  const hayConflictoAprobado = filas.some((f) => f.aprobada && f.error_detalle?.startsWith('CONFLICTO'));
  const hayPendientesAusentes = filas.some((f) => f.accion === 'ausente' && f.aprobada === false && !f.error_detalle?.startsWith('CONFLICTO'));

  return (
    <div className="rev-section">
      <div className="rev-header">
        <button className="btn btn-secondary btn-back" onClick={onBack}>← Volver al proyecto</button>
        <div>
          <h2>Importador de Cubicación (Line List / MTO)</h2>
          <p className="doc-subheader">
            Sube una planilla Excel, revisa el diff contra los datos actuales y aplica los cambios de forma transaccional.
          </p>
        </div>
      </div>

      {error && (
        <div className="cub-error">⚠️ {error}</div>
      )}

      {fase === 'origen' && (
        <div className="cub-origen">
          <div className="form-group">
            <label>Tabla destino</label>
            <select value={tablaDestino} onChange={(e) => setTablaDestino(e.target.value as TablaDestino)}>
              <option value="list_lineas">Line List (list_lineas)</option>
              <option value="list_mto">MTO (list_mto)</option>
            </select>
          </div>

          <div
            className="file-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('cub-file-input')?.click()}
          >
            <div className="dropzone-icon">📊</div>
            <p>Arrastra tu Excel aquí o <strong>haz clic para examinar</strong></p>
            <span className="dropzone-sub">Archivos .xlsx / .xls, primera fila con encabezados</span>
            <input
              id="cub-file-input"
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArchivoSeleccionado(f); }}
            />
          </div>
        </div>
      )}

      {fase === 'mapeo' && (
        <div className="cub-mapeo">
          <h3>Mapeo de columnas — {archivo?.name}</h3>
          <p className="doc-subheader">{filasCrudas.length} filas detectadas. Asigna cada campo del sistema a una columna de tu planilla.</p>

          <div className="cub-mapeo-grid">
            {campos.map((c) => (
              <div className="form-group" key={c.campo}>
                <label>{c.label}{c.requerido ? ' *' : ''}</label>
                <select
                  value={mapeo[c.campo] ?? ''}
                  onChange={(e) => setMapeo((prev) => ({ ...prev, [c.campo]: e.target.value }))}
                >
                  <option value="">— No mapear —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={reiniciar}>Cancelar</button>
            <button className="btn btn-primary" disabled={!mapeoCompleto || procesando} onClick={handleProcesar}>
              {procesando ? 'Calculando diff…' : 'Procesar y Calcular Diff'}
            </button>
          </div>
        </div>
      )}

      {(fase === 'diff' || fase === 'aplicado') && (
        <>
          <div className="cub-resumen-bar">
            {(['nueva', 'modificada', 'ausente', 'sin_cambio', 'error'] as Accion[]).map((a) => {
              const n = resumen?.[RESUMEN_KEY[a]] ?? filas.filter((f) => f.accion === a).length;
              return (
                <button
                  key={a}
                  className={`cub-chip ${filtroAccion === a ? 'active' : ''}`}
                  style={{ borderColor: ACCION_META[a].color, color: ACCION_META[a].color }}
                  onClick={() => setFiltroAccion(filtroAccion === a ? 'todas' : a)}
                >
                  {ACCION_META[a].label}: {n}
                </button>
              );
            })}
            {resumen?.n_conflictos ? <span className="cub-conflicto-tag">⚠️ {resumen.n_conflictos} conflicto(s) bloqueante(s)</span> : null}
          </div>

          <div className="rev-layout">
            <div className="rev-panel-list">
              <div className="panel-actions">
                <span>Filas ({filasFiltradas.length})</span>
              </div>
              <div className="propuestas-list">
                {filasFiltradas.map((f) => (
                  <div
                    key={f.id}
                    className={`propuesta-item ${f.id === seleccionadaId ? 'selected' : ''} ${f.aprobada === true ? 'aprobada' : f.aprobada === false && f.accion !== 'sin_cambio' ? 'rechazada' : ''}`}
                    onClick={() => setSeleccionadaId(f.id)}
                  >
                    <div className="propuesta-item-header">
                      <span className="propuesta-tabla" style={{ color: ACCION_META[f.accion ?? 'sin_cambio'].color }}>
                        {ACCION_META[f.accion ?? 'sin_cambio'].label}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Fila {Math.abs(f.nro_fila)}</span>
                    </div>
                    <div className="propuesta-item-key">Clave: <strong>{f.clave_natural ?? '—'}</strong></div>
                    {(f.accion === 'nueva' || f.accion === 'modificada' || f.accion === 'ausente') && !f.error_detalle?.startsWith('CONFLICTO') && (
                      <div className="propuesta-item-actions">
                        <button className="btn-pill btn-pill-approve" onClick={(e) => { e.stopPropagation(); handleAprobarFila(f, true); }}>✓ Aprobar</button>
                        <button className="btn-pill btn-pill-reject" onClick={(e) => { e.stopPropagation(); handleAprobarFila(f, false); }}>✗ Rechazar</button>
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
                    <h3>Fila {Math.abs(seleccionada.nro_fila)} — {seleccionada.clave_natural ?? 'sin clave'}</h3>
                    <span className="badge" style={{ backgroundColor: ACCION_META[seleccionada.accion ?? 'sin_cambio'].color, color: '#0f172a' }}>
                      {ACCION_META[seleccionada.accion ?? 'sin_cambio'].label}
                    </span>
                  </div>

                  {seleccionada.error_detalle && (
                    <div className={seleccionada.error_detalle.startsWith('CONFLICTO') ? 'cub-conflicto-box' : 'cub-error-box'}>
                      {seleccionada.error_detalle}
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
                    <h4>Datos del archivo</h4>
                    <pre className="payload-json">{JSON.stringify(seleccionada.payload, null, 2)}</pre>
                  </div>
                </div>
              ) : (
                <div className="empty-detail"><p>Selecciona una fila para ver su detalle.</p></div>
              )}
            </div>
          </div>

          <div className="rev-footer-bar">
            <div className="rev-summary">
              Estado del lote: <strong>{estadoLote}</strong>
              {hayConflictoAprobado && <span style={{ color: '#f87171', marginLeft: 12 }}>Hay conflictos aprobados — no se puede aplicar.</span>}
              {hayPendientesAusentes && <span style={{ color: '#eab308', marginLeft: 12 }}>Hay filas ausentes pendientes de decisión.</span>}
            </div>
            {fase === 'diff' ? (
              <button
                className="btn btn-primary btn-lg"
                disabled={aplicando || estadoLote !== 'diff_listo' || hayConflictoAprobado}
                onClick={handleAplicarLote}
              >
                {aplicando ? 'Aplicando…' : 'Aprobar y Aplicar'}
              </button>
            ) : (
              <button className="btn btn-success btn-lg" onClick={reiniciar}>✓ Aplicado — Importar otra planilla</button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CubicadorImport;

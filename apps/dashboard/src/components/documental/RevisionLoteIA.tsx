import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';
import { useHeaderActions } from '../../hooks/useHeaderActions';

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

const ACCION_META: Record<Accion, { label: string; color: string; border: string; bg: string }> = {
  nueva: { label: 'Nueva', color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
  modificada: { label: 'Modificada', color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
  sin_cambio: { label: 'Sin cambio', color: 'text-slate-400', border: 'border-slate-500/20', bg: 'bg-slate-500/5' },
  error: { label: 'Error', color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/5' },
};

const getConfianzaColor = (conf: number | null) => {
  if (conf == null) return 'bg-slate-500';
  if (conf >= 0.95) return 'bg-emerald-500 shadow-emerald-500/50';
  if (conf >= 0.8) return 'bg-amber-500 shadow-amber-500/50';
  return 'bg-rose-500 shadow-rose-500/50';
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
      <div className="flex-grow p-6 flex justify-center items-center text-sm text-muted-foreground font-medium gap-2 bg-background text-foreground font-sans">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
        <span>Cargando propuestas…</span>
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="flex-grow p-6 space-y-6 bg-background text-foreground font-sans">
        <div className="flex justify-between items-center border-b border-border pb-4 mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight">Revisión de Extracción Asistida por IA</h2>
        </div>
        <p className="text-sm text-muted-foreground">Este documento todavía no tiene propuestas de catálogos generadas.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-6 space-y-4 bg-background text-foreground font-sans flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Revisión de Extracción Asistida por IA</h2>
          <p className="text-xs text-muted-foreground mt-1">Verifica los datos propuestos por Gemini antes de insertarlos en el catálogo del proyecto. (Documento: {docTitulo})</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-lg text-xs text-red-400 leading-relaxed shrink-0">
          ⚠️ {error}
        </div>
      )}

      {lotes.length > 1 && (
        <div className="flex gap-2 shrink-0">
          {lotes.map((l) => (
            <Button
              key={l.id}
              onClick={() => setLoteActivoId(l.id)}
              variant={l.id === loteActivoId ? 'primary' : 'secondary'}
              size="sm"
            >
              {TABLA_LABEL[l.tabla_destino]} {l.estado === 'aplicado' ? '✓' : ''}
            </Button>
          ))}
        </div>
      )}

      {loteActivo && (
        <div className="grid grid-cols-12 gap-4 flex-grow overflow-hidden min-h-0">
          {/* Panel Izquierdo: Lista de propuestas */}
          <div className="col-span-4 border border-border bg-panel rounded-xl flex flex-col overflow-hidden">
            <div className="p-3 bg-card border-b border-border text-xs font-bold text-white flex justify-between items-center shrink-0">
              <span>Propuestas — {TABLA_LABEL[loteActivo.tabla_destino]} ({filas.length})</span>
            </div>

            <div className="flex-grow overflow-y-auto p-3 space-y-2">
              {filas.map((f) => (
                <div
                  key={f.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:border-accent transition-all text-xs space-y-2
                    ${f.id === seleccionadaId ? 'border-accent bg-accent/5' : 'border-border/60 bg-card/40'}
                    ${f.aprobada === true ? 'border-emerald-500/60 bg-emerald-500/5' : f.aprobada === false && f.accion !== 'sin_cambio' ? 'border-rose-500/60 bg-rose-500/5' : ''}`}
                  onClick={() => setSeleccionadaId(f.id)}
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className={`font-bold ${ACCION_META[f.accion ?? 'sin_cambio'].color}`}>
                      {ACCION_META[f.accion ?? 'sin_cambio'].label.toUpperCase()}
                    </span>
                    {f.confianza != null && (
                      <span
                        className={`w-2.5 h-2.5 rounded-full inline-block ${getConfianzaColor(f.confianza)}`}
                        title={`${Math.round(f.confianza * 100)}% de confianza`}
                      />
                    )}
                  </div>
                  <div className="text-white font-medium">Clave: <strong className="text-accent">{f.clave_natural ?? '—'}</strong></div>
                  
                  {loteActivo.estado === 'diff_listo' && (f.accion === 'nueva' || f.accion === 'modificada') && (
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleAprobarFila(f, true); }}
                      >
                        Aprobar
                      </button>
                      <button
                        className="px-2 py-0.5 rounded text-[10px] font-bold border bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleAprobarFila(f, false); }}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panel Derecho: Detalle de propuesta */}
          <div className="col-span-8 border border-border bg-panel rounded-xl flex flex-col overflow-hidden">
            {seleccionada ? (
              <div className="p-6 space-y-5 overflow-y-auto h-full">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <h3 className="text-base font-extrabold text-white tracking-tight">{seleccionada.clave_natural ?? 'Sin clave'}</h3>
                  {seleccionada.confianza != null && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border text-white/95 ${getConfianzaColor(seleccionada.confianza)}`}>
                      IA Confianza: {Math.round(seleccionada.confianza * 100)}%
                    </span>
                  )}
                </div>

                {seleccionada.error_detalle && (
                  <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-lg text-xs text-red-400 leading-relaxed">
                    {seleccionada.error_detalle}
                  </div>
                )}

                {seleccionada.fuente?.contexto && (
                  <div className="bg-card border border-border/80 rounded-xl overflow-hidden">
                    <div className="p-3 bg-panel border-b border-border text-[10px] font-bold text-white">
                      📖 Origen del PDF: Página(s) {(seleccionada.fuente.paginas ?? []).join(', ') || '—'}
                    </div>
                    <div className="p-3 text-xs leading-relaxed text-muted-foreground italic bg-card/30">
                      "{seleccionada.fuente.contexto}"
                    </div>
                  </div>
                )}

                {seleccionada.diff && Object.keys(seleccionada.diff).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Comparación de Cambios</h4>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full border-collapse text-xs text-left">
                        <thead>
                          <tr className="bg-card/85 text-white font-semibold border-b border-border">
                            <th className="p-2.5">Campo</th>
                            <th className="p-2.5">Antes</th>
                            <th className="p-2.5">Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(seleccionada.diff).map(([campo, v]) => (
                            <tr key={campo} className="border-b border-border/40 font-medium">
                              <td className="p-2.5 text-white font-bold">{campo}</td>
                              <td className="p-2.5 text-rose-400 line-through bg-rose-500/5">{v.antes ?? '—'}</td>
                              <td className="p-2.5 text-emerald-400 bg-emerald-500/5 font-semibold">{v.despues ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="bg-card border border-border/80 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Datos Propuestos Finales</h4>
                  <pre className="bg-panel border border-border/60 p-3 rounded-lg text-[10px] text-accent font-mono overflow-x-auto">
                    {JSON.stringify(
                      Object.fromEntries(campos.map((c) => [c.label, seleccionada.payload[c.campo] ?? null])),
                      null, 2
                    )}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-full text-xs text-muted-foreground">
                Selecciona una propuesta de la lista de la izquierda para auditar sus detalles.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer bar */}
      <div className="flex justify-between items-center bg-panel border border-border p-4 rounded-xl shrink-0 mt-2">
        <div className="text-xs text-muted-foreground flex gap-4 font-medium">
          {lotes.map((l) => (
            <span key={l.id}>
              {TABLA_LABEL[l.tabla_destino]}: <strong className="text-white uppercase">{l.estado}</strong>
            </span>
          ))}
        </div>
        {!todosAplicados ? (
          <Button
            variant="primary"
            size="sm"
            disabled={aplicando || !loteActivo || loteActivo.estado !== 'diff_listo'}
            onClick={handleAplicarLote}
          >
            {aplicando ? 'Aplicando…' : `Aprobar y Aplicar Catálogo (${loteActivo ? TABLA_LABEL[loteActivo.tabla_destino] : ''})`}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleFinalizar}>
            Todo Aplicado — Finalizar Auditoría
          </Button>
        )}
      </div>
    </div>
  );
};
export default RevisionLoteIA;

import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { sanitizarNombreArchivo } from '../../lib/storagePath';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

type TablaDestino = 'list_lineas' | 'list_mto' | 'list_isos' | 'list_spools' | 'list_juntas';
type Accion = 'nueva' | 'modificada' | 'ausente' | 'sin_cambio' | 'error';
type Fase = 'conexiones' | 'sync_modal' | 'diff' | 'aplicado';

interface CampoCanonico {
  campo: string;
  label: string;
  requerido?: boolean;
  alias: string[];
}

const CAMPOS_POR_TABLA: Record<TablaDestino, CampoCanonico[]> = {
  list_lineas: [
    { campo: 'id_linea', label: 'ID Línea', requerido: true, alias: ['id_linea', 'idlinea', 'linea', 'line_id', 'lineno', 'line_no', 'line_number', 'nlinea'] },
    { campo: 'descripcion', label: 'Descripción', alias: ['descripcion', 'description', 'desc'] },
    { campo: 'fluido_codigo', label: 'Fluido (código)', alias: ['fluido', 'fluido_codigo', 'servicio', 'fluid', 'service'] },
    { campo: 'clase_codigo', label: 'Clase piping (código)', alias: ['clase', 'clase_codigo', 'class', 'pipingclass', 'clasepiping'] },
    { campo: 'nps_texto', label: 'NPS / Diámetro', alias: ['nps', 'diametro', 'size', 'npstexto'] },
    { campo: 'longitud_total', label: 'Longitud total', alias: ['longitud', 'longitudtotal', 'length', 'metros', 'lengthtotal', 'mts'] },
  ],
  list_mto: [
    { campo: 'item', label: 'Ítem', requerido: true, alias: ['item', 'itemno', 'nitem', 'itemnumber', 'id_mto'] },
    { campo: 'id_linea', label: 'ID Línea', alias: ['id_linea', 'idlinea', 'linea', 'lineid', 'lineno'] },
    { campo: 'descripcion', label: 'Descripción', alias: ['descripcion', 'description', 'desc'] },
    { campo: 'tag', label: 'Tag', alias: ['tag'] },
    { campo: 'cantidad', label: 'Cantidad', alias: ['cantidad', 'qty', 'quantity', 'cant'] },
    { campo: 'unidad', label: 'Unidad', alias: ['unidad', 'unit', 'uom'] },
    { campo: 'nps_texto', label: 'NPS / Diámetro', alias: ['nps', 'diametro', 'size', 'npstexto', 'diam.'] },
    { campo: 'clase_codigo', label: 'Clase piping (código)', alias: ['clase', 'clase_codigo', 'class', 'pipingclass'] },
    { campo: 'material', label: 'Material', alias: ['material', 'mat'] },
    { campo: 'norma', label: 'Norma', alias: ['norma', 'standard', 'spec'] },
    { campo: 'schedule', label: 'Schedule', alias: ['schedule', 'sch'] },
    { campo: 'heat_number', label: 'N° Colada (Heat)', alias: ['heatnumber', 'heat', 'colada', 'ncolada'] },
  ],
  list_isos: [
    { campo: 'id_iso', label: 'ID Isométrico', requerido: true, alias: ['id_iso', 'idiso', 'iso', 'isometrico'] },
    { campo: 'id_linea', label: 'ID Línea', alias: ['id_linea', 'idlinea', 'linea'] },
    { campo: 'sheet', label: 'Sheet (Hoja)', alias: ['sheet', 'hoja', 'hojanumero'] },
    { campo: 'descripcion', label: 'Descripción', alias: ['descripcion', 'description', 'desc'] },
    { campo: 'revision', label: 'Revisión', alias: ['revision', 'rev'] },
    { campo: 'estado', label: 'Estado', alias: ['estado', 'status', 'estatus'] },
    { campo: 'pdf_path', label: 'PDF Path', alias: ['pdfpath', 'pdf', 'ruta'] },
  ],
  list_spools: [
    { campo: 'id_spool', label: 'ID Spool', requerido: true, alias: ['id_spool', 'idspool', 'spool', 'spoolno', 'spool_no'] },
    { campo: 'id_iso', label: 'ID Isométrico', alias: ['id_iso', 'idiso', 'iso'] },
    { campo: 'tag_gestion', label: 'Tag Gestión', alias: ['taggestion', 'tag', 'gestion', 'tag gestion'] },
    { campo: 'peso', label: 'Peso', alias: ['peso', 'weight', 'kgs', 'peso_total'] },
    { campo: 'longitud', label: 'Longitud', alias: ['longitud', 'length', 'largo'] },
    { campo: 'nro_juntas', label: 'N° Juntas', alias: ['nrojuntas', 'njuntas', 'juntas', 'cantjuntas', 'total uniones s'] },
    { campo: 'estado_montaje', label: 'Estado Montaje', alias: ['estado', 'estadomontaje', 'status', 'montaje'] },
    { campo: 'sector', label: 'Sector / Área', alias: ['sector', 'area'] },
  ],
  list_juntas: [
    { campo: 'id_spool', label: 'ID Spool', requerido: true, alias: ['id_spool', 'idspool', 'spool'] },
    { campo: 'numero_junta', label: 'N° Junta', requerido: true, alias: ['numero_junta', 'numerojunta', 'junta', 'juntano', 'jointno', 'joint_no', 'n union', 'nº union'] },
    { campo: 'tipo_union', label: 'Tipo Unión (código)', alias: ['tipo_union', 'tipounion', 'tipo', 'jointtype', 'weldtype', 'tipo union ', 'tipo union'] },
    { campo: 'nps_texto', label: 'NPS / Diámetro', alias: ['nps', 'diametro', 'size'] },
    { campo: 'proceso_soldadura', label: 'Proceso Soldadura', alias: ['proceso', 'procesosoldadura', 'wps', 'process', 'proceso'] },
    { campo: 'material_base', label: 'Material Base', alias: ['material_base', 'materialbase', 'matbase', 'material'] },
    { campo: 'requiere_pwht', label: 'Req. PWHT', alias: ['requiere_pwht', 'reqpwht', 'pwht'] },
    { campo: 'requiere_pmi', label: 'Req. PMI', alias: ['requiere_pmi', 'reqpmi', 'pmi'] },
    { campo: 'porcentaje_nde', label: '% NDE', alias: ['porcentaje_nde', 'nde', 'ndt', 'rt'] },
  ],
};

// Columnas específicas del piloto para generación de plantillas
const COLUMNAS_REALES: Record<TablaDestino, string[]> = {
  list_lineas: ['ID_LINEA', 'CLASE', 'NPS', 'SERVICIO', 'TIPO MATERIAL', 'PLANO_CODELCO', 'MTS', 'FROM', 'TO', 'TEMP_DISEÑO_C', 'PRESION_DISEÑO_KG', 'TIPO PRUEBA', 'ESQUEMA', 'RAL', 'REVESTIMIENTO INTERIOR', 'AISLACION', 'OBSERVACIONES'],
  list_mto: ['ID_MTO', 'TABLACUB', 'ITEM', 'EWP', 'CWP', 'CWA', 'PWP', 'ID_LINEA', 'ID_ISO', 'ID_SPOOL', 'CLASE', 'DESCRIPCION', 'DIAM.', 'CANTIDAD', 'UNIDAD', 'REVISADO', 'PESO_TOTAL', 'UNIDAD2', 'SUMINISTRO', 'GRUPO', 'PROVEEDOR', 'ORDEN_COMPRA', 'ETA_OBRA', 'RECEPCIONADO', 'SOLICITADO', 'DESPACHADO', 'USUARIO_COMPRA', 'REVISION_MAT', 'PRIORIDAD_FAB', 'CANT_REAL', 'UBICACION_ACTUAL', 'FECHA_CONTROL', 'OBSERV.'],
  list_isos: ['ID_ISO', 'ID_LINEA', 'SHEET', 'REV', 'PLANO_CONTRATISTA', 'PLANO_CODELCO', 'CLASE', 'NPS', 'INGENIERIA', 'CONDICION', 'SPOOLEADO', 'ESTATUS', 'DISTRIBUIDO', 'OBSERVACIONES'],
  list_spools: ['ID_SPOOL', 'TAG GESTION', 'ID_ISO', 'SISTEMA', 'SUB SISTEMA', 'TEST PACK', 'AREA', 'ID_LINEA', 'SHEET', 'REV', 'SPOOL', 'NPS', 'AISLACION', 'MATERIAL', 'NOMBRE SERVICIO', 'ESQUEMA', 'RAL', 'Total Uniones S', 'Avance Uniones S', 'RESPONSABLE', 'Proceso', 'Pintura / Revestimiento', 'Recibido', 'Posicionado', 'Montaje', 'Ubicación', 'TOTAL', 'OBSERV.'],
  list_juntas: ['ID_JUNTA', 'ID_SPOOL', 'ID_ISO', 'SISTEMA', 'SUB SISTEMA', 'TEST PACK', 'AREA', 'ID_LINEA', 'SHEET', 'REV', 'SPOOL', 'Nº UNION', 'DESTINATION', 'TIPO UNION ', 'NPS', 'SCH', 'CLASE', 'AISLACION', 'MATERIAL', 'MTS', 'NOMBRE SERVICIO', 'RESPONSABLE', 'EST.', 'OBSERV.']
};

const SH_NAMES: Record<TablaDestino, string> = {
  list_lineas: 'LIST_Lineas_MS_',
  list_mto: 'LIST_MTO_MS',
  list_isos: 'LIST_Isos_MS_',
  list_spools: 'LIST_Spools_MS_',
  list_juntas: 'LIST_Juntas_MS_'
};

const TAB_LABELS: Record<TablaDestino, string> = {
  list_lineas: 'Line List',
  list_mto: 'MTO (Material Take-Off)',
  list_isos: 'Isométricos',
  list_spools: 'Spools',
  list_juntas: 'Juntas'
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

interface ConnectionState {
  lastSync: string | null;
  status: 'Conectado' | 'Pendiente' | 'Sincronizando';
}

interface CubicadorImportProps {
  proyectoId: string;
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

const ACCION_META: Record<Accion, { label: string; bg: string; text: string }> = {
  nueva: { label: 'Nueva', bg: 'bg-emerald-500/10 border-emerald-500/25', text: 'text-emerald-400' },
  modificada: { label: 'Modificada', bg: 'bg-amber-500/10 border-amber-500/25', text: 'text-amber-400' },
  ausente: { label: 'Ausente', bg: 'bg-red-500/10 border-red-500/25', text: 'text-red-400' },
  sin_cambio: { label: 'Sin cambio', bg: 'bg-slate-500/10 border-slate-500/25', text: 'text-slate-400' },
  error: { label: 'Error', bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-400' },
};

export const CubicadorImport: React.FC<CubicadorImportProps> = ({ proyectoId }) => {
  const [fase, setFase] = useState<Fase>('conexiones');
  const [tablaDestino, setTablaDestino] = useState<TablaDestino>('list_lineas');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loteId, setLoteId] = useState<string | null>(null);
  const [estadoLote, setEstadoLote] = useState<string | null>(null);
  const [resumen, setResumen] = useState<LoteResumen | null>(null);
  const [filas, setFilas] = useState<FilaImport[]>([]);
  const [filtroAccion, setFiltroAccion] = useState<Accion | 'todas'>('todas');
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  // Estados de conexión locales (SharePoint mock persistente en localStorage)
  const [syncStates, setSyncStates] = useState<Record<TablaDestino, ConnectionState>>({
    list_lineas: { lastSync: null, status: 'Pendiente' },
    list_mto: { lastSync: null, status: 'Pendiente' },
    list_isos: { lastSync: null, status: 'Pendiente' },
    list_spools: { lastSync: null, status: 'Pendiente' },
    list_juntas: { lastSync: null, status: 'Pendiente' }
  });

  const baseFolder = "C:\\Users\\CristianLukeCabello\\EISA\\EIMI00413 - Andina - 2 - Espesador de Concentrado Colectivo PMFC - CODELCO - 2025\n\\1 - APP\\1_Tablas_MS\\LIST";

  useEffect(() => {
    const saved = localStorage.getItem(`sync_states_${proyectoId}`);
    if (saved) {
      try { setSyncStates(JSON.parse(saved)); } catch (e) {}
    }
  }, [proyectoId]);

  const saveSyncState = (table: TablaDestino, state: ConnectionState) => {
    const updated = { ...syncStates, [table]: state };
    setSyncStates(updated);
    localStorage.setItem(`sync_states_${proyectoId}`, JSON.stringify(updated));
  };

  const handleDescargarPlantilla = (table: TablaDestino) => {
    const cols = COLUMNAS_REALES[table];
    const sheetName = SH_NAMES[table];
    
    // Crear datos con la primera fila conteniendo las columnas
    const data = [cols];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Escribir y descargar
    XLSX.writeFile(wb, `${sheetName}_plantilla.xlsx`);
  };

  const handleArchivoSeleccionado = async (file: File) => {
    setError(null);
    setArchivo(file);
    setProcesando(true);
    
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      
      const expectedSheet = SH_NAMES[tablaDestino];
      let hoja = wb.Sheets[expectedSheet];
      
      // Fallback si no tiene el nombre exacto del piloto
      if (!hoja) {
        hoja = wb.Sheets[wb.SheetNames[0]];
        console.warn(`Hoja '${expectedSheet}' no encontrada. Usando primera hoja: '${wb.SheetNames[0]}'`);
      }
      
      const filasRaw: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
      if (filasRaw.length < 2) {
        throw new Error('La planilla no tiene filas de datos.');
      }
      
      const encabezados = (filasRaw[0] as string[]).map((h) => String(h ?? '').trim());
      const datos = filasRaw.slice(1)
        .filter((fila) => fila.some((c) => String(c ?? '').trim() !== ''))
        .map((fila) => {
          const obj: Record<string, unknown> = {};
          encabezados.forEach((h, i) => { obj[h] = fila[i]; });
          return obj;
        });

      // Auto-mapeo estricto basado en campos canónicos y alias del piloto
      const campos = CAMPOS_POR_TABLA[tablaDestino];
      const mapeoCalculado: Record<string, string> = {};
      for (const c of campos) {
        const encontrado = encabezados.find((h) => c.alias.includes(normalizar(h)));
        if (encontrado) {
          mapeoCalculado[c.campo] = encontrado;
        } else if (c.requerido) {
          // Intentar coincidencia directa insensible
          const directa = encabezados.find(h => normalizar(h) === normalizar(c.campo));
          if (directa) mapeoCalculado[c.campo] = directa;
        }
      }

      // Validar mapeo de campos requeridos
      const faltantes = campos.filter(c => c.requerido && !mapeoCalculado[c.campo]);
      if (faltantes.length > 0) {
        throw new Error(`Columnas requeridas no encontradas en el archivo: ${faltantes.map(f => f.label).join(', ')}. Por favor descarga la plantilla de referencia.`);
      }

      // Preparar payload
      const filasPayload = datos.map((fila) => {
        const payload: Record<string, string> = {};
        for (const c of campos) {
          const header = mapeoCalculado[c.campo];
          const valor = header ? fila[header] : undefined;
          payload[c.campo] = valor === undefined || valor === null ? '' : String(valor).trim();
        }
        
        if (tablaDestino === 'list_juntas') {
          payload['id_junta'] = `${payload['id_spool']}_${payload['numero_junta']}`;
        }
        return payload;
      });

      const hash = await hashArchivo(buf);
      const storagePath = `${proyectoId}/cubicador/${tablaDestino}/${Date.now()}_${sanitizarNombreArchivo(file.name)}`;

      // Guardar archivo original en bucket de auditoría
      const { error: errUpload } = await supabase.storage.from('importaciones').upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (errUpload) throw errUpload;

      // Crear transacción de lote
      const { data: nuevoLoteId, error: errRpc } = await supabase.rpc('importar_crear_lote', {
        p_proyecto_id: proyectoId,
        p_tabla_destino: tablaDestino,
        p_archivo_nombre: file.name,
        p_hash_archivo: hash,
        p_storage_path: storagePath,
        p_mapeo: mapeoCalculado,
        p_filas: filasPayload,
      });
      if (errRpc) throw errRpc;

      setLoteId(nuevoLoteId as string);
      await cargarLote(nuevoLoteId as string);
      setFase('diff');
    } catch (e: any) {
      setError(e.message || 'Error al procesar el archivo Excel.');
      setArchivo(null);
    } finally {
      setProcesando(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleArchivoSeleccionado(file);
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
      
      // Registrar última sincronización exitosa
      saveSyncState(tablaDestino, {
        status: 'Conectado',
        lastSync: new Date().toLocaleString('es-CL')
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aplicar los datos.');
    } finally {
      setAplicando(false);
    }
  };

  const reiniciar = () => {
    setFase('conexiones');
    setArchivo(null);
    setLoteId(null);
    setEstadoLote(null);
    setResumen(null);
    setFilas([]);
    setSeleccionadaId(null);
    setError(null);
  };

  // Simulación de sync directa para mock/demo
  const handleSimularSyncDirecta = () => {
    setProcesando(true);
    setError(null);
    setTimeout(() => {
      setProcesando(false);
      setError('Simulación exitosa: Para procesar los datos reales, arrastra el archivo de tu OneDrive.');
    }, 1500);
  };

  const filasFiltradas = filtroAccion === 'todas' ? filas : filas.filter((f) => f.accion === filtroAccion);
  const seleccionada = filas.find((f) => f.id === seleccionadaId) ?? null;
  const hayConflictoAprobado = filas.some((f) => f.aprobada && f.error_detalle?.startsWith('CONFLICTO'));
  const hayPendientesAusentes = filas.some((f) => f.accion === 'ausente' && f.aprobada === false && !f.error_detalle?.startsWith('CONFLICTO'));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 font-sans text-foreground">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 mb-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white tracking-tight">Conexión de Datos (SharePoint / OneDrive)</h1>
          <p className="text-muted text-xs mt-1">
            Visualiza y sincroniza las tablas de control del cubicador de solo lectura desde tu carpeta OneDrive.
          </p>
        </div>
        {fase !== 'conexiones' && (
          <Button variant="outline" size="sm" onClick={reiniciar}>
            ← Volver a Conexiones
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 text-red-400 text-xs mb-6">
          ⚠️ {error}
        </div>
      )}

      {/* FASE 1: TABLA DE CONEXIONES */}
      {fase === 'conexiones' && (
        <div className="flex flex-col gap-6">
          {/* Carpeta Sincronizada Info */}
          <Card className="bg-panel/20 border-border">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Carpeta de SharePoint Sincronizada</h4>
                  <code className="text-[10px] text-accent block mt-1 break-all bg-background/50 p-1.5 rounded border border-border/40 font-mono">
                    {baseFolder}
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400">Canal Activo (Excel Online)</span>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de listas */}
          <div className="overflow-x-auto border border-border rounded-xl bg-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-panel/40 border-b border-border/80 text-muted uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4">Lista Operativa</th>
                  <th className="p-4">Archivo Origen (SharePoint)</th>
                  <th className="p-4">Hoja Origen</th>
                  <th className="p-4 w-32">Estado</th>
                  <th className="p-4 w-48">Última Sincronización</th>
                  <th className="p-4 w-52 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(Object.keys(CAMPOS_POR_TABLA) as TablaDestino[]).map((tabKey) => {
                  const state = syncStates[tabKey];
                  return (
                    <tr key={tabKey} className="hover:bg-panel/10">
                      <td className="p-4 font-semibold text-white">
                        {TAB_LABELS[tabKey]}
                        <span className="text-[10px] text-muted block font-normal mt-0.5">{tabKey}</span>
                      </td>
                      <td className="p-4 text-muted font-mono text-[11px]">LIST_Piping_MS.xlsx</td>
                      <td className="p-4 text-accent font-mono text-[11px]">{SH_NAMES[tabKey]}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 ${
                          state.status === 'Conectado'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${state.status === 'Conectado' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {state.status}
                        </span>
                      </td>
                      <td className="p-4 text-muted/70 text-[11px]">{state.lastSync || 'Sin sincronizaciones'}</td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setTablaDestino(tabKey);
                            setFase('sync_modal');
                          }}
                        >
                          Sincronizar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Descargar Plantilla Excel"
                          onClick={() => handleDescargarPlantilla(tabKey)}
                        >
                          ⇩ Plantilla
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FASE 2: DETALLE / SYNC MODAL */}
      {fase === 'sync_modal' && (
        <Card className="bg-panel/40 border-border max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-white text-base font-bold">
              Sincronizar {TAB_LABELS[tablaDestino]}
            </CardTitle>
            <p className="text-muted text-xs">
              Conectando a SharePoint para actualizar los registros de forma automática.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="bg-background/40 border border-border/60 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-muted uppercase">Conexión SharePoint Sincronizada</span>
              <div className="flex flex-col gap-1 text-xs text-foreground/80">
                <div>• Archivo: <code className="text-accent font-mono">LIST_Piping_MS.xlsx</code></div>
                <div>• Hoja: <code className="text-accent font-mono">{SH_NAMES[tablaDestino]}</code></div>
              </div>
            </div>

            {/* Dropzone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-panel/10 ${
                procesando ? 'border-accent bg-panel/5' : 'border-border'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('cub-file-input')?.click()}
            >
              <div className="text-3xl mb-2">🔄</div>
              <p className="text-sm font-semibold text-white text-center">
                Arrastra el archivo Excel aquí para iniciar lectura
              </p>
              <span className="text-[10px] text-muted text-center mt-1 max-w-xs leading-relaxed">
                Selecciona el archivo de tu carpeta sincronizada de OneDrive. La app extraerá la pestaña <code className="text-white bg-card px-1 py-0.5 rounded font-mono">{SH_NAMES[tablaDestino]}</code> automáticamente.
              </span>
              <input
                id="cub-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArchivoSeleccionado(f); }}
              />
            </div>

            <div className="flex justify-between items-center border-t border-border/40 pt-4">
              <Button variant="ghost" onClick={reiniciar}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                disabled={procesando}
                onClick={handleSimularSyncDirecta}
              >
                {procesando ? 'Conectando…' : 'Simular Sync SharePoint'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FASE 3: DIFF Y APROBACIÓN */}
      {(fase === 'diff' || fase === 'aplicado') && (
        <div className="flex flex-col gap-6">
          <div className="bg-panel/20 p-4 border border-border rounded-xl flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Resumen de Diferencias: {TAB_LABELS[tablaDestino]}
              </h3>
              <p className="text-muted text-[10px] mt-0.5">Archivo: {archivo?.name}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['nueva', 'modificada', 'ausente', 'sin_cambio', 'error'] as Accion[]).map((a) => {
                const n = resumen?.[RESUMEN_KEY[a]] ?? filas.filter((f) => f.accion === a).length;
                return (
                  <button
                    key={a}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      filtroAccion === a
                        ? 'bg-accent border-accent text-white shadow-md'
                        : `${ACCION_META[a].bg} ${ACCION_META[a].text} hover:bg-panel/20`
                    }`}
                    onClick={() => setFiltroAccion(filtroAccion === a ? 'todas' : a)}
                  >
                    {ACCION_META[a].label}: {n}
                  </button>
                );
              })}
              {resumen?.n_conflictos ? (
                <span className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full text-[10px] font-bold">
                  ⚠️ {resumen.n_conflictos} conflicto(s)
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de Filas */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs text-muted px-1">
                <span>Filas ({filasFiltradas.length})</span>
                {fase === 'diff' && (
                  <span className="text-[10px]">Aprueba/Rechaza ítems individuales</span>
                )}
              </div>
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                {filasFiltradas.map((f) => (
                  <div
                    key={f.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:bg-panel/25 ${
                      f.id === seleccionadaId ? 'border-accent bg-panel/30' : 'border-border/60 bg-panel/10'
                    } ${
                      f.aprobada === true ? 'border-l-4 border-l-emerald-500' :
                      f.aprobada === false && f.accion !== 'sin_cambio' ? 'border-l-4 border-l-red-500' : ''
                    }`}
                    onClick={() => setSeleccionadaId(f.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-extrabold uppercase ${ACCION_META[f.accion ?? 'sin_cambio'].text}`}>
                        {ACCION_META[f.accion ?? 'sin_cambio'].label}
                      </span>
                      <span className="text-[10px] text-muted font-mono">Fila {Math.abs(f.nro_fila)}</span>
                    </div>
                    <div className="text-xs text-white font-semibold truncate mb-2">
                      Clave: {f.clave_natural || '—'}
                    </div>
                    {fase === 'diff' && (f.accion === 'nueva' || f.accion === 'modificada' || f.accion === 'ausente') && !f.error_detalle?.startsWith('CONFLICTO') && (
                      <div className="flex gap-2 mt-2">
                        <button
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold px-2.5 py-1 rounded"
                          onClick={(e) => { e.stopPropagation(); handleAprobarFila(f, true); }}
                        >
                          Aprobar
                        </button>
                        <button
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[9px] font-extrabold px-2.5 py-1 rounded"
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

            {/* Detalle de Fila Seleccionada */}
            <div className="lg:col-span-7">
              {seleccionada ? (
                <div className="bg-panel/40 border border-border rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-border/40 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Fila {Math.abs(seleccionada.nro_fila)}
                      </h3>
                      <span className="text-xs text-muted block mt-0.5">Clave: {seleccionada.clave_natural || 'sin clave'}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      seleccionada.accion === 'nueva' ? 'bg-emerald-500/10 text-emerald-400' :
                      seleccionada.accion === 'modificada' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {ACCION_META[seleccionada.accion ?? 'sin_cambio'].label}
                    </span>
                  </div>

                  {seleccionada.error_detalle && (
                    <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                      seleccionada.error_detalle.startsWith('CONFLICTO')
                        ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400'
                        : 'bg-red-500/10 border border-red-500/25 text-red-400'
                    }`}>
                      <strong>{seleccionada.error_detalle.startsWith('CONFLICTO') ? 'Alerta de conflicto:' : 'Error detectado:'}</strong>
                      <p className="mt-1">{seleccionada.error_detalle}</p>
                    </div>
                  )}

                  {/* Diff Table */}
                  {seleccionada.diff && Object.keys(seleccionada.diff).length > 0 && (
                    <div className="overflow-x-auto border border-border rounded-lg bg-card">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-panel/40 border-b border-border/80 text-muted uppercase text-[9px] font-bold">
                            <th className="p-3">Campo</th>
                            <th className="p-3">Antes (Base de Datos)</th>
                            <th className="p-3">Después (Archivo)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {Object.entries(seleccionada.diff).map(([campo, v]) => (
                            <tr key={campo} className="hover:bg-panel/5">
                              <td className="p-3 font-semibold text-white">{campo}</td>
                              <td className="p-3 text-red-400/90 line-through font-mono">{v.antes ?? '—'}</td>
                              <td className="p-3 text-emerald-400 font-semibold font-mono">{v.despues ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Fila Completa */}
                  <div className="bg-card border border-border rounded-lg p-4">
                    <span className="text-[9px] font-bold text-muted uppercase block mb-2">Datos completos en archivo</span>
                    <pre className="text-[10px] text-foreground/90 font-mono bg-background/50 p-3 rounded border border-border/30 overflow-x-auto max-h-48 leading-relaxed">
                      {JSON.stringify(seleccionada.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="bg-panel/10 border border-border border-dashed rounded-xl p-12 text-center text-muted text-xs">
                  Selecciona una fila para ver el detalle de los cambios.
                </div>
              )}
            </div>
          </div>

          {/* Footer del Lote */}
          <div className="bg-panel/40 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
            <div className="text-xs text-muted flex flex-col gap-1">
              <div>Estado de transacción: <strong className="text-white uppercase font-mono">{estadoLote}</strong></div>
              {hayConflictoAprobado && (
                <span className="text-red-400 font-medium">✕ Hay conflictos aprobados pendientes. Resuélvelos para poder aplicar.</span>
              )}
              {hayPendientesAusentes && (
                <span className="text-amber-400 font-medium">⚠ Hay ítems ausentes pendientes de aprobación/rechazo.</span>
              )}
            </div>

            {fase === 'diff' ? (
              <Button
                variant="primary"
                disabled={aplicando || estadoLote !== 'diff_listo' || hayConflictoAprobado}
                onClick={handleAplicarLote}
              >
                {aplicando ? 'Aplicando transacciones…' : 'Confirmar y Sincronizar en BD'}
              </Button>
            ) : (
              <Button variant="primary" onClick={reiniciar}>
                Sincronización Aplicada Correctamente
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CubicadorImport;

import React, { useState, useEffect } from 'react';
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
    { campo: 'proceso_soldadura', label: 'Proceso Soldadura', alias: ['proceso', 'procesosoldadura', 'wps', 'process'] },
    { campo: 'material_base', label: 'Material Base', alias: ['material_base', 'materialbase', 'matbase', 'material'] },
    { campo: 'requiere_pwht', label: 'Req. PWHT', alias: ['requiere_pwht', 'reqpwht', 'pwht'] },
    { campo: 'requiere_pmi', label: 'Req. PMI', alias: ['requiere_pmi', 'reqpmi', 'pmi'] },
    { campo: 'porcentaje_nde', label: '% NDE', alias: ['porcentaje_nde', 'nde', 'ndt', 'rt'] },
  ],
};

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

interface TablaProcesada {
  loteId: string;
  estado: string;
  resumen: LoteResumen;
  filas: FilaImport[];
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
  const [progresoSync, setProgresoSync] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Estados de datos de múltiples tablas procesadas
  const [tablasProcesadas, setTablasProcesadas] = useState<Record<TablaDestino, TablaProcesada | null>>({
    list_lineas: null,
    list_mto: null,
    list_isos: null,
    list_spools: null,
    list_juntas: null
  });

  // Fila seleccionada por tabla
  const [seleccionadas, setSeleccionadas] = useState<Record<TablaDestino, string | null>>({
    list_lineas: null,
    list_mto: null,
    list_isos: null,
    list_spools: null,
    list_juntas: null
  });

  const [filtroAccion, setFiltroAccion] = useState<Accion | 'todas'>('todas');
  const [aplicando, setAplicando] = useState(false);

  // Estados de conexión locales (SharePoint mock persistente en localStorage)
  const [syncStates, setSyncStates] = useState<Record<TablaDestino, ConnectionState>>({
    list_lineas: { lastSync: null, status: 'Pendiente' },
    list_mto: { lastSync: null, status: 'Pendiente' },
    list_isos: { lastSync: null, status: 'Pendiente' },
    list_spools: { lastSync: null, status: 'Pendiente' },
    list_juntas: { lastSync: null, status: 'Pendiente' }
  });

  const baseFolder = "C:\\Users\\CristianLukeCabello\\EISA\\EIMI00413 - Andina - 2 - Espesador de Concentrado Colectivo PMFC - CODELCO - 2025\\1 - APP\\1_Tablas_MS\\LIST";

  useEffect(() => {
    const saved = localStorage.getItem(`sync_states_${proyectoId}`);
    if (saved) {
      try { setSyncStates(JSON.parse(saved)); } catch (e) {}
    }
  }, [proyectoId]);

  const saveSyncState = (table: TablaDestino, state: ConnectionState) => {
    setSyncStates((prev) => {
      const updated = { ...prev, [table]: state };
      localStorage.setItem(`sync_states_${proyectoId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleDescargarPlantilla = (table: TablaDestino) => {
    const cols = COLUMNAS_REALES[table];
    const sheetName = SH_NAMES[table];
    const data = [cols];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_plantilla.xlsx`);
  };

  const processSingleSheet = async (
    wb: XLSX.WorkBook,
    tableKey: TablaDestino,
    fileName: string,
    hash: string,
    storagePath: string
  ): Promise<TablaProcesada | null> => {
    const expectedSheet = SH_NAMES[tableKey];
    const hoja = wb.Sheets[expectedSheet];
    if (!hoja) {
      console.warn(`Hoja '${expectedSheet}' no encontrada en el libro. Omitiendo.`);
      return null;
    }

    const filasRaw: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
    if (filasRaw.length < 2) {
      console.warn(`La hoja '${expectedSheet}' no tiene filas de datos. Omitiendo.`);
      return null;
    }

    const encabezados = (filasRaw[0] as string[]).map((h) => String(h ?? '').trim());
    const datos = filasRaw.slice(1)
      .filter((fila) => fila.some((c) => String(c ?? '').trim() !== ''))
      .map((fila) => {
        const obj: Record<string, unknown> = {};
        encabezados.forEach((h, i) => { obj[h] = fila[i]; });
        return obj;
      });

    const campos = CAMPOS_POR_TABLA[tableKey];
    const mapeoCalculado: Record<string, string> = {};
    for (const c of campos) {
      const encontrado = encabezados.find((h) => c.alias.includes(normalizar(h)));
      if (encontrado) {
        mapeoCalculado[c.campo] = encontrado;
      } else if (c.requerido) {
        const directa = encabezados.find(h => normalizar(h) === normalizar(c.campo));
        if (directa) mapeoCalculado[c.campo] = directa;
      }
    }

    // Validar mapeo de campos requeridos
    const faltantes = campos.filter(c => c.requerido && !mapeoCalculado[c.campo]);
    if (faltantes.length > 0) {
      throw new Error(`En la pestaña '${expectedSheet}', faltan columnas requeridas: ${faltantes.map(f => f.label).join(', ')}.`);
    }

    // Preparar payload
    const filasPayload = datos.map((fila) => {
      const payload: Record<string, string> = {};
      for (const c of campos) {
        const header = mapeoCalculado[c.campo];
        const valor = header ? fila[header] : undefined;
        payload[c.campo] = valor === undefined || valor === null ? '' : String(valor).trim();
      }
      
      if (tableKey === 'list_juntas') {
        payload['id_junta'] = `${payload['id_spool']}_${payload['numero_junta']}`;
      }
      return payload;
    });

    // Crear transacción de lote en base de datos
    const { data: nuevoLoteId, error: errRpc } = await supabase.rpc('importar_crear_lote', {
      p_proyecto_id: proyectoId,
      p_tabla_destino: tableKey,
      p_archivo_nombre: fileName,
      p_hash_archivo: hash,
      p_storage_path: storagePath,
      p_mapeo: mapeoCalculado,
      p_filas: filasPayload,
    });
    if (errRpc) throw errRpc;

    // Cargar datos del lote creado
    const { data: lote, error: errLote } = await supabase
      .from('import_lotes').select('estado, resumen').eq('id', nuevoLoteId).single();
    if (errLote) throw errLote;

    const { data: filasData, error: errFilas } = await supabase
      .from('import_filas').select('*').eq('lote_id', nuevoLoteId).order('nro_fila');
    if (errFilas) throw errFilas;

    return {
      loteId: nuevoLoteId as string,
      estado: lote.estado,
      resumen: lote.resumen as LoteResumen,
      filas: (filasData as FilaImport[]) ?? []
    };
  };

  const handleArchivoSeleccionado = async (file: File) => {
    setError(null);
    setAviso(null);
    setArchivo(file);
    setProcesando(true);
    setProgresoSync([]);

    try {
      const buf = await file.arrayBuffer();
      const hash = await hashArchivo(buf);
      const storagePath = `${proyectoId}/cubicador/multi/${Date.now()}_${sanitizarNombreArchivo(file.name)}`;

      // Subir archivo completo para auditoría
      setProgresoSync(prev => [...prev, 'Guardando archivo original en almacenamiento seguro…']);
      const { error: errUpload } = await supabase.storage.from('importaciones').upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (errUpload) throw errUpload;

      const wb = XLSX.read(buf, { type: 'array' });
      const keys = Object.keys(CAMPOS_POR_TABLA) as TablaDestino[];
      const tempTablasProcesadas: Record<TablaDestino, TablaProcesada | null> = {
        list_lineas: null,
        list_mto: null,
        list_isos: null,
        list_spools: null,
        list_juntas: null
      };
      const tempSeleccionadas: Record<TablaDestino, string | null> = {
        list_lineas: null,
        list_mto: null,
        list_isos: null,
        list_spools: null,
        list_juntas: null
      };

      // Procesar cada hoja en paralelo
      setProgresoSync(prev => [...prev, 'Extrayendo hojas y calculando diferencias en paralelo…']);
      await Promise.all(
        keys.map(async (key) => {
          try {
            const res = await processSingleSheet(wb, key, file.name, hash, storagePath);
            if (res) {
              tempTablasProcesadas[key] = res;
              if (res.filas.length > 0) {
                tempSeleccionadas[key] = res.filas[0].id;
              }
            }
          } catch (e: any) {
            console.error(`Error procesando pestaña ${SH_NAMES[key]}:`, e);
            throw new Error(`Error en pestaña ${SH_NAMES[key]}: ${e.message}`);
          }
        })
      );

      // Verificar que se haya procesado al menos una tabla
      const algunaProcesada = Object.values(tempTablasProcesadas).some((t) => t !== null);
      if (!algunaProcesada) {
        throw new Error('No se encontró ninguna de las hojas estándar del piloto en el archivo subido.');
      }

      setTablasProcesadas(tempTablasProcesadas);
      setSeleccionadas(tempSeleccionadas);
      
      // Encontrar la primera tabla que se procesó con éxito
      const primeraTabla = keys.find((key) => tempTablasProcesadas[key] !== null) || 'list_lineas';
      setTablaDestino(primeraTabla);
      setFase('diff');
    } catch (e: any) {
      setError(e.message || 'Error al procesar el libro de trabajo.');
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

  const handleAprobarFila = async (tableKey: TablaDestino, fila: FilaImport, aprobar: boolean) => {
    const tableData = tablasProcesadas[tableKey];
    if (!tableData) return;

    const { error: errAp } = await supabase.rpc('importar_aprobar_filas', {
      p_lote_id: tableData.loteId,
      p_fila_ids: [fila.id],
      p_aprobada: aprobar,
    });
    if (errAp) { setError(errAp.message); return; }

    setTablasProcesadas((prev) => {
      const current = prev[tableKey];
      if (!current) return prev;
      return {
        ...prev,
        [tableKey]: {
          ...current,
          filas: current.filas.map((f) => (f.id === fila.id ? { ...f, aprobada: aprobar } : f)),
        },
      };
    });
  };

  // Sincronizar/Aplicar un lote individual
  const handleAplicarLoteIndividual = async (tableKey: TablaDestino) => {
    const tableData = tablasProcesadas[tableKey];
    if (!tableData) return;

    setAplicando(true);
    setError(null);
    setAviso(null);
    try {
      const { data, error: errAplicar } = await supabase.rpc('importar_aplicar_lote', { p_lote_id: tableData.loteId });
      if (errAplicar) throw errAplicar;

      setTablasProcesadas((prev) => {
        const current = prev[tableKey];
        if (!current) return prev;
        return {
          ...prev,
          [tableKey]: {
            ...current,
            estado: 'aplicado',
            resumen: data as LoteResumen,
          },
        };
      });

      saveSyncState(tableKey, {
        status: 'Conectado',
        lastSync: new Date().toLocaleString('es-CL'),
      });
      setAviso(`Sincronización de '${TAB_LABELS[tableKey]}' aplicada con éxito.`);
    } catch (e: any) {
      setError(e.message || 'Error al aplicar el lote.');
    } finally {
      setAplicando(false);
    }
  };

  // Sincronizar TODOS los lotes procesados en serie
  const handleAplicarTodosLosLotes = async () => {
    setAplicando(true);
    setError(null);
    setAviso(null);

    const keys = Object.keys(tablasProcesadas) as TablaDestino[];
    const exitos: string[] = [];

    try {
      for (const key of keys) {
        const tableData = tablasProcesadas[key];
        if (!tableData || tableData.estado !== 'diff_listo') continue;

        // Validar que no haya conflictos aprobados
        const tieneConflictos = tableData.filas.some(f => f.aprobada && f.error_detalle?.startsWith('CONFLICTO'));
        if (tieneConflictos) {
          console.warn(`Omitiendo '${TAB_LABELS[key]}' debido a conflictos aprobados.`);
          continue;
        }

        const { data, error: errAplicar } = await supabase.rpc('importar_aplicar_lote', { p_lote_id: tableData.loteId });
        if (errAplicar) throw errAplicar;

        setTablasProcesadas((prev) => {
          const current = prev[key];
          if (!current) return prev;
          return {
            ...prev,
            [key]: {
              ...current,
              estado: 'aplicado',
              resumen: data as LoteResumen,
            },
          };
        });

        saveSyncState(key, {
          status: 'Conectado',
          lastSync: new Date().toLocaleString('es-CL'),
        });
        exitos.push(TAB_LABELS[key]);
      }

      if (exitos.length > 0) {
        setAviso(`Sincronización masiva exitosa para: ${exitos.join(', ')}.`);
        setFase('aplicado');
      } else {
        setError('No se aplicó ninguna tabla. Verifica que no haya conflictos aprobados bloqueantes.');
      }
    } catch (e: any) {
      setError(e.message || 'Error al aplicar sincronización masiva.');
    } finally {
      setAplicando(false);
    }
  };

  const reiniciar = () => {
    setFase('conexiones');
    setArchivo(null);
    setTablasProcesadas({
      list_lineas: null,
      list_mto: null,
      list_isos: null,
      list_spools: null,
      list_juntas: null
    });
    setSeleccionadas({
      list_lineas: null,
      list_mto: null,
      list_isos: null,
      list_spools: null,
      list_juntas: null
    });
    setError(null);
    setAviso(null);
  };

  const handleSimularSyncDirecta = () => {
    setProcesando(true);
    setError(null);
    setTimeout(() => {
      setProcesando(false);
      setError('Simulación exitosa: Arrastra el archivo LIST_Piping_MS.xlsx para ver e integrar los cambios.');
    }, 1500);
  };

  // Variables derivadas de la tabla activa
  const activeData = tablasProcesadas[tablaDestino];
  const currentEstadoLote = activeData?.estado ?? null;
  const currentResumen = activeData?.resumen ?? null;
  const currentFilas = activeData?.filas ?? [];
  const currentSeleccionadaId = seleccionadas[tablaDestino];

  const filasFiltradas = filtroAccion === 'todas'
    ? currentFilas
    : currentFilas.filter((f: FilaImport) => f.accion === filtroAccion);

  const seleccionada = currentFilas.find((f: FilaImport) => f.id === currentSeleccionadaId) ?? null;
  
  const hayConflictoAprobado = currentFilas.some((f: FilaImport) => f.aprobada && f.error_detalle?.startsWith('CONFLICTO'));
  const hayPendientesAusentes = currentFilas.some((f: FilaImport) => f.accion === 'ausente' && f.aprobada === false && !f.error_detalle?.startsWith('CONFLICTO'));

  // Determinar si hay alguna tabla lista para aplicar
  const algunaTablaLista = Object.values(tablasProcesadas).some(
    (t) => t !== null && t.estado === 'diff_listo'
  );

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
      {aviso && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3 text-emerald-400 text-xs mb-6">
          ✓ {aviso}
        </div>
      )}

      {/* FASE 1: TABLA DE CONEXIONES */}
      {fase === 'conexiones' && (
        <div className="flex flex-col gap-6">
          {/* Carpeta Sincronizada Info */}
          <Card className="bg-panel/20 border-border">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="text-3xl">📁</span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Carpeta de SharePoint Sincronizada</h4>
                  <code className="text-[10px] text-accent block mt-1 break-all bg-background/50 p-2 rounded border border-border/40 font-mono">
                    {baseFolder}
                  </code>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => setFase('sync_modal')}
                >
                  🔄 Sincronizar Libro Completo
                </Button>
                <div className="flex items-center gap-2 justify-center bg-card/40 px-3 py-1.5 rounded border border-border/50 text-[10px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Excel Online Activo
                </div>
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
                  <th className="p-4 w-36 text-right">Plantilla</th>
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
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
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

      {/* FASE 2: SYNC MODAL (CARGA DEL LIBRO COMPLETO) */}
      {fase === 'sync_modal' && (
        <Card className="bg-panel/40 border-border max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-white text-base font-bold">
              Sincronizar Libro Excel de Piping
            </CardTitle>
            <p className="text-muted text-xs">
              Sube el libro de Piping para procesar las 5 hojas de control en paralelo.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="bg-background/40 border border-border/60 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-muted uppercase">Origen Sincronizado</span>
              <div className="flex flex-col gap-1.5 text-xs text-foreground/80 leading-relaxed">
                <div>• Archivo: <code className="text-accent font-mono">LIST_Piping_MS.xlsx</code></div>
                <div>• Hojas a sincronizar: <code className="text-accent font-mono">LIST_Lineas_MS_, LIST_MTO_MS, LIST_Isos_MS_, LIST_Spools_MS_, LIST_Juntas_MS_</code></div>
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
                {procesando ? 'Procesando libro de trabajo…' : 'Arrastra LIST_Piping_MS.xlsx aquí'}
              </p>
              <span className="text-[10px] text-muted text-center mt-1.5 max-w-xs leading-relaxed">
                Selecciona el archivo de tu carpeta sincronizada de OneDrive. La app extraerá y procesará las 5 hojas de control en paralelo.
              </span>
              <input
                id="cub-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArchivoSeleccionado(f); }}
              />
            </div>

            {procesando && progresoSync.length > 0 && (
              <div className="bg-card border border-border p-3.5 rounded-lg flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-muted uppercase">Progreso de Sincronización:</span>
                <div className="flex flex-col gap-1 text-[10px] font-mono text-accent">
                  {progresoSync.map((p, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center">
                      <span className="animate-pulse">⌛</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-border/40 pt-4">
              <Button variant="ghost" onClick={reiniciar}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                disabled={procesando}
                onClick={handleSimularSyncDirecta}
              >
                Simular Conexión Directa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FASE 3: DIFF Y APROBACIÓN MULTI-TABLA */}
      {(fase === 'diff' || fase === 'aplicado') && (
        <div className="flex flex-col gap-6">
          {/* Selector de Tabla Activa */}
          <div className="bg-panel/40 border border-border p-1 rounded-lg flex gap-1 flex-wrap w-full">
            {(Object.keys(tablasProcesadas) as TablaDestino[]).map((tabKey) => {
              const data = tablasProcesadas[tabKey];
              if (!data) return null;
              
              const totalCambios = (data.resumen?.n_nuevas || 0) + (data.resumen?.n_modificadas || 0) + (data.resumen?.n_ausentes || 0);
              
              return (
                <button
                  key={tabKey}
                  onClick={() => {
                    setTablaDestino(tabKey);
                    setFiltroAccion('todas');
                  }}
                  className={`flex-1 text-center py-2 px-3 rounded-md text-xs font-semibold tracking-wide transition-all min-w-[120px] ${
                    tablaDestino === tabKey
                      ? 'bg-accent text-white shadow'
                      : 'text-muted hover:text-white hover:bg-panel/10'
                  }`}
                >
                  {TAB_LABELS[tabKey]} {totalCambios > 0 && (
                    <span className="ml-1 bg-accent-light/20 text-accent font-bold px-1.5 py-0.5 rounded text-[10px]">
                      +{totalCambios}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Resumen de Cambios de la Tabla Activa */}
          <div className="bg-panel/20 p-4 border border-border rounded-xl flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Diferencias en: {TAB_LABELS[tablaDestino]}
              </h3>
              <p className="text-muted text-[10px] mt-0.5">Archivo: {archivo?.name} · Hoja: {SH_NAMES[tablaDestino]}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['nueva', 'modificada', 'ausente', 'sin_cambio', 'error'] as Accion[]).map((a) => {
                const n = currentResumen?.[RESUMEN_KEY[a]] ?? currentFilas.filter((f: FilaImport) => f.accion === a).length;
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
              {currentResumen?.n_conflictos ? (
                <span className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full text-[10px] font-bold">
                  ⚠️ {currentResumen.n_conflictos} conflicto(s)
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de Filas */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs text-muted px-1">
                <span>Filas ({filasFiltradas.length})</span>
                {fase === 'diff' && currentEstadoLote === 'diff_listo' && (
                  <span className="text-[10px]">Aprueba/Rechaza ítems individuales</span>
                )}
              </div>
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                {filasFiltradas.length === 0 ? (
                  <div className="border border-border/40 bg-panel/5 rounded-lg p-8 text-center text-muted text-xs">
                    No hay cambios en esta categoría.
                  </div>
                ) : (
                  filasFiltradas.map((f: FilaImport) => (
                    <div
                      key={f.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-all hover:bg-panel/25 ${
                        f.id === currentSeleccionadaId ? 'border-accent bg-panel/30' : 'border-border/60 bg-panel/10'
                      } ${
                        f.aprobada === true ? 'border-l-4 border-l-emerald-500' :
                        f.aprobada === false && f.accion !== 'sin_cambio' ? 'border-l-4 border-l-red-500' : ''
                      }`}
                      onClick={() => setSeleccionadas(prev => ({ ...prev, [tablaDestino]: f.id }))}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-extrabold uppercase ${ACCION_META[(f.accion || 'sin_cambio') as Accion].text}`}>
                          {ACCION_META[(f.accion || 'sin_cambio') as Accion].label}
                        </span>
                        <span className="text-[10px] text-muted font-mono">Fila {Math.abs(f.nro_fila)}</span>
                      </div>
                      <div className="text-xs text-white font-semibold truncate mb-2">
                        Clave: {f.clave_natural || '—'}
                      </div>
                      {fase === 'diff' && currentEstadoLote === 'diff_listo' && (f.accion === 'nueva' || f.accion === 'modificada' || f.accion === 'ausente') && !f.error_detalle?.startsWith('CONFLICTO') && (
                        <div className="flex gap-2 mt-2">
                          <button
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold px-2.5 py-1 rounded"
                            onClick={(e) => { e.stopPropagation(); handleAprobarFila(tablaDestino, f, true); }}
                          >
                            Aprobar
                          </button>
                          <button
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[9px] font-extrabold px-2.5 py-1 rounded"
                            onClick={(e) => { e.stopPropagation(); handleAprobarFila(tablaDestino, f, false); }}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
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
                      {ACCION_META[(seleccionada.accion || 'sin_cambio') as Accion].label}
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
                          {Object.entries(seleccionada.diff).map(([campo, v]: [string, any]) => (
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

          {/* Footer del Lote / Acciones */}
          <div className="bg-panel/40 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
            <div className="text-xs text-muted flex flex-col gap-1">
              <div>Estado de tabla activa ({TAB_LABELS[tablaDestino]}): <strong className="text-white uppercase font-mono">{currentEstadoLote}</strong></div>
              {hayConflictoAprobado && (
                <span className="text-red-400 font-medium">✕ Hay conflictos aprobados pendientes en esta tabla.</span>
              )}
              {hayPendientesAusentes && (
                <span className="text-amber-400 font-medium">⚠ Hay ítems ausentes pendientes de decisión en esta tabla.</span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {fase === 'diff' && (
                <>
                  <Button
                    variant="outline"
                    disabled={aplicando || currentEstadoLote !== 'diff_listo' || hayConflictoAprobado}
                    onClick={() => handleAplicarLoteIndividual(tablaDestino)}
                  >
                    Aplicar Solo esta Tabla
                  </Button>
                  <Button
                    variant="primary"
                    disabled={aplicando || !algunaTablaLista}
                    onClick={handleAplicarTodosLosLotes}
                  >
                    {aplicando ? 'Sincronizando Todo…' : 'Sincronizar Todas las Tablas'}
                  </Button>
                </>
              )}
              {fase === 'aplicado' && (
                <Button variant="primary" onClick={reiniciar}>
                  Sincronización Completada — Volver
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CubicadorImport;

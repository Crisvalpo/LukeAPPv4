import React, { useState } from 'react';
import './documental.css';

interface FilaPropuesta {
  id: string;
  nro_fila: number;
  tabla_destino: 'cat_clase_piping' | 'cat_fluido_servicio';
  clave_natural: string;
  payload: any;
  confianza: number; // 0.0 a 1.0
  fuente: {
    paginas: number[];
    contexto: string;
  };
  aprobada: boolean | null; // null = pendiente, true = aprobada, false = rechazada
}

interface RevisionLoteIAProps {
  loteId: string;
  docId: string;
  onBack: () => void;
  onCompletado: () => void;
}

// Propuestas demo extraídas por Gemini
const PROPUESTAS_MOCK: FilaPropuesta[] = [
  {
    id: 'fila-001',
    nro_fila: 1,
    tabla_destino: 'cat_fluido_servicio',
    clave_natural: 'AG',
    payload: {
      codigo: 'AG',
      descripcion: 'Agua de procesos y de servicio industrial'
    },
    confianza: 0.98,
    fuente: {
      paginas: [1],
      contexto: "Los siguientes fluidos están autorizados... AG: Agua de procesos y de servicio industrial."
    },
    aprobada: null
  },
  {
    id: 'fila-002',
    nro_fila: 2,
    tabla_destino: 'cat_fluido_servicio',
    clave_natural: 'AC',
    payload: {
      codigo: 'AC',
      descripcion: 'Ácido sulfúrico diluido'
    },
    confianza: 0.95,
    fuente: {
      paginas: [1],
      contexto: "- AC: Ácido sulfúrico diluido. Temperatura máxima 60°C."
    },
    aprobada: null
  },
  {
    id: 'fila-003',
    nro_fila: 3,
    tabla_destino: 'cat_fluido_servicio',
    clave_natural: 'VN',
    payload: {
      codigo: 'VN',
      descripcion: 'Vapor de media presión'
    },
    confianza: 0.97,
    fuente: {
      paginas: [1],
      contexto: "- VN: Vapor de media presión. Temperatura de diseño 180°C."
    },
    aprobada: null
  },
  {
    id: 'fila-004',
    nro_fila: 4,
    tabla_destino: 'cat_clase_piping',
    clave_natural: 'A1',
    payload: {
      codigo: 'A1',
      descripcion: 'Acero al Carbono (ASTM A106-B) 150# — Agua de procesos',
      usa_pwht: false,
      usa_pmi: false
    },
    confianza: 0.94,
    fuente: {
      paginas: [2],
      contexto: "- Clase A1: Acero al Carbono (ASTM A106-B). Rating 150#. Servicio: Agua de procesos (AG). Requiere pintura protectora tipo EP1. Sin tratamiento térmico posterior (PWHT)."
    },
    aprobada: null
  },
  {
    id: 'fila-005',
    nro_fila: 5,
    tabla_destino: 'cat_clase_piping',
    clave_natural: 'A2',
    payload: {
      codigo: 'A2',
      descripcion: 'Acero al Carbono (ASTM A106-B) 300# — Vapor',
      usa_pwht: true,
      usa_pmi: false
    },
    confianza: 0.96,
    fuente: {
      paginas: [2, 3],
      contexto: "- Clase A2: Acero al Carbono (ASTM A106-B). Rating 300#. Servicio: Vapor (VN). Requiere PWHT para espesores mayores a 3/4\". Requiere ensayos no destructivos (NDE) al 20% en juntas BW. Obligatorio para líneas de vapor clase A2 en juntas de diámetro nominal (NPS) mayor o igual a 2\"."
    },
    aprobada: null
  },
  {
    id: 'fila-006',
    nro_fila: 6,
    tabla_destino: 'cat_clase_piping',
    clave_natural: 'C1',
    payload: {
      codigo: 'C1',
      descripcion: 'Acero Inoxidable (ASTM A312 TP316L) 150# — Ácido sulfúrico',
      usa_pwht: false,
      usa_pmi: true
    },
    confianza: 0.92,
    fuente: {
      paginas: [2, 3],
      contexto: "- Clase C1: Acero Inoxidable (ASTM A312 TP316L). Rating 150#. Servicio: Ácido sulfúrico (AC). Requiere control de materiales (PMI) al 100% de las juntas y componentes. Sin pintura."
    },
    aprobada: null
  }
];

export const RevisionLoteIA: React.FC<RevisionLoteIAProps> = ({ loteId, docId, onBack, onCompletado }) => {
  const [propuestas, setPropuestas] = useState<FilaPropuesta[]>(PROPUESTAS_MOCK);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(PROPUESTAS_MOCK[0].id);
  const [aplicando, setAplicando] = useState(false);

  const seleccionada = propuestas.find(p => p.id === seleccionadaId);

  const handleAprobarFila = (id: string, aprueba: boolean) => {
    setPropuestas(prev => prev.map(p => p.id === id ? { ...p, aprobada: aprueba } : p));
  };

  const handleAprobarTodo = () => {
    setPropuestas(prev => prev.map(p => ({ ...p, aprobada: true })));
  };

  const handleAplicarLote = () => {
    setAplicando(true);
    // Simular escritura transaccional en cat_clase_piping y cat_fluido_servicio
    setTimeout(() => {
      setAplicando(false);
      onCompletado();
    }, 1500);
  };

  const getConfianzaClass = (conf: number) => {
    if (conf >= 0.95) return 'confianza-alta';
    if (conf >= 0.90) return 'confianza-media';
    return 'confianza-baja';
  };

  const getConfianzaLabel = (conf: number) => {
    return `${(conf * 100).toFixed(0)}% de confianza`;
  };

  return (
    <div className="rev-section">
      <div className="rev-header">
        <button className="btn btn-secondary btn-back" onClick={onBack}>
          ← Volver a Biblioteca
        </button>
        <div>
          <h2>Revisión de Extracción Asistida por IA</h2>
          <p className="doc-subheader">Verifica los datos propuestos por Gemini antes de insertarlos en el catálogo del proyecto. (Documento: {docId} | Lote: {loteId})</p>
        </div>
      </div>

      <div className="rev-layout">
        {/* Panel izquierdo: Lista de propuestas */}
        <div className="rev-panel-list">
          <div className="panel-actions">
            <span>Propuestas extraídas ({propuestas.length})</span>
            <button className="btn btn-secondary btn-sm" onClick={handleAprobarTodo}>
              Aprobar Todo el Lote
            </button>
          </div>
          
          <div className="propuestas-list">
            {propuestas.map(p => (
              <div 
                key={p.id} 
                className={`propuesta-item ${p.id === seleccionadaId ? 'selected' : ''} ${p.aprobada === true ? 'aprobada' : p.aprobada === false ? 'rechazada' : ''}`}
                onClick={() => setSeleccionadaId(p.id)}
              >
                <div className="propuesta-item-header">
                  <span className="propuesta-tabla">{p.tabla_destino.replace('cat_', '').replace('_', ' ').toUpperCase()}</span>
                  <span className={`conf-dot ${getConfianzaClass(p.confianza)}`} title={getConfianzaLabel(p.confianza)}></span>
                </div>
                <div className="propuesta-item-key">
                  Clave: <strong>{p.clave_natural}</strong>
                </div>
                <div className="propuesta-item-actions">
                  <button 
                    className="btn-pill btn-pill-approve" 
                    onClick={(e) => { e.stopPropagation(); handleAprobarFila(p.id, true); }}
                  >
                    ✓ Aprobar
                  </button>
                  <button 
                    className="btn-pill btn-pill-reject" 
                    onClick={(e) => { e.stopPropagation(); handleAprobarFila(p.id, false); }}
                  >
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel derecho: Detalle, diff y trazabilidad de fuente */}
        <div className="rev-panel-detail">
          {seleccionada ? (
            <div className="detail-container">
              <div className="detail-header">
                <h3>Detalle de la Propuesta</h3>
                <span className={`badge ${getConfianzaClass(seleccionada.confianza)}`}>
                  {getConfianzaLabel(seleccionada.confianza)}
                </span>
              </div>

              {/* Trazabilidad: Fuente del documento */}
              <div className="source-card">
                <div className="source-card-header">
                  <span>📖 Origen del PDF: <strong>Páginas {seleccionada.fuente.paginas.join(', ')}</strong></span>
                </div>
                <div className="source-card-body">
                  <p className="source-context">
                    "{seleccionada.fuente.contexto}"
                  </p>
                </div>
              </div>

              {/* Detalle del Payload JSON */}
              <div className="payload-card">
                <h4>Estructura de Datos Sugerida (JSON)</h4>
                <pre className="payload-json">
                  {JSON.stringify(seleccionada.payload, null, 2)}
                </pre>
              </div>

              {/* Acciones unitarias */}
              <div className="detail-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleAprobarFila(seleccionada.id, false)}
                >
                  Marcar como Rechazada
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleAprobarFila(seleccionada.id, true)}
                >
                  Marcar como Aprobada
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-detail">
              <p>Selecciona una propuesta a la izquierda para inspeccionar su origen en el PDF y sus campos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Aplicar cambios */}
      <div className="rev-footer-bar">
        <div className="rev-summary">
          Aprobadas: <strong>{propuestas.filter(p => p.aprobada === true).length}</strong> | 
          Rechazadas: <strong>{propuestas.filter(p => p.aprobada === false).length}</strong> | 
          Pendientes: <strong>{propuestas.filter(p => p.aprobada === null).length}</strong>
        </div>
        <button 
          className="btn btn-primary btn-lg" 
          disabled={propuestas.some(p => p.aprobada === null) || aplicando}
          onClick={handleAplicarLote}
        >
          {aplicando ? 'Insertando en Catálogos...' : 'Aplicar Lote Aprobado'}
        </button>
      </div>
    </div>
  );
};
export default RevisionLoteIA;

import { useState } from 'react';
import BibliotecaDocumental from './components/documental/BibliotecaDocumental';
import RevisionLoteIA from './components/documental/RevisionLoteIA';

type Vista = 'cartera' | 'ingesta_ia' | 'revision_lote';

function App() {
  const [vista, setVista] = useState<Vista>('cartera');
  const [proyectoActivo] = useState('proj-413'); // Piloto 413 Andina
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null);
  const [docSeleccionado, setDocSeleccionado] = useState<string | null>(null);

  const handleSelectLote = (loteId: string, docId: string) => {
    setLoteSeleccionado(loteId);
    setDocSeleccionado(docId);
    setVista('revision_lote');
  };

  const handleBackToBiblioteca = () => {
    setVista('ingesta_ia');
    setLoteSeleccionado(null);
    setDocSeleccionado(null);
  };

  const handleCompletado = () => {
    alert('🎉 ¡Lote de importación IA aprobado y aplicado exitosamente a las tablas de catálogo!');
    handleBackToBiblioteca();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Barra de Navegación Premium */}
      <header style={{
        height: '64px',
        background: 'rgba(30, 41, 59, 0.8)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            LukeAPP v4
          </div>
          <span style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#38bdf8',
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            PROYECTO PILOTO 413
          </span>
        </div>

        <nav style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => setVista('cartera')}
            style={{
              background: 'none',
              border: 'none',
              color: vista === 'cartera' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: vista === 'cartera' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
              transition: 'all 0.2s'
            }}
          >
            📊 Cartera de Proyectos
          </button>
          
          <button 
            onClick={() => setVista('ingesta_ia')}
            style={{
              background: 'none',
              border: 'none',
              color: vista === 'ingesta_ia' || vista === 'revision_lote' ? '#a855f7' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: vista === 'ingesta_ia' || vista === 'revision_lote' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
              transition: 'all 0.2s'
            }}
          >
            ✨ Ingesta Documental IA
          </button>
        </nav>
      </header>

      {/* Contenido Principal */}
      <main style={{ flexGrow: 1 }}>
        {vista === 'cartera' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '80vh',
            textAlign: 'center',
            padding: '24px'
          }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                LukeAPP Dashboard Cartera
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
                Plataforma de trazabilidad multi-proyecto de prefabricación y montaje. Revisa indicadores y avance físico de juntas, spools y materiales críticos.
              </p>
              <button 
                onClick={() => setVista('ingesta_ia')}
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Probar Ingesta IA
              </button>
            </div>
          </div>
        )}

        {vista === 'ingesta_ia' && (
          <BibliotecaDocumental 
            proyectoId={proyectoActivo} 
            onSelectLote={handleSelectLote} 
          />
        )}

        {vista === 'revision_lote' && loteSeleccionado && docSeleccionado && (
          <RevisionLoteIA 
            loteId={loteSeleccionado} 
            docId={docSeleccionado} 
            onBack={handleBackToBiblioteca} 
            onCompletado={handleCompletado} 
          />
        )}
      </main>
    </div>
  );
}

export default App;

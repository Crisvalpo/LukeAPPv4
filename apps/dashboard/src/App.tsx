import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { Login } from './components/auth/Login';
import { CarteraProyectos } from './components/proyectos/CarteraProyectos';
import BibliotecaDocumental from './components/documental/BibliotecaDocumental';
import RevisionLoteIA from './components/documental/RevisionLoteIA';

type Vista = 'cartera' | 'ingesta_ia' | 'revision_lote';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionCargada, setSessionCargada] = useState(false);
  const [vista, setVista] = useState<Vista>('cartera');
  // proyecto_id siempre viene del contexto de navegación (drill-down), nunca hardcodeado
  const [proyectoActivo, setProyectoActivo] = useState<string | null>(null);
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null);
  const [docSeleccionado, setDocSeleccionado] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionCargada(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAbrirIngesta = (proyectoId: string) => {
    setProyectoActivo(proyectoId);
    setVista('ingesta_ia');
  };

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

  const handleBackToCartera = () => {
    setVista('cartera');
    setProyectoActivo(null);
    setLoteSeleccionado(null);
    setDocSeleccionado(null);
  };

  const handleCompletado = () => {
    alert('🎉 ¡Lote de importación IA aprobado y aplicado exitosamente a las tablas de catálogo!');
    handleBackToBiblioteca();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    handleBackToCartera();
  };

  if (!sessionCargada) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#94a3b8' }}>
        Cargando…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Barra de Navegación */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            onClick={handleBackToCartera}
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              cursor: 'pointer'
            }}
          >
            LukeAPP v4
          </div>
          {vista !== 'cartera' && (
            <button
              onClick={handleBackToCartera}
              style={{
                background: 'none',
                border: '1px solid #334155',
                color: '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: '6px'
              }}
            >
              ← Cartera
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{session.user.email}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #334155',
              color: '#cbd5e1',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: '6px'
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main style={{ flexGrow: 1 }}>
        {vista === 'cartera' && (
          <CarteraProyectos onAbrirIngesta={handleAbrirIngesta} />
        )}

        {vista === 'ingesta_ia' && proyectoActivo && (
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

import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { Login } from './components/auth/Login';
import { ResetPassword } from './components/auth/ResetPassword';
import { CuentaPendiente, CuentaRechazada, SinProyectos } from './components/auth/EstadosCuenta';
import { SolicitudesAcceso } from './components/auth/SolicitudesAcceso';
import { CarteraProyectos } from './components/proyectos/CarteraProyectos';
import BibliotecaDocumental from './components/documental/BibliotecaDocumental';
import RevisionLoteIA from './components/documental/RevisionLoteIA';
import CubicadorImport from './components/cubicador/CubicadorImport';
import { Button } from './components/ui/Button';

// three.js/gsap pesan ~1.3MB — se cargan solo cuando realmente se muestra la
// landing (nunca para usuarios ya logueados ni mientras carga el dashboard).
const LandingPage = lazy(() => import('./components/landing/LandingPage').then((m) => ({ default: m.LandingPage })));

type Vista = 'cartera' | 'ingesta_ia' | 'revision_lote' | 'cubicador' | 'solicitudes';

interface Perfil {
  estado_cuenta: 'pendiente' | 'aprobado' | 'rechazado';
  motivo_rechazo: string | null;
  acceso_global: boolean;
  tiene_membresia_activa: boolean;
  puede_administrar_accesos: boolean;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionCargada, setSessionCargada] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [avisoLogin, setAvisoLogin] = useState<string | null>(null);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilCargado, setPerfilCargado] = useState(false);

  const [vista, setVista] = useState<Vista>('cartera');
  // proyecto_id siempre viene del contexto de navegación (drill-down), nunca hardcodeado
  const [proyectoActivo, setProyectoActivo] = useState<string | null>(null);
  const [docSeleccionado, setDocSeleccionado] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionCargada(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchPerfil = useCallback(async () => {
    setPerfilCargado(false);
    const { data, error } = await supabase.rpc('mi_perfil').single();
    if (!error) setPerfil(data as Perfil);
    setPerfilCargado(true);
  }, []);

  useEffect(() => {
    if (session && !recoveryMode) {
      fetchPerfil();
    } else {
      setPerfil(null);
      setPerfilCargado(false);
    }
  }, [session, recoveryMode, fetchPerfil]);

  const handleAbrirIngesta = (proyectoId: string) => {
    setProyectoActivo(proyectoId);
    setVista('ingesta_ia');
  };

  const handleAbrirCubicador = (proyectoId: string) => {
    setProyectoActivo(proyectoId);
    setVista('cubicador');
  };

  const handleSelectLote = (docId: string) => {
    setDocSeleccionado(docId);
    setVista('revision_lote');
  };

  const handleBackToBiblioteca = () => {
    setVista('ingesta_ia');
    setDocSeleccionado(null);
  };

  const handleBackToCartera = () => {
    setVista('cartera');
    setProyectoActivo(null);
    setDocSeleccionado(null);
  };

  const handleCompletado = () => {
    alert('🎉 ¡Lote de importación IA aprobado y aplicado exitosamente a las tablas de catálogo!');
    handleBackToBiblioteca();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowLogin(false);
    handleBackToCartera();
  };

  const handleResetCompletado = () => {
    setRecoveryMode(false);
    setAvisoLogin('Contraseña actualizada, ingresa de nuevo.');
  };

  if (!sessionCargada) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted">
        Cargando…
      </div>
    );
  }

  if (recoveryMode) {
    return <ResetPassword onCompletado={handleResetCompletado} />;
  }

  if (!session) {
    if (showLogin) {
      return (
        <div className="relative w-full min-h-screen bg-background">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowLogin(false)} 
            className="absolute top-5 left-5 z-[100]"
          >
            ← Volver al Inicio
          </Button>
          <Login avisoInicial={avisoLogin} />
        </div>
      );
    }
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background text-muted">
            Cargando…
          </div>
        }
      >
        <LandingPage onLoginClick={() => setShowLogin(true)} />
      </Suspense>
    );
  }

  if (!perfilCargado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted">
        Cargando…
      </div>
    );
  }

  if (perfil?.estado_cuenta === 'pendiente') {
    return <CuentaPendiente onSalir={handleLogout} />;
  }

  if (perfil?.estado_cuenta === 'rechazado') {
    return <CuentaRechazada motivo={perfil.motivo_rechazo} onSalir={handleLogout} />;
  }

  if (perfil?.estado_cuenta === 'aprobado' && !perfil.tiene_membresia_activa && !perfil.acceso_global) {
    return <SinProyectos onSalir={handleLogout} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">

      {/* Barra de Navegación */}
      <header className="h-16 bg-panel/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div
            onClick={handleBackToCartera}
            className="text-2xl font-extrabold font-display cursor-pointer tracking-tight"
          >
            <span className="text-white">LukeAPP</span>{' '}
            <span className="text-accent">v4</span>
          </div>
          {vista !== 'cartera' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToCartera}
            >
              ← Cartera
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {perfil?.puede_administrar_accesos && (
            <Button
              variant={vista === 'solicitudes' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setVista('solicitudes')}
            >
              Solicitudes
            </Button>
          )}
          <span className="text-muted text-sm">{session.user.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
          >
            Salir
          </Button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-grow">
        {vista === 'cartera' && (
          <CarteraProyectos onAbrirIngesta={handleAbrirIngesta} onAbrirCubicador={handleAbrirCubicador} esGerencia={perfil?.acceso_global ?? false} />
        )}

        {vista === 'solicitudes' && perfil?.puede_administrar_accesos && (
          <SolicitudesAcceso />
        )}

        {vista === 'ingesta_ia' && proyectoActivo && (
          <BibliotecaDocumental
            proyectoId={proyectoActivo}
            onSelectLote={handleSelectLote}
          />
        )}

        {vista === 'cubicador' && proyectoActivo && (
          <CubicadorImport
            proyectoId={proyectoActivo}
            onBack={handleBackToCartera}
          />
        )}

        {vista === 'revision_lote' && docSeleccionado && (
          <RevisionLoteIA
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

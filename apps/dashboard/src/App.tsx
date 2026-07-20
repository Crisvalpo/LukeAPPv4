import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { Login } from './components/auth/Login';
import { ResetPassword } from './components/auth/ResetPassword';
import { CuentaPendiente, CuentaRechazada, SinProyectos } from './components/auth/EstadosCuenta';
import { GestionUsuarios } from './components/auth/GestionUsuarios';
import { CarteraProyectos } from './components/proyectos/CarteraProyectos';
import BibliotecaDocumental from './components/documental/BibliotecaDocumental';
import RevisionLoteIA from './components/documental/RevisionLoteIA';
import CubicadorImport from './components/cubicador/CubicadorImport';

import { ConstructorEspecificaciones } from './components/documental/ConstructorEspecificaciones';
import { BibliotecaPIDs } from './components/documental/BibliotecaPIDs';
import { AWPCatalogos } from './components/proyectos/AWPCatalogos';
import { GestionCatalogos } from './components/proyectos/GestionCatalogos';
import { DotacionPersonal } from './components/proyectos/DotacionPersonal';
import { GestionCuadrillas } from './components/proyectos/GestionCuadrillas';
import { ConfiguracionBotPersonal } from './components/proyectos/ConfiguracionBotPersonal';
import { Button } from './components/ui/Button';
import { Settings } from 'lucide-react';
import { HeaderActionsContext } from './hooks/useHeaderActions';

// three.js/gsap pesan ~1.3MB — se cargan solo cuando realmente se muestra la
// landing (nunca para usuarios ya logueados ni mientras carga el dashboard).
const LandingPage = lazy(() => import('./components/landing/LandingPage').then((m) => ({ default: m.LandingPage })));

type Vista = 'cartera' | 'ingesta_ia' | 'revision_lote' | 'cubicador' | 'solicitudes' | 'biblioteca_pids' | 'constructor_specs' | 'awp' | 'dotacion' | 'cuadrillas' | 'config_bot' | 'catalogos';

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
  const [menuConfigAbierto, setMenuConfigAbierto] = useState(false);
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [avisoLogin, setAvisoLogin] = useState<string | null>(null);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilCargado, setPerfilCargado] = useState(false);

  const [vista, setVista] = useState<Vista>('cartera');
  // proyecto_id siempre viene del contexto de navegación (drill-down), nunca hardcodeado
  const [proyectoActivo, setProyectoActivo] = useState<string | null>(null);
  const [docSeleccionado, setDocSeleccionado] = useState<string | null>(null);

  const [membresias, setMembresias] = useState<any[]>([]);
  const [proyectoActivoDetalle, setProyectoActivoDetalle] = useState<{ codigo: string; nombre: string } | null>(null);


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
    if (!error) {
      setPerfil(data as Perfil);
      // Cargar membresías del usuario
      const { data: mems } = await supabase
        .from('membresias')
        .select('rol, proyecto_id, proyectos(codigo, nombre)')
        .eq('usuario_id', session?.user?.id || '')
        .eq('activo', true);
      setMembresias(mems || []);
    }
    setPerfilCargado(true);
  }, [session]);

  useEffect(() => {
    if (proyectoActivo) {
      const memActiva = membresias.find(m => m.proyecto_id === proyectoActivo);
      if (memActiva) {
        setProyectoActivoDetalle({
          codigo: memActiva.proyectos.codigo,
          nombre: memActiva.proyectos.nombre
        });
      } else {
        // Fallback para usuarios con acceso_global que entran a un proyecto sin membresía directa
        supabase.from('proyectos')
          .select('codigo, nombre')
          .eq('id', proyectoActivo)
          .single()
          .then(({ data }) => {
            if (data) setProyectoActivoDetalle(data);
          });
      }
    } else {
      setProyectoActivoDetalle(null);
    }
  }, [proyectoActivo, membresias]);


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

  const handleAbrirPids = (proyectoId: string) => {
    setProyectoActivo(proyectoId);
    setVista('biblioteca_pids');
  };
  const handleAbrirCatalogos = (proyectoId: string) => {
    setProyectoActivo(proyectoId);
    setVista('catalogos');
  };
  const handleAbrirAWP = (proyectoId: string) => {
    setProyectoActivo(proyectoId);
    setVista('awp');
  };

  const handleAbrirDotacion = (proyectoId: string) => {
    setProyectoActivo(proyectoId);
    setVista('dotacion');
  };

  const handleAbrirConstructor = (docId: string) => {
    setDocSeleccionado(docId);
    setVista('constructor_specs');
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
    setVista('cubicador');
    setDocSeleccionado(null);
    alert('🎉 ¡Todos los catálogos han sido aprobados y aplicados al proyecto con éxito!\n\nPaso 2: Ahora puedes proceder a cargar los datos del cubicador (Line List, Spools, Juntas, etc.) utilizando el importador.');
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
    <HeaderActionsContext.Provider value={setHeaderActions}>
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">

      {/* Barra de Navegación: único lugar con botones de acción/navegación
          de página — cada vista registra los suyos vía useHeaderActions(). */}
      <header className="h-16 bg-panel/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <div
            onClick={handleBackToCartera}
            className="text-2xl font-extrabold font-display cursor-pointer tracking-tight"
          >
            <span className="text-white">LukeAPP</span>{' '}
            <span className="text-accent">v4</span>
          </div>
          {vista !== 'cartera' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToCartera}
              >
                ← Proyectos
              </Button>
              {proyectoActivo && (
                <div className="flex items-center gap-1 bg-card/40 border border-border/80 p-0.5 rounded-lg ml-2">
                  <Button
                    variant={vista === 'ingesta_ia' || vista === 'revision_lote' || vista === 'constructor_specs' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('ingesta_ia'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider"
                  >
                    1. Documentos
                  </Button>
                  <Button
                    variant={vista === 'catalogos' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('catalogos'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider"
                  >
                    2. Catálogos
                  </Button>
                  <Button
                    variant={vista === 'cubicador' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('cubicador'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider"
                  >
                    3. Datos / Line List
                  </Button>
                  <Button
                    variant={vista === 'biblioteca_pids' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('biblioteca_pids'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider"
                  >
                    Planos P&ID
                  </Button>
                  <Button
                    variant={vista === 'awp' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('awp'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground"
                  >
                    AWP (Avanzado)
                  </Button>
                  <Button
                    variant={vista === 'dotacion' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('dotacion'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground"
                  >
                    Dotación (Avanzado)
                  </Button>
                  <Button
                    variant={vista === 'cuadrillas' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('cuadrillas'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground"
                  >
                    Cuadrillas
                  </Button>
                  <Button
                    variant={vista === 'config_bot' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => { setVista('config_bot'); setDocSeleccionado(null); }}
                    className="py-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground"
                  >
                    WhatsApp Bot
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-x-auto">
          {headerActions}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {perfil?.puede_administrar_accesos && (
            <div className="relative">
              <Button
                variant={vista === 'solicitudes' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMenuConfigAbierto((v) => !v)}
                title="Configuración"
              >
                <Settings size={16} />
              </Button>
              {menuConfigAbierto && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuConfigAbierto(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-panel border border-border rounded-lg shadow-2xl z-50 py-1">
                    <button
                      onClick={() => { setVista('solicitudes'); setMenuConfigAbierto(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${
                        vista === 'solicitudes' ? 'text-accent bg-accent/10' : 'text-foreground hover:bg-card/60'
                      }`}
                    >
                      Usuarios y Accesos
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Badge de Perfil de Usuario */}
          {(() => {
            const getRolYProyectoActivos = () => {
              if (!proyectoActivo) {
                if (perfil?.acceso_global) {
                  return { rol: 'GERENCIA', proyecto: 'Proyectos' };
                }
                // Con una sola membresía no hay ambigüedad: se muestra directo,
                // sin esperar a que el usuario entre al proyecto.
                if (membresias.length === 1) {
                  return { rol: membresias[0].rol, proyecto: membresias[0].proyectos?.codigo ?? 'Proyectos' };
                }
                return { rol: '—', proyecto: 'Proyectos' };
              }
              const memActiva = membresias.find(m => m.proyecto_id === proyectoActivo);
              const rol = memActiva ? memActiva.rol : (perfil?.acceso_global ? 'GERENCIA' : '—');
              const proyecto = proyectoActivoDetalle?.codigo || 'Cargando…';
              return { rol, proyecto };
            };
            const { rol: rolActivo, proyecto: proyActivoText } = getRolYProyectoActivos();
            return (
              <div className="flex items-center gap-3 bg-card/60 border border-border px-3 py-1.5 rounded-lg">
                <div className="flex flex-col text-right">
                  <span className="text-white text-xs font-bold font-sans leading-tight">
                    {session.user.email}
                  </span>
                  <span className="text-muted text-[10px] font-medium font-sans mt-0.5">
                    {proyectoActivo || (!perfil?.acceso_global && membresias.length === 1)
                      ? `Proyecto: ${proyActivoText}`
                      : 'Proyectos'}
                  </span>
                </div>
                <div className="h-8 w-px bg-border/80" />
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                  rolActivo === 'ADMIN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  rolActivo === 'GERENCIA' ? 'bg-accent/10 text-accent border border-accent/20' :
                  'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  {rolActivo}
                </span>
              </div>
            );
          })()}

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
          <CarteraProyectos
            onAbrirIngesta={handleAbrirIngesta}
            onAbrirCatalogos={handleAbrirCatalogos}
            onAbrirCubicador={handleAbrirCubicador}
            onAbrirPids={handleAbrirPids}
            onAbrirAWP={handleAbrirAWP}
            onAbrirDotacion={handleAbrirDotacion}
            esGerencia={perfil?.acceso_global ?? false}
          />
        )}

        {vista === 'solicitudes' && perfil?.puede_administrar_accesos && (
          <GestionUsuarios
            perfilGlobal={perfil}
            proyectoActivoId={proyectoActivo}
          />
        )}

        {vista === 'ingesta_ia' && proyectoActivo && (
          <BibliotecaDocumental
            proyectoId={proyectoActivo}
            onSelectLote={handleSelectLote}
            onAbrirConstructor={handleAbrirConstructor}
          />
        )}

        {vista === 'cubicador' && proyectoActivo && (
          <CubicadorImport
            proyectoId={proyectoActivo}
          />
        )}

        {vista === 'catalogos' && proyectoActivo && (
          <GestionCatalogos
            proyectoId={proyectoActivo}
          />
        )}

        {vista === 'biblioteca_pids' && proyectoActivo && (
          <BibliotecaPIDs
            proyectoId={proyectoActivo}
          />
        )}

        {vista === 'awp' && proyectoActivo && (
          <AWPCatalogos
            proyectoId={proyectoActivo}
          />
        )}

        {vista === 'dotacion' && proyectoActivo && (
          <DotacionPersonal
            proyectoId={proyectoActivo}
          />
        )}

        {vista === 'cuadrillas' && proyectoActivo && (
          <GestionCuadrillas
            proyectoId={proyectoActivo}
          />
        )}

        {vista === 'config_bot' && proyectoActivo && (
          <ConfiguracionBotPersonal
            proyectoId={proyectoActivo}
          />
        )}

        {vista === 'constructor_specs' && docSeleccionado && (
          <ConstructorEspecificaciones
            proyectoId={proyectoActivo || ''}
            documentoId={docSeleccionado}
            onBack={handleBackToBiblioteca}
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
    </HeaderActionsContext.Provider>
  );
}

export default App;

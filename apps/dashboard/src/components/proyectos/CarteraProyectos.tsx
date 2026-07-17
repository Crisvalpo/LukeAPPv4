import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { NuevoProyectoModal } from './NuevoProyectoModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useHeaderActions } from '../../hooks/useHeaderActions';

export interface ProyectoKpis {
  id: string;
  codigo: string;
  nombre: string;
  industria: 'mineria' | 'refineria' | 'celulosa';
  estado: string;
  fecha_inicio: string | null;
  mandante: string | null;
  n_lineas: number;
  n_isos: number;
  n_spools: number;
  n_juntas: number;
  n_mto: number;
  n_juntas_ejecutadas: number;
}

const INDUSTRIA_META: Record<ProyectoKpis['industria'], { label: string; icon: string; color: string; bg: string }> = {
  mineria: { label: 'Minería', icon: '⛏️', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  refineria: { label: 'Refinería', icon: '🛢️', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  celulosa: { label: 'Celulosa', icon: '🌲', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
};

const ESTADO_META: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: 'text-green-500' },
  en_pausa: { label: 'En pausa', color: 'text-yellow-500' },
  cerrado: { label: 'Cerrado', color: 'text-slate-500' },
  borrador: { label: 'Borrador', color: 'text-slate-400' },
};

interface CarteraProyectosProps {
  onAbrirIngesta: (proyectoId: string) => void;
  onAbrirCubicador: (proyectoId: string) => void;
  onAbrirPids: (proyectoId: string) => void;
  onAbrirConfig: (proyectoId: string) => void;
  esGerencia: boolean;
}

export const CarteraProyectos: React.FC<CarteraProyectosProps> = ({ onAbrirIngesta, onAbrirCubicador, onAbrirPids, onAbrirConfig, esGerencia }) => {
  const [proyectos, setProyectos] = useState<ProyectoKpis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ProyectoKpis | null>(null);

  const fetchProyectos = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('v_cartera_kpis')
      .select('*')
      .order('codigo');
    if (err) {
      setError(err.message);
    } else {
      setProyectos((data as ProyectoKpis[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProyectos();
  }, [fetchProyectos]);

  // Un usuario con un único proyecto no gana nada viendo la lista de
  // cartera — entra directo al detalle. GERENCIA siempre ve la cartera,
  // incluso si hoy solo hay un proyecto (va a crecer).
  useEffect(() => {
    if (!esGerencia && !seleccionado && proyectos.length === 1) {
      setSeleccionado(proyectos[0]);
    }
  }, [esGerencia, proyectos, seleccionado]);

  const handleProyectoCreado = () => {
    setMostrarWizard(false);
    fetchProyectos();
  };

  // El borrado de un proyecto solo elimina en cascada las FILAS de las tablas
  // (doc_biblioteca, list_pid, import_lotes, etc.) — los archivos físicos en
  // Storage viven en un sistema aparte sin FK hacia proyectos, así que hay que
  // recolectar sus paths ANTES del DELETE (la cascada los borra de la tabla)
  // y removerlos explícitamente para no dejar carpetas huérfanas en los buckets.
  const limpiarStorageProyecto = async (proyectoId: string) => {
    try {
      const [docs, pids, lotes] = await Promise.all([
        supabase.from('doc_biblioteca').select('storage_path').eq('proyecto_id', proyectoId),
        supabase.from('list_pid').select('pdf_path').eq('proyecto_id', proyectoId),
        supabase.from('import_lotes').select('archivo_storage_path').eq('proyecto_id', proyectoId),
      ]);

      const pathsDocumentos = [
        ...(docs.data ?? []).map((d) => d.storage_path),
        ...(pids.data ?? []).map((p) => p.pdf_path),
      ].filter((p): p is string => !!p);

      const pathsImportaciones = (lotes.data ?? [])
        .map((l) => l.archivo_storage_path)
        .filter((p): p is string => !!p);

      if (pathsDocumentos.length > 0) {
        const { error } = await supabase.storage.from('documentos').remove(pathsDocumentos);
        if (error) console.error('[CarteraProyectos] error limpiando bucket documentos:', error.message);
      }
      if (pathsImportaciones.length > 0) {
        const { error } = await supabase.storage.from('importaciones').remove(pathsImportaciones);
        if (error) console.error('[CarteraProyectos] error limpiando bucket importaciones:', error.message);
      }
    } catch (e) {
      console.error('[CarteraProyectos] error recolectando archivos de storage del proyecto:', e);
    }
  };

  const handleEliminarProyecto = async (proyectoId: string, codigo: string) => {
    const input = window.prompt(
      `Estás a punto de eliminar permanentemente el proyecto ${codigo} y todos sus datos en cascada.\n\n` +
      `Para confirmar esta acción irreversible, por favor escribe el nombre del proyecto (${codigo}) a continuación:`
    );

    if (input !== codigo) {
      if (input !== null) {
        alert('El nombre ingresado no coincide. Eliminación cancelada.');
      }
      return;
    }

    setLoading(true);
    await limpiarStorageProyecto(proyectoId);
    const { data, error: err } = await supabase.from('proyectos').delete().eq('id', proyectoId).select();
    
    if (err) {
      alert(`Error al eliminar: ${err.message}`);
      setLoading(false);
    } else if (!data || data.length === 0) {
      alert('⚠️ No se eliminó nada. Esto ocurre porque la Base de Datos bloqueó la acción (RLS).\n\nAsegúrate de haber ejecutado el script SQL de la migración 011 en el panel de Supabase para habilitar el borrado.');
      setLoading(false);
    } else {
      setSeleccionado(null);
      fetchProyectos();
      alert(`El proyecto ${codigo} ha sido eliminado permanentemente.`);
    }
  };

  const pctAvance = (p: ProyectoKpis) =>
    p.n_juntas > 0 ? Math.round((p.n_juntas_ejecutadas / p.n_juntas) * 100) : 0;

  useHeaderActions(
    seleccionado ? (
      <>
        <Button variant="outline" size="sm" onClick={() => setSeleccionado(null)}>
          ← Volver
        </Button>
        <Button variant="primary" size="sm" onClick={() => onAbrirIngesta(seleccionado.id)}>
          Especificaciones
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onAbrirCubicador(seleccionado.id)}>
          Datos
        </Button>
        <Button variant="outline" size="sm" onClick={() => onAbrirPids(seleccionado.id)}>
          Planos P&ID
        </Button>
        <Button variant="outline" size="sm" onClick={() => onAbrirConfig(seleccionado.id)}>
          Configuración Integración
        </Button>
        {esGerencia && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleEliminarProyecto(seleccionado.id, seleccionado.codigo)}
            title="Eliminar proyecto permanentemente"
          >
            Eliminar
          </Button>
        )}
      </>
    ) : esGerencia ? (
      <Button variant="primary" size="sm" onClick={() => setMostrarWizard(true)}>
        + Nuevo Proyecto
      </Button>
    ) : null
  );

  // ─── Panel drill-down de un proyecto ───
  if (seleccionado) {
    const meta = INDUSTRIA_META[seleccionado.industria];
    const estado = ESTADO_META[seleccionado.estado] ?? { label: seleccionado.estado, color: 'text-slate-400' };
    const kpis = [
      { label: 'Líneas', valor: seleccionado.n_lineas },
      { label: 'Isométricos', valor: seleccionado.n_isos },
      { label: 'Spools', valor: seleccionado.n_spools },
      { label: 'Juntas', valor: seleccionado.n_juntas },
      { label: 'Ítems MTO', valor: seleccionado.n_mto },
      { label: 'Juntas ejecutadas', valor: seleccionado.n_juntas_ejecutadas },
    ];

    return (
      <div className="max-w-6xl mx-auto p-8">
        <Card className="p-8">
          <div className="flex flex-wrap justify-between items-start gap-6">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-white m-0">{seleccionado.codigo}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.color}`}>
                  {meta.icon} {meta.label}
                </span>
                <span className={`text-sm font-semibold ${estado.color}`}>
                  ● {estado.label}
                </span>
              </div>
              <p className="text-muted text-lg mt-3">{seleccionado.nombre}</p>
              <p className="text-slate-500 text-sm mt-1">
                Mandante: {seleccionado.mandante ?? '—'}
              </p>
            </div>
          </div>

          {/* Avance físico de juntas */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-300 text-sm font-semibold">Avance físico (juntas ejecutadas)</span>
              <span className="text-accent font-bold">{pctAvance(seleccionado)}%</span>
            </div>
            <div className="h-2.5 bg-background rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-500" 
                style={{ width: `${pctAvance(seleccionado)}%` }}
              />
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
            {kpis.map((k) => (
              <div key={k.label} className="bg-background border border-border rounded-xl p-5 text-center">
                <div className="text-2xl font-extrabold text-white">
                  {k.valor.toLocaleString('es-CL')}
                </div>
                <div className="text-xs text-muted mt-1.5 font-medium">{k.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // ─── Vista de cartera ───
  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl text-white font-display font-bold tracking-tight">Proyectos</h1>
        <p className="text-muted text-base mt-2">
          {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} visible{proyectos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500 text-sm mb-6">
          ⚠️ Error al cargar los proyectos: {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted text-center py-16">Cargando proyectos…</div>
      ) : proyectos.length === 0 && !error ? (
        <div className="text-center py-20 px-6 bg-panel rounded-2xl border border-dashed border-border">
          <div className="text-4xl mb-4">🗂️</div>
          <h3 className="text-white text-xl font-semibold mb-2">No hay proyectos visibles</h3>
          <p className="text-muted text-sm m-0">
            Crea tu primer proyecto o pide a un administrador que te agregue como miembro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {proyectos.map((p) => {
            const meta = INDUSTRIA_META[p.industria];
            const estado = ESTADO_META[p.estado] ?? { label: p.estado, color: 'text-slate-400' };
            return (
              <Card
                key={p.id}
                onClick={() => setSeleccionado(p)}
                className="p-6 cursor-pointer hover:-translate-y-1 hover:border-accent transition-all bg-panel/80 backdrop-blur-md"
              >
                <div className="flex justify-between items-center mb-4">
                  <span className={`px-3 py-1 rounded-full text-[0.75rem] font-bold ${meta.bg} ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className={`text-[0.78rem] font-semibold ${estado.color}`}>
                    ● {estado.label}
                  </span>
                </div>

                <h3 className="text-white text-lg font-bold m-0">{p.codigo}</h3>
                <p className="text-muted text-sm mt-1 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  {p.nombre}
                </p>
                <p className="text-slate-500 text-xs mt-1 mb-0">
                  {p.mandante ?? 'Sin mandante'}
                </p>

                {/* Avance */}
                <div className="mt-5">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted">Avance juntas</span>
                    <span className="text-accent font-bold">{pctAvance(p)}%</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-500" 
                      style={{ width: `${pctAvance(p)}%` }}
                    />
                  </div>
                </div>

                {/* Mini KPIs */}
                <div className="flex justify-between mt-5 pt-3.5 border-t border-white/5 text-xs text-muted">
                  <span><strong className="text-slate-200">{p.n_lineas.toLocaleString('es-CL')}</strong> líneas</span>
                  <span><strong className="text-slate-200">{p.n_spools.toLocaleString('es-CL')}</strong> spools</span>
                  <span><strong className="text-slate-200">{p.n_juntas.toLocaleString('es-CL')}</strong> juntas</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {mostrarWizard && (
        <NuevoProyectoModal
          onClose={() => setMostrarWizard(false)}
          onSuccess={handleProyectoCreado}
        />
      )}
    </div>
  );
};

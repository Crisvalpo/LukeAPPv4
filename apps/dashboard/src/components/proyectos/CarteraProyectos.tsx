import React, { useState, useEffect, useCallback } from 'react';
import { useHeaderActions } from '../../hooks/useHeaderActions';
import { supabase } from '../../supabaseClient';
import { NuevoProyectoModal } from './NuevoProyectoModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';


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
  esGerencia: boolean;
}


export const CarteraProyectos: React.FC<CarteraProyectosProps> = ({ onAbrirIngesta, esGerencia }) => {

  const [proyectos, setProyectos] = useState<ProyectoKpis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarWizard, setMostrarWizard] = useState(false);


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


  const handleProyectoCreado = (proyectoId: string) => {
    setMostrarWizard(false);
    fetchProyectos();
    onAbrirIngesta(proyectoId);
  };


  const pctAvance = (p: ProyectoKpis) =>
    p.n_juntas > 0 ? Math.round((p.n_juntas_ejecutadas / p.n_juntas) * 100) : 0;

  // Botón "+ Nuevo Proyecto" solo para GERENCIA — acción propia de la vista cartera.
  useHeaderActions(
    esGerencia ? (
      <Button variant="primary" size="sm" onClick={() => setMostrarWizard(true)}>
        + Nuevo Proyecto
      </Button>
    ) : null
  );


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
                onClick={() => onAbrirIngesta(p.id)}
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

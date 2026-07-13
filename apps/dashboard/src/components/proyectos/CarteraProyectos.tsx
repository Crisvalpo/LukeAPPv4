import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { NuevoProyectoModal } from './NuevoProyectoModal';

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
  mineria: { label: 'Minería', icon: '⛏️', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
  refineria: { label: 'Refinería', icon: '🛢️', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  celulosa: { label: 'Celulosa', icon: '🌲', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

const ESTADO_META: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: '#22c55e' },
  en_pausa: { label: 'En pausa', color: '#eab308' },
  cerrado: { label: 'Cerrado', color: '#64748b' },
  borrador: { label: 'Borrador', color: '#94a3b8' },
};

interface CarteraProyectosProps {
  onAbrirIngesta: (proyectoId: string) => void;
}

export const CarteraProyectos: React.FC<CarteraProyectosProps> = ({ onAbrirIngesta }) => {
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

  const handleProyectoCreado = () => {
    setMostrarWizard(false);
    fetchProyectos();
  };

  const pctAvance = (p: ProyectoKpis) =>
    p.n_juntas > 0 ? Math.round((p.n_juntas_ejecutadas / p.n_juntas) * 100) : 0;

  // ─── Panel drill-down de un proyecto ───
  if (seleccionado) {
    const meta = INDUSTRIA_META[seleccionado.industria];
    const estado = ESTADO_META[seleccionado.estado] ?? { label: seleccionado.estado, color: '#94a3b8' };
    const kpis = [
      { label: 'Líneas', valor: seleccionado.n_lineas },
      { label: 'Isométricos', valor: seleccionado.n_isos },
      { label: 'Spools', valor: seleccionado.n_spools },
      { label: 'Juntas', valor: seleccionado.n_juntas },
      { label: 'Ítems MTO', valor: seleccionado.n_mto },
      { label: 'Juntas ejecutadas', valor: seleccionado.n_juntas_ejecutadas },
    ];

    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        <button
          onClick={() => setSeleccionado(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#38bdf8',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '20px',
          }}
        >
          ← Volver a la cartera
        </button>

        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '32px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>{seleccionado.codigo}</h1>
                <span style={{
                  backgroundColor: meta.bg,
                  color: meta.color,
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}>
                  {meta.icon} {meta.label}
                </span>
                <span style={{ color: estado.color, fontSize: '0.85rem', fontWeight: 600 }}>
                  ● {estado.label}
                </span>
              </div>
              <p style={{ color: '#94a3b8', margin: '8px 0 0 0', fontSize: '1.05rem' }}>{seleccionado.nombre}</p>
              <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                Mandante: {seleccionado.mandante ?? '—'}
              </p>
            </div>
            <button
              onClick={() => onAbrirIngesta(seleccionado.id)}
              style={{
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✨ Ingesta Documental IA
            </button>
          </div>

          {/* Avance físico de juntas */}
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 600 }}>Avance físico (juntas ejecutadas)</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{pctAvance(seleccionado)}%</span>
            </div>
            <div style={{ height: '10px', backgroundColor: '#0f172a', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pctAvance(seleccionado)}%`,
                background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
                borderRadius: '5px',
                transition: 'width 0.5s',
              }} />
            </div>
          </div>

          {/* KPIs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginTop: '28px',
          }}>
            {kpis.map((k) => (
              <div key={k.label} style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '20px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
                  {k.valor.toLocaleString('es-CL')}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista de cartera ───
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>Cartera de Proyectos</h1>
          <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '0.95rem' }}>
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} visible{proyectos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setMostrarWizard(true)}
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.3)',
          }}
        >
          + Nuevo Proyecto
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#f87171',
          fontSize: '0.875rem',
          marginBottom: '20px',
        }}>
          ⚠️ Error al cargar la cartera: {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '60px 0' }}>Cargando cartera…</div>
      ) : proyectos.length === 0 && !error ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 24px',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          border: '1px dashed #334155',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗂️</div>
          <h3 style={{ color: '#f8fafc', margin: '0 0 8px 0' }}>No hay proyectos visibles</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Crea tu primer proyecto o pide a un administrador que te agregue como miembro.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
        }}>
          {proyectos.map((p) => {
            const meta = INDUSTRIA_META[p.industria];
            const estado = ESTADO_META[p.estado] ?? { label: p.estado, color: '#94a3b8' };
            return (
              <div
                key={p.id}
                onClick={() => setSeleccionado(p)}
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = meta.color;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    backgroundColor: meta.bg,
                    color: meta.color,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span style={{ color: estado.color, fontSize: '0.78rem', fontWeight: 600 }}>
                    ● {estado.label}
                  </span>
                </div>

                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem' }}>{p.codigo}</h3>
                <p style={{
                  color: '#94a3b8',
                  margin: '4px 0 0 0',
                  fontSize: '0.88rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {p.nombre}
                </p>
                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.8rem' }}>
                  {p.mandante ?? 'Sin mandante'}
                </p>

                {/* Avance */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Avance juntas</span>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>{pctAvance(p)}%</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pctAvance(p)}%`,
                      background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
                    }} />
                  </div>
                </div>

                {/* Mini KPIs */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  paddingTop: '14px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                }}>
                  <span><strong style={{ color: '#e2e8f0' }}>{p.n_lineas.toLocaleString('es-CL')}</strong> líneas</span>
                  <span><strong style={{ color: '#e2e8f0' }}>{p.n_spools.toLocaleString('es-CL')}</strong> spools</span>
                  <span><strong style={{ color: '#e2e8f0' }}>{p.n_juntas.toLocaleString('es-CL')}</strong> juntas</span>
                </div>
              </div>
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

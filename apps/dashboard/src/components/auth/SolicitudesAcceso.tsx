import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

interface Solicitud {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  mensaje_solicitud: string | null;
  proyecto_solicitado_id: string | null;
  solicitado_en: string;
}

interface ProyectoOpcion {
  id: string;
  codigo: string;
  nombre: string;
}

const ROLES = ['ADMIN', 'OT', 'QAQC', 'LOGISTICA', 'SUPERVISOR', 'GERENCIA'] as const;

export const SolicitudesAcceso: React.FC = () => {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOpcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [accionAbierta, setAccionAbierta] = useState<{ id: string; tipo: 'aprobar' | 'rechazar' } | null>(null);
  const [proyectoSel, setProyectoSel] = useState('');
  const [rolSel, setRolSel] = useState<typeof ROLES[number]>('OT');
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: sol, error: errSol }, { data: proy, error: errProy }] = await Promise.all([
      supabase.rpc('solicitudes_pendientes'),
      supabase.from('v_cartera_kpis').select('id, codigo, nombre').order('codigo'),
    ]);
    if (errSol) setError(errSol.message);
    else setSolicitudes((sol as Solicitud[]) ?? []);
    if (!errProy) setProyectos((proy as ProyectoOpcion[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDatos(); }, [fetchDatos]);

  const abrirAprobar = (s: Solicitud) => {
    setAccionAbierta({ id: s.id, tipo: 'aprobar' });
    setProyectoSel(s.proyecto_solicitado_id ?? '');
    setRolSel('OT');
    setAviso(null); setError(null);
  };

  const abrirRechazar = (s: Solicitud) => {
    setAccionAbierta({ id: s.id, tipo: 'rechazar' });
    setMotivo('');
    setAviso(null); setError(null);
  };

  const confirmarAprobar = async (usuarioId: string) => {
    if (!proyectoSel) { setError('Selecciona un proyecto.'); return; }
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('aprobar_usuario', {
      p_usuario_id: usuarioId,
      p_proyecto_id: proyectoSel,
      p_rol: rolSel,
    });
    if (err) setError(err.message);
    else {
      setAviso('Cuenta aprobada.');
      setAccionAbierta(null);
      await fetchDatos();
    }
    setProcesando(false);
  };

  const confirmarRechazar = async (usuarioId: string) => {
    if (!motivo.trim()) { setError('Indica un motivo.'); return; }
    setProcesando(true);
    setError(null);
    const { error: err } = await supabase.rpc('rechazar_usuario', {
      p_usuario_id: usuarioId,
      p_motivo: motivo.trim(),
    });
    if (err) setError(err.message);
    else {
      setAviso('Solicitud rechazada.');
      setAccionAbierta(null);
      await fetchDatos();
    }
    setProcesando(false);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#f8fafc' }}>Solicitudes de Acceso</h1>
      <p style={{ color: '#94a3b8', margin: '6px 0 28px 0', fontSize: '0.95rem' }}>
        {solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''} pendiente{solicitudes.length !== 1 ? 's' : ''}
      </p>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '0.875rem', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}
      {aviso && (
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#34d399', fontSize: '0.875rem', marginBottom: '20px' }}>
          ✓ {aviso}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '60px 0' }}>Cargando…</div>
      ) : solicitudes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: '#1e293b', borderRadius: '16px', border: '1px dashed #334155', color: '#94a3b8' }}>
          No hay solicitudes pendientes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {solicitudes.map((s) => (
            <div key={s.id} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem' }}>{s.nombre ?? s.email}</h3>
                  <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>{s.email}{s.telefono ? ` · ${s.telefono}` : ''}</p>
                  <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                    Solicitado el {new Date(s.solicitado_en).toLocaleString('es-CL')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => abrirAprobar(s)}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    onClick={() => abrirRechazar(s)}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    ✕ Rechazar
                  </button>
                </div>
              </div>

              {s.mensaje_solicitud && (
                <p style={{ margin: '14px 0 0 0', color: '#cbd5e1', fontSize: '0.9rem', backgroundColor: '#0f172a', borderRadius: '8px', padding: '12px 14px', lineHeight: 1.5 }}>
                  {s.mensaje_solicitud}
                </p>
              )}

              {accionAbierta?.id === s.id && accionAbierta.tipo === 'aprobar' && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', borderTop: '1px solid #334155', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Proyecto</label>
                    <select value={proyectoSel} onChange={(e) => setProyectoSel(e.target.value)} style={selectStyle}>
                      <option value="">— Selecciona —</option>
                      {proyectos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Rol</label>
                    <select value={rolSel} onChange={(e) => setRolSel(e.target.value as typeof ROLES[number])} style={selectStyle}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => confirmarAprobar(s.id)}
                    disabled={procesando}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: procesando ? 'wait' : 'pointer' }}
                  >
                    {procesando ? 'Aprobando…' : 'Confirmar aprobación'}
                  </button>
                  <button onClick={() => setAccionAbierta(null)} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              )}

              {accionAbierta?.id === s.id && accionAbierta.tipo === 'rechazar' && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', borderTop: '1px solid #334155', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1, minWidth: '220px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Motivo del rechazo</label>
                    <input
                      type="text"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej: No corresponde a un proyecto activo"
                      style={selectStyle}
                    />
                  </div>
                  <button
                    onClick={() => confirmarRechazar(s.id)}
                    disabled={procesando}
                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: procesando ? 'wait' : 'pointer' }}
                  >
                    {procesando ? 'Rechazando…' : 'Confirmar rechazo'}
                  </button>
                  <button onClick={() => setAccionAbierta(null)} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const selectStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#e2e8f0',
  fontSize: '0.85rem',
  minWidth: '160px',
};

export default SolicitudesAcceso;

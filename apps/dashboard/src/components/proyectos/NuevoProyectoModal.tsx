import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

interface Empresa {
  id: string;
  nombre: string;
}

interface NuevoProyectoModalProps {
  onClose: () => void;
  onSuccess: (proyectoId: string) => void;
}

export const NuevoProyectoModal: React.FC<NuevoProyectoModalProps> = ({ onClose, onSuccess }) => {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [mandanteId, setMandanteId] = useState('');
  const [industria, setIndustria] = useState<'mineria' | 'refineria' | 'celulosa'>('mineria');

  // Carga de empresas
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [mostrarNuevaEmpresa, setMostrarNuevaEmpresa] = useState(false);
  const [nombreNuevaEmpresa, setNombreNuevaEmpresa] = useState('');

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const fetchEmpresas = async () => {
    try {
      const { data, error: err } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('tipo', 'mandante')
        .eq('activo', true);

      if (err) throw err;
      if (data) {
        setEmpresas(data);
        if (data.length > 0) {
          setMandanteId(data[0].id);
        }
      }
    } catch (e: any) {
      console.error('Error al cargar empresas:', e.message);
    }
  };

  const handleCrearEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevaEmpresa.trim()) return;

    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('empresas')
        .insert({
          nombre: nombreNuevaEmpresa.trim(),
          tipo: 'mandante',
          activo: true
        })
        .select()
        .single();

      if (err) throw err;
      if (data) {
        setEmpresas([...empresas, data]);
        setMandanteId(data.id);
        setNombreNuevaEmpresa('');
        setMostrarNuevaEmpresa(false);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearProyecto = async () => {
    if (!codigo.trim() || !nombre.trim() || !mandanteId) {
      setError('Por favor completa todos los campos obligatorios.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // La función usa auth.uid() en el servidor como creador; solo requiere sesión activa.
      const { data, error: err } = await supabase.rpc('crear_proyecto_wizard', {
        p_codigo: codigo.trim().toUpperCase(),
        p_nombre: nombre.trim(),
        p_mandante_id: mandanteId,
        p_industria: industria
      });

      if (err) throw err;
      if (data) {
        onSuccess(data);
      }
    } catch (e: any) {
      setError(e.message || 'Error al crear el proyecto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '540px',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        
        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Nuevo Proyecto
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Paso {paso} de 3
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
          >
            ✕
          </button>
        </div>

        {/* Indicador de Pasos */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flexGrow: 1, height: '4px', backgroundColor: paso >= 1 ? '#0ea5e9' : '#334155', borderRadius: '2px', transition: 'all 0.3s' }}></div>
          <div style={{ flexGrow: 1, height: '4px', backgroundColor: paso >= 2 ? '#0ea5e9' : '#334155', borderRadius: '2px', transition: 'all 0.3s' }}></div>
          <div style={{ flexGrow: 1, height: '4px', backgroundColor: paso >= 3 ? '#0ea5e9' : '#334155', borderRadius: '2px', transition: 'all 0.3s' }}></div>
        </div>

        {/* Alerta de Error */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#f87171',
            fontSize: '0.875rem',
            lineHeight: 1.5
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Contenido del Paso */}
        <div style={{ minHeight: '220px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {paso === 1 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Código del Proyecto <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Ej: PROY-413"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#f8fafc',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0ea5e9'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#334155'}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Identificador único corto del proyecto en el sistema.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Nombre del Proyecto <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Ej: Planta de Celulosa Valdivia"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#f8fafc',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0ea5e9'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#334155'}
                />
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1' }}>
                    Mandante <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <button 
                    onClick={() => setMostrarNuevaEmpresa(!mostrarNuevaEmpresa)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0ea5e9',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {mostrarNuevaEmpresa ? 'Seleccionar existente' : '+ Crear nuevo'}
                  </button>
                </div>

                {mostrarNuevaEmpresa ? (
                  <form onSubmit={handleCrearEmpresa} style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Nombre del Mandante (ej: ARAUCO)"
                      value={nombreNuevaEmpresa}
                      onChange={(e) => setNombreNuevaEmpresa(e.target.value)}
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        flexGrow: 1,
                        outline: 'none'
                      }}
                    />
                    <button 
                      type="submit" 
                      disabled={loading || !nombreNuevaEmpresa.trim()}
                      style={{
                        backgroundColor: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0 16px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Guardar
                    </button>
                  </form>
                ) : (
                  <select 
                    value={mandanteId}
                    onChange={(e) => setMandanteId(e.target.value)}
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      color: '#f8fafc',
                      fontSize: '1rem',
                      outline: 'none'
                    }}
                  >
                    {empresas.length === 0 ? (
                      <option value="">No hay mandantes creados</option>
                    ) : (
                      empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Industria <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {(['mineria', 'refineria', 'celulosa'] as const).map((ind) => {
                    const active = industria === ind;
                    const borderCol = active 
                      ? (ind === 'mineria' ? '#f97316' : ind === 'refineria' ? '#06b6d4' : '#10b981')
                      : '#334155';
                    const bgCol = active 
                      ? (ind === 'mineria' ? 'rgba(249, 115, 22, 0.1)' : ind === 'refineria' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(16, 185, 129, 0.1)')
                      : '#0f172a';
                    const icon = ind === 'mineria' ? '🟠' : ind === 'refineria' ? '🔵' : '🟢';
                    
                    return (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => setIndustria(ind)}
                        style={{
                          backgroundColor: bgCol,
                          border: `2px solid ${borderCol}`,
                          borderRadius: '12px',
                          padding: '16px 8px',
                          color: '#f8fafc',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                        {ind}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Esto inicializará automáticamente los catálogos y clases de piping correspondientes.
                </span>
              </div>
            </>
          )}

          {paso === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
                Resumen de Configuración
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b' }}>Código:</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{codigo.toUpperCase()}</span>
                
                <span style={{ color: '#64748b' }}>Nombre:</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{nombre}</span>
                
                <span style={{ color: '#64748b' }}>Mandante:</span>
                <span style={{ color: '#cbd5e1' }}>
                  {empresas.find(e => e.id === mandanteId)?.nombre || 'Por definir'}
                </span>
                
                <span style={{ color: '#64748b' }}>Industria:</span>
                <span style={{ color: '#cbd5e1', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {industria === 'mineria' ? '🟠 Minería' : industria === 'refineria' ? '🔵 Refinería' : '🟢 Celulosa'}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px', lineHeight: 1.4 }}>
                💡 Al crear el proyecto se copiarán los catálogos e industria seleccionada y se te asignará el rol de <strong>ADMIN</strong> con control total de maestros.
              </div>
            </div>
          )}

        </div>

        {/* Botones de Navegación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
          <button
            disabled={paso === 1 || loading}
            onClick={() => setPaso(paso - 1)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#cbd5e1',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: paso === 1 ? 0.3 : 1
            }}
          >
            Atrás
          </button>

          {paso < 3 ? (
            <button
              disabled={(paso === 1 && (!codigo.trim() || !nombre.trim())) || (paso === 2 && !mandanteId)}
              onClick={() => setPaso(paso + 1)}
              style={{
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Siguiente
            </button>
          ) : (
            <button
              disabled={loading}
              onClick={handleCrearProyecto}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 28px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
              }}
            >
              {loading ? 'Creando...' : 'Crear Proyecto'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

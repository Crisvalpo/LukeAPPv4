import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

type Modo = 'ingresar' | 'registrar' | 'recuperar';

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '12px 16px',
  color: '#f8fafc',
  fontSize: '1rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = { fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1' };

interface LoginProps {
  avisoInicial?: string | null;
}

export const Login: React.FC<LoginProps> = ({ avisoInicial }) => {
  const [modo, setModo] = useState<Modo>('ingresar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [mensajeSolicitud, setMensajeSolicitud] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(avisoInicial ?? null);

  const resetMensajes = () => { setError(null); setAviso(null); };

  const handleIngresar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMensajes();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : err.message);
    }
    // Si el login es exitoso, onAuthStateChange en App actualiza la sesión.
    setLoading(false);
  };

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMensajes();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          mensaje_solicitud: mensajeSolicitud,
        },
      },
    });
    if (err) {
      setError(err.message);
    } else {
      setAviso('Solicitud enviada. Un administrador debe aprobar tu cuenta antes de que puedas ingresar. Revisa tu correo para confirmar tu email.');
      setEmail(''); setPassword(''); setNombre(''); setMensajeSolicitud('');
    }
    setLoading(false);
  };

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMensajes();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    // Mensaje siempre igual, exista o no la cuenta — no revelar el padrón de usuarios.
    setAviso('Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.');
    setLoading(false);
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    resetMensajes();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      padding: '20px',
    }}>
      <form
        onSubmit={modo === 'ingresar' ? handleIngresar : modo === 'registrar' ? handleRegistrar : handleRecuperar}
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            LukeAPP v4
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '8px 0 0 0' }}>
            {modo === 'ingresar' && 'Plataforma de trazabilidad de montaje industrial'}
            {modo === 'registrar' && 'Solicitar una cuenta nueva'}
            {modo === 'recuperar' && 'Recuperar contraseña'}
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '0.875rem' }}>
            ⚠️ {error}
          </div>
        )}
        {aviso && (
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#34d399', fontSize: '0.875rem' }}>
            ✓ {aviso}
          </div>
        )}

        {modo === 'registrar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={labelStyle}>Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              required
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={labelStyle}>Correo</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.cl"
            required
            style={inputStyle}
          />
        </div>

        {modo !== 'recuperar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={labelStyle}>Contraseña</label>
            <input
              type="password"
              autoComplete={modo === 'registrar' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={modo === 'registrar' ? 6 : undefined}
              style={inputStyle}
            />
          </div>
        )}

        {modo === 'registrar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={labelStyle}>¿A qué empresa/proyecto perteneces y quién es tu supervisor?</label>
            <textarea
              value={mensajeSolicitud}
              onChange={(e) => setMensajeSolicitud(e.target.value)}
              placeholder="Ej: Contratista XYZ, proyecto Andina, supervisor Juan Pérez"
              rows={3}
              required
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || (modo !== 'recuperar' && !password) || (modo === 'registrar' && (!nombre || !mensajeSolicitud))}
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            marginTop: '8px',
          }}
        >
          {loading ? 'Procesando…' : modo === 'ingresar' ? 'Ingresar' : modo === 'registrar' ? 'Solicitar cuenta' : 'Enviar enlace de recuperación'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.85rem', marginTop: '4px' }}>
          {modo === 'ingresar' ? (
            <>
              <button type="button" onClick={() => cambiarModo('registrar')} style={linkStyle}>Crear cuenta</button>
              <button type="button" onClick={() => cambiarModo('recuperar')} style={linkStyle}>¿Olvidaste tu contraseña?</button>
            </>
          ) : (
            <button type="button" onClick={() => cambiarModo('ingresar')} style={linkStyle}>← Volver a ingresar</button>
          )}
        </div>
      </form>
    </div>
  );
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#38bdf8',
  cursor: 'pointer',
  fontWeight: 600,
  padding: 0,
};

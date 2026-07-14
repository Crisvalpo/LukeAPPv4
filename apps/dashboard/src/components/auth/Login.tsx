import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { colors, fontDisplay, fontBody } from '../../theme';

type Modo = 'ingresar' | 'registrar' | 'recuperar';

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: `1px solid ${colors.border}`,
  borderRadius: '10px',
  padding: '12px 16px',
  color: colors.text,
  fontSize: '0.95rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: fontBody,
  transition: 'border-color 0.2s ease, background 0.2s ease',
};

const labelStyle: React.CSSProperties = {
  fontFamily: fontBody,
  fontSize: '0.82rem',
  fontWeight: 600,
  color: colors.textMuted,
};

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = colors.accentSky;
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = colors.border;
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
  },
};

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
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(ellipse 70% 55% at 50% 30%, rgba(56,189,248,0.08), transparent 70%), ${colors.bg}`,
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 35%, black 30%, transparent 80%)',
        }}
      />

      <form
        onSubmit={modo === 'ingresar' ? handleIngresar : modo === 'registrar' ? handleRegistrar : handleRecuperar}
        style={{
          position: 'relative',
          backgroundColor: colors.bgCard,
          backdropFilter: 'blur(16px)',
          border: `1px solid ${colors.border}`,
          borderRadius: '18px',
          width: '100%',
          maxWidth: '420px',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{
            fontFamily: fontDisplay,
            fontSize: '1.6rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            background: colors.accentGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            LukeAPP v4
          </div>
          <p style={{ fontFamily: fontBody, color: colors.textMuted, fontSize: '0.88rem', margin: '8px 0 0 0' }}>
            {modo === 'ingresar' && 'Plataforma de trazabilidad de montaje industrial'}
            {modo === 'registrar' && 'Solicitar una cuenta nueva'}
            {modo === 'recuperar' && 'Recuperar contraseña'}
          </p>
        </div>

        {error && (
          <div style={{ fontFamily: fontBody, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '12px 16px', color: '#f87171', fontSize: '0.85rem', lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {aviso && (
          <div style={{ fontFamily: fontBody, backgroundColor: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: '10px', padding: '12px 16px', color: colors.statusInstalled, fontSize: '0.85rem', lineHeight: 1.5 }}>
            {aviso}
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
              {...focusHandlers}
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
            {...focusHandlers}
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
              {...focusHandlers}
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
              style={{ ...inputStyle, resize: 'vertical' }}
              {...focusHandlers}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || (modo !== 'recuperar' && !password) || (modo === 'registrar' && (!nombre || !mensajeSolicitud))}
          style={{
            fontFamily: fontBody,
            background: colors.accentGradient,
            color: '#08101f',
            border: 'none',
            borderRadius: '10px',
            padding: '13px',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            marginTop: '8px',
            boxShadow: '0 12px 28px rgba(56, 189, 248, 0.2)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseOver={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 16px 34px rgba(56, 189, 248, 0.3)'; } }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(56, 189, 248, 0.2)'; }}
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
  fontFamily: fontBody,
  background: 'none',
  border: 'none',
  color: colors.accentSky,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
  padding: 0,
};

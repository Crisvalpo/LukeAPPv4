import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Modo = 'ingresar' | 'registrar' | 'recuperar';

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
    setAviso('Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.');
    setLoading(false);
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    resetMensajes();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-5 relative overflow-hidden">
      {/* Patrón de fondo serio e industrial (sin brillos/estrellitas) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <form
        onSubmit={modo === 'ingresar' ? handleIngresar : modo === 'registrar' ? handleRegistrar : handleRecuperar}
        className="relative bg-card/80 backdrop-blur-md border border-border rounded-xl w-full max-w-md p-8 md:p-10 flex flex-col gap-6 shadow-2xl z-10"
      >
        <div className="text-center mb-2">
          <div className="font-display text-3xl font-extrabold tracking-tight">
            <span className="text-white">LukeAPP</span>{' '}
            <span className="text-accent">v4</span>
          </div>
          <p className="font-sans text-muted text-sm mt-2">
            {modo === 'ingresar' && 'Plataforma de trazabilidad de montaje industrial'}
            {modo === 'registrar' && 'Solicitar una cuenta nueva'}
            {modo === 'recuperar' && 'Recuperar contraseña'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-md px-4 py-3 text-red-500 text-sm leading-relaxed">
            {error}
          </div>
        )}
        {aviso && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-md px-4 py-3 text-status-installed text-sm leading-relaxed">
            {aviso}
          </div>
        )}

        {modo === 'registrar' && (
          <Input
            label="Nombre completo"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            required
          />
        )}

        <Input
          label="Correo"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@empresa.cl"
          required
        />

        {modo !== 'recuperar' && (
          <Input
            label="Contraseña"
            type="password"
            autoComplete={modo === 'registrar' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={modo === 'registrar' ? 6 : undefined}
          />
        )}

        {modo === 'registrar' && (
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-muted font-sans">
              ¿A qué empresa/proyecto perteneces y quién es tu supervisor?
            </label>
            <textarea
              className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-y min-h-[80px]"
              value={mensajeSolicitud}
              onChange={(e) => setMensajeSolicitud(e.target.value)}
              placeholder="Ej: Contratista XYZ, proyecto Andina, supervisor Juan Pérez"
              required
            />
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          loading={loading}
          disabled={!email || (modo !== 'recuperar' && !password) || (modo === 'registrar' && (!nombre || !mensajeSolicitud))}
        >
          {modo === 'ingresar' ? 'Ingresar' : modo === 'registrar' ? 'Solicitar cuenta' : 'Enviar enlace de recuperación'}
        </Button>

        <div className="flex justify-center gap-4 text-sm mt-2">
          {modo === 'ingresar' ? (
            <>
              <button type="button" onClick={() => cambiarModo('registrar')} className="text-accent font-semibold hover:underline">Crear cuenta</button>
              <button type="button" onClick={() => cambiarModo('recuperar')} className="text-accent font-semibold hover:underline">¿Olvidaste tu contraseña?</button>
            </>
          ) : (
            <button type="button" onClick={() => cambiarModo('ingresar')} className="text-accent font-semibold hover:underline">← Volver a ingresar</button>
          )}
        </div>
      </form>
    </div>
  );
};

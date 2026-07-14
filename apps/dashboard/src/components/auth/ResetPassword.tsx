import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface ResetPasswordProps {
  onCompletado: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onCompletado }) => {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    onCompletado();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-5 relative overflow-hidden">
      {/* Patrón de fondo serio e industrial */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <form onSubmit={handleSubmit} className="relative bg-card/80 backdrop-blur-md border border-border rounded-xl w-full max-w-md p-8 md:p-10 flex flex-col gap-6 shadow-2xl z-10">
        <div className="text-center mb-2">
          <div className="font-display text-3xl font-extrabold tracking-tight">
            <span className="text-white">LukeAPP</span>{' '}
            <span className="text-accent">v4</span>
          </div>
          <p className="font-sans text-muted text-sm mt-2">Elige una nueva contraseña</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-md px-4 py-3 text-red-500 text-sm leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground">Nueva contraseña</label>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-foreground">Confirmar contraseña</label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !password || !confirmacion}
          className="w-full mt-2"
        >
          {loading ? 'Guardando…' : 'Actualizar contraseña'}
        </Button>
      </form>
    </div>
  );
};

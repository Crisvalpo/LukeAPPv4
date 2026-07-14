import type { CSSProperties } from 'react';

// Sistema de diseño compartido para la landing page.
// Paleta consistente con el resto del dashboard (gradiente sky→indigo)
// pero con un fondo más profundo y acentos más contenidos para un
// registro visual "enterprise industrial", no consumer/playful.

export const colors = {
  bg: '#080b14',
  bgPanel: '#0d1220',
  bgCard: 'rgba(255, 255, 255, 0.03)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  text: '#e8ecf5',
  textMuted: '#8b94a8',
  textFaint: '#5b6478',
  accentSky: '#38bdf8',
  accentIndigo: '#818cf8',
  accentGradient: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
  statusPending: '#5b6478',
  statusPrefab: '#f59e0b',
  statusTransit: '#38bdf8',
  statusInstalled: '#34d399',
};

export const fontDisplay = "'Space Grotesk', 'Inter', system-ui, sans-serif";
export const fontBody = "'Inter', system-ui, sans-serif";

export const easing = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

export const section: CSSProperties = {
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 48px',
};

export const eyebrow: CSSProperties = {
  fontFamily: fontBody,
  fontSize: '0.8rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: colors.accentSky,
};

import { colors, fontDisplay, fontBody, section } from '../../theme';

interface CTASectionProps {
  onLoginClick: () => void;
}

export function CTASection({ onLoginClick }: CTASectionProps) {
  return (
    <div style={{ position: 'relative', background: colors.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 55% at 50% 40%, rgba(56,189,248,0.1), transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 40%, black 30%, transparent 80%)',
        }}
      />

      <div style={{ ...section, position: 'relative', padding: '140px 48px 80px', textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: fontDisplay,
            fontSize: 'clamp(2.1rem, 4vw, 3.2rem)',
            fontWeight: 700,
            color: colors.text,
            margin: '0 0 20px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Lleva tu próximo proyecto con trazabilidad real
        </h2>
        <p style={{ fontFamily: fontBody, fontSize: '1.05rem', color: colors.textMuted, maxWidth: '520px', margin: '0 auto 40px' }}>
          Crea tu proyecto, carga el line list y empieza a registrar avance de terreno hoy mismo.
        </p>

        <button
          onClick={onLoginClick}
          style={{
            fontFamily: fontBody,
            background: colors.accentGradient,
            border: 'none',
            color: '#08101f',
            padding: '15px 38px',
            fontSize: '1rem',
            fontWeight: 700,
            borderRadius: '10px',
            cursor: 'pointer',
            boxShadow: '0 12px 32px rgba(56, 189, 248, 0.25)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 16px 40px rgba(56, 189, 248, 0.35)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(56, 189, 248, 0.25)';
          }}
        >
          Ingresar a LukeAPP
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          borderTop: `1px solid ${colors.border}`,
          padding: '28px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          maxWidth: '1280px',
          margin: '0 auto',
        }}
      >
        <span style={{ fontFamily: fontBody, fontSize: '0.82rem', fontWeight: 700, color: colors.textMuted }}>LukeAPP v4</span>
        <span style={{ fontFamily: fontBody, fontSize: '0.78rem', color: colors.textFaint }}>
          Minería · Refinería · Celulosa
        </span>
      </div>
    </div>
  );
}

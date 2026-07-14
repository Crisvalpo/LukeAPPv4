import { useEffect, useState } from 'react';
import Lenis from '@studio-freight/lenis';
import { HeroIsometric } from './HeroIsometric';
import { PipelineCanvas3D } from './PipelineCanvas3D';
import { FeaturesSection } from './FeaturesSection';
import { CTASection } from './CTASection';
import { colors, fontBody } from './theme';

export function LandingPage({ onLoginClick }: { onLoginClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    lenis.on('scroll', ({ scroll }: { scroll: number }) => setScrolled(scroll > 40));

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div style={{ background: colors.bg, color: colors.text, fontFamily: fontBody }}>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          padding: '18px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 50,
          background: scrolled ? 'rgba(8, 11, 20, 0.75)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? `1px solid ${colors.border}` : '1px solid transparent',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        <div style={{ fontFamily: fontBody, fontSize: '1.15rem', fontWeight: 800, color: colors.text, letterSpacing: '-0.01em' }}>
          LukeAPP <span style={{ color: colors.accentSky }}>v4</span>
        </div>
        <button
          onClick={onLoginClick}
          style={{
            fontFamily: fontBody,
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${colors.borderStrong}`,
            color: colors.text,
            padding: '9px 22px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.88rem',
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = colors.accentSky; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = colors.borderStrong; }}
        >
          Iniciar Sesión
        </button>
      </header>

      <HeroIsometric />
      <PipelineCanvas3D />
      <FeaturesSection />
      <CTASection onLoginClick={onLoginClick} />
    </div>
  );
}

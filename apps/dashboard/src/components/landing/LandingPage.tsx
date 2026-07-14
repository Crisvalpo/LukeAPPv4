import { useEffect, useState } from 'react';
import Lenis from '@studio-freight/lenis';
import { HeroIsometric } from './HeroIsometric';
import { PipelineCanvas3D } from './PipelineCanvas3D';
import { CTASection } from './CTASection';
import { Button } from '../ui/Button';

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
    <div className="bg-background text-foreground font-sans">
      <header
        className={`fixed top-0 left-0 w-full px-12 py-4 flex justify-between items-center z-50 transition-all duration-300 ${
          scrolled ? 'bg-panel/75 backdrop-blur-md border-b border-border' : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="font-display text-xl font-extrabold tracking-tight">
          LukeAPP <span className="text-accent">v4</span>
        </div>
        <Button variant="outline" size="sm" onClick={onLoginClick}>
          Iniciar Sesión
        </Button>
      </header>

      <HeroIsometric />
      <PipelineCanvas3D />
      <CTASection onLoginClick={onLoginClick} />
    </div>
  );
}

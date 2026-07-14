import { Button } from '../ui/Button';

interface CTASectionProps {
  onLoginClick: () => void;
}

export function CTASection({ onLoginClick }: CTASectionProps) {
  return (
    <div className="relative bg-background overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 55% at 50% 40%, rgba(56,189,248,0.1), transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 40%, black 30%, transparent 80%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-12 pt-[140px] pb-[80px] text-center">
        <h2 className="font-display text-[clamp(2.1rem,4vw,3.2rem)] font-bold text-foreground m-0 mb-5 tracking-tight">
          Lleva tu próximo proyecto con trazabilidad real
        </h2>
        <p className="font-sans text-[1.05rem] text-muted max-w-[520px] mx-auto mb-10">
          Crea tu proyecto, carga el line list y empieza a registrar avance de terreno hoy mismo.
        </p>

        <Button variant="primary" size="lg" onClick={onLoginClick}>
          Ingresar a LukeAPP
        </Button>
      </div>

      <div className="relative border-t border-border py-7 px-12 flex justify-between items-center flex-wrap gap-3 max-w-7xl mx-auto">
        <span className="font-sans text-[0.82rem] font-bold text-muted">LukeAPP v4</span>
        <span className="font-sans text-[0.78rem] text-faint">
          Minería · Refinería · Celulosa
        </span>
      </div>
    </div>
  );
}

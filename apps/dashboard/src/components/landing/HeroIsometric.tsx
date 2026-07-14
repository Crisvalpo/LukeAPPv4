import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const colors = {
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

gsap.registerPlugin(ScrollTrigger);

// Coordenadas isométricas puras (ejes a 30°) para que la tubería se lea
// como un plano isométrico real. Un solo codo: tramo derecho + tramo vertical.
const U = 78;
const RIGHT = { x: U * 0.866, y: U * 0.5 };

const P0 = { x: 90, y: 300 }; // extremo con brida (horizontal)
const P1 = { x: P0.x + RIGHT.x * 3.6, y: P0.y + RIGHT.y * 3.6 }; // codo
const P2 = { x: P1.x, y: P1.y - U * 2.6 }; // extremo superior (válvula)
const VALVE = { x: P1.x, y: P1.y - U * 1.55 };

function L(p: { x: number; y: number }) {
  return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}
function offset(p: { x: number; y: number }, dx: number, dy: number) {
  return { x: p.x + dx, y: p.y + dy };
}

export function HeroIsometric() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const scrollTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const text = textRef.current;
    const scrollText = scrollTextRef.current;
    const container = containerRef.current;
    if (!svg || !text || !scrollText || !container) return;

    const paths = svg.querySelectorAll<SVGPathElement>('.iso-line');
    paths.forEach((path) => {
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    });

    const tl = gsap.timeline({ delay: 0.15 });
    tl.to(paths, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut', stagger: 0.06 });
    tl.to('.iso-fitting', { opacity: 1, duration: 0.4, stagger: 0.04 }, '-=0.4');
    tl.to('.iso-tag', { opacity: 1, duration: 0.5 }, '-=0.2');
    tl.to(text, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=1.3');

    gsap.to(svg, {
      y: -20,
      opacity: 0.2,
      scrollTrigger: { trigger: container, start: 'top top', end: 'bottom top', scrub: 1 },
    });
    gsap.to(scrollText, {
      y: -50,
      opacity: 0,
      scrollTrigger: { trigger: container, start: 'top top', end: '+=260', scrub: true },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-screen w-full flex flex-col relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 80% 55% at 50% 35%, rgba(56,189,248,0.06), transparent 70%), ${colors.bg}`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black 30%, transparent 80%)',
        }}
      />

      <div className="flex-none pt-[clamp(120px,15vh,180px)]">
        <div ref={scrollTextRef}>
          <div ref={textRef} className="relative z-10 text-center max-w-7xl mx-auto px-6 opacity-0 translate-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-card mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_theme(colors.accent)]" />
            <span className="font-sans text-xs font-semibold text-muted tracking-wide">
              Minería · Refinería · Celulosa
            </span>
          </div>

          <h1 className="font-display text-[clamp(2.4rem,5.2vw,3.8rem)] font-bold tracking-tight leading-[1.08] text-foreground mb-4">
            Trazabilidad de montaje,
            <br />
            <span className="text-accent">
              de la ingeniería a terreno
            </span>
          </h1>
          <p className="font-sans text-lg text-muted max-w-[540px] mx-auto leading-relaxed">
            Line lists, MTO, especificaciones técnicas y avance físico de juntas — un solo sistema, con IA para extraer datos de tus documentos de ingeniería.
          </p>
        </div>
      </div>
    </div>

      <div style={{ flex: '1 1 auto', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg ref={svgRef} width="560" height="420" viewBox="50 200 400 320" fill="none" style={{ opacity: 0.95, overflow: 'visible' }}>
          <defs>
            <linearGradient id="pipeStroke" gradientUnits="userSpaceOnUse" x1={P0.x} y1={P0.y} x2={P2.x} y2={P2.y}>
              <stop offset="0%" stopColor={colors.accentIndigo} />
              <stop offset="100%" stopColor={colors.accentSky} />
            </linearGradient>
          </defs>

          {/* Piso isométrico de referencia (rombo tenue bajo el codo) */}
          <g opacity="0.3" stroke="#243049" strokeWidth="1.5">
            <path d={`M${L(offset(P1, -70, 40))} L${L(offset(P1, 0, 80))} L${L(offset(P1, 70, 40))} L${L(offset(P1, 0, 0))} Z`} />
          </g>
          {/* Soporte vertical bajo la brida horizontal */}
          <path d={`M${L(P0)} L${L(offset(P0, 0, 60))}`} stroke="#334155" strokeWidth="2" opacity="0.35" />

          {/* Tubería: doble trazo para representar el diámetro */}
          <path className="iso-line" d={`M${L(P0)} L${L(P1)}`} stroke="url(#pipeStroke)" strokeWidth="5" strokeLinecap="round" />
          <path className="iso-line" d={`M${L(offset(P0, -6, 10))} L${L(offset(P1, -6, 10))}`} stroke="url(#pipeStroke)" strokeWidth="5" strokeLinecap="round" opacity="0.4" />

          <path className="iso-line" d={`M${L(P1)} L${L(P2)}`} stroke="url(#pipeStroke)" strokeWidth="5" strokeLinecap="round" />
          <path className="iso-line" d={`M${L(offset(P1, 13, 0))} L${L(offset(P2, 13, 0))}`} stroke="url(#pipeStroke)" strokeWidth="5" strokeLinecap="round" opacity="0.4" />

          {/* Codo */}
          <circle className="iso-fitting" cx={P1.x} cy={P1.y} r="17" fill={colors.bg} stroke={colors.accentIndigo} strokeWidth="3.5" opacity="0" />

          {/* Brida en el extremo horizontal */}
          <g className="iso-fitting" opacity="0">
            <ellipse cx={P0.x} cy={P0.y} rx="11" ry="19" fill={colors.bg} stroke={colors.accentSky} strokeWidth="3" transform={`rotate(30 ${P0.x} ${P0.y})`} />
          </g>

          {/* Válvula de compuerta sobre el tramo vertical */}
          <g className="iso-fitting" opacity="0">
            <rect x={VALVE.x - 19} y={VALVE.y - 19} width="38" height="38" rx="5" fill="rgba(56,189,248,0.1)" stroke={colors.accentSky} strokeWidth="3" />
            <path d={`M${VALVE.x} ${VALVE.y - 19} L${VALVE.x} ${VALVE.y - 42}`} stroke={colors.accentSky} strokeWidth="3" strokeLinecap="round" />
            <rect x={VALVE.x - 15} y={VALVE.y - 50} width="30" height="10" rx="2" fill={colors.bg} stroke={colors.accentSky} strokeWidth="2.5" />
          </g>

          {/* Brida superior */}
          <g className="iso-fitting" opacity="0">
            <ellipse cx={P2.x} cy={P2.y} rx="19" ry="11" fill={colors.bg} stroke={colors.accentSky} strokeWidth="3" />
          </g>

          {/* Puntos de junta (trazabilidad) */}
          <circle className="iso-fitting" cx={(P0.x + P1.x) / 2} cy={(P0.y + P1.y) / 2 + 5} r="4.5" fill={colors.statusInstalled} opacity="0" />
          <circle className="iso-fitting" cx={P1.x} cy={(P1.y + P2.y) / 2 - 30} r="4.5" fill={colors.statusTransit} opacity="0" />

          {/* Tag isométrico estilo plano real */}
          <g className="iso-tag" opacity="0">
            <line x1={P1.x} y1={P1.y - 17} x2={P1.x} y2={P1.y - 55} stroke={colors.textFaint} strokeWidth="1" strokeDasharray="2 3" />
            <rect x={P1.x - 78} y={P1.y - 82} width="156" height="30" rx="5" fill={colors.bgPanel} stroke={colors.border} />
            <text x={P1.x} y={P1.y - 62} textAnchor="middle" className="font-sans text-xs font-semibold fill-muted tracking-wider">
              L-2205 · 6&quot; · A1B
            </text>
          </g>
        </svg>
      </div>

      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 z-10">
        <span className="font-sans text-[0.68rem] text-faint tracking-widest uppercase">Scroll</span>
        <div className="w-px h-6 bg-gradient-to-b from-faint to-transparent" />
      </div>
    </div>
  );
}

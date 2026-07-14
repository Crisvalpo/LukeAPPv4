import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileSpreadsheet, Sparkles, Link2, Building2 } from 'lucide-react';
import { colors, fontDisplay, fontBody, section, eyebrow } from './theme';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: 'Cubicador Excel inteligente',
    desc: 'Sube el line list o el MTO y el sistema detecta nuevas líneas, cambios y ausencias antes de tocar el catálogo — nada se sobrescribe sin aprobación.',
  },
  {
    icon: Sparkles,
    title: 'Ingesta documental con IA',
    desc: 'Especificaciones técnicas y estándares en PDF se leen con IA para proponer fluidos y clases de piping, con página y cita de origen para cada dato.',
  },
  {
    icon: Link2,
    title: 'Avance físico de juntas',
    desc: 'Cada junta soldada queda enlazada a su línea, spool y clase — el porcentaje de avance sale del terreno, no de una estimación.',
  },
  {
    icon: Building2,
    title: 'Multi-proyecto, multi-industria',
    desc: 'Minería, refinería y celulosa en una sola cartera, con catálogos, permisos y roles independientes por proyecto.',
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = sectionRef.current?.querySelectorAll('.feature-card');
    if (!cards || cards.length === 0) return;

    gsap.fromTo(
      cards,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === sectionRef.current) t.kill();
      });
    };
  }, []);

  return (
    <div ref={sectionRef} style={{ background: colors.bg, padding: '140px 0 120px' }}>
      <div style={section}>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 64px' }}>
          <div style={{ ...eyebrow, marginBottom: '14px' }}>Una plataforma, todo el ciclo</div>
          <h2 style={{ fontFamily: fontDisplay, fontSize: 'clamp(1.9rem, 3.2vw, 2.6rem)', fontWeight: 700, color: colors.text, margin: 0, letterSpacing: '-0.01em' }}>
            Del catálogo de ingeniería al último bulón
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="feature-card"
              style={{
                background: colors.bgCard,
                border: `1px solid ${colors.border}`,
                borderRadius: '16px',
                padding: '28px',
                opacity: 0,
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(56, 189, 248, 0.1)',
                  marginBottom: '20px',
                }}
              >
                <Icon size={22} color={colors.accentSky} strokeWidth={1.8} />
              </div>
              <h3 style={{ fontFamily: fontBody, fontSize: '1.05rem', fontWeight: 700, color: colors.text, margin: '0 0 10px 0' }}>{title}</h3>
              <p style={{ fontFamily: fontBody, fontSize: '0.9rem', color: colors.textMuted, lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

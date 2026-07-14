import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, ContactShadows, Grid } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const statusColors = {
  pending: '#5b6478',
  prefab: '#f59e0b',
  transit: '#38bdf8',
  installed: '#34d399',
};

const STEPS = [
  { label: 'Pendiente', color: statusColors.pending },
  { label: 'Prefabricado', color: statusColors.prefab },
  { label: 'En tránsito', color: statusColors.transit },
  { label: 'Montado', color: statusColors.installed },
];

function stepColor(progress: number) {
  if (progress < 0.28) return statusColors.pending;
  if (progress < 0.55) return statusColors.prefab;
  if (progress < 0.82) return statusColors.transit;
  return statusColors.installed;
}

function stepIndex(progress: number) {
  if (progress < 0.28) return 0;
  if (progress < 0.55) return 1;
  if (progress < 0.82) return 2;
  return 3;
}

function PipeSpool({ scrollProgress, isMobile }: { scrollProgress: number; isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const pipeMatRefs = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const targetColor = useRef(new THREE.Color(statusColors.pending));

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = 0.55 + scrollProgress * Math.PI * 1.4;
    }
    targetColor.current.set(stepColor(scrollProgress));
    for (const mat of pipeMatRefs.current) {
      if (mat) mat.color.lerp(targetColor.current, 0.08);
    }
  });

  const registerPipeMat = (i: number) => (mat: THREE.MeshPhysicalMaterial | null) => {
    if (mat) pipeMatRefs.current[i] = mat;
  };

  const metalMat = { color: '#2a3344', roughness: 0.35, metalness: 0.55 } as const;
  const pipeMatProps = { roughness: 0.42, metalness: 0.35, clearcoat: 0.25, clearcoatRoughness: 0.5 } as const;

  // En móviles desplazamos el modelo ligeramente hacia abajo y lo centramos
  const positionX = isMobile ? 0.3 : 0;
  const positionY = isMobile ? -0.2 : 0.3;

  return (
    <group ref={groupRef} position={[positionX, positionY, 0]}>
      {/* Tramo horizontal */}
      <mesh position={[-1.53, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 4.34, 40]} />
        <meshPhysicalMaterial ref={registerPipeMat(0)} color={statusColors.pending} {...pipeMatProps} />
      </mesh>
      {/* Codo */}
      <mesh position={[-0.4, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.27, 32, 32]} />
        <meshPhysicalMaterial ref={registerPipeMat(1)} color={statusColors.pending} {...pipeMatProps} />
      </mesh>
      {/* Tramo vertical */}
      <mesh position={[-0.4, -1.15, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 3.4, 40]} />
        <meshPhysicalMaterial ref={registerPipeMat(2)} color={statusColors.pending} {...pipeMatProps} />
      </mesh>

      {/* Bridas */}
      <mesh position={[-3.7, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.12, 32]} />
        <meshStandardMaterial {...metalMat} />
      </mesh>
      <mesh position={[-0.4, -2.85, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.12, 32]} />
        <meshStandardMaterial {...metalMat} />
      </mesh>

      {/* Cuerpo de válvula */}
      <mesh position={[0.95, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.62]} />
        <meshStandardMaterial {...metalMat} roughness={0.3} />
      </mesh>
      <mesh position={[0.95, 1.42, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 16]} />
        <meshStandardMaterial {...metalMat} />
      </mesh>
      <mesh position={[0.95, 1.72, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.14, 24]} />
        <meshStandardMaterial color="#e8ecf5" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[1.85, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 1.1, 40]} />
        <meshPhysicalMaterial ref={registerPipeMat(3)} color={statusColors.pending} {...pipeMatProps} />
      </mesh>
    </group>
  );
}

function Scene({ scrollData, isMobile }: { scrollData: MutableRefObject<{ progress: number }>; isMobile: boolean }) {
  const [progress, setProgress] = useState(0);
  useFrame(() => {
    if (Math.abs(progress - scrollData.current.progress) > 0.008) {
      setProgress(scrollData.current.progress);
    }
  });
  return <PipeSpool scrollProgress={progress} isMobile={isMobile} />;
}

export function PipelineCanvas3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollData = useRef({ progress: 0 });
  const [stepIdx, setStepIdx] = useState(0);
  const [pct, setPct] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mm = gsap.matchMedia();

    // Escritorio: Pinning activo y scroll profundo
    mm.add('(min-width: 768px)', () => {
      const trigger = ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: '+=2200',
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          scrollData.current.progress = self.progress;
          setPct(Math.round(self.progress * 100));
          setStepIdx(stepIndex(self.progress));
        },
      });
      return () => trigger.kill();
    });

    // Móvil: Sin pinning para evitar atascos de scroll, scrub natural al pasar
    mm.add('(max-width: 767px)', () => {
      const trigger = ScrollTrigger.create({
        trigger: container,
        start: 'top 75%',
        end: 'bottom 25%',
        scrub: 1,
        onUpdate: (self) => {
          scrollData.current.progress = self.progress;
          setPct(Math.round(self.progress * 100));
          setStepIdx(stepIndex(self.progress));
        },
      });
      return () => trigger.kill();
    });

    return () => mm.revert();
  }, []);

  return (
    <div ref={containerRef} className="h-auto md:h-screen w-full relative bg-background overflow-hidden flex flex-col md:block py-16 md:py-0">
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{ background: `radial-gradient(ellipse 60% 50% at 75% 50%, rgba(56,189,248,0.06), transparent 70%)` }} 
      />

      {/* Contenedor de Texto */}
      <div className="relative md:absolute md:top-[12%] left-0 right-0 z-10 max-w-7xl mx-auto px-6 md:px-12 flex-none">
        <div className="max-w-[460px] mx-auto md:mx-0">
          <div className="font-sans text-[0.78rem] font-semibold tracking-widest uppercase text-accent mb-3.5">
            Gemelo digital
          </div>
          <h2 className="font-display text-[clamp(2rem,3.4vw,2.8rem)] font-bold text-foreground m-0 mb-4 tracking-tight">
            De la línea abstracta a la pieza real
          </h2>
          <p className="font-sans text-[1.02rem] text-muted leading-relaxed m-0">
            Cada spool y cada junta reporta su estado real de terreno. LukeAPP conecta el line list de ingeniería con el avance físico de montaje, sin planillas paralelas.
          </p>

          <div className="mt-10 p-6 bg-card/80 backdrop-blur-md rounded-2xl border border-border">
            <div className="flex justify-between items-baseline mb-4">
              <span className="font-sans text-[0.72rem] text-faint tracking-widest uppercase">Avance de spool</span>
              <span className="font-display text-2xl font-bold text-foreground">{pct}%</span>
            </div>

            <div className="flex items-center">
              {STEPS.map((step, i) => (
                <div key={step.label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : 'initial' }}>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full transition-all duration-300"
                      style={{
                        background: i <= stepIdx ? step.color : 'transparent',
                        borderColor: i <= stepIdx ? step.color : 'rgba(255,255,255,0.14)',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        boxShadow: i === stepIdx ? `0 0 12px ${step.color}` : 'none',
                      }}
                    />
                    <span 
                      className="font-sans text-[0.68rem] whitespace-nowrap"
                      style={{
                        color: i <= stepIdx ? '#e8ecf5' : '#5b6478',
                        fontWeight: i === stepIdx ? 700 : 500
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div 
                      className="flex-1 h-[2px] mx-1.5 mb-5 transition-colors duration-300"
                      style={{ background: i < stepIdx ? STEPS[i + 1].color : 'rgba(255,255,255,0.08)' }} 
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lienzo 3D Canvas */}
      <div className="w-full h-[320px] md:h-full md:absolute md:inset-0 flex-none mt-8 md:mt-0">
        <Canvas shadows dpr={[1, 2]} className="w-full h-full">
          {/* En móviles reubicamos la cámara para centrar la tubería de frente */}
          <PerspectiveCamera makeDefault position={isMobile ? [0, 0.4, 7.5] : [3.5, 2.2, 7]} fov={isMobile ? 38 : 42} />
          <ambientLight intensity={0.45} />
          <directionalLight position={[5, 8, 4]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[-4, 2, -3]} intensity={0.3} color="#818cf8" />
          <spotLight position={[2, 6, 6]} angle={0.35} penumbra={0.8} intensity={0.6} color="#38bdf8" />

          <Scene scrollData={scrollData} isMobile={isMobile} />

          <Grid
            position={[0, -2.9, 0]}
            args={[20, 20]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#1e2536"
            sectionSize={2.5}
            sectionThickness={1}
            sectionColor="#2a3348"
            fadeDistance={14}
            fadeStrength={1.5}
            infiniteGrid
          />
          <ContactShadows position={[0, -2.88, 0]} opacity={0.55} scale={12} blur={2.2} far={4} color="#000000" />
        </Canvas>
      </div>
    </div>
  );
}

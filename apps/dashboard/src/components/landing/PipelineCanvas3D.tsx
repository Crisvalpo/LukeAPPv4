import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, ContactShadows, Grid } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { colors, fontDisplay, fontBody, section } from './theme';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { label: 'Pendiente', color: colors.statusPending },
  { label: 'Prefabricado', color: colors.statusPrefab },
  { label: 'En tránsito', color: colors.statusTransit },
  { label: 'Montado', color: colors.statusInstalled },
];

function stepColor(progress: number) {
  if (progress < 0.28) return colors.statusPending;
  if (progress < 0.55) return colors.statusPrefab;
  if (progress < 0.82) return colors.statusTransit;
  return colors.statusInstalled;
}

function stepIndex(progress: number) {
  if (progress < 0.28) return 0;
  if (progress < 0.55) return 1;
  if (progress < 0.82) return 2;
  return 3;
}

function PipeSpool({ scrollProgress }: { scrollProgress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const pipeMatRefs = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const targetColor = useRef(new THREE.Color(colors.statusPending));

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

  return (
    <group ref={groupRef} position={[0, 0.3, 0]}>
      {/* Tramo horizontal */}
      <mesh position={[-2.1, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 3.2, 40]} />
        <meshPhysicalMaterial ref={registerPipeMat(0)} color={colors.statusPending} {...pipeMatProps} />
      </mesh>
      {/* Codo */}
      <mesh position={[-0.4, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.27, 32, 32]} />
        <meshPhysicalMaterial ref={registerPipeMat(1)} color={colors.statusPending} {...pipeMatProps} />
      </mesh>
      {/* Tramo vertical */}
      <mesh position={[-0.4, -1.15, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 3.4, 40]} />
        <meshPhysicalMaterial ref={registerPipeMat(2)} color={colors.statusPending} {...pipeMatProps} />
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
        <meshPhysicalMaterial ref={registerPipeMat(3)} color={colors.statusPending} {...pipeMatProps} />
      </mesh>
    </group>
  );
}

function Scene({ scrollData }: { scrollData: MutableRefObject<{ progress: number }> }) {
  const [progress, setProgress] = useState(0);
  useFrame(() => {
    if (Math.abs(progress - scrollData.current.progress) > 0.008) {
      setProgress(scrollData.current.progress);
    }
  });
  return <PipeSpool scrollProgress={progress} />;
}

export function PipelineCanvas3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollData = useRef({ progress: 0 });
  const [stepIdx, setStepIdx] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
  }, []);

  return (
    <div ref={containerRef} style={{ height: '100vh', width: '100%', position: 'relative', background: colors.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 50% at 75% 50%, rgba(56,189,248,0.06), transparent 70%)` }} />

      <div style={{ position: 'absolute', top: '12%', left: 0, right: 0, zIndex: 10, ...section }}>
        <div style={{ maxWidth: '460px' }}>
          <div style={{ fontFamily: fontBody, fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.accentSky, marginBottom: '14px' }}>
            Gemelo digital
          </div>
          <h2 style={{ fontFamily: fontDisplay, fontSize: 'clamp(2rem, 3.4vw, 2.8rem)', fontWeight: 700, color: colors.text, margin: '0 0 16px 0', letterSpacing: '-0.01em' }}>
            De la línea abstracta a la pieza real
          </h2>
          <p style={{ fontFamily: fontBody, fontSize: '1.02rem', color: colors.textMuted, lineHeight: 1.65, margin: 0 }}>
            Cada spool y cada junta reporta su estado real de terreno. LukeAPP conecta el line list de ingeniería con el avance físico de montaje, sin planillas paralelas.
          </p>

          <div style={{ marginTop: '40px', padding: '24px', background: colors.bgCard, backdropFilter: 'blur(12px)', borderRadius: '14px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px' }}>
              <span style={{ fontFamily: fontBody, fontSize: '0.72rem', color: colors.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Avance de spool</span>
              <span style={{ fontFamily: fontDisplay, fontSize: '1.6rem', fontWeight: 700, color: colors.text }}>{pct}%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              {STEPS.map((step, i) => (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'initial' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '13px',
                        height: '13px',
                        borderRadius: '50%',
                        background: i <= stepIdx ? step.color : 'transparent',
                        border: `2px solid ${i <= stepIdx ? step.color : colors.borderStrong}`,
                        boxShadow: i === stepIdx ? `0 0 12px ${step.color}` : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    />
                    <span style={{ fontFamily: fontBody, fontSize: '0.68rem', color: i <= stepIdx ? colors.text : colors.textFaint, whiteSpace: 'nowrap', fontWeight: i === stepIdx ? 700 : 500 }}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: '2px', margin: '0 6px 20px', background: i < stepIdx ? STEPS[i + 1].color : colors.border, transition: 'background 0.3s ease' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Canvas shadows dpr={[1, 2]} style={{ position: 'absolute', inset: 0 }}>
        <PerspectiveCamera makeDefault position={[3.5, 2.2, 7]} fov={42} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 8, 4]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[-4, 2, -3]} intensity={0.3} color={colors.accentIndigo} />
        <spotLight position={[2, 6, 6]} angle={0.35} penumbra={0.8} intensity={0.6} color={colors.accentSky} />

        <Scene scrollData={scrollData} />

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
  );
}

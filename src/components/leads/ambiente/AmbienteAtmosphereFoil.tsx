import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface AmbienteAtmosphereFoilProps {
  className?: string;
  intensity?: number;
  /**
   * `css` — leve, para botões e lousa (várias instâncias).
   * `shader` — um quad WebGL com grão e brilho quente nos cabeçalhos de seção.
   */
  variant?: 'css' | 'shader';
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  float n = noise(uv * 7.0 + uTime * 0.08);
  float n2 = noise(uv * 18.0 - uTime * 0.05);

  vec3 mahogany = vec3(0.18, 0.10, 0.07);
  vec3 cream = vec3(1.0, 0.96, 0.90);
  vec3 gold = vec3(0.95, 0.85, 0.57);

  float glowA = smoothstep(0.75, 0.15, distance(uv, vec2(0.82, 0.18)));
  float glowB = smoothstep(0.85, 0.25, distance(uv, vec2(0.12, 0.88)));
  float wash = smoothstep(1.0, 0.2, uv.y);

  vec3 color = mahogany;
  color = mix(color, cream, glowA * 0.22 * uIntensity);
  color = mix(color, gold, glowB * 0.16 * uIntensity);
  color += gold * (n * 0.06 + n2 * 0.035) * uIntensity;
  color += cream * wash * 0.05 * uIntensity;

  float alpha = (0.28 + glowA * 0.22 + glowB * 0.14 + n * 0.08) * uIntensity;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
}
`;

function CssAtmosphereFoil({
  className,
  intensity = 1,
}: {
  className?: string;
  intensity?: number;
}) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ opacity: Math.min(1, Math.max(0.15, intensity * 0.72)) }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(70% 55% at 78% 16%, rgba(255,246,234,0.18), transparent 58%)',
            'radial-gradient(80% 70% at 12% 88%, rgba(242,216,146,0.12), transparent 52%)',
            'linear-gradient(180deg, rgba(58,36,28,0.22), transparent 42%)',
          ].join(', '),
        }}
      />
    </div>
  );
}

function ShaderAtmosphereFoil({
  className,
  intensity = 1,
}: {
  className?: string;
  intensity?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let renderer: THREE.WebGLRenderer | null = null;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: Math.min(1.4, Math.max(0.35, intensity)) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'block',
    });
    if (fallbackRef.current) fallbackRef.current.style.opacity = '0';

    const resize = () => {
      if (!renderer || !host) return;
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
    };

    const clock = new THREE.Clock();
    const tick = () => {
      if (disposed || !renderer) return;
      material.uniforms.uTime.value = reduceMotion ? 0 : clock.getElapsedTime();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(tick);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      material.dispose();
      mesh.geometry.dispose();
      renderer?.dispose();
      if (renderer?.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [intensity]);

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <div ref={fallbackRef} className="absolute inset-0 transition-opacity duration-300">
        <CssAtmosphereFoil intensity={intensity * 0.85} />
      </div>
    </div>
  );
}

/**
 * Véu de luz quente.
 * CSS nas áreas com muitas cópias; shader leve (um quad) só nos cabeçalhos de seção.
 */
export function AmbienteAtmosphereFoil({
  className,
  intensity = 1,
  variant = 'css',
}: AmbienteAtmosphereFoilProps) {
  if (variant === 'shader') {
    return <ShaderAtmosphereFoil className={className} intensity={intensity} />;
  }
  return <CssAtmosphereFoil className={className} intensity={intensity} />;
}

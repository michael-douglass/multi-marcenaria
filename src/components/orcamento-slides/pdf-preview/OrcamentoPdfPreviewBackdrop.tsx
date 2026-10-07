import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface OrcamentoPdfPreviewBackdropProps {
  className?: string;
}

/**
 * Fundo da pré-visualização do PDF: “bancada do ateliê” — madeira escura com veios
 * procedurais e um foco de luz dourada que passeia devagar sobre as folhas.
 * Renderiza em meia resolução (é desfocado por natureza) para poupar bateria no celular.
 */
export function OrcamentoPdfPreviewBackdrop({ className }: OrcamentoPdfPreviewBackdropProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
      });
    } catch {
      // Sem WebGL: fica o gradiente CSS do contêiner.
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(0.5);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uEspresso: { value: new THREE.Color(PALETTE.espresso) },
      uMahogany: { value: new THREE.Color(PALETTE.mahogany) },
      uGold: { value: new THREE.Color(PALETTE.gold) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false);
      uniforms.uAspect.value = w / h;
      if (prefersReducedMotion) renderer.render(scene, camera);
    };
    resize();

    let frame = 0;
    const clock = new THREE.Clock();
    const renderFrame = () => {
      uniforms.uTime.value = prefersReducedMotion ? 8 : clock.getElapsedTime();
      renderer.render(scene, camera);
      if (!prefersReducedMotion && !document.hidden) {
        frame = requestAnimationFrame(renderFrame);
      }
    };
    renderFrame();

    const onVisibility = () => {
      if (!document.hidden && !prefersReducedMotion) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(renderFrame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#3a2218_0%,#170e0a_55%,#0c0705_100%)]',
        className,
      )}
    />
  );
}

const PALETTE = {
  espresso: '#0c0705',
  mahogany: '#2e1a12',
  gold: '#e8c878',
} as const;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uEspresso;
  uniform vec3 uMahogany;
  uniform vec3 uGold;
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vUv;
    vec2 q = vec2(p.x * uAspect, p.y);
    float t = uTime;

    // Veios de madeira: senoide horizontal deformada por ruído (corte longitudinal da tábua).
    float warp = fbm(q * vec2(0.9, 2.6) + vec2(t * 0.012, 0.0));
    float rings = 0.5 + 0.5 * sin(q.y * 26.0 + warp * 6.0);
    float grain = smoothstep(0.6, 1.0, rings);

    // Foco de luz que passeia no alto, como luminária de bancada.
    vec2 lamp = vec2(uAspect * (0.5 + 0.28 * sin(t * 0.06)), 1.08 + 0.05 * sin(t * 0.11));
    float d = distance(q, lamp);
    float pool = exp(-d * d * 1.35);

    // Varredura diagonal lenta — reflexo de folha de ouro.
    float sweep = 0.5 + 0.5 * sin((q.x * 0.55 - q.y * 0.85) * 3.2 - t * 0.14);
    sweep = smoothstep(0.62, 1.0, sweep);

    vec3 col = mix(uEspresso, uMahogany, clamp(pool * 0.9 + warp * 0.12, 0.0, 1.0));
    col = mix(col, col * 0.7, grain * (0.3 + pool * 0.5));
    col += uGold * (pool * 0.035 + sweep * pool * 0.045);

    float vignette = smoothstep(1.15, 0.2, distance(p, vec2(0.5, 0.58)) * 1.25);
    col *= mix(0.45, 1.0, vignette);

    // Grão de filme bem leve: evita “degraus” no gradiente escuro.
    col += (random(gl_FragCoord.xy) - 0.5) * 0.004;

    gl_FragColor = vec4(col, 1.0);
    // THREE.Color guarda as cores em linear; converte de volta para sRGB na tela.
    #include <colorspace_fragment>
  }
`;

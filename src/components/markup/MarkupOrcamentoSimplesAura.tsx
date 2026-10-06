import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
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
  float t = uTime * 0.035;
  float grain = noise(uv * vec2(18.0, 70.0) + vec2(0.0, t));
  float vein = noise(uv * vec2(6.0, 28.0) + vec2(t * 0.4, 0.0));
  float wash = exp(-length((uv - vec2(0.18, 0.22)) * vec2(1.4, 1.8)) * 1.35);
  float rim = pow(1.0 - uv.y, 2.2) * 0.28;
  float brassBand = smoothstep(0.12, 0.0, abs(uv.y - 0.08)) * 0.55;

  vec3 mahogany = vec3(0.22, 0.10, 0.055);
  vec3 brass = vec3(0.77, 0.64, 0.35);
  vec3 paper = vec3(0.96, 0.90, 0.78);

  vec3 color = mix(mahogany, paper, 0.18 + grain * 0.12);
  color = mix(color, brass, vein * 0.16 + brassBand + wash * 0.10);
  color += brass * rim * 0.22;

  float alpha = (0.22 + wash * 0.18 + rim * 0.12 + grain * 0.05) * uIntensity;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.42));
}
`;

interface MarkupOrcamentoSimplesAuraProps {
  className?: string;
  /** 1 = cabeçalho; 0.45 = caixa de fotos. */
  intensity?: number;
}

/** Um canvas só, baixo consumo — madeira e latão atrás da folha comercial. */
export function MarkupOrcamentoSimplesAura({
  className,
  intensity = 1,
}: MarkupOrcamentoSimplesAuraProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: true,
        }),
    );
    if (!renderer) return;

    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    host.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: intensity },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const timer = new THREE.Timer();
    let frame = 0;
    let running = true;
    let visible = true;

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting !== false;
      },
      { threshold: 0.05 },
    );
    io.observe(host);

    const draw = () => {
      if (!running) return;
      if (!prefersReduced) frame = requestAnimationFrame(draw);
      if (!visible) return;
      timer.update();
      material.uniforms.uTime.value = prefersReduced ? 0 : timer.getElapsed();
      renderer.render(scene, camera);
    };
    draw();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [intensity]);

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    />
  );
}

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface ChecklistGoldFoilProps {
  className?: string;
}

/**
 * Folha de ouro no painel da visita — um único plano WebGL, baixo consumo.
 */
export function ChecklistGoldFoil({ className }: ChecklistGoldFoilProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uGold: { value: new THREE.Color('#f2d892') },
      uMahogany: { value: new THREE.Color('#2a1812') },
      uCream: { value: new THREE.Color('#fff6ea') },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uGold;
        uniform vec3 uMahogany;
        uniform vec3 uCream;
        varying vec2 vUv;

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
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

        void main() {
          vec2 p = vUv;
          float n = noise(p * vec2(7.5, 4.0) + vec2(uTime * 0.08, -uTime * 0.05));
          float foil = noise(p * vec2(18.0, 11.0) - vec2(uTime * 0.04, uTime * 0.03));
          float sweep = 0.5 + 0.5 * sin((p.x * 1.4 + p.y * 0.35) * 6.2831 - uTime * 0.35);
          float rim = smoothstep(0.0, 0.18, p.y) * smoothstep(1.0, 0.72, p.y);
          vec3 color = mix(uMahogany, uGold, n * 0.45 + sweep * 0.22);
          color = mix(color, uCream, foil * 0.12 * rim);
          float alpha = (0.10 + n * 0.14 + sweep * 0.08) * rim;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false);
    };
    resize();

    let frame = 0;
    const clock = new THREE.Clock();
    const renderFrame = () => {
      uniforms.uTime.value = prefersReducedMotion ? 0.8 : clock.getElapsedTime();
      renderer.render(scene, camera);
      if (!prefersReducedMotion) {
        frame = requestAnimationFrame(renderFrame);
      }
    };
    renderFrame();

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  );
}

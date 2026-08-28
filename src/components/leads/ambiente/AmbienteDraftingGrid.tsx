import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface AmbienteDraftingGridProps {
  active?: boolean;
  className?: string;
}

/**
 * Grade de atelier na lousa — ouro fino sobre mogno, só quando uma forma está ativa.
 */
export function AmbienteDraftingGrid({ active = false, className }: AmbienteDraftingGridProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

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
      uActive: { value: active ? 1 : 0 },
      uGold: { value: new THREE.Color('#f2d892') },
      uMahogany: { value: new THREE.Color('#1a100c') },
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
        uniform float uActive;
        uniform vec3 uGold;
        uniform vec3 uMahogany;
        varying vec2 vUv;

        float gridLine(float coord, float cells) {
          float g = abs(fract(coord * cells) - 0.5);
          return 1.0 - smoothstep(0.0, 0.035, g);
        }

        void main() {
          float major = max(gridLine(vUv.x, 8.0), gridLine(vUv.y, 5.0));
          float minor = max(gridLine(vUv.x, 24.0), gridLine(vUv.y, 15.0)) * 0.35;
          float sweep = 0.5 + 0.5 * sin((vUv.x * 1.4 + vUv.y * 0.7) * 6.2831 - uTime * 0.22);
          float rim = pow(1.0 - abs(vUv.y - 0.5) * 1.55, 2.6) * pow(1.0 - abs(vUv.x - 0.5) * 1.35, 2.2);
          vec3 color = mix(uMahogany, uGold, major * 0.55 + minor * 0.25 + sweep * 0.08);
          float alpha = (major * 0.10 + minor * 0.045 + rim * 0.06) * uActive;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const resize = () => {
      renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1), false);
    };
    resize();

    let frame = 0;
    const clock = new THREE.Clock();
    const renderFrame = () => {
      uniforms.uTime.value = prefersReducedMotion ? 0.7 : clock.getElapsedTime();
      uniforms.uActive.value = activeRef.current ? 1 : 0;
      renderer.render(scene, camera);
      if (!prefersReducedMotion) frame = requestAnimationFrame(renderFrame);
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
      className={cn(
        'pointer-events-none absolute inset-0 z-[12] transition-opacity duration-300',
        active ? 'opacity-100' : 'opacity-0',
        className,
      )}
      aria-hidden
    />
  );
}

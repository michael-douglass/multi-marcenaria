import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface LeadNegociadorShaderBackdropProps {
  /** 0 = longe do piso (seguro), 1 = colado no piso (alerta). */
  proximityToFloor?: number;
  className?: string;
}

/**
 * Fundo atmosférico mahogany/gold do Negociador.
 * Usa ShaderMaterial leve; com prefers-reduced-motion cai em CSS estático.
 */
export function LeadNegociadorShaderBackdrop({
  proximityToFloor = 0,
  className,
}: LeadNegociadorShaderBackdropProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const proximityRef = useRef(proximityToFloor);

  useEffect(() => {
    proximityRef.current = proximityToFloor;
  }, [proximityToFloor]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uProximity: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uTime;
        uniform float uProximity;
        uniform vec2 uResolution;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 uv = vUv;
          float aspect = uResolution.x / max(uResolution.y, 1.0);
          vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

          // Gradiente mahogany → cream quente
          vec3 mahogany = vec3(0.165, 0.094, 0.071);
          vec3 gold = vec3(0.949, 0.839, 0.573);
          vec3 cream = vec3(1.0, 0.988, 0.973);

          float radial = length(p * 1.15);
          float pulse = 0.5 + 0.5 * sin(uTime * 1.4 + radial * 4.0);
          float warmth = smoothstep(0.85, 0.05, radial) * (0.35 + 0.25 * pulse);

          // Alerta dourado quando perto do piso
          float alert = clamp(uProximity, 0.0, 1.0);
          vec3 base = mix(mahogany, cream, 0.12 + warmth * 0.45);
          vec3 accent = mix(gold * 0.55, gold, alert);
          vec3 color = mix(base, accent, warmth * (0.45 + alert * 0.4));

          // Grain sutil
          float n = hash(uv * uResolution * 0.35 + uTime * 0.02);
          color += (n - 0.5) * 0.035;

          float alpha = 0.22 + warmth * 0.28 + alert * 0.12;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      uniforms.uTime.value = clock.getElapsedTime();
      uniforms.uProximity.value += (proximityRef.current - uniforms.uProximity.value) * 0.08;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]',
        'bg-gradient-to-br from-[#2a1812]/90 via-[#3d2418]/75 to-[#1a0f0c]/95',
        className,
      )}
    />
  );
}

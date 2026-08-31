import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

const WOOD_GRAIN_URL = '/imagens/apresentacao-garbo/projetos/cubo-painel-madeira.png';

interface CapaAtmosphereFoilProps {
  className?: string;
  intensity?: number;
  enabled?: boolean;
}

/**
 * Véu de madeira e ouro na capa da proposta — carrega a textura real da Garbo
 * e mistura com um brilho dourado lento (como folha metálica no papel).
 */
export function CapaAtmosphereFoil({
  className,
  intensity = 0.9,
  enabled = true,
}: CapaAtmosphereFoilProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !enabled) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    THREE.Cache.enabled = true;

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
      uGold: { value: new THREE.Color('#e8c878') },
      uMahogany: { value: new THREE.Color('#2a1812') },
      uCream: { value: new THREE.Color('#fff6ea') },
      uIntensity: { value: intensity },
      uWood: { value: null as THREE.Texture | null },
      uHasWood: { value: 0 },
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
        uniform float uIntensity;
        uniform sampler2D uWood;
        uniform float uHasWood;
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
          float n = noise(p * vec2(5.4, 3.1) + vec2(uTime * 0.04, -uTime * 0.03));
          float foil = noise(p * vec2(14.0, 8.0) - vec2(uTime * 0.02, uTime * 0.035));
          float sweep = 0.5 + 0.5 * sin((p.x * 0.9 + p.y * 0.45) * 6.2831 - uTime * 0.22);
          float vignette = pow(1.0 - distance(p, vec2(0.5, 0.42)) * 1.15, 1.6);
          float woodMix = 0.0;
          vec3 woodColor = uMahogany;
          if (uHasWood > 0.5) {
            vec3 sampled = texture2D(uWood, p * vec2(1.35, 1.1) + vec2(uTime * 0.008, 0.0)).rgb;
            woodColor = sampled;
            woodMix = 0.55;
          }
          vec3 color = mix(uMahogany, uGold, n * 0.32 + sweep * 0.14);
          color = mix(color, woodColor, woodMix * 0.45);
          color = mix(color, uCream, foil * 0.08 * vignette);
          float alpha = (0.05 + n * 0.08 + sweep * 0.05 + vignette * 0.04) * uIntensity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    let cancelled = false;
    let woodTexture: THREE.Texture | null = null;
    const manager = new THREE.LoadingManager();
    const textureLoader = new THREE.TextureLoader(manager);

    manager.onError = () => {
      uniforms.uHasWood.value = 0;
    };

    textureLoader.load(
      WOOD_GRAIN_URL,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.LinearSRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        woodTexture = texture;
        uniforms.uWood.value = texture;
        uniforms.uHasWood.value = 1;
      },
      undefined,
      () => {
        uniforms.uHasWood.value = 0;
      },
    );

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false);
    };
    resize();

    let frame = 0;
    const clock = new THREE.Clock();
    const renderFrame = () => {
      uniforms.uTime.value = prefersReducedMotion ? 1.2 : clock.getElapsedTime();
      renderer.render(scene, camera);
      if (!prefersReducedMotion) {
        frame = requestAnimationFrame(renderFrame);
      }
    };
    renderFrame();

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      woodTexture?.dispose();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [enabled, intensity]);

  if (!enabled) return null;

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 print:hidden', className)}
      data-capa-atmosphere=""
      aria-hidden
    />
  );
}

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';
import { GARBO_WOOD_TEXTURE_URL } from '@/lib/furniture-catalog-banks';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';

/**
 * Véu da porta do ateliê: madeira + marca via TextureLoader.
 * A luz de ouro segue o ponteiro — um canvas só, baixo consumo.
 */
export function LoginAtmosphereFoil({ className }: { className?: string }) {
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

    THREE.Cache.enabled = true;
    const fallback = new THREE.DataTexture(new Uint8Array([42, 24, 18, 255]), 1, 1);
    fallback.needsUpdate = true;

    const uniforms = {
      uTime: { value: 0 },
      uWood: { value: fallback },
      uBrand: { value: fallback },
      uHasWood: { value: 0 },
      uHasBrand: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.72, 0.28) },
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uWood;
        uniform sampler2D uBrand;
        uniform float uHasWood;
        uniform float uHasBrand;
        uniform vec2 uPointer;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = vUv;
          float t = uTime * 0.045;
          vec3 mahogany = vec3(0.165, 0.094, 0.071);
          vec3 gold = vec3(0.949, 0.847, 0.573);
          vec3 cream = vec3(1.0, 0.965, 0.918);

          vec2 woodUv = uv * vec2(0.72, 0.92) + vec2(0.01 * sin(t), -0.006 * t);
          vec3 wood = texture2D(uWood, woodUv).rgb;
          vec2 brandUv = uv * vec2(1.15, 1.35) + vec2(0.12, 0.08);
          vec3 brand = texture2D(uBrand, brandUv).rgb;

          float vignette = smoothstep(1.15, 0.22, length((uv - vec2(0.5, 0.42)) * vec2(1.15, 1.05)));
          float lamp = smoothstep(0.62, 0.0, distance(uv, uPointer));
          float grain = hash(uv * 220.0 + t) * 0.06;

          vec3 color = mahogany;
          color = mix(color, wood, 0.09 * uHasWood);
          color = mix(color, gold, lamp * 0.18 + vignette * 0.05);
          color = mix(color, cream, 0.03 * uHasBrand * brand.r);
          color += grain * gold * 0.28;

          float alpha = 0.22 + lamp * 0.16 + vignette * 0.07;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
        }
      `,
    });

    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);

    const setupTex = (tex: THREE.Texture, repeatX: number, repeatY: number) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;
    };

    loader.load(GARBO_WOOD_TEXTURE_URL, (tex) => {
      setupTex(tex, 1.6, 1.6);
      uniforms.uWood.value = tex;
      uniforms.uHasWood.value = 1;
    });
    loader.load(GARBO_LOGO_SRC, (tex) => {
      setupTex(tex, 1, 1);
      uniforms.uBrand.value = tex;
      uniforms.uHasBrand.value = 1;
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const pointer = uniforms.uPointer.value as THREE.Vector2;
    const onMove = (event: PointerEvent) => {
      if (prefersReduced) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      pointer.set(event.clientX / w, 1 - event.clientY / h);
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const clock = new THREE.Clock();
    let frame = 0;
    let running = true;

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const draw = () => {
      if (!running) return;
      if (!prefersReduced) frame = requestAnimationFrame(draw);
      uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime();
      renderer.render(scene, camera);
    };

    if (prefersReduced) {
      renderer.render(scene, camera);
    } else {
      draw();
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      const wood = uniforms.uWood.value as THREE.Texture;
      const brand = uniforms.uBrand.value as THREE.Texture;
      if (wood && wood !== fallback) wood.dispose();
      if (brand && brand !== fallback) brand.dispose();
      fallback.dispose();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 z-0', className)}
      aria-hidden
    />
  );
}

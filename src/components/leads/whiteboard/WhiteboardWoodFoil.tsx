import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { GARBO_WOOD_TEXTURE_URL } from '@/lib/furniture-catalog-banks';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';

interface WhiteboardWoodFoilProps {
  className?: string;
}

/**
 * Véu de mogno da lousa: textura de madeira entra pelo TextureLoader.
 * Um canvas só, baixo consumo — se o aparelho não aguentar WebGL, some em silêncio.
 */
export function WhiteboardWoodFoil({ className }: WhiteboardWoodFoilProps) {
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
      uHasWood: { value: 0 },
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
        uniform float uHasWood;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = vUv;
          float t = uTime * 0.06;
          vec3 mahogany = vec3(0.102, 0.063, 0.047);
          vec3 gold = vec3(0.949, 0.847, 0.573);
          vec3 cream = vec3(1.0, 0.965, 0.918);

          vec2 woodUv = uv * vec2(2.4, 1.15) + vec2(0.012 * sin(t), -0.004 * t);
          vec3 wood = texture2D(uWood, woodUv).rgb;

          float sweep = 0.5 + 0.5 * sin((uv.x * 2.8 + uv.y * 0.4 - t) * 6.2831);
          float rim = pow(1.0 - abs(uv.y - 0.5) * 2.0, 2.4);
          float grain = hash(uv * 180.0 + t) * 0.05;

          vec3 color = mahogany;
          color = mix(color, wood, 0.28 * uHasWood);
          color = mix(color, gold, rim * 0.22 + sweep * 0.08);
          color = mix(color, cream, rim * sweep * 0.07);
          color += grain * gold * 0.22;

          float alpha = 0.28 + rim * 0.14 + sweep * 0.05;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.52));
        }
      `,
    });

    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);
    loader.load(
      GARBO_WOOD_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2.2, 1.4);
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        tex.needsUpdate = true;
        uniforms.uWood.value = tex;
        uniforms.uHasWood.value = 1;
      },
      undefined,
      () => {
        uniforms.uHasWood.value = 0;
      },
    );

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const clock = new THREE.Clock();
    let frame = 0;
    let running = true;

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const draw = () => {
      if (!running) return;
      if (!prefersReduced) frame = requestAnimationFrame(draw);
      uniforms.uTime.value = prefersReduced ? 0.6 : clock.getElapsedTime();
      renderer.render(scene, camera);
    };

    if (prefersReduced) {
      uniforms.uTime.value = 0.6;
      renderer.render(scene, camera);
    } else {
      draw();
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      const wood = uniforms.uWood.value as THREE.Texture;
      if (wood && wood !== fallback) wood.dispose();
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

import { useEffect, useId, useRef, useState } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';

interface LeadAIRenderWipeStageProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  onExport?: () => void;
}

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = `
uniform sampler2D uBefore;
uniform sampler2D uAfter;
uniform vec2 uResolution;
uniform vec2 uBeforeSize;
uniform vec2 uAfterSize;
uniform float uWipe;
uniform float uTime;
uniform float uReady;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 coverUv(vec2 uv, vec2 texSize) {
  float texAspect = max(texSize.x, 1.0) / max(texSize.y, 1.0);
  float resAspect = max(uResolution.x, 1.0) / max(uResolution.y, 1.0);
  vec2 scale = resAspect > texAspect
    ? vec2(1.0, texAspect / resAspect)
    : vec2(resAspect / texAspect, 1.0);
  return clamp((uv - 0.5) * scale + 0.5, 0.0, 1.0);
}

vec4 sampleFit(sampler2D tex, vec2 uv, vec2 texSize, vec3 paper) {
  vec4 sampled = texture2D(tex, coverUv(uv, texSize));
  return vec4(mix(paper, sampled.rgb, 1.0), sampled.a);
}

void main() {
  vec3 paper = vec3(0.055, 0.031, 0.024);
  vec4 before = sampleFit(uBefore, vUv, uBeforeSize, paper);
  vec4 after = sampleFit(uAfter, vUv, uAfterSize, paper);
  float grain = hash(vUv * 420.0 + uTime * 8.0) * 0.045;
  float edge = smoothstep(uWipe - 0.012, uWipe + 0.012, vUv.x);
  vec3 gold = vec3(0.949, 0.847, 0.573);
  float slit = 1.0 - smoothstep(0.0, 0.018, abs(vUv.x - uWipe));
  float fresnel = pow(slit, 1.6);
  vec3 mixed = mix(before.rgb, after.rgb, edge);
  mixed += gold * fresnel * 0.85;
  mixed += grain * mix(0.35, 0.12, edge);
  float alpha = mix(before.a, after.a, edge) * uReady;
  gl_FragColor = vec4(mixed, max(alpha, fresnel * 0.35));
}
`;

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => {
      const texture = new THREE.Texture(image);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => reject(new Error('falha ao carregar textura'));
    image.src = url;
  });
}

/**
 * Comparador ateliê: o depois revela o antes por uma fenda dourada.
 * Se o aparelho não aguentar WebGL, usa recorte CSS.
 */
export function LeadAIRenderWipeStage({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
  className,
  onExport,
}: LeadAIRenderWipeStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wipeRef = useRef(0.52);
  const [wipe, setWipe] = useState(0.52);
  const [webglOk, setWebglOk] = useState(true);
  const sliderId = useId();

  useEffect(() => {
    wipeRef.current = wipe;
  }, [wipe]);

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
    if (!renderer) {
      setWebglOk(false);
      return;
    }

    setWebglOk(true);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    host.appendChild(renderer.domElement);

    const dummy = new THREE.DataTexture(new Uint8Array([20, 12, 8, 255]), 1, 1);
    dummy.needsUpdate = true;

    const uniforms = {
      uBefore: { value: dummy as THREE.Texture },
      uAfter: { value: dummy as THREE.Texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uBeforeSize: { value: new THREE.Vector2(1, 1) },
      uAfterSize: { value: new THREE.Vector2(1, 1) },
      uWipe: { value: wipeRef.current },
      uTime: { value: 0 },
      uReady: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    let beforeTex: THREE.Texture | null = null;
    let afterTex: THREE.Texture | null = null;
    let running = true;
    let frame = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      uniforms.uResolution.value.set(w, h);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    void Promise.all([loadTexture(beforeUrl), loadTexture(afterUrl)])
      .then(([before, after]) => {
        if (!running) {
          before.dispose();
          after.dispose();
          return;
        }
        beforeTex = before;
        afterTex = after;
        uniforms.uBefore.value = before;
        uniforms.uAfter.value = after;
        const beforeImage = before.image as { width?: number; height?: number };
        const afterImage = after.image as { width?: number; height?: number };
        uniforms.uBeforeSize.value.set(beforeImage.width ?? 1, beforeImage.height ?? 1);
        uniforms.uAfterSize.value.set(afterImage.width ?? 1, afterImage.height ?? 1);
        uniforms.uReady.value = 1;
      })
      .catch(() => {
        if (running) setWebglOk(false);
      });

    const tick = () => {
      if (!running) return;
      uniforms.uWipe.value = wipeRef.current;
      uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      material.dispose();
      mesh.geometry.dispose();
      beforeTex?.dispose();
      afterTex?.dispose();
      dummy.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [afterUrl, beforeUrl]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-gold/30 bg-[#140c09]',
        'shadow-[0_18px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(242,216,146,0.16)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gold/20 px-3 py-1.5 sm:px-3.5">
        <p className="font-display text-[10px] tracking-[0.22em] text-[#f2d892]">Fenda do ateliê</p>
        <div className="flex items-center gap-2">
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              className="rounded-full border border-[#f2d892]/40 bg-[#f2d892]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f2d892] hover:bg-[#f2d892]/20"
            >
              Exportar
            </button>
          ) : (
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#f2d892]/70">Arraste para ver o antes e o depois</p>
          )}
        </div>
      </div>

      <div className="relative mx-auto h-[min(240px,36vh)] w-full bg-[#0e0806]">
        {!webglOk && (
          <div className="absolute inset-0">
            <img src={afterUrl} alt={afterLabel} className="h-full w-full object-cover" />
            <img
              src={beforeUrl}
              alt={beforeLabel}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${((1 - wipe) * 100).toFixed(2)}% 0 0)` }}
            />
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-[#f2d892] shadow-[0_0_18px_rgba(242,216,146,0.65)]"
              style={{ left: `${wipe * 100}%` }}
            />
          </div>
        )}
        <div ref={hostRef} className={cn('absolute inset-0', !webglOk && 'hidden')} />

        <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#f2d892]/35 bg-[#1a100c]/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#f2d892]">
          {beforeLabel}
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-gold">
          {afterLabel}
        </span>
      </div>

      <div className="border-t border-gold/20 px-3 py-1.5 sm:px-3.5">
        <label htmlFor={sliderId} className="sr-only">
          Posição da comparação entre a montagem e o render
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          value={Math.round(wipe * 100)}
          onChange={(event) => setWipe(Number(event.target.value) / 100)}
          className="h-2 w-full cursor-ew-resize appearance-none rounded-full bg-[#2a1812] accent-[#f2d892]"
        />
      </div>
    </div>
  );
}

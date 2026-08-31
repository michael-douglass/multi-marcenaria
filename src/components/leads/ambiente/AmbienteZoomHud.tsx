import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { AMBIENTE_ZOOM_MAX, AMBIENTE_ZOOM_MIN } from '@/lib/lead-ai-ambiente-zoom';

interface AmbienteZoomHudProps {
  scale: number;
  disabled?: boolean;
  onScaleChange: (scale: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/**
 * Controle de distância na cena — mais longe / mais perto, com véu WebGL no trilho.
 */
export function AmbienteZoomHud({
  scale,
  disabled = false,
  onScaleChange,
  onZoomIn,
  onZoomOut,
}: AmbienteZoomHudProps) {
  const foilRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    const host = foilRef.current;
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
      uScale: { value: scaleRef.current },
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
        uniform float uScale;
        uniform vec3 uGold;
        uniform vec3 uMahogany;
        varying vec2 vUv;

        void main() {
          float t = clamp((uScale - 0.4) / 2.4, 0.0, 1.0);
          float sweep = 0.5 + 0.5 * sin((vUv.x * 9.0 + uTime * 0.55) * 6.2831);
          float focus = pow(1.0 - abs(vUv.x - mix(0.16, 0.84, t)), 1.8);
          float rim = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.4);
          vec3 color = mix(uMahogany, uGold, focus * 0.72 + sweep * 0.08);
          float alpha = (0.18 + focus * 0.42 + t * 0.12) * rim;
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
      uniforms.uTime.value = prefersReducedMotion ? 0.6 : clock.getElapsedTime();
      uniforms.uScale.value = scaleRef.current;
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

  const percent = Math.round(scale * 100);
  const sliderMin = Math.round(AMBIENTE_ZOOM_MIN * 100);
  const sliderMax = Math.round(AMBIENTE_ZOOM_MAX * 100);

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-50 flex justify-center">
      <div
        className={cn(
          'relative overflow-hidden rounded-full border border-gold/35 bg-[#1a100c]/88 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md',
          'px-2 py-1.5 sm:px-3',
        )}
      >
        <div ref={foilRef} className="pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex items-center gap-1.5 sm:gap-2">
          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-gold/80 sm:inline">
            Longe
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gold hover:bg-gold/15 hover:text-gold"
            disabled={disabled || scale <= AMBIENTE_ZOOM_MIN}
            onClick={onZoomOut}
            aria-label="Afastar foto"
            title="Mais longe"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Slider
            min={sliderMin}
            max={sliderMax}
            step={4}
            value={[percent]}
            disabled={disabled}
            onValueChange={([value]) => onScaleChange((value ?? percent) / 100)}
            aria-label="Distância da foto na cena"
            className={cn(
              'w-[7.5rem] sm:w-40',
              '[&>span]:h-1 [&>span]:bg-[#2a1812]/90',
              '[&>span>span]:bg-gold',
              '[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-gold [&_[role=slider]]:bg-[#fff6ea]',
            )}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gold hover:bg-gold/15 hover:text-gold"
            disabled={disabled || scale >= AMBIENTE_ZOOM_MAX}
            onClick={onZoomIn}
            aria-label="Aproximar foto"
            title="Mais perto"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-gold/80 sm:inline">
            Perto
          </span>
          <span className="min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums text-[#fff6ea]">
            {percent}%
          </span>
        </div>
      </div>
    </div>
  );
}

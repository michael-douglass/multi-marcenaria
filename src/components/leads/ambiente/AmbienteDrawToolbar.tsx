import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  Circle,
  MousePointer2,
  Minus,
  Pencil,
  Square,
  Triangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AMBIENTE_INK, AMBIENTE_INK_PRESETS } from '@/lib/lead-ai-ambiente-draw';
import type { AmbienteDrawTool } from '@/lib/lead-ai-ambiente-types';

interface AmbienteDrawToolbarProps {
  tool: AmbienteDrawTool;
  fill: boolean;
  stroke?: string;
  disabled?: boolean;
  onToolChange: (tool: AmbienteDrawTool) => void;
  onFillChange: (fill: boolean) => void;
  onStrokeChange?: (stroke: string) => void;
}

const TOOLS: { id: AmbienteDrawTool; label: string; hint: string; icon: typeof Square }[] = [
  { id: 'select', label: 'Selecionar', hint: 'Mover e apagar o que já está na cena — V', icon: MousePointer2 },
  { id: 'pencil', label: 'Lápis', hint: 'Traço livre para paredes e recortes — P', icon: Pencil },
  { id: 'line', label: 'Linha', hint: 'Clique e arraste. Shift trava em 45° — L', icon: Minus },
  { id: 'rect', label: 'Retângulo', hint: 'Clique e arraste. Shift faz quadrado — R', icon: Square },
  { id: 'ellipse', label: 'Elipse', hint: 'Clique e arraste. Shift faz círculo — O', icon: Circle },
  { id: 'triangle', label: 'Triângulo', hint: 'Volume triangular — T', icon: Triangle },
];

export function AmbienteDrawToolbar({
  tool,
  fill,
  stroke = AMBIENTE_INK,
  disabled = false,
  onToolChange,
  onFillChange,
  onStrokeChange,
}: AmbienteDrawToolbarProps) {
  const foilRef = useRef<HTMLDivElement>(null);

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
    renderer.domElement.style.pointerEvents = 'none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uTime: { value: 0 },
      uGold: { value: new THREE.Color('#f2d892') },
      uMahogany: { value: new THREE.Color('#1a100c') },
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

        void main() {
          float sweep = 0.5 + 0.5 * sin((vUv.x * 3.4 + uTime * 0.35) * 6.2831);
          float rim = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.8);
          vec3 color = mix(uMahogany, uGold, rim * 0.55 + sweep * 0.12);
          color = mix(color, uCream, rim * sweep * 0.18);
          gl_FragColor = vec4(color, 0.22 + rim * 0.18);
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
      uniforms.uTime.value = prefersReducedMotion ? 0.8 : clock.getElapsedTime();
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
      data-ambiente-draw-toolbar="true"
      className="relative overflow-hidden rounded-xl border border-gold/30 bg-[#1a100c]/90 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
    >
      <div ref={foilRef} className="pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10 flex flex-wrap items-center gap-1 p-1.5">
        {TOOLS.map((item) => {
          const Icon = item.icon;
          const selected = tool === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={item.label}
                  aria-pressed={selected}
                  className={cn(
                    'h-8 w-8 text-[#fff6ea] hover:bg-gold/15 hover:text-gold',
                    selected && 'bg-gold/20 text-gold ring-1 ring-gold/50',
                  )}
                  onClick={() => onToolChange(item.id)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{item.hint}</TooltipContent>
            </Tooltip>
          );
        })}
        <div className="mx-0.5 h-6 w-px bg-gold/25" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              aria-pressed={fill}
              className={cn(
                'h-8 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#fff6ea]',
                fill && 'bg-gold/20 text-gold ring-1 ring-gold/50',
              )}
              onClick={() => onFillChange(!fill)}
            >
              Preencher
            </Button>
          </TooltipTrigger>
          <TooltipContent>Retângulo, elipse e triângulo com preenchimento suave</TooltipContent>
        </Tooltip>
        <div className="mx-0.5 h-6 w-px bg-gold/25" />
        <div className="flex items-center gap-1" role="group" aria-label="Cor do desenho">
          {AMBIENTE_INK_PRESETS.map((preset) => {
            const selected = stroke.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled || !onStrokeChange}
                aria-label={preset.label}
                aria-pressed={selected}
                title={preset.label}
                className={cn(
                  'relative z-10 h-6 w-6 shrink-0 rounded-full border-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)] transition-transform hover:scale-110 disabled:opacity-50',
                  selected
                    ? 'border-[#fff6ea] ring-2 ring-gold/70 scale-110'
                    : 'border-white/30',
                )}
                style={{ backgroundColor: preset.hex }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (disabled) return;
                  onStrokeChange?.(preset.hex);
                }}
              />
            );
          })}
          <label
            className="relative z-10 h-6 w-6 shrink-0 overflow-hidden rounded-full border-2 border-white/30 hover:border-gold/60"
            title="Cor personalizada"
          >
            <span className="sr-only">Cor personalizada</span>
            <input
              type="color"
              value={stroke}
              disabled={disabled || !onStrokeChange}
              aria-label="Cor personalizada do desenho"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => onStrokeChange?.(event.target.value)}
            />
            <span
              className="pointer-events-none block h-full w-full rounded-full"
              style={{
                background:
                  'conic-gradient(#e85d4c, #f2d892, #7dce7a, #4aa3ff, #e879f9, #e85d4c)',
              }}
              aria-hidden
            />
          </label>
        </div>
        <span className="hidden px-1.5 text-[10px] uppercase tracking-[0.14em] text-gold/70 sm:inline">
          Lousa
        </span>
      </div>
    </div>
  );
}

import type { PointerEvent as ReactPointerEvent } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { wrapShapeRotation } from '@/lib/lead-ai-ambiente-draw';

interface AmbienteShapeEditHudProps {
  rotation: number;
  disabled?: boolean;
  onRotate: (deltaDeg: number) => void;
  onRotationChange: (deg: number) => void;
  onSnapRotation: (deg: number) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

const hudBtn =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#f2d892] transition hover:bg-white/10 active:scale-95 disabled:opacity-40';

const presetBtn =
  'h-7 shrink-0 rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-wide transition active:scale-95 disabled:opacity-40';

const SHAPE_PRESETS: Array<{ deg: number; label: string; hint: string }> = [
  { deg: 0, label: 'Reto', hint: 'Deitar o desenho na horizontal' },
  { deg: 45, label: 'Diag. 45°', hint: 'Diagonal' },
  { deg: 90, label: 'Vert. 90°', hint: 'Vertical' },
  { deg: 135, label: 'Diag. 135°', hint: 'Diagonal invertida' },
  { deg: 180, label: 'Transv. 180°', hint: 'Transversal — de cabeça para baixo' },
  { deg: 270, label: 'Vert. 270°', hint: 'Vertical para o outro lado' },
];

/**
 * Giro do desenho na lousa — diagonal, vertical, transversal e livre.
 */
export function AmbienteShapeEditHud({
  rotation,
  disabled = false,
  onRotate,
  onRotationChange,
  onSnapRotation,
  onRotatePointerDown,
}: AmbienteShapeEditHudProps) {
  const deg = wrapShapeRotation(rotation);

  return (
    <div className="pointer-events-auto absolute inset-x-3 top-3 z-[56] flex justify-center pr-12">
      <div
        role="toolbar"
        aria-label="Girar desenho"
        className={cn(
          'relative overflow-hidden rounded-2xl border border-gold/35 bg-[#1a100c]/90 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md',
          'px-2 py-1.5 sm:px-3',
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f2d892]/70">
          Girar desenho
        </p>
        <div className="relative flex flex-wrap items-center justify-center gap-1">
          {SHAPE_PRESETS.map((preset) => {
            const active = deg === preset.deg;
            return (
              <button
                key={preset.deg}
                type="button"
                disabled={disabled}
                title={preset.hint}
                aria-label={preset.hint}
                aria-pressed={active}
                className={cn(
                  presetBtn,
                  active
                    ? 'border-[#f2d892]/70 bg-[#f2d892]/20 text-[#fff6ea]'
                    : 'border-[#f2d892]/25 bg-transparent text-[#f2d892] hover:bg-white/10',
                )}
                onClick={() => onSnapRotation(preset.deg)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="relative mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            className={hudBtn}
            disabled={disabled}
            title="Girar 15° à esquerda"
            aria-label="Girar 15 graus à esquerda"
            onClick={() => onRotate(-15)}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Arraste para girar o desenho"
            aria-label="Girar o desenho em tempo real"
            disabled={disabled}
            className={cn(
              'relative flex h-9 min-w-[4.25rem] items-center justify-center gap-1 rounded-xl',
              'border border-[#f2d892]/45 bg-[#f2d892]/12 text-[#fff6ea]',
              'cursor-grab active:cursor-grabbing hover:bg-[#f2d892]/20',
              'disabled:opacity-40',
            )}
            onPointerDown={onRotatePointerDown}
          >
            <RotateCw className="h-3.5 w-3.5 opacity-80" />
            <span className="font-mono text-[11px] font-bold tabular-nums">{deg}°</span>
          </button>
          <button
            type="button"
            className={hudBtn}
            disabled={disabled}
            title="Girar 15° à direita"
            aria-label="Girar 15 graus à direita"
            onClick={() => onRotate(15)}
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <Slider
            min={0}
            max={359}
            step={1}
            value={[deg]}
            disabled={disabled}
            onValueChange={([value]) => onRotationChange(value ?? deg)}
            aria-label="Giro do desenho"
            className={cn(
              'w-[6.5rem] sm:w-28',
              '[&>span]:h-1 [&>span]:bg-[#2a1812]/90',
              '[&>span>span]:bg-gold',
              '[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-gold [&_[role=slider]]:bg-[#fff6ea]',
            )}
          />
        </div>
      </div>
    </div>
  );
}

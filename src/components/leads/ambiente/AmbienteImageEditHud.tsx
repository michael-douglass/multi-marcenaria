import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Crop,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

function wrapPhotoRotation(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

interface AmbienteImageEditHudProps {
  rotation: number;
  flipH?: boolean;
  flipV?: boolean;
  disabled?: boolean;
  onRotate: (deltaDeg: number) => void;
  onRotationChange: (deg: number) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onCrop?: () => void;
  onRetouch?: () => void;
  onRemove?: () => void;
}

const hudBtn =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#f2d892] transition hover:bg-white/10 active:scale-95 disabled:opacity-40';

/**
 * Giro livre da foto na lousa — 90°, arraste, slider e espelho.
 */
export function AmbienteImageEditHud({
  rotation,
  flipH = false,
  flipV = false,
  disabled = false,
  onRotate,
  onRotationChange,
  onRotatePointerDown,
  onFlipH,
  onFlipV,
  onCrop,
  onRetouch,
  onRemove,
}: AmbienteImageEditHudProps) {
  const deg = wrapPhotoRotation(rotation);

  return (
    <div className="pointer-events-auto absolute inset-x-3 top-3 z-[55] flex justify-center pr-12">
      <div
        role="toolbar"
        aria-label="Editar foto"
        className={cn(
          'relative overflow-hidden rounded-2xl border border-gold/35 bg-[#1a100c]/90 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md',
          'px-2 py-1.5 sm:px-3',
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="relative flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            className={hudBtn}
            disabled={disabled}
            title="Girar 90° à esquerda"
            aria-label="Girar 90 graus à esquerda"
            onClick={() => onRotate(-90)}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Arraste para girar a foto"
            aria-label="Girar a foto em tempo real"
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
            title="Girar 90° à direita"
            aria-label="Girar 90 graus à direita"
            onClick={() => onRotate(90)}
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
            aria-label="Giro da foto"
            className={cn(
              'w-[6.5rem] sm:w-28',
              '[&>span]:h-1 [&>span]:bg-[#2a1812]/90',
              '[&>span>span]:bg-gold',
              '[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-gold [&_[role=slider]]:bg-[#fff6ea]',
            )}
          />
          <button
            type="button"
            className={cn(hudBtn, flipH && 'bg-[#f2d892]/20 ring-1 ring-[#f2d892]/50')}
            disabled={disabled}
            title="Espelhar esquerda e direita"
            aria-label="Espelhar horizontalmente"
            onClick={onFlipH}
          >
            <FlipHorizontal2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(hudBtn, flipV && 'bg-[#f2d892]/20 ring-1 ring-[#f2d892]/50')}
            disabled={disabled}
            title="Espelhar cima e baixo"
            aria-label="Espelhar verticalmente"
            onClick={onFlipV}
          >
            <FlipVertical2 className="h-4 w-4" />
          </button>
          {onCrop ? (
            <button
              type="button"
              className={hudBtn}
              disabled={disabled}
              title="Recortar a foto"
              aria-label="Recortar a foto"
              onClick={onCrop}
            >
              <Crop className="h-4 w-4" />
            </button>
          ) : null}
          {onRetouch ? (
            <button
              type="button"
              className={hudBtn}
              disabled={disabled}
              title="Remover fundo e ajustar luz"
              aria-label="Retocar a foto"
              onClick={onRetouch}
            >
              <Eraser className="h-4 w-4" />
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              className={cn(hudBtn, 'ml-0.5 text-[#f3c4b8] hover:bg-red-950/70')}
              disabled={disabled}
              title="Excluir só esta foto — os desenhos ficam"
              aria-label="Excluir esta foto"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

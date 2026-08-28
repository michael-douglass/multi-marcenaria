import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeftRight,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getFamilyForModuleType,
  getFurnitureVariants,
} from '@/lib/furniture-modules';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import type { AmbienteFurnitureObject } from '@/lib/lead-ai-ambiente-types';

function normalizeDeg(deg: number): number {
  let value = ((deg % 360) + 360) % 360;
  if (value > 180) value -= 360;
  return Math.round(value);
}

interface AmbienteObjectEditHudProps {
  object: AmbienteFurnitureObject;
  disabled?: boolean;
  onScale: (factor: number) => void;
  onNudgeWidth: (factor: number) => void;
  onRotate: (deltaDeg: number) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onChangeType: (moduleType: FurnitureModuleType) => void;
  onRemove: () => void;
}

const dockBtn =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800/90 text-amber-50 shadow-sm transition hover:bg-zinc-700 active:scale-95 disabled:opacity-40';

export function AmbienteObjectEditHud({
  object,
  disabled = false,
  onScale,
  onNudgeWidth,
  onRotate,
  onRotatePointerDown,
  onChangeType,
  onRemove,
}: AmbienteObjectEditHudProps) {
  const rotDeg = normalizeDeg(object.rotation ?? 0);
  const variants = getFurnitureVariants(getFamilyForModuleType(object.moduleType));

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: `${object.x * 100}%`,
        top: `${object.y * 100}%`,
        width: `${object.width * 100}%`,
        height: `${object.height * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        role="toolbar"
        aria-label="Ajustes do móvel"
        className={cn(
          'pointer-events-auto absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-[calc(100%+10px)]',
          'max-w-[min(92vw,28rem)] items-center gap-1 overflow-x-auto rounded-xl border border-amber-900/40',
          'bg-zinc-950/92 p-1.5 shadow-lg backdrop-blur-md',
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          title="Diminuir tamanho"
          aria-label="Diminuir tamanho"
          className={dockBtn}
          disabled={disabled}
          onClick={() => onScale(0.85)}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Aumentar tamanho"
          aria-label="Aumentar tamanho"
          className={dockBtn}
          disabled={disabled}
          onClick={() => onScale(1.15)}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-5 w-px shrink-0 bg-amber-700/40" />
        <button
          type="button"
          title="Estreitar móvel"
          aria-label="Estreitar móvel"
          className={cn(dockBtn, 'w-auto gap-1 px-2 text-[10px] font-bold tracking-wide')}
          disabled={disabled}
          onClick={() => onNudgeWidth(0.82)}
        >
          <ArrowLeftRight className="h-3 w-3 rotate-90 opacity-70" />
          −
        </button>
        <button
          type="button"
          title="Alargar móvel"
          aria-label="Alargar móvel"
          className={cn(dockBtn, 'w-auto gap-1 px-2 text-[10px] font-bold tracking-wide')}
          disabled={disabled}
          onClick={() => onNudgeWidth(1.22)}
        >
          <ArrowLeftRight className="h-3 w-3 opacity-70" />
          +
        </button>
        <div className="mx-0.5 h-5 w-px shrink-0 bg-amber-700/40" />
        {variants.map((mod) => (
          <button
            key={mod.type}
            type="button"
            title={`${mod.label} — ${mod.description}`}
            disabled={disabled}
            className={cn(
              'shrink-0 rounded-md px-1.5 py-1.5 text-[9px] font-semibold leading-none transition-colors',
              object.moduleType === mod.type
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800/80 text-amber-100/80 hover:bg-zinc-700',
            )}
            onClick={() => onChangeType(mod.type)}
          >
            {mod.label}
          </button>
        ))}
        <button
          type="button"
          title="Apagar objeto"
          aria-label={`Apagar ${object.label}`}
          className={cn(dockBtn, 'ml-0.5 bg-red-900/80 hover:bg-red-800')}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        role="toolbar"
        aria-label="Rotação do móvel"
        className={cn(
          'pointer-events-auto absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-[calc(100%+12px)]',
          'items-center gap-1.5 rounded-2xl border border-amber-500/35',
          'bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 px-2 py-1.5 shadow-xl backdrop-blur-md',
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          title="Girar 15° à esquerda"
          aria-label="Girar para a esquerda"
          className={dockBtn}
          disabled={disabled}
          onClick={() => onRotate(-15)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Arraste para girar em tempo real"
          aria-label="Girar em tempo real"
          disabled={disabled}
          className={cn(
            'relative flex h-10 min-w-[4.5rem] shrink-0 items-center justify-center gap-1.5 rounded-xl',
            'border border-amber-400/50 bg-amber-500/15 text-amber-100',
            'cursor-grab active:cursor-grabbing hover:bg-amber-500/25 active:scale-[0.98]',
            'shadow-inner transition disabled:opacity-40',
          )}
          onPointerDown={onRotatePointerDown}
        >
          <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-300/20" />
          <RotateCw className="h-3.5 w-3.5 opacity-80" />
          <span className="font-mono text-[11px] font-bold tabular-nums tracking-tight">
            {rotDeg > 0 ? `+${rotDeg}` : rotDeg}°
          </span>
        </button>
        <button
          type="button"
          title="Girar 15° à direita"
          aria-label="Girar para a direita"
          className={dockBtn}
          disabled={disabled}
          onClick={() => onRotate(15)}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Girar 90°"
          className={cn(dockBtn, 'w-auto px-2 text-[10px] font-bold')}
          disabled={disabled}
          onClick={() => onRotate(90)}
        >
          90°
        </button>
      </div>
    </div>
  );
}

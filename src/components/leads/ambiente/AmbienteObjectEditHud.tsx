import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
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
import { clampOrbitPitch, wrapOrbitYaw } from '@/lib/furniture-catalog-banks';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';
import type { AmbienteFurnitureObject } from '@/lib/lead-ai-ambiente-types';
import type { FurnitureViewMode } from '@/lib/furniture-catalog-banks';
import {
  DEFAULT_FURNITURE_COLOR,
  FURNITURE_FINISH_PRESETS,
} from '@/lib/furniture-finish-colors';

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
  onOrbitYaw: (deltaDeg: number) => void;
  onOrbitPitch: (deltaDeg: number) => void;
  onOrbitPreset: (yaw: number, pitch?: number) => void;
  onOrbitPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onChangeType: (moduleType: FurnitureModuleType) => void;
  onChangeViewMode: (viewMode: FurnitureViewMode) => void;
  onChangeColor: (colorHex: string) => void;
  onRemove: () => void;
}

const dockBtn =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800/90 text-amber-50 shadow-sm transition hover:bg-zinc-700 active:scale-95 disabled:opacity-40';

const YAW_PRESETS: Array<{ yaw: number; label: string }> = [
  { yaw: 0, label: 'Frente' },
  { yaw: 45, label: '¾' },
  { yaw: 90, label: 'Lado' },
  { yaw: 180, label: 'Costas' },
  { yaw: 270, label: 'Outro lado' },
];

export function AmbienteObjectEditHud({
  object,
  disabled = false,
  onScale,
  onNudgeWidth,
  onRotate,
  onRotatePointerDown,
  onOrbitYaw,
  onOrbitPitch,
  onOrbitPreset,
  onOrbitPointerDown,
  onChangeType,
  onChangeViewMode,
  onChangeColor,
  onRemove,
}: AmbienteObjectEditHudProps) {
  const rotDeg = normalizeDeg(object.rotation ?? 0);
  const yaw = Math.round(wrapOrbitYaw(object.yaw ?? 0));
  const pitch = Math.round(clampOrbitPitch(object.pitch ?? 0));
  const variants = getFurnitureVariants(getFamilyForModuleType(object.moduleType));
  const viewMode: FurnitureViewMode = object.viewMode ?? '3d';

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: `${(object.x + object.width / 2) * 100}%`,
        top: `${object.y * 100}%`,
        transform: 'translate(14px, -50%)',
      }}
    >
      <div
        role="toolbar"
        aria-label="Ajustes do móvel"
        className={cn(
          'pointer-events-auto z-10 flex max-h-[min(70vh,28rem)] max-w-[15.5rem] flex-col gap-1.5 overflow-y-auto',
          'rounded-2xl border border-amber-900/40 bg-zinc-950/92 p-1.5 shadow-lg backdrop-blur-md',
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-1">
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
        {(['reto', '3d', 'realista'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            title={mode === 'reto' ? 'Desenho reto (frontal)' : mode === '3d' ? 'Desenho em volume' : 'Madeira realista'}
            disabled={disabled}
            className={cn(
              'shrink-0 rounded-md px-1.5 py-1.5 text-[9px] font-semibold leading-none transition-colors',
              viewMode === mode
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800/80 text-amber-100/80 hover:bg-zinc-700',
            )}
            onClick={() => onChangeViewMode(mode)}
          >
            {mode === 'reto' ? 'Reto' : mode === '3d' ? '3D' : 'Madeira'}
          </button>
        ))}
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
        className="flex flex-col items-start gap-1.5 rounded-xl border border-amber-500/25 bg-zinc-900/80 px-1.5 py-1.5"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Girar 15° à esquerda no plano"
            aria-label="Girar no plano para a esquerda"
            className={dockBtn}
            disabled={disabled}
            onClick={() => onRotate(-15)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Arraste para girar no plano da foto"
            aria-label="Girar no plano em tempo real"
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
            title="Girar 15° à direita no plano"
            aria-label="Girar no plano para a direita"
            className={dockBtn}
            disabled={disabled}
            onClick={() => onRotate(15)}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Girar 90° no plano"
            className={cn(dockBtn, 'w-auto px-2 text-[10px] font-bold')}
            disabled={disabled}
            onClick={() => onRotate(90)}
          >
            90°
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1">
          <span className="px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">
            Virar
          </span>
          {YAW_PRESETS.map((preset) => (
            <button
              key={preset.yaw}
              type="button"
              title={`Ver ${preset.label.toLowerCase()}`}
              disabled={disabled}
              className={cn(
                'h-7 rounded-md px-1.5 text-[9px] font-semibold',
                yaw === preset.yaw
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800/90 text-amber-100/85 hover:bg-zinc-700',
              )}
              onClick={() => onOrbitPreset(preset.yaw, pitch)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            title="Virar 45° para a esquerda"
            className={dockBtn}
            disabled={disabled}
            onClick={() => onOrbitYaw(-45)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Arraste: esquerda/direita vira, cima/baixo inclina"
            aria-label="Orbitar em todas as direções"
            disabled={disabled}
            className={cn(
              'relative flex h-8 min-w-[5.5rem] items-center justify-center rounded-lg',
              'border border-amber-400/40 bg-amber-500/10 text-[10px] font-bold text-amber-100',
              'cursor-grab active:cursor-grabbing hover:bg-amber-500/20',
            )}
            onPointerDown={onOrbitPointerDown}
          >
            {yaw}° · {pitch}°
          </button>
          <button
            type="button"
            title="Virar 45° para a direita"
            className={dockBtn}
            disabled={disabled}
            onClick={() => onOrbitYaw(45)}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Inclinar para ver de cima"
            aria-label="Inclinar para cima"
            className={dockBtn}
            disabled={disabled}
            onClick={() => onOrbitPitch(12)}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Inclinar para ver de baixo"
            aria-label="Inclinar para baixo"
            className={dockBtn}
            disabled={disabled}
            onClick={() => onOrbitPitch(-12)}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className="flex flex-col gap-1.5 rounded-xl border border-amber-500/25 bg-zinc-900/80 px-1.5 py-1.5"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
          Cor do objeto
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {FURNITURE_FINISH_PRESETS.map((preset) => {
            const active = (object.colorHex ?? DEFAULT_FURNITURE_COLOR).toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={`Pintar de ${preset.label}`}
                aria-pressed={active}
                disabled={disabled}
                className={cn(
                  'h-5 w-5 rounded-full border shadow-inner transition hover:scale-110 disabled:opacity-40',
                  active ? 'border-amber-200 ring-2 ring-amber-400/70' : 'border-black/40',
                )}
                style={{ backgroundColor: preset.hex }}
                onClick={() => onChangeColor(preset.hex)}
              />
            );
          })}
          <label className="relative h-5 w-5 overflow-hidden rounded-full border border-amber-400/50" title="Cor livre">
            <span className="sr-only">Escolher cor livre</span>
            <input
              type="color"
              disabled={disabled}
              value={object.colorHex ?? DEFAULT_FURNITURE_COLOR}
              aria-label="Escolher cor livre do objeto"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              onChange={(event) => onChangeColor(event.target.value)}
            />
            <span
              className="block h-full w-full"
              style={{
                background:
                  'conic-gradient(#f2d892, #3a241c, #3d5c4a, #3a4a62, #a85a3a, #f4efe6, #f2d892)',
              }}
            />
          </label>
        </div>
      </div>
      </div>
    </div>
  );
}

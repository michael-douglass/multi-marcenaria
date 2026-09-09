import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crop,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Move3d,
  PanelRight,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { wrapPhotoPitch, wrapPhotoYaw } from '@/lib/lead-ai-ambiente-zoom';

function wrapPhotoRotation(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

const HUD_MIN_KEY = 'selletos-ambiente-photo-hud-min';

interface PhotoHudAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AmbienteImageEditHudProps {
  rotation: number;
  yaw?: number;
  pitch?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** Caixa da foto na lousa (0–1). Sem isso, o painel fica no canto. */
  anchor?: PhotoHudAnchor;
  /** Foto de móvel por cima — gira nos 3 eixos. O fundo do cômodo não. */
  showOrbit?: boolean;
  disabled?: boolean;
  onRotate: (deltaDeg: number) => void;
  onRotationChange: (deg: number) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onYaw?: (deltaDeg: number) => void;
  onPitch?: (deltaDeg: number) => void;
  onYawChange?: (deg: number) => void;
  onPitchChange?: (deg: number) => void;
  onOrbitPreset?: (yaw: number, pitch?: number) => void;
  onOrbitPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onCrop?: () => void;
  onRetouch?: () => void;
  onRemove?: () => void;
}

const hudBtn =
  'ambiente-lousa-hud__icon-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition hover:bg-white/10 active:scale-95 disabled:opacity-40';

const nudgeBtn =
  'ambiente-lousa-hud__nudge flex h-8 min-w-[2rem] flex-1 items-center justify-center rounded-md font-mono text-[10px] font-bold tabular-nums transition hover:bg-white/10 active:scale-95 disabled:opacity-40';

const sliderClass =
  '[&>span]:bg-[#2a1812]/90 [&>span>span]:bg-[#f2d892] [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-[#f2d892] [&_[role=slider]]:bg-[#fff6ea] [&_[role=slider]]:shadow-[0_0_0_3px_rgba(26,16,12,0.85)]';

const YAW_PRESETS: Array<{ yaw: number; label: string; hint: string }> = [
  { yaw: 0, label: 'Frente', hint: 'De frente' },
  { yaw: 45, label: '¾', hint: 'Três quartos' },
  { yaw: 90, label: 'Lado', hint: 'Transversal — de lado' },
  { yaw: 180, label: 'Costas', hint: 'Virado de costas' },
  { yaw: 270, label: 'Outro', hint: 'O outro lado' },
];

const PITCH_PRESETS: Array<{ pitch: number; label: string; hint: string }> = [
  { pitch: 0, label: 'Reto', hint: 'De pé, no eixo horizontal' },
  { pitch: 90, label: 'Cima', hint: 'Deitado — virado para cima' },
  { pitch: 180, label: 'Ponta', hint: 'De cabeça para baixo' },
  { pitch: 270, label: 'Baixo', hint: 'Deitado — virado para baixo' },
];

function readMinimized(): boolean {
  try {
    return sessionStorage.getItem(HUD_MIN_KEY) === '1';
  } catch {
    return false;
  }
}

const HUD_GAP_PX = 4;

function clamp01(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Cola o painel na lateral da foto, do lado que tiver mais espaço. */
function photoHudPlacement(anchor: PhotoHudAnchor, minimized: boolean): CSSProperties {
  const spaceRight = 1 - (anchor.x + anchor.width);
  const spaceLeft = anchor.x;
  const placeLeft = spaceRight < 0.22 || spaceRight < spaceLeft;
  const top = clamp01(anchor.y, 0.015, 0.48);
  const height = clamp01(Math.min(anchor.height, 0.9 - top), minimized ? 0.08 : 0.36, 0.88);

  return {
    left: `${(placeLeft ? anchor.x : anchor.x + anchor.width) * 100}%`,
    top: `${top * 100}%`,
    height: minimized ? undefined : `${height * 100}%`,
    maxHeight: 'calc(100% - 4.5rem)',
    transform: placeLeft
      ? `translate(calc(-100% - ${HUD_GAP_PX}px), 0)`
      : `translate(${HUD_GAP_PX}px, 0)`,
  };
}

/**
 * Véu tipo shader (Fresnel + ruído) em CSS.
 * Sem palco WebGL extra — o 3D da lousa já usa o orçamento do navegador.
 */
function HudShaderFoil() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(120% 70% at 0% 8%, rgba(255,246,234,0.16), transparent 46%)',
            'radial-gradient(90% 80% at 100% 100%, rgba(242,216,146,0.1), transparent 52%)',
            'linear-gradient(180deg, rgba(58,36,28,0.28), transparent 38%)',
          ].join(', '),
        }}
      />
      <div
        className="absolute -inset-[140%] origin-center opacity-50 motion-reduce:animate-none motion-safe:animate-spin"
        style={{
          animationDuration: '22s',
          background:
            'conic-gradient(from 200deg at 50% 50%, transparent 0 62%, rgba(242,216,146,0.18) 72%, transparent 84%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.55'/></svg>`,
          )}")`,
        }}
      />
      <span className="absolute inset-y-2 left-0 w-px bg-gradient-to-b from-transparent via-[#f2d892]/70 to-transparent" />
    </div>
  );
}

/**
 * Ferramentas da foto — coladas na peça selecionada (ou no canto, se for o fundo).
 */
export function AmbienteImageEditHud({
  rotation,
  yaw = 0,
  pitch = 0,
  flipH = false,
  flipV = false,
  anchor,
  showOrbit = false,
  disabled = false,
  onRotate,
  onRotationChange,
  onRotatePointerDown,
  onYaw,
  onPitch,
  onYawChange,
  onPitchChange,
  onOrbitPreset,
  onOrbitPointerDown,
  onFlipH,
  onFlipV,
  onCrop,
  onRetouch,
  onRemove,
}: AmbienteImageEditHudProps) {
  const deg = wrapPhotoRotation(rotation);
  const yawDeg = wrapPhotoYaw(yaw);
  const pitchDeg = wrapPhotoPitch(pitch);
  const canOrbit = Boolean(
    showOrbit && onYaw && onPitch && onYawChange && onPitchChange && onOrbitPreset && onOrbitPointerDown,
  );

  const [minimized, setMinimized] = useState(readMinimized);
  const placement = useMemo(
    () => (anchor ? photoHudPlacement(anchor, minimized) : undefined),
    [anchor, minimized],
  );

  const toggleMinimized = useCallback(() => {
    setMinimized((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(HUD_MIN_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);

  return (
    <div
      className={cn(
        'pointer-events-auto absolute z-[55]',
        !anchor && (minimized ? 'right-2 top-3' : 'bottom-[4.75rem] right-2 top-3 flex'),
        Boolean(anchor) && !minimized && 'flex',
      )}
      style={placement}
    >
      {minimized ? (
        <button
          type="button"
          aria-expanded={false}
          aria-controls="ambiente-image-edit-hud"
          aria-label="Mostrar ferramentas da foto"
          title="Ferramentas da foto"
          className={cn(
            'group relative flex h-[4.35rem] w-10 flex-col items-center justify-center gap-1 overflow-hidden',
            'ambiente-lousa-hud rounded-l-2xl rounded-r-md',
            'shadow-[0_10px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(242,216,146,0.18)]',
            'backdrop-blur-md transition hover:brightness-110',
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={toggleMinimized}
        >
          <HudShaderFoil />
          <PanelRight className="ambiente-lousa-hud__gold relative h-3.5 w-3.5" />
          <span
            className="ambiente-lousa-hud__gold relative font-display text-[10px] leading-none tracking-[0.18em]"
            style={{ writingMode: 'vertical-rl' }}
          >
            Foto
          </span>
        </button>
      ) : (
        <div
          id="ambiente-image-edit-hud"
          role="toolbar"
          aria-label="Editar foto"
          className={cn(
            'ambiente-lousa-hud relative flex h-full w-[11.5rem] min-h-0 flex-col overflow-hidden rounded-2xl',
            'shadow-[0_12px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(242,216,146,0.16)]',
            'backdrop-blur-md',
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <HudShaderFoil />

          <div className="ambiente-lousa-hud__header relative flex shrink-0 items-center justify-between gap-0.5 px-1.5 py-1">
            <p className="ambiente-lousa-hud__title font-display text-[11px] leading-none tracking-[0.22em]">
              Foto
            </p>
            <button
              type="button"
              aria-expanded
              aria-controls="ambiente-image-edit-hud"
              aria-label="Minimizar ferramentas da foto"
              title="Minimizar"
              className="ambiente-lousa-hud__icon-btn flex h-6 w-6 items-center justify-center rounded-full"
              onClick={toggleMinimized}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 py-2 [scrollbar-width:thin]">
            <div className="flex w-full shrink-0 flex-col gap-1.5">
              <span className="ambiente-lousa-hud__label text-[9px] font-semibold uppercase tracking-[0.16em]">
                Giro no plano
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={hudBtn}
                  disabled={disabled}
                  title="Girar 90° no plano, à esquerda"
                  aria-label="Girar 90 graus à esquerda"
                  onClick={() => onRotate(-90)}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Arraste para girar no plano da lousa"
                  aria-label="Girar a foto em tempo real"
                  disabled={disabled}
                  className={cn(
                    'ambiente-lousa-hud__primary relative flex h-10 min-h-10 flex-1 items-center justify-center gap-1 rounded-xl',
                    'cursor-grab active:cursor-grabbing',
                    'disabled:opacity-40',
                  )}
                  onPointerDown={onRotatePointerDown}
                >
                  <RotateCw className="h-3.5 w-3.5 opacity-80" />
                  <span className="font-mono text-sm font-bold tabular-nums">{deg}°</span>
                </button>
                <button
                  type="button"
                  className={hudBtn}
                  disabled={disabled}
                  title="Girar 90° no plano, à direita"
                  aria-label="Girar 90 graus à direita"
                  onClick={() => onRotate(90)}
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={nudgeBtn}
                  disabled={disabled}
                  title="Girar 15° à esquerda"
                  aria-label="Girar 15 graus à esquerda"
                  onClick={() => onRotate(-15)}
                >
                  −15
                </button>
                <button
                  type="button"
                  className={nudgeBtn}
                  disabled={disabled}
                  title="Girar 1° à esquerda"
                  aria-label="Girar 1 grau à esquerda"
                  onClick={() => onRotate(-1)}
                >
                  −1
                </button>
                <button
                  type="button"
                  className={nudgeBtn}
                  disabled={disabled}
                  title="Girar 1° à direita"
                  aria-label="Girar 1 grau à direita"
                  onClick={() => onRotate(1)}
                >
                  +1
                </button>
                <button
                  type="button"
                  className={nudgeBtn}
                  disabled={disabled}
                  title="Girar 15° à direita"
                  aria-label="Girar 15 graus à direita"
                  onClick={() => onRotate(15)}
                >
                  +15
                </button>
              </div>

              <Slider
                min={0}
                max={359}
                step={1}
                value={[deg]}
                disabled={disabled}
                onValueChange={([value]) => onRotationChange(value ?? deg)}
                aria-label="Giro da foto no plano"
                className={cn('w-full py-1.5', sliderClass)}
              />
            </div>

            <div className="grid shrink-0 grid-cols-4 gap-1">
              <button
                type="button"
                className={cn(hudBtn, flipH && 'ambiente-lousa-hud__icon-btn--active')}
                disabled={disabled}
                title="Espelhar esquerda e direita"
                aria-label="Espelhar horizontalmente"
                onClick={onFlipH}
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={cn(hudBtn, flipV && 'ambiente-lousa-hud__icon-btn--active')}
                disabled={disabled}
                title="Espelhar cima e baixo"
                aria-label="Espelhar verticalmente"
                onClick={onFlipV}
              >
                <FlipVertical2 className="h-3.5 w-3.5" />
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
                  <Crop className="h-3.5 w-3.5" />
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
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {onRemove ? (
              <button
                type="button"
                className={cn(hudBtn, 'ambiente-lousa-hud__btn--danger w-full')}
                disabled={disabled}
                title="Excluir só esta foto — os desenhos ficam"
                aria-label="Excluir esta foto"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {canOrbit ? (
              <div className="ambiente-lousa-hud__orbit mt-0.5 flex w-full shrink-0 flex-col gap-1.5 pt-2">
                <p className="ambiente-lousa-hud__label flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em]">
                  <Move3d className="h-3 w-3" aria-hidden />
                  Eixos 3D
                </p>
                <div className="grid w-full grid-cols-2 gap-1">
                  {YAW_PRESETS.map((preset) => {
                    const active = yawDeg === preset.yaw;
                    return (
                      <button
                        key={preset.yaw}
                        type="button"
                        disabled={disabled}
                        title={preset.hint}
                        aria-label={preset.hint}
                        aria-pressed={active}
                        className={cn(
                          'ambiente-lousa-hud__preset h-7 rounded-md text-[10px] font-semibold uppercase tracking-wide transition active:scale-95 disabled:opacity-40',
                          active && 'ambiente-lousa-hud__preset--active',
                        )}
                        onClick={() => onOrbitPreset?.(preset.yaw, pitchDeg)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid w-full grid-cols-4 gap-1">
                  {PITCH_PRESETS.map((preset) => {
                    const active = pitchDeg === preset.pitch;
                    return (
                      <button
                        key={preset.pitch}
                        type="button"
                        disabled={disabled}
                        title={preset.hint}
                        aria-label={preset.hint}
                        aria-pressed={active}
                        className={cn(
                          'ambiente-lousa-hud__preset h-7 rounded-md text-[10px] font-semibold uppercase tracking-wide transition active:scale-95 disabled:opacity-40',
                          active && 'ambiente-lousa-hud__preset--active',
                        )}
                        onClick={() => onOrbitPreset?.(yawDeg, preset.pitch)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  title="Arraste: esquerda/direita vira o lado, cima/baixo inclina"
                  aria-label="Virar a foto em todas as direções"
                  disabled={disabled}
                  className={cn(
                    'ambiente-lousa-hud__primary relative flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl',
                    'cursor-grab active:cursor-grabbing',
                    'disabled:opacity-40',
                  )}
                  onPointerDown={onOrbitPointerDown}
                >
                  <Move3d className="h-4 w-4 opacity-80" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="font-mono text-xs font-bold tabular-nums">Lado {yawDeg}°</span>
                    <span className="ambiente-lousa-hud__gold font-mono text-[10px] font-bold tabular-nums opacity-90">
                      Inclina {pitchDeg}°
                    </span>
                  </span>
                </button>

                <div className="flex w-full items-center justify-center gap-1">
                  <button
                    type="button"
                    className={hudBtn}
                    disabled={disabled}
                    title="Virar 15° para a esquerda (transversal)"
                    aria-label="Virar 15 graus no transversal à esquerda"
                    onClick={() => onYaw?.(-15)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={nudgeBtn}
                    disabled={disabled}
                    title="Virar 1° à esquerda"
                    aria-label="Virar 1 grau no transversal à esquerda"
                    onClick={() => onYaw?.(-1)}
                  >
                    −1
                  </button>
                  <button
                    type="button"
                    className={nudgeBtn}
                    disabled={disabled}
                    title="Virar 1° à direita"
                    aria-label="Virar 1 grau no transversal à direita"
                    onClick={() => onYaw?.(1)}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className={hudBtn}
                    disabled={disabled}
                    title="Virar 15° para a direita (transversal)"
                    aria-label="Virar 15 graus no transversal à direita"
                    onClick={() => onYaw?.(15)}
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex w-full items-center justify-center gap-1">
                  <button
                    type="button"
                    className={hudBtn}
                    disabled={disabled}
                    title="Inclinar para ver de cima"
                    aria-label="Inclinar para cima"
                    onClick={() => onPitch?.(15)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={nudgeBtn}
                    disabled={disabled}
                    title="Inclinar 1° para cima"
                    aria-label="Inclinar 1 grau para cima"
                    onClick={() => onPitch?.(1)}
                  >
                    ↑1
                  </button>
                  <button
                    type="button"
                    className={nudgeBtn}
                    disabled={disabled}
                    title="Inclinar 1° para baixo"
                    aria-label="Inclinar 1 grau para baixo"
                    onClick={() => onPitch?.(-1)}
                  >
                    ↓1
                  </button>
                  <button
                    type="button"
                    className={hudBtn}
                    disabled={disabled}
                    title="Inclinar para ver de baixo"
                    aria-label="Inclinar para baixo"
                    onClick={() => onPitch?.(-15)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <label className="flex w-full flex-col gap-1">
                  <span className="ambiente-lousa-hud__label text-[9px] font-semibold uppercase tracking-[0.14em]">
                    Lado · {yawDeg}°
                  </span>
                  <Slider
                    min={0}
                    max={359}
                    step={1}
                    value={[yawDeg]}
                    disabled={disabled}
                    onValueChange={([value]) => onYawChange?.(value ?? yawDeg)}
                    aria-label="Virar no transversal"
                    className={cn('w-full py-1', sliderClass)}
                  />
                </label>
                <label className="flex w-full flex-col gap-1">
                  <span className="ambiente-lousa-hud__label text-[9px] font-semibold uppercase tracking-[0.14em]">
                    Inclina · {pitchDeg}°
                  </span>
                  <Slider
                    min={0}
                    max={359}
                    step={1}
                    value={[pitchDeg]}
                    disabled={disabled}
                    onValueChange={([value]) => onPitchChange?.(value ?? pitchDeg)}
                    aria-label="Inclinar a foto"
                    className={cn('w-full py-1', sliderClass)}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

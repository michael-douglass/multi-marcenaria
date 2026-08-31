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
 * Controle de distância na cena — mais longe / mais perto.
 */
export function AmbienteZoomHud({
  scale,
  disabled = false,
  onScaleChange,
  onZoomIn,
  onZoomOut,
}: AmbienteZoomHudProps) {
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
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 50%, rgba(242,216,146,0.16), transparent 70%)',
          }}
          aria-hidden
        />
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

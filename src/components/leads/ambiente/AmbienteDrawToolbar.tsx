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
  { id: 'select', label: 'Selecionar', hint: 'Mover, girar e apagar o que já está na cena — V', icon: MousePointer2 },
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
  return (
    <div
      data-ambiente-draw-toolbar="true"
      className="relative overflow-hidden rounded-xl border border-gold/30 bg-[#1a100c]/90 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 120% at 50% 50%, rgba(242,216,146,0.14), transparent 68%)',
        }}
        aria-hidden
      />
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

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LeadAIRenderCaracteristicas } from '@/lib/lead-ai-render-caracteristicas';
import {
  Brain,
  ImageIcon,
  Layers,
  Palette,
  ScanEye,
  Sparkles,
  Wand2,
} from 'lucide-react';

const BASE_PHASES = [
  { icon: ScanEye, label: 'Lendo o esboço e mapeando cada módulo…' },
  { icon: Brain, label: 'Inventariando proporções em YAML técnico…' },
  { icon: Wand2, label: 'Aplicando texturas e iluminação de estúdio…' },
  { icon: ImageIcon, label: 'Refinando acabamentos fotorrealistas…' },
  { icon: Sparkles, label: 'Finalizando a imagem do projeto…' },
] as const;

const EXTRAS_PHASES = [
  { icon: Palette, label: 'Incorporando a cor escolhida ao acabamento…' },
  { icon: Layers, label: 'Ajustando material e detalhes solicitados…' },
] as const;

interface LeadAIRenderThinkingStateProps {
  variant?: 'embedded' | 'dialog';
  className?: string;
  sketchLabel?: string;
  caracteristicas?: LeadAIRenderCaracteristicas | null;
}

function CharacteristicPill({
  label,
  value,
  delayMs,
}: {
  label: string;
  value: string;
  delayMs: number;
}) {
  return (
    <div
      className="ai-render-pill-enter flex items-center gap-2 rounded-full border border-gold/35 bg-mahogany-elevated/90 px-3 py-1.5 shadow-md shadow-black/20"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gold/90">{label}</span>
      <span className="max-w-[140px] truncate text-xs text-cream-secondary">{value}</span>
    </div>
  );
}

export function LeadAIRenderThinkingState({
  variant = 'embedded',
  className,
  sketchLabel,
  caracteristicas,
}: LeadAIRenderThinkingStateProps) {
  const phases = useMemo(
    () => (caracteristicas ? [...BASE_PHASES.slice(0, 2), ...EXTRAS_PHASES, ...BASE_PHASES.slice(2)] : [...BASE_PHASES]),
    [caracteristicas],
  );

  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = phases[phaseIndex % phases.length];
  const PhaseIcon = phase.icon;

  const pills = useMemo(() => {
    if (!caracteristicas) return [];
    const items: { label: string; value: string }[] = [];
    if (caracteristicas.cor?.trim()) items.push({ label: 'Cor', value: caracteristicas.cor.trim() });
    if (caracteristicas.material?.trim()) {
      items.push({ label: 'Material', value: caracteristicas.material.trim() });
    }
    if (caracteristicas.detalhes?.trim()) {
      items.push({ label: 'Detalhes', value: caracteristicas.detalhes.trim() });
    }
    return items;
  }, [caracteristicas]);

  useEffect(() => {
    setPhaseIndex(0);
  }, [caracteristicas, sketchLabel]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % phases.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [phases.length]);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden',
        variant === 'dialog' ? 'min-h-[380px] py-6' : 'min-h-[280px] py-10',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="A inteligência artificial está renderizando o projeto"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.88\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(242,216,146,0.12)_0%,_transparent_62%)]" />

      {/* Esboço → Render morph */}
      <div className="relative mb-5 flex w-full max-w-sm items-center justify-center gap-3 px-2">
        <div className="ai-render-sketch-card relative h-20 w-[38%] overflow-hidden rounded-lg border border-dashed border-cream-faint/30 bg-mahogany-base/80">
          <div className="absolute inset-2 space-y-1.5 opacity-50">
            <div className="h-1 w-3/4 rounded bg-cream-faint/40" />
            <div className="h-8 w-full rounded border border-cream-faint/25" />
            <div className="flex gap-1">
              <div className="h-4 flex-1 rounded bg-cream-faint/20" />
              <div className="h-4 flex-1 rounded bg-cream-faint/20" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-mahogany-panel/80 px-2 py-1">
            <p className="truncate text-[9px] uppercase tracking-wider text-cream-faint">Esboço</p>
          </div>
        </div>

        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-gold/15 ai-render-glow" />
          <Wand2 className="relative h-5 w-5 text-gold ai-render-wand" aria-hidden />
        </div>

        <div className="ai-render-output-card relative h-20 w-[38%] overflow-hidden rounded-lg border border-gold/40 bg-gradient-to-br from-gold/15 via-mahogany-elevated to-mahogany-base shadow-lg shadow-gold/10">
          <div className="absolute inset-2 space-y-1.5">
            <div className="h-1 w-3/4 rounded bg-gold/40 ai-render-shimmer" />
            <div className="h-8 w-full rounded border border-gold/30 bg-gold/10 ai-render-shimmer" />
            <div className="flex gap-1">
              <div className="h-4 flex-1 rounded bg-gold/20 ai-render-shimmer" />
              <div className="h-4 flex-1 rounded bg-gold/25 ai-render-shimmer" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gold/20 px-2 py-1 backdrop-blur-sm">
            <p className="text-[9px] font-medium uppercase tracking-wider text-gold">Render</p>
          </div>
          <div className="ai-render-scan-line absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>
      </div>

      {/* Orbit core */}
      <div className="relative mb-5 h-24 w-24 sm:h-28 sm:w-28">
        <div className="absolute inset-0 rounded-full bg-gold/10 blur-2xl ai-render-glow" />
        <svg className="absolute inset-0 h-full w-full text-gold/25" viewBox="0 0 128 128" aria-hidden>
          <circle
            cx="64"
            cy="64"
            r="52"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="4 6"
            className="ai-render-orbit"
          />
          <circle cx="64" cy="12" r="3" fill="currentColor" className="text-gold ai-render-node" />
          <circle cx="110" cy="44" r="2.5" fill="currentColor" className="text-gold-soft ai-render-node-d1" />
          <circle cx="98" cy="96" r="3" fill="currentColor" className="text-gold ai-render-node-d2" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-mahogany-panel/90 shadow-lg shadow-gold/15 ai-render-core">
            <PhaseIcon className="h-6 w-6 text-gold ai-render-icon" key={phaseIndex} />
          </div>
        </div>
        <Sparkles className="absolute -right-0.5 top-1 h-3.5 w-3.5 text-gold/80 ai-render-sparkle" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-3 px-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/90">
          {caracteristicas ? 'Renderização personalizada' : 'Renderização em andamento'}
        </p>
        {sketchLabel && (
          <p className="truncate text-xs text-cream-faint">
            Projeto: <span className="text-cream-muted">{sketchLabel}</span>
          </p>
        )}

        <div
          key={phaseIndex}
          className="flex items-center justify-center gap-2 text-sm text-cream-secondary animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both"
        >
          <span>{phase.label}</span>
        </div>

        <div className="mx-auto flex flex-wrap justify-center gap-1 pt-1">
          {phases.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i === phaseIndex % phases.length ? 'w-5 bg-gold' : 'w-1 bg-gold/25',
              )}
            />
          ))}
        </div>
      </div>

      {pills.length > 0 && (
        <div className="relative z-10 mt-6 w-full max-w-md space-y-2 px-2">
          <p className="text-center text-[10px] uppercase tracking-[0.16em] text-cream-faint">
            Suas características estão sendo aplicadas
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {pills.map((pill, i) => (
              <CharacteristicPill key={pill.label} label={pill.label} value={pill.value} delayMs={i * 180} />
            ))}
          </div>
        </div>
      )}

      <p className="relative z-10 mt-5 text-xs text-cream-muted">Isso pode levar até um minuto</p>

      <style>{`
        @keyframes ai-render-glow {
          0%, 100% { opacity: 0.35; transform: scale(0.94); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }
        @keyframes ai-render-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ai-render-core {
          0%, 100% { box-shadow: 0 0 0 0 rgba(242, 216, 146, 0.12); }
          50% { box-shadow: 0 0 28px 6px rgba(242, 216, 146, 0.28); }
        }
        @keyframes ai-render-wand {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          50% { transform: rotate(8deg) scale(1.08); }
        }
        @keyframes ai-render-shimmer {
          0% { opacity: 0.35; }
          50% { opacity: 0.85; }
          100% { opacity: 0.35; }
        }
        @keyframes ai-render-scan {
          0% { top: 8%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 92%; opacity: 0; }
        }
        @keyframes ai-render-pill-enter {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ai-render-sketch-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes ai-render-output-reveal {
          0%, 100% { filter: brightness(0.9); }
          50% { filter: brightness(1.15); }
        }
        @keyframes ai-render-node-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes ai-render-sparkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes ai-render-icon-pop {
          0% { opacity: 0.5; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        .ai-render-glow { animation: ai-render-glow 3s ease-in-out infinite; }
        .ai-render-orbit { transform-origin: 64px 64px; animation: ai-render-orbit 16s linear infinite; }
        .ai-render-core { animation: ai-render-core 2.2s ease-in-out infinite; }
        .ai-render-wand { animation: ai-render-wand 2.4s ease-in-out infinite; }
        .ai-render-shimmer { animation: ai-render-shimmer 2s ease-in-out infinite; }
        .ai-render-scan-line { animation: ai-render-scan 2.6s ease-in-out infinite; }
        .ai-render-sketch-card { animation: ai-render-sketch-pulse 2.8s ease-in-out infinite; }
        .ai-render-output-card { animation: ai-render-output-reveal 2.8s ease-in-out infinite; }
        .ai-render-node { animation: ai-render-node-pulse 2s ease-in-out infinite; }
        .ai-render-node-d1 { animation: ai-render-node-pulse 2s ease-in-out 0.5s infinite; }
        .ai-render-node-d2 { animation: ai-render-node-pulse 2s ease-in-out 1s infinite; }
        .ai-render-sparkle { animation: ai-render-sparkle 2.2s ease-in-out infinite; }
        .ai-render-icon { animation: ai-render-icon-pop 0.45s ease-out; }
        .ai-render-pill-enter { animation: ai-render-pill-enter 0.55s ease-out both; }
      `}</style>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Brain, ScanEye, Sparkles, TextQuote } from 'lucide-react';

const THINKING_PHASES = [
  { icon: ScanEye, label: 'Lendo pixels e texturas das imagens…' },
  { icon: Brain, label: 'Identificando ambientes, materiais e detalhes…' },
  { icon: Sparkles, label: 'Cruzando padrões visuais com o contexto do lead…' },
  { icon: TextQuote, label: 'Estruturando o relatório comercial…' },
  { icon: ScanEye, label: 'Agente de briefing relendo fotos e relatório…' },
  { icon: TextQuote, label: 'Montando perguntas alinhadas ao ambiente analisado…' },
  { icon: Sparkles, label: 'Refinando conclusões e recomendações…' },
] as const;

const SKELETON_LINES = [
  'w-[92%]',
  'w-full',
  'w-[78%]',
  'w-[88%]',
  'w-[65%]',
  'w-[84%]',
  'w-[72%]',
];

interface LeadAIAnalysisThinkingStateProps {
  variant?: 'embedded' | 'fullscreen';
  className?: string;
}

export function LeadAIAnalysisThinkingState({
  variant = 'embedded',
  className,
}: LeadAIAnalysisThinkingStateProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = THINKING_PHASES[phaseIndex];
  const PhaseIcon = phase.icon;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % THINKING_PHASES.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden',
        variant === 'fullscreen' ? 'min-h-[320px] py-10' : 'min-h-[240px] py-8',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="A inteligência artificial está analisando as imagens"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative mb-6 h-28 w-28 sm:h-32 sm:w-32">
        <div className="absolute inset-0 rounded-full bg-gold/10 blur-2xl ai-think-glow" />
        <svg
          className="absolute inset-0 h-full w-full text-gold/25"
          viewBox="0 0 128 128"
          aria-hidden
        >
          <circle cx="64" cy="64" r="52" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 6" className="ai-think-orbit-slow" />
          <circle cx="64" cy="12" r="3" fill="currentColor" className="text-gold ai-think-node" />
          <circle cx="110" cy="44" r="2.5" fill="currentColor" className="text-gold-soft ai-think-node-delay-1" />
          <circle cx="98" cy="96" r="3" fill="currentColor" className="text-gold ai-think-node-delay-2" />
          <circle cx="30" cy="88" r="2" fill="currentColor" className="text-gold-soft ai-think-node-delay-3" />
          <circle cx="18" cy="40" r="2.5" fill="currentColor" className="text-gold ai-think-node-delay-4" />
          <line x1="64" y1="64" x2="64" y2="12" stroke="currentColor" strokeWidth="0.5" className="ai-think-pulse-line" />
          <line x1="64" y1="64" x2="110" y2="44" stroke="currentColor" strokeWidth="0.5" className="ai-think-pulse-line-delay-1" />
          <line x1="64" y1="64" x2="98" y2="96" stroke="currentColor" strokeWidth="0.5" className="ai-think-pulse-line-delay-2" />
          <line x1="64" y1="64" x2="30" y2="88" stroke="currentColor" strokeWidth="0.5" className="ai-think-pulse-line-delay-3" />
          <line x1="64" y1="64" x2="18" y2="40" stroke="currentColor" strokeWidth="0.5" className="ai-think-pulse-line-delay-4" />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-mahogany-panel/90 shadow-lg shadow-gold/10 ai-think-core">
            <Brain className="h-7 w-7 text-gold ai-think-brain" />
          </div>
        </div>

        <Sparkles className="absolute -right-1 top-2 h-4 w-4 text-gold/80 ai-think-sparkle" />
        <Sparkles className="absolute bottom-1 -left-1 h-3 w-3 text-gold-soft/70 ai-think-sparkle-delay" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-3 px-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/90">
          Cognição em andamento
        </p>

        <div
          key={phaseIndex}
          className="flex items-center justify-center gap-2 text-sm text-cream-secondary animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both"
        >
          <PhaseIcon className="h-4 w-4 shrink-0 text-gold" aria-hidden />
          <span>{phase.label}</span>
        </div>

        <div className="mx-auto flex gap-1 pt-1">
          {THINKING_PHASES.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i === phaseIndex ? 'w-5 bg-gold' : 'w-1 bg-gold/25',
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-8 w-full max-w-md space-y-2.5 px-1">
        <p className="text-[10px] uppercase tracking-[0.16em] text-cream-faint text-center mb-3">
          Gerando relatório
        </p>
        {SKELETON_LINES.map((width, i) => (
          <div
            key={i}
            className={cn(
              'h-2.5 rounded-md bg-gradient-to-r from-mahogany-muted/60 via-gold/20 to-mahogany-muted/60 bg-[length:200%_100%] ai-think-shimmer',
              width,
              i % 3 === 0 && 'h-3',
            )}
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes ai-think-glow {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 0.85; transform: scale(1.08); }
        }
        @keyframes ai-think-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ai-think-core-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(242, 216, 146, 0.15); }
          50% { box-shadow: 0 0 24px 4px rgba(242, 216, 146, 0.25); }
        }
        @keyframes ai-think-node-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        @keyframes ai-think-line-pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.55; }
        }
        @keyframes ai-think-brain-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes ai-think-sparkle-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes ai-think-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes ai-think-scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes ai-think-bracket-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .ai-think-glow { animation: ai-think-glow 3s ease-in-out infinite; }
        .ai-think-orbit-slow { transform-origin: 64px 64px; animation: ai-think-orbit 18s linear infinite; }
        .ai-think-core { animation: ai-think-core-pulse 2.4s ease-in-out infinite; }
        .ai-think-brain { animation: ai-think-brain-float 2.8s ease-in-out infinite; }
        .ai-think-node { animation: ai-think-node-pulse 2s ease-in-out infinite; }
        .ai-think-node-delay-1 { animation: ai-think-node-pulse 2s ease-in-out 0.4s infinite; }
        .ai-think-node-delay-2 { animation: ai-think-node-pulse 2s ease-in-out 0.8s infinite; }
        .ai-think-node-delay-3 { animation: ai-think-node-pulse 2s ease-in-out 1.2s infinite; }
        .ai-think-node-delay-4 { animation: ai-think-node-pulse 2s ease-in-out 1.6s infinite; }
        .ai-think-pulse-line { animation: ai-think-line-pulse 2s ease-in-out infinite; }
        .ai-think-pulse-line-delay-1 { animation: ai-think-line-pulse 2s ease-in-out 0.4s infinite; }
        .ai-think-pulse-line-delay-2 { animation: ai-think-line-pulse 2s ease-in-out 0.8s infinite; }
        .ai-think-pulse-line-delay-3 { animation: ai-think-line-pulse 2s ease-in-out 1.2s infinite; }
        .ai-think-pulse-line-delay-4 { animation: ai-think-line-pulse 2s ease-in-out 1.6s infinite; }
        .ai-think-sparkle { animation: ai-think-sparkle-twinkle 2.2s ease-in-out infinite; }
        .ai-think-sparkle-delay { animation: ai-think-sparkle-twinkle 2.2s ease-in-out 1.1s infinite; }
        .ai-think-shimmer { animation: ai-think-shimmer 1.8s ease-in-out infinite; }
        .ai-think-scan-line { animation: ai-think-scan 2.8s ease-in-out infinite; }
        .ai-think-bracket { animation: ai-think-bracket-pulse 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/** Overlay sobre a imagem enquanto a IA analisa */
export function LeadAIAnalysisImageThinkingOverlay({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 overflow-hidden bg-mahogany-base/55 backdrop-blur-[2px]',
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-3 border border-gold/20 rounded-lg ai-think-bracket" />
      <div className="absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-gold/70 ai-think-bracket" />
      <div className="absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-gold/70 ai-think-bracket" />
      <div className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-gold/70 ai-think-bracket" />
      <div className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-gold/70 ai-think-bracket" />

      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent ai-think-scan-line shadow-[0_0_12px_rgba(242,216,146,0.6)]" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-gold/35 bg-mahogany-panel/90 px-4 py-2 shadow-lg shadow-black/30 backdrop-blur-md">
          <ScanEye className="h-4 w-4 text-gold animate-pulse" />
          <span className="text-xs font-medium text-gold">IA observando referências</span>
        </div>
      </div>
    </div>
  );
}

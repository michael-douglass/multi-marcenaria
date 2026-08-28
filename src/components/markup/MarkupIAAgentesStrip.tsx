import {
  Bot,
  ClipboardCheck,
  PackageSearch,
  RefreshCw,
  Ruler,
  Scale,
} from 'lucide-react';
import type { MarkupIAAgenteAtivoId } from '@/lib/markup-ia-prompts';
import { MARKUP_IA_AGENTES_META } from '@/lib/markup-ia-prompts';
import { cn } from '@/lib/utils';

const AGENT_ICONS: Record<string, typeof Bot> = {
  projetista: Ruler,
  inventariante: PackageSearch,
  inventariante_retry: RefreshCw,
  auditor: Scale,
  auditor_projetista: ClipboardCheck,
  precificador: Bot,
  precificador_retry: RefreshCw,
};

interface MarkupIAAgentesStripProps {
  agenteAtivo?: MarkupIAAgenteAtivoId;
  className?: string;
  compact?: boolean;
}

export function MarkupIAAgentesStrip({
  agenteAtivo,
  className,
  compact = false,
}: MarkupIAAgentesStripProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-amber-500/20',
        compact
          ? 'bg-slate-950/60 px-2 py-2 backdrop-blur-md'
          : 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-3 py-2.5',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(251,191,36,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.5) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative flex items-center gap-1 overflow-x-auto scrollbar-none">
        {MARKUP_IA_AGENTES_META.map((agent, index) => {
          const Icon = AGENT_ICONS[agent.id] ?? ClipboardCheck;
          const isActive = agenteAtivo === agent.id;
          const isPast =
            agenteAtivo != null &&
            MARKUP_IA_AGENTES_META.findIndex((a) => a.id === agenteAtivo) > index;
          return (
            <div key={agent.id} className="flex shrink-0 items-center">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all duration-300',
                  compact ? 'text-[10px]' : 'text-xs',
                  isActive &&
                    'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]',
                  isPast && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                  !isActive && !isPast && 'border-slate-700/80 bg-slate-800/50 text-slate-400 opacity-70',
                )}
              >
                <Icon className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
                <span className="whitespace-nowrap font-medium">{agent.titulo}</span>
                {!compact && (
                  <span className="hidden text-[10px] text-slate-500 sm:inline">F{agent.fase}</span>
                )}
              </div>
              {index < MARKUP_IA_AGENTES_META.length - 1 && (
                <div
                  className={cn(
                    'mx-0.5 h-px w-2 shrink-0 sm:w-3',
                    isPast ? 'bg-emerald-500/40' : 'bg-slate-700/60',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

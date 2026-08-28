import { Button } from '@/components/ui/button';
import type { LeadAIRender } from '@/hooks/useLeadAIRenders';
import {
  getNextVersionInChain,
  getPreviousVersionInChain,
  getVersionIndexInChain,
} from '@/lib/lead-ai-render-version-chain';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LeadAIRenderVersionNavigatorProps {
  chain: LeadAIRender[];
  currentId: string;
  onSelect: (render: LeadAIRender) => void;
  className?: string;
  /** Rótulo do botão “próxima versão” (mais recente). */
  nextLabel?: string;
  /** Rótulo do botão “versão anterior”. */
  previousLabel?: string;
  compact?: boolean;
}

export function LeadAIRenderVersionNavigator({
  chain,
  currentId,
  onSelect,
  className,
  nextLabel = 'Versão seguinte',
  previousLabel = 'Versão anterior',
  compact = false,
}: LeadAIRenderVersionNavigatorProps) {
  if (chain.length <= 1) return null;

  const index = getVersionIndexInChain(chain, currentId);
  const previous = getPreviousVersionInChain(chain, currentId);
  const next = getNextVersionInChain(chain, currentId);
  const position = index >= 0 ? index + 1 : 1;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-gold-border-subtle/25 bg-mahogany-base/50 p-2',
        className,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream-muted">
        Versão {position} de {chain.length}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!previous}
          onClick={() => previous && onSelect(previous)}
          className={cn(
            'h-8 border-gold-border-subtle/30 bg-mahogany-elevated/50 text-xs text-cream-secondary hover:border-gold/40 hover:text-gold',
            compact && 'px-2',
          )}
        >
          <ChevronLeft className={cn('h-3.5 w-3.5', !compact && 'mr-1')} />
          {!compact && previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!next}
          onClick={() => next && onSelect(next)}
          className={cn(
            'h-8 border-gold-border-subtle/30 bg-mahogany-elevated/50 text-xs text-cream-secondary hover:border-gold/40 hover:text-gold',
            compact && 'px-2',
          )}
        >
          {!compact && nextLabel}
          <ChevronRight className={cn('h-3.5 w-3.5', !compact && 'ml-1')} />
        </Button>
      </div>
    </div>
  );
}

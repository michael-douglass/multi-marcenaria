import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FloatingLeadAIBackgroundIconProps {
  count: number;
  activeCount: number;
  onClick: () => void;
}

export function FloatingLeadAIBackgroundIcon({
  count,
  activeCount,
  onClick,
}: FloatingLeadAIBackgroundIconProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'relative h-11 w-11 rounded-full border-gold/50 bg-background shadow-lg',
        activeCount > 0 && 'animate-pulse ring-2 ring-gold/60',
      )}
      onClick={onClick}
      title="IA em segundo plano"
      aria-label={`${count} tarefa(s) de IA em segundo plano`}
    >
      <Zap className="h-5 w-5 text-gold" />
      {count > 0 && (
        <Badge
          variant="secondary"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center border border-gold/40 bg-gold/90 px-1 text-[10px] text-mahogany-base"
        >
          {count > 9 ? '9+' : count}
        </Badge>
      )}
    </Button>
  );
}

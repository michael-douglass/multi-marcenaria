import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FloatingLeadSinalizacoesIconProps {
  count: number;
  onClick: () => void;
  /** Pulso extra quando o preview temporário está visível */
  isPulsing?: boolean;
}

export function FloatingLeadSinalizacoesIcon({
  count,
  onClick,
  isPulsing = false,
}: FloatingLeadSinalizacoesIconProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'h-11 w-11 rounded-full shadow-lg border-amber-500/50 bg-background relative',
        (count > 0 || isPulsing) && 'animate-pulse ring-2 ring-amber-500/60',
        isPulsing && 'scale-110 transition-transform',
      )}
      onClick={onClick}
      title="Leads sinalizados"
      aria-label={`${count} lead(s) sinalizado(s)`}
    >
      <Flag className="h-5 w-5 text-amber-600" />
      {count > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
        >
          {count > 9 ? '9+' : count}
        </Badge>
      )}
    </Button>
  );
}

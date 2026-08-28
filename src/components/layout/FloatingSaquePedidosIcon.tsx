import { Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingSaquePedidosIconProps {
  count: number;
  onClick: () => void;
}

export function FloatingSaquePedidosIcon({ count, onClick }: FloatingSaquePedidosIconProps) {
  const hasPending = count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative z-50',
        'p-3 rounded-full shadow-lg',
        hasPending ? 'bg-green-600 hover:bg-green-700' : 'bg-muted hover:bg-muted/80',
        'transition-all duration-200 hover:scale-105',
        'animate-in fade-in zoom-in duration-300',
      )}
      title={
        hasPending
          ? `${count} saque${count > 1 ? 's' : ''} aguardando pagamento PIX`
          : 'Saques de prestadores'
      }
      aria-label={`Saques pendentes: ${count}`}
    >
      <Banknote className={cn('h-6 w-6', hasPending ? 'text-white' : 'text-muted-foreground')} />

      {hasPending && (
        <span
          className={cn(
            'absolute -top-1 -right-1',
            'min-w-5 h-5 px-1.5',
            'flex items-center justify-center',
            'bg-amber-500 text-amber-950',
            'text-xs font-bold rounded-full',
            'animate-pulse',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

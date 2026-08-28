import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SaquePedidosHeaderButtonProps {
  count: number;
  isActive: boolean;
  onClick: () => void;
}

export function SaquePedidosHeaderButton({
  count,
  isActive,
  onClick,
}: SaquePedidosHeaderButtonProps) {
  const hasPending = count > 0;

  if (!hasPending) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        'relative h-9 w-9 transition-colors',
        isActive ? 'bg-green-500/20' : 'hover:bg-green-500/10',
      )}
      style={{ color: hasPending ? '#4ade80' : 'rgba(240,210,140,0.45)' }}
      title={
        hasPending
          ? `${count} saque${count > 1 ? 's' : ''} aguardando pagamento`
          : 'Saques de prestadores'
      }
      aria-label={`Saques pendentes: ${count}`}
    >
      <Banknote className="h-4 w-4" />
      <span
        className={cn(
          'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
          'flex items-center justify-center rounded-full text-[10px] font-bold',
          'bg-amber-500 text-amber-950 border border-amber-400/80',
          hasPending && 'animate-pulse',
        )}
      >
        {count > 99 ? '99+' : count}
      </span>
    </Button>
  );
}

import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  count: number;
  onClick: () => void;
}

export function FloatingLeadLembretesIcon({ count, onClick }: Props) {
  const has = count > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative z-50 p-3 rounded-full shadow-lg',
        has ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/90',
        'transition-all duration-200 hover:scale-105',
        'animate-in fade-in zoom-in duration-300',
      )}
      title={has ? `${count} lembrete${count > 1 ? 's' : ''} de lead` : 'Lembretes de leads'}
    >
      <Bell className="h-6 w-6 text-white" />
      {has && (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-5 h-5 px-1.5',
            'flex items-center justify-center',
            'bg-white text-amber-600 text-xs font-bold rounded-full',
            'animate-pulse border-2 border-amber-500',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

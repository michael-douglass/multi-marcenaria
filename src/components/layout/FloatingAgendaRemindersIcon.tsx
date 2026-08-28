import { BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingAgendaRemindersIconProps {
  count: number;
  onClick: () => void;
}

export function FloatingAgendaRemindersIcon({ count, onClick }: FloatingAgendaRemindersIconProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative z-50 shrink-0 p-3 rounded-full shadow-lg',
        'bg-amber-500 hover:bg-amber-600',
        'transition-all duration-200 hover:scale-105',
        'animate-in fade-in zoom-in duration-300',
      )}
      title={`${count} lembrete${count > 1 ? 's' : ''} agora — clique para abrir`}
      aria-label={`${count} lembretes agora. Clique para expandir.`}
    >
      <BellRing className="h-6 w-6 text-white" />
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
    </button>
  );
}

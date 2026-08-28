import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingCalendarIconProps {
  count: number;
  onClick: () => void;
  isActive?: boolean;
}

export function FloatingCalendarIcon({ count, onClick, isActive = false }: FloatingCalendarIconProps) {
  const hasOpenTasks = count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative',
        'p-3 rounded-full shadow-lg',
        isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105',
        hasOpenTasks ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90',
        'transition-all duration-200 hover:scale-105',
        'animate-in fade-in zoom-in duration-300',
      )}
      title={
        isActive
          ? 'Fechar Agenda Geral'
          : hasOpenTasks
            ? `${count} ${count > 1 ? 'tarefas' : 'tarefa'} pendente${count > 1 ? 's' : ''} hoje`
            : 'Abrir Agenda Geral'
      }
      aria-label={isActive ? 'Fechar Agenda Geral' : 'Abrir Agenda Geral'}
      aria-pressed={isActive}
    >
      <Calendar className="h-6 w-6 text-white" />
      
      {/* Badge com contador - só mostra se tiver tarefas */}
      {hasOpenTasks && (
        <span
          className={cn(
            "absolute -top-1 -right-1",
            "min-w-5 h-5 px-1.5",
            "flex items-center justify-center",
            "bg-white text-destructive",
            "text-xs font-bold rounded-full",
            "animate-pulse border-2 border-destructive"
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

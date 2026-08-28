import { ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingAgendaPessoalIconProps {
  count: number;
  onClick: () => void;
}

export function FloatingAgendaPessoalIcon({ count, onClick }: FloatingAgendaPessoalIconProps) {
  const hasOpenTasks = count > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative z-50",
        "p-3 rounded-full shadow-lg",
        hasOpenTasks ? "bg-violet-500 hover:bg-violet-600" : "bg-violet-400 hover:bg-violet-500",
        "transition-all duration-200 hover:scale-105",
        "animate-in fade-in zoom-in duration-300"
      )}
      title={hasOpenTasks ? `${count} ${count > 1 ? 'tarefas pessoais' : 'tarefa pessoal'} pendente${count > 1 ? 's' : ''}` : 'Agenda Pessoal'}
    >
      <ClipboardList className="h-6 w-6 text-white" />
      
      {hasOpenTasks && (
        <span
          className={cn(
            "absolute -top-1 -right-1",
            "min-w-5 h-5 px-1.5",
            "flex items-center justify-center",
            "bg-white text-violet-600",
            "text-xs font-bold rounded-full",
            "animate-pulse border-2 border-violet-500"
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

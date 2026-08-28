import { Calendar, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingMarketingCalendarIconProps {
  count: number;
  onClick: () => void;
}

export function FloatingMarketingCalendarIcon({ count, onClick }: FloatingMarketingCalendarIconProps) {
  const hasPendingTasks = count > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative z-50",
        "p-3 rounded-full shadow-lg",
        hasPendingTasks ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-500 hover:bg-emerald-600",
        "transition-all duration-200 hover:scale-105",
        "animate-in fade-in zoom-in duration-300"
      )}
      title={hasPendingTasks ? `${count} tarefa${count > 1 ? 's' : ''} de postagem pendente${count > 1 ? 's' : ''}` : 'Calendário de Postagens'}
    >
      <div className="relative">
        <Calendar className="h-6 w-6 text-white" />
        <Megaphone className="h-3 w-3 text-white absolute -bottom-0.5 -right-0.5" />
      </div>
      
      {/* Badge com contador */}
      {hasPendingTasks && (
        <span
          className={cn(
            "absolute -top-1 -right-1",
            "min-w-5 h-5 px-1.5",
            "flex items-center justify-center",
            "bg-white text-emerald-600",
            "text-xs font-bold rounded-full",
            "animate-pulse border-2 border-emerald-600"
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

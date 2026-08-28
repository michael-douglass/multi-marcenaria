import { Calendar, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketingCalendarIconProps {
  count: number;
  onClick: () => void;
}

export function MarketingCalendarIcon({ count, onClick }: MarketingCalendarIconProps) {
  const hasPendingTasks = count > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-2 rounded-lg transition-all duration-200",
        hasPendingTasks 
          ? "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50" 
          : "hover:bg-muted"
      )}
      title={hasPendingTasks ? `${count} tarefa${count > 1 ? 's' : ''} de marketing pendente${count > 1 ? 's' : ''}` : 'Calendário de Marketing'}
    >
      <div className="relative">
        <Calendar className={cn(
          "h-5 w-5",
          hasPendingTasks ? "text-emerald-600" : "text-muted-foreground"
        )} />
        <Megaphone className={cn(
          "h-3 w-3 absolute -bottom-1 -right-1",
          hasPendingTasks ? "text-emerald-600" : "text-muted-foreground"
        )} />
      </div>
      
      {/* Badge com contador */}
      {hasPendingTasks && (
        <span
          className={cn(
            "absolute -top-1 -right-1",
            "min-w-4 h-4 px-1",
            "flex items-center justify-center",
            "bg-emerald-600 text-white",
            "text-xs font-bold rounded-full"
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

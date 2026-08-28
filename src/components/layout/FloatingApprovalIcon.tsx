import { FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingApprovalIconProps {
  count: number;
  onClick: () => void;
}

export function FloatingApprovalIcon({ count, onClick }: FloatingApprovalIconProps) {
  const hasNotifications = count > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative z-50",
        "p-3 rounded-full shadow-lg",
        hasNotifications ? "bg-amber-500 hover:bg-amber-600" : "bg-muted hover:bg-muted/80",
        "transition-all duration-200 hover:scale-105",
        "animate-in fade-in zoom-in duration-300"
      )}
      title={hasNotifications ? `${count} conteúdo${count > 1 ? 's' : ''} para aprovar` : 'Aprovações de conteúdo'}
    >
      <FileCheck className={cn("h-6 w-6", hasNotifications ? "text-white" : "text-muted-foreground")} />
      
      {/* Badge com contador */}
      {hasNotifications && (
        <span
          className={cn(
            "absolute -top-1 -right-1",
            "min-w-5 h-5 px-1.5",
            "flex items-center justify-center",
            "bg-destructive text-destructive-foreground",
            "text-xs font-bold rounded-full",
            "animate-pulse"
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

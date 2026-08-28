import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppNotificationIconProps {
  count: number;
  onClick: () => void;
}

export function WhatsAppNotificationIcon({ count, onClick }: WhatsAppNotificationIconProps) {
  // Se não há notificações, não mostra o ícone
  if (count === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative z-50",
        "p-2 rounded-full shadow-md backdrop-blur-sm",
        "bg-green-500/75 hover:bg-green-500/90 border border-white/20",
        "transition-all duration-200 hover:scale-105",
        "animate-in fade-in zoom-in duration-300"
      )}
      title={`${count} ${count > 1 ? 'novas mensagens' : 'nova mensagem'}`}
    >
      <MessageCircle className="h-5 w-5 text-white" />
      
      {/* Badge com contador */}
      <span
        className={cn(
          "absolute -top-1 -right-1",
          "min-w-4.5 h-4.5 px-1",
          "flex items-center justify-center",
          "bg-destructive text-destructive-foreground",
          "text-[10px] font-bold rounded-full",
          "animate-pulse"
        )}
      >
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}
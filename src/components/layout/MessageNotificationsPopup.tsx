import { useEffect, useRef } from 'react';
import { X, MessageCircle, MapPin, Target, Clock, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { floatingIconsPositionClass } from '@/lib/floating-ui-layout';
import { MessageNotification } from '@/hooks/useMessageNotifications';

interface MessageNotificationsPopupProps {
  notifications: MessageNotification[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onLeadClick?: (leadId: number) => void;
  onPhoneClick?: (telefone: string) => void;
}

export function MessageNotificationsPopup({ 
  notifications,
  isOpen,
  onClose,
  onClear,
  onRemove,
  onLeadClick,
  onPhoneClick
}: MessageNotificationsPopupProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o topo quando nova notificação chegar
  useEffect(() => {
    if (scrollRef.current && notifications.length > 0 && isOpen) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = 0;
      }
    }
  }, [notifications.length, isOpen]);

  const handleNotificationClick = (notification: MessageNotification) => {
    // Se tem lead, abre o modal do lead
    if (notification.leadId && onLeadClick) {
      onLeadClick(notification.leadId);
      onRemove(notification.id);
    } 
    // Se não tem lead mas tem telefone, busca pelo telefone
    else if (notification.telefone && onPhoneClick) {
      onPhoneClick(notification.telefone);
      onRemove(notification.id);
    }
  };

  // Remover notificação individual (parar propagação para não clicar no card)
  const handleRemoveClick = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    onRemove(notificationId);
  };

  // Formatar telefone para exibição
  const formatPhone = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  // Se popup não está aberto, não renderiza nada (o ícone flutuante fica no MainLayout)
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className={cn(
        floatingIconsPositionClass,
        "w-[340px] h-[420px]",
        "bg-background/80 backdrop-blur-md border border-border/70 rounded-xl shadow-xl",
        "flex flex-col",
        "animate-in slide-in-from-right-5 fade-in duration-300"
      )}
    >
      {/* Header - altura fixa */}
      <div className="flex items-center justify-between p-2.5 border-b bg-primary/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-green-500/80 rounded-full">
            <MessageCircle className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-xs">Mensagens WhatsApp</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {notifications.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          title="Minimizar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Notifications List - área scrollável */}
      {notifications.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden min-h-0">
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="p-1.5 space-y-1.5">
              {notifications.map((notification) => {
                const hasLead = !!notification.leadId;
                const displayName = hasLead 
                  ? notification.leadName 
                  : formatPhone(notification.telefone);
                
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "p-2.5 rounded-lg border border-border/70 cursor-pointer transition-all relative group",
                      "hover:bg-accent hover:border-primary/30",
                      "bg-card/75 backdrop-blur-sm"
                    )}
                  >
                    {/* Botão X para remover notificação individual */}
                    <button
                      onClick={(e) => handleRemoveClick(e, notification.id)}
                      className={cn(
                        "absolute top-2 right-2 p-1 rounded-full",
                        "bg-muted/50 hover:bg-destructive hover:text-destructive-foreground",
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "z-10"
                      )}
                      title="Remover notificação"
                    >
                      <X className="h-3 w-3" />
                    </button>

                    {/* Nome/Telefone + Tempo */}
                    <div className="flex items-start justify-between gap-2 mb-1.5 pr-6">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {!hasLead && <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className={cn(
                          "font-medium text-sm truncate",
                          hasLead ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {displayName}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(notification.timestamp, { 
                          addSuffix: false, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>

                    {/* Região & Origem - sempre mostra se tiver dados válidos */}
                    {(notification.regiao !== 'N/A' || notification.origem !== 'N/A') && (
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {notification.origem && notification.origem !== 'N/A' && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-primary/10">
                            <Target className="h-3 w-3 mr-1" />
                            {notification.origem}
                          </Badge>
                        )}
                        {notification.regiao && notification.regiao !== 'N/A' && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                            <MapPin className="h-3 w-3 mr-1" />
                            {notification.regiao}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Message Preview */}
                    {notification.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        "{notification.content}"
                      </p>
                    )}

                    {/* Click hint */}
                    <p className="text-xs text-primary mt-2 font-medium">
                      {hasLead ? 'Ver conversa →' : 'Buscar contato →'}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Footer - altura fixa */}
      {notifications.length > 0 && (
        <div className="p-2 border-t bg-muted/30 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={onClear}
          >
            Limpar todas
          </Button>
        </div>
      )}
    </div>
  );
}
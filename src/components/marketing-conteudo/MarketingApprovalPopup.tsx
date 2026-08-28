import { useState } from 'react';
import { X, CheckCircle2, FileCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { floatingPopupMaxHeightStyle, floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import { MarketingApprovalNotification } from '@/hooks/useMarketingApprovalNotifications';
import { MarketingContentCard, MarketingColumn } from '@/hooks/useMarketingConteudo';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MarketingApprovalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: MarketingApprovalNotification[];
  cards: MarketingContentCard[];
  columns: MarketingColumn[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onViewCard: (cardId: string) => void;
  onApproveCard: (cardId: string) => void;
}

export function MarketingApprovalPopup({
  isOpen,
  onClose,
  notifications,
  cards,
  columns,
  onMarkAsRead,
  onClearAll,
  onViewCard,
  onApproveCard,
}: MarketingApprovalPopupProps) {
  const [viewMode, setViewMode] = useState<'notifications' | 'pending'>('notifications');

  // Encontrar coluna "Enviados para aprovação"
  const approvalColumn = columns.find(c => 
    c.nome.toLowerCase().includes('enviados para aprovação') || 
    c.nome.toLowerCase().includes('aprovação')
  );

  // Cards pendentes de aprovação
  const pendingCards = approvalColumn 
    ? cards.filter(c => c.column_id === approvalColumn.id)
    : [];

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        floatingPopupPositionClass,
        'w-[90vw] sm:w-[420px] max-w-[420px]',
        'bg-background border rounded-lg shadow-xl',
        'flex flex-col overflow-hidden',
        'animate-in fade-in slide-in-from-top-2 duration-200'
      )}
      style={floatingPopupMaxHeightStyle}
    >
      {/* Header */}
      <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileCheck className="h-5 w-5 text-primary shrink-0" />
          <h3 className="font-semibold text-sm sm:text-base truncate">Aprovações de Conteúdo</h3>
          {notifications.filter(n => !n.lida).length > 0 && (
            <Badge variant="destructive" className="text-xs shrink-0">
              {notifications.filter(n => !n.lida).length}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-3 sm:px-4 pt-3 pb-2 flex gap-2 shrink-0">
        <Button
          variant={viewMode === 'notifications' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('notifications')}
          className="flex-1 text-xs sm:text-sm"
        >
          Notificações ({notifications.length})
        </Button>
        <Button
          variant={viewMode === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('pending')}
          className="flex-1 text-xs sm:text-sm"
        >
          Pendentes ({pendingCards.length})
        </Button>
      </div>

      {/* Content - usando div com overflow ao invés de ScrollArea */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-3">
        {viewMode === 'notifications' && (
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nenhuma notificação
              </p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    notif.lida 
                      ? 'bg-muted/30' 
                      : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                  )}
                  onClick={() => {
                    onMarkAsRead(notif.id);
                    onViewCard(notif.card_id);
                    setViewMode('pending');
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{notif.card_titulo}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notif.enviado_por && `Por: ${notif.enviado_por} • `}
                        {formatDistanceToNow(new Date(notif.criado_em), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                    {!notif.lida && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {viewMode === 'pending' && (
          <div className="space-y-3">
            {pendingCards.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                Nenhum conteúdo pendente de aprovação
              </p>
            ) : (
              pendingCards.map((card) => (
                <div
                  key={card.id}
                  className="p-3 rounded-lg border bg-card hover:shadow-md transition-shadow"
                >
                  <h4 className="font-medium text-sm mb-2 whitespace-normal break-words">{card.titulo}</h4>
                  {card.script_copy && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground whitespace-normal break-words">
                        {card.script_copy}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs sm:text-sm"
                      onClick={() => onViewCard(card.id)}
                    >
                      <Eye className="h-3 w-3 mr-1 shrink-0" />
                      Ver Completo
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 text-xs sm:text-sm bg-green-600 hover:bg-green-700"
                      onClick={() => onApproveCard(card.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {viewMode === 'notifications' && notifications.length > 0 && (
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={onClearAll}
          >
            Limpar todas
          </Button>
        </div>
      )}
    </div>
  );
}

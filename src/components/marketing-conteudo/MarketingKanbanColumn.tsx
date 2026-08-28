import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MarketingKanbanCard } from './MarketingKanbanCard';
import { 
  MarketingColumn, 
  MarketingContentCard, 
  MarketingTrafficSource,
  MarketingFunnelStage,
  MarketingProduct,
} from '@/hooks/useMarketingConteudo';
import { MarketingBoardTemplate } from '@/hooks/useMarketingBoardTemplates';

interface MarketingKanbanColumnProps {
  column: MarketingColumn;
  cards: MarketingContentCard[];
  columns: MarketingColumn[];
  trafficSources: MarketingTrafficSource[];
  funnelStages: MarketingFunnelStage[];
  products: MarketingProduct[];
  centralTemplates: MarketingBoardTemplate[];
  onCardUpdate: (updates: Partial<MarketingContentCard> & { id: string }) => void;
  onCardClick: (card: MarketingContentCard) => void;
  onAddCard: (columnId: string) => void;
  onSendForApproval?: (cardId: string, cardTitulo: string) => void;
  onApprove?: (cardId: string) => void;
}

export function MarketingKanbanColumn({
  column,
  cards,
  columns,
  trafficSources,
  funnelStages,
  products,
  centralTemplates,
  onCardUpdate,
  onCardClick,
  onAddCard,
  onSendForApproval,
  onApprove,
}: MarketingKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  // Ordenar cards: performando/urgente no topo, depois por atualizado_em (mais recente primeiro)
  const sortedCards = [...cards].sort((a, b) => {
    // Primeiro: Performando no topo
    if (a.performando && !b.performando) return -1;
    if (!a.performando && b.performando) return 1;
    
    // Segundo: Urgente no topo
    if (a.urgente && !b.urgente) return -1;
    if (!a.urgente && b.urgente) return 1;
    
    // Terceiro: Mais recentemente atualizado primeiro
    const aDate = new Date(a.atualizado_em).getTime();
    const bDate = new Date(b.atualizado_em).getTime();
    return bDate - aDate;
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-muted/50 rounded-lg min-w-[300px] w-[300px] max-w-[300px] shrink-0 overflow-hidden',
        isOver && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{column.nome}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {cards.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onAddCard(column.id)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-280px)] w-full">
        <SortableContext items={sortedCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="p-2 space-y-2 w-[284px]">
            {sortedCards.map(card => (
              <MarketingKanbanCard
                key={card.id}
                card={card}
                trafficSources={trafficSources}
                funnelStages={funnelStages}
                products={products}
                centralTemplates={centralTemplates}
                columns={columns}
                onUpdate={onCardUpdate}
                onClick={() => onCardClick(card)}
                onSendForApproval={onSendForApproval}
                onApprove={onApprove}
              />
            ))}
            {cards.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum card nesta coluna
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

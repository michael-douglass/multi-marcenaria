import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MarketingKanbanColumn } from './MarketingKanbanColumn';
import { MarketingKanbanCard } from './MarketingKanbanCard';
import { MarketingCardEditModal } from './MarketingCardEditModal';
import {
  useMarketingColumns,
  useMarketingContentCards,
  useMarketingTrafficSources,
  useMarketingFunnelStages,
  useMarketingProducts,
  MarketingContentCard,
} from '@/hooks/useMarketingConteudo';
import { useMarketingBoardTemplates } from '@/hooks/useMarketingBoardTemplates';
import { useMarketingApprovalNotifications } from '@/hooks/useMarketingApprovalNotifications';
import { useMarketingCardsRealtime } from '@/hooks/useMarketingCardsRealtime';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

export function MarketingKanbanBoard() {
  const [searchParams] = useSearchParams();

  const { columns } = useMarketingColumns();
  const { cards, updateCard, createCard, deleteCard } = useMarketingContentCards();
  const { sources } = useMarketingTrafficSources();
  const { stages } = useMarketingFunnelStages();
  const { products } = useMarketingProducts();
  const { centralTemplates } = useMarketingBoardTemplates();
  const { createNotification } = useMarketingApprovalNotifications();
  const { toast } = useToast();
  const { currentUser } = useApp();

  // Ativar sincronização em tempo real dos cards
  useMarketingCardsRealtime();

  const [activeCard, setActiveCard] = useState<MarketingContentCard | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MarketingContentCard | null>(null);
  const [isNewCard, setIsNewCard] = useState(false);
  const [newCardColumnId, setNewCardColumnId] = useState<string>('');

  // Deep link: abrir card via URL (?card=...)
  useEffect(() => {
    const cardId = searchParams.get('card');
    if (!cardId) return;
    if (!cards || cards.length === 0) return;

    const found = cards.find((c) => c.id === cardId);
    if (!found) return;

    setSelectedCard(found);
    setIsNewCard(false);
    setEditModalOpen(true);

    const t = window.setTimeout(() => {
      const el = document.getElementById(`marketing-card-${cardId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 50);

    return () => window.clearTimeout(t);
  }, [cards, searchParams]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const cardsByColumn = useMemo(() => {
    const map: Record<string, MarketingContentCard[]> = {};
    columns.forEach(col => {
      map[col.id] = cards.filter(c => c.column_id === col.id);
    });
    return map;
  }, [cards, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    const cardId = event.active.id as string;
    const card = cards.find(c => c.id === cardId);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find(c => c.id === activeId);
    if (!activeCard) return;

    // Check if dropping over a column
    const overColumn = columns.find(c => c.id === overId);
    if (overColumn && activeCard.column_id !== overId) {
      updateCard({ id: activeId, column_id: overId });
    }

    // Check if dropping over another card
    const overCard = cards.find(c => c.id === overId);
    if (overCard && activeCard.column_id !== overCard.column_id) {
      updateCard({ id: activeId, column_id: overCard.column_id });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeCard = cards.find(c => c.id === activeId);
    const overCard = cards.find(c => c.id === overId);

    if (activeCard && overCard && activeCard.column_id === overCard.column_id) {
      const columnCards = cardsByColumn[activeCard.column_id];
      const oldIndex = columnCards.findIndex(c => c.id === activeId);
      const newIndex = columnCards.findIndex(c => c.id === overId);

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(columnCards, oldIndex, newIndex);
        newOrder.forEach((card, index) => {
          if (card.ordem !== index) {
            updateCard({ id: card.id, ordem: index });
          }
        });
      }
    }
  };

  const handleCardClick = (card: MarketingContentCard) => {
    setSelectedCard(card);
    setIsNewCard(false);
    setEditModalOpen(true);
  };

  const handleAddCard = (columnId: string) => {
    setSelectedCard(null);
    setIsNewCard(true);
    setNewCardColumnId(columnId);
    setEditModalOpen(true);
  };

  const handleSaveCard = async (updates: Partial<MarketingContentCard> & { id?: string }) => {
    if (updates.id) {
      updateCard(updates as Partial<MarketingContentCard> & { id: string });
    } else if (updates.titulo && updates.column_id) {
      const columnCards = cardsByColumn[updates.column_id] || [];
      const maxOrdem = columnCards.reduce((max, c) => Math.max(max, c.ordem), -1);
      await createCard({
        titulo: updates.titulo,
        script_copy: updates.script_copy,
        column_id: updates.column_id,
        traffic_sources: updates.traffic_sources,
        funnel_stage_id: updates.funnel_stage_id,
        product_id: updates.product_id,
        performando: updates.performando,
        urgente: updates.urgente,
        ordem: maxOrdem + 1,
        planning_node_id: updates.planning_node_id,
      });
    }
  };

  // Handler para enviar para aprovação
  const handleSendForApproval = async (cardId: string, cardTitulo: string) => {
    const approvalColumn = columns.find(c => 
      c.nome.toLowerCase().includes('enviados para aprovação')
    );
    
    if (!approvalColumn) {
      toast({
        title: 'Erro',
        description: 'Coluna "Enviados para aprovação" não encontrada',
        variant: 'destructive',
      });
      return;
    }

    // Mover card para coluna de aprovação
    updateCard({ id: cardId, column_id: approvalColumn.id });
    
    // Criar notificação
    await createNotification({
      cardId,
      cardTitulo,
      enviadoPor: currentUser?.name || 'Usuário',
    });

    toast({
      title: 'Enviado para aprovação',
      description: 'O conteúdo foi enviado para aprovação dos administradores',
    });
  };

  // Handler para aprovar
  const handleApprove = (cardId: string) => {
    const approvedColumn = columns.find(c => 
      c.nome.toLowerCase().includes('aprovados') && 
      !c.nome.toLowerCase().includes('enviados')
    );
    
    if (!approvedColumn) {
      toast({
        title: 'Erro',
        description: 'Coluna "Aprovados" não encontrada',
        variant: 'destructive',
      });
      return;
    }

    updateCard({ id: cardId, column_id: approvedColumn.id });
    
    toast({
      title: 'Conteúdo aprovado!',
      description: 'O conteúdo foi movido para a coluna de aprovados',
    });
  };

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div className="flex gap-4 p-4 min-h-[calc(100vh-220px)]">
            {columns.map(column => (
              <MarketingKanbanColumn
                key={column.id}
                column={column}
                cards={cardsByColumn[column.id] || []}
                columns={columns}
                trafficSources={sources}
                funnelStages={stages}
                products={products}
                centralTemplates={centralTemplates}
                onCardUpdate={updateCard}
                onCardClick={handleCardClick}
                onAddCard={handleAddCard}
                onSendForApproval={handleSendForApproval}
                onApprove={handleApprove}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeCard && (
            <div className="rotate-3 opacity-90">
              <MarketingKanbanCard
                card={activeCard}
                trafficSources={sources}
                funnelStages={stages}
                products={products}
                centralTemplates={centralTemplates}
                columns={columns}
                onUpdate={() => {}}
                onClick={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <MarketingCardEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        card={selectedCard}
        columns={columns}
        trafficSources={sources}
        funnelStages={stages}
        products={products}
        centralTemplates={centralTemplates}
        onSave={handleSaveCard}
        onDelete={deleteCard}
        onSendForApproval={handleSendForApproval}
        onApprove={handleApprove}
        isNew={isNewCard}
        defaultColumnId={newCardColumnId}
      />
    </div>
  );
}

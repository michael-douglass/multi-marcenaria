import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical, Flame, Zap, FileText, Star, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  MarketingContentCard, 
  MarketingTrafficSource, 
  MarketingFunnelStage,
  MarketingProduct,
  MarketingColumn,
} from '@/hooks/useMarketingConteudo';
import { MarketingBoardTemplate } from '@/hooks/useMarketingBoardTemplates';

interface MarketingKanbanCardProps {
  card: MarketingContentCard;
  trafficSources: MarketingTrafficSource[];
  funnelStages: MarketingFunnelStage[];
  products: MarketingProduct[];
  centralTemplates: MarketingBoardTemplate[];
  columns: MarketingColumn[];
  onUpdate: (updates: Partial<MarketingContentCard> & { id: string }) => void;
  onClick: () => void;
  onSendForApproval?: (cardId: string, cardTitulo: string) => void;
  onApprove?: (cardId: string) => void;
}

export function MarketingKanbanCard({
  card,
  trafficSources,
  funnelStages,
  products,
  centralTemplates,
  columns,
  onUpdate,
  onClick,
  onSendForApproval,
  onApprove,
}: MarketingKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isHighlighted = card.performando || card.urgente;
  const cardTrafficSources = trafficSources.filter(s => card.traffic_sources?.includes(s.id));
  const funnelStage = funnelStages.find(s => s.id === card.funnel_stage_id);
  const product = products.find(p => p.id === card.product_id);

  const handleToggle = (field: 'performando' | 'urgente', value: boolean) => {
    onUpdate({ id: card.id, [field]: value });
  };

  // Detectar colunas especiais
  const approvalColumn = columns.find(c => 
    c.nome.toLowerCase().includes('enviados para aprovação') || 
    c.nome.toLowerCase() === 'enviados para aprovação'
  );
  const approvedColumn = columns.find(c => 
    c.nome.toLowerCase().includes('aprovados') || 
    c.nome.toLowerCase() === 'aprovados'
  );
  
  const isInApprovalColumn = approvalColumn && card.column_id === approvalColumn.id;
  const isInApprovedColumn = approvedColumn && card.column_id === approvedColumn.id;
  const canSendForApproval = !isInApprovalColumn && !isInApprovedColumn && onSendForApproval;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      id={`marketing-card-${card.id}`}
      className={cn(
        'p-3 cursor-pointer transition-all duration-200 w-full overflow-hidden box-border',
        isDragging && 'opacity-50 rotate-2 scale-105',
        isHighlighted 
          ? 'bg-green-50 border-green-500 dark:bg-green-950/30 dark:border-green-700' 
          : 'bg-card hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-2 w-full min-w-0">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="flex items-center gap-2 mb-2">
            {card.performando && (
              <Badge variant="default" className="bg-green-600 text-xs">
                <Flame className="h-3 w-3 mr-1" />
                Performando
              </Badge>
            )}
            {card.urgente && (
              <Badge variant="destructive" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Urgente
              </Badge>
            )}
          </div>

          <h4 className="font-medium text-sm break-words line-clamp-2 mb-2">{card.titulo}</h4>

          {/* Traffic Sources */}
          <div className="flex flex-wrap gap-1 mb-2">
            {cardTrafficSources.map(source => (
              <Badge key={source.id} variant="outline" className="text-xs">
                {source.nome}
              </Badge>
            ))}
          </div>

          {/* Funnel Stage */}
          {funnelStage && (
            <Badge variant="secondary" className="text-xs mb-2">
              {funnelStage.nome}
            </Badge>
          )}

          {/* Product */}
          {product && (
            <Badge variant="default" className="text-xs mb-2 bg-primary/80">
              {product.nome}
            </Badge>
          )}

          {/* Script preview */}
          {card.script_copy && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {card.script_copy}
            </p>
          )}
        </div>

        {/* Planejamento Central Tooltip */}
        {centralTemplates.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <FileText className="h-4 w-4 text-blue-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-md p-0">
              <ScrollArea className="max-h-96 p-3">
                <p className="font-medium text-sm mb-2 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current text-yellow-500" />
                  Templates Centrais
                </p>
                <div className="space-y-2">
                  {centralTemplates.map(template => (
                    <div key={template.id} className="bg-muted/50 rounded p-2">
                      <p className="font-medium text-xs">{template.nome}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.board_data.nodes?.length || 0} nós, {template.board_data.shapes?.length || 0} formas
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Toggle Switches e Botões de Ação */}
      <div className="flex flex-col gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={card.performando}
              onCheckedChange={(v) => handleToggle('performando', v)}
              className="scale-75"
            />
            <span>Performando</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={card.urgente}
              onCheckedChange={(v) => handleToggle('urgente', v)}
              className="scale-75"
            />
            <span>Urgente</span>
          </label>
        </div>
        
        {/* Botões de aprovação */}
        {canSendForApproval && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7 text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => onSendForApproval(card.id, card.titulo)}
          >
            <Send className="h-3 w-3 mr-1" />
            Enviar para aprovação
          </Button>
        )}
        
        {isInApprovalColumn && onApprove && (
          <Button
            variant="default"
            size="sm"
            className="w-full text-xs h-7 bg-green-600 hover:bg-green-700"
            onClick={() => onApprove(card.id)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aprovar
          </Button>
        )}
      </div>
    </Card>
  );
}

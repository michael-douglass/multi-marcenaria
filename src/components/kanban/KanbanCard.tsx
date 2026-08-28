import { useState, useEffect, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Lead } from '@/types/selletos';
import { cn, formatYMDToBR } from '@/lib/utils';
import { Calendar, DollarSign, MapPin, ChevronDown, Clock, MessageSquare, MessageCircle, AlertTriangle, CalendarCheck, Bell, FileText, Presentation, Calculator, GripVertical, Star } from 'lucide-react';
import { LeadSinalizarButton } from '@/components/leads/LeadSinalizarButton';
import { LeadLembretesPopover } from '@/components/agenda/LeadLembretesPopover';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { useRegioes } from '@/hooks/useRegioes';
import { usePipelineTimeConfig } from '@/hooks/usePipelineTimeConfig';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { isLeadNegocioGanho } from '@/lib/vendas-ganhos';
import type { LeadLastMessagePreview } from '@/lib/lead-last-message-preview';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MarkupLeadResumo } from '@/lib/markup-types';
import { MarkupCardPreview } from '@/components/markup/MarkupCardPreview';
import { LeadVendorBanner } from '@/components/leads/LeadVendorBanner';
import { toast } from 'sonner';
import { LeadPontuaGarboPartnerBadge } from '@/components/leads/LeadPontuaGarboPartnerBadge';
import { usePontuaGarboPartnerBadge } from '@/hooks/usePontuaGarboPartnerLeads';
import { KanbanProjetoSignal } from '@/components/kanban/KanbanProjetoSignal';
import { LeadProjetoCardActions } from '@/components/projetos/LeadProjetoCardActions';
import { useLeadProjetos, useProjetoStages } from '@/hooks/useLeadProjetos';
import { kanbanCardProjetoRingClass, projetoSignalTone } from '@/lib/projetos-atelie';

interface KanbanCardProps {
  lead: Lead;
  onClick?: () => void;
  onMarkAsSale?: (leadId: number) => void;
  lastInteractionTime?: number; // timestamp em ms da última interação
  unreadCount?: number; // Contador de mensagens não lidas
  hasMeeting?: boolean; // Indica se o lead tem reunião agendada
  /** Animação ao soltar o card em outra coluna */
  justDropped?: boolean;
  /** Índice na coluna para entrada escalonada */
  appearIndex?: number;
  /** Contratos vinculados a este lead */
  contratosCount?: number;
  /** Orçamentos em slides vinculados a este lead */
  orcamentosCount?: number;
  /** Resumo do markup mais recente */
  markupResumo?: MarkupLeadResumo | null;
  /** Abrir calculadora de markup */
  onOpenMarkup?: (leadId: number, orcamentoId?: string) => void;
  /** Contagem de lembretes pendentes (buscada uma vez no pai). */
  lembretesCount?: number;
  /** Última mensagem do chat (buscada em lote no pai). */
  lastMessage?: LeadLastMessagePreview | null;
}

const originColors: Record<string, string> = {
  'Formulário': 'bg-primary text-primary-foreground',
  'WhatsApp': 'bg-success text-success-foreground',
  'Redes Sociais': 'bg-warning text-warning-foreground',
  'Indicação': 'bg-accent text-accent-foreground',
  'Pontua Garbo': 'bg-gold/20 text-gold border border-gold/35',
  'Outros': 'bg-muted text-muted-foreground',
};

export function KanbanCard({
  lead,
  onClick,
  onMarkAsSale,
  lastInteractionTime,
  unreadCount,
  hasMeeting,
  justDropped = false,
  appearIndex = 0,
  contratosCount = 0,
  orcamentosCount = 0,
  markupResumo,
  onOpenMarkup,
  lembretesCount = 0,
  lastMessage: lastMessageData,
}: KanbanCardProps) {
  const { hasPermission } = usePermissions();
  const { userRole, isSuperAdmin } = useAuth();
  /** Vendedor vê o valor no card; só gestão abre a calculadora. */
  const podeAbrirMarkup = userRole !== 'vendedor';
  const isAdmin = isSuperAdmin || userRole === 'admin';
  const canEditVendor =
    isAdmin || hasPermission('lead_vendor', 'edit');
  const { config: vendasGanhosConfig } = useVendasGanhosConfig();
  const { updateLead } = useLeads({ fetchLeads: false });
  const { users: dbUsers, isLoading: isLoadingUsers } = useUsers();
  const { regioesDisponiveis, regiaoToTabelaMap } = useRegioes();
  const { getColorForElapsedTime, formatElapsedTime, configs } = usePipelineTimeConfig();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isSavingVendor, setIsSavingVendor] = useState(false);
  const pontuaGarboBadge = usePontuaGarboPartnerBadge(lead.id);
  const { data: leadProjetos = [] } = useLeadProjetos();
  const { data: projetoStages = [] } = useProjetoStages();
  const projetoTone = projetoSignalTone(
    leadProjetos.find((item) => item.lead_id === lead.id) ?? null,
    projetoStages,
  );

  const vendorOptions = useMemo(
    () =>
      (dbUsers || [])
        .filter((u) =>
          u.roles?.includes('admin') ||
          u.roles?.includes('vendedor') ||
          u.role === 'admin' ||
          u.role === 'vendedor'
        )
        .map((u) => ({ id: u.id, nome: u.nome })),
    [dbUsers],
  );

  const handleVendorChange = async (vendorName: string | null) => {
    const nextId = vendorName
      ? vendorOptions.find((u) => u.nome === vendorName)?.id ?? null
      : null;
    if (vendorName && !nextId) {
      toast.error('Vendedor não encontrado na lista.');
      return;
    }

    setIsSavingVendor(true);
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: { vendedor_responsavel_id: nextId },
        silent: true,
      });
      toast.success(
        nextId ? `Vendedor: ${vendorName}` : 'Lead sem vendedor',
      );
    } catch (error) {
      console.error('Erro ao atualizar vendedor do lead:', error);
    } finally {
      setIsSavingVendor(false);
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
  });

  const appearDelayMs = Math.min(appearIndex, 12) * 45;

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Atualizar a cada 5 minutos para recalcular cores
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  const canMarkAsSale =
    onMarkAsSale &&
    !isLeadNegocioGanho(lead, vendasGanhosConfig) &&
    lead.status !== 'Venda Perdida (Não Matriculado)' &&
    lead.status !== 'Clientes Já Cadastrados';

  const handleMarkSale = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsSale) {
      onMarkAsSale(lead.id);
    }
  };

  const handleRegiaoChange = async (novaRegiao: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (novaRegiao === lead.regiao) return;
    
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: {
          regiao: novaRegiao,
          regiao_tabela: regiaoToTabelaMap[novaRegiao] || null,
        },
      });
    } catch (error) {
      console.error('Erro ao atualizar região:', error);
    }
  };

  const currentRegiao = lead.regiao || lead.tabelaOrigem;

  // Handler para alternar o status "Dar atenção"
  const handleAttentionToggle = async (checked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: { dar_atencao: checked },
      });
    } catch (error) {
      console.error('Erro ao atualizar dar_atencao:', error);
    }
  };

  // Calcular tempo decorrido em minutos
  const baseTime = lastInteractionTime || new Date(lead.dateArrived).getTime();
  const elapsedMinutes = Math.floor((currentTime - baseTime) / (1000 * 60));
  const timeColor = getColorForElapsedTime(elapsedMinutes);
  const timeDisplay = formatElapsedTime(elapsedMinutes);

  const bellButtonClass = cn(
    'relative shrink-0 h-7 w-7 rounded-full bg-amber-500 text-white shadow-sm',
    'flex items-center justify-center transition-colors',
    'hover:bg-amber-600',
    lembretesCount > 0 && 'ring-2 ring-amber-300 animate-pulse',
  );

  const bellButton = (
    <LeadLembretesPopover leadId={lead.id} leadName={lead.name}>
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={bellButtonClass}
        aria-label={
          lembretesCount > 0
            ? `${lembretesCount} lembrete(s) em aberto — ver lista`
            : 'Ver lembretes deste lead'
        }
        title={
          lembretesCount > 0
            ? `${lembretesCount} lembrete${lembretesCount > 1 ? 's' : ''} em aberto`
            : 'Lembretes do lead'
        }
      >
        <Bell className="h-3.5 w-3.5" />
        {lembretesCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center border border-background leading-none">
            {lembretesCount > 9 ? '9+' : lembretesCount}
          </span>
        )}
      </button>
    </LeadLembretesPopover>
  );

  return (
    <div ref={setNodeRef} style={sortableStyle} className="w-full min-w-0">
      <Card
        className={cn(
          'w-full min-w-0 overflow-hidden cursor-pointer transition-all hover:shadow-md',
          !isDragging && 'animate-in fade-in slide-in-from-top-2 duration-300 fill-mode-backwards',
          isDragging && 'z-50 scale-[1.03] rotate-1 opacity-95 shadow-xl ring-2 ring-primary/30',
          justDropped && !isDragging && 'animate-in zoom-in-95 duration-300 ring-2 ring-primary/40 shadow-lg',
          kanbanCardProjetoRingClass(projetoTone),
        )}
        onClick={onClick}
      >
      {hasPermission('lead_vendor', 'view') && (
        <div
          className="relative z-10"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <LeadVendorBanner
            vendor={lead.vendor}
            variant="card"
            canEdit={canEditVendor}
            vendors={vendorOptions}
            isLoadingVendors={isLoadingUsers}
            isSaving={isSavingVendor}
            onVendorChange={canEditVendor ? handleVendorChange : undefined}
          />
        </div>
      )}
      <CardContent
        className={cn(
          'p-2.5 sm:p-3 space-y-2 overflow-hidden',
          !isDragging && 'animate-in fade-in duration-300 fill-mode-backwards',
        )}
        style={{ animationDelay: `${appearDelayMs}ms` }}
      >
        {/* Cabeçalho: badges à esquerda, controles à direita (sem posição absoluta) */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <button
            type="button"
            className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Arrastar card"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
            {projetoTone ? <KanbanProjetoSignal tone={projetoTone} /> : null}
            {lead.needsAttention && (
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 max-w-full truncate animate-pulse"
              >
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">Dar atenção</span>
              </Badge>
            )}
            {pontuaGarboBadge && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 max-w-full truncate border-gold/40 bg-gold/15 text-gold"
                  >
                    <Star className="h-2.5 w-2.5 shrink-0 fill-gold" />
                    <span className="truncate">Pontua</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>Parceiro Pontua Garbo</p>
                </TooltipContent>
              </Tooltip>
            )}
            {hasMeeting && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 max-w-full truncate bg-primary/10 text-primary border-primary/30"
              >
                <CalendarCheck className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">Reunião</span>
              </Badge>
            )}
            {contratosCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 max-w-full truncate bg-amber-500/15 text-amber-200 border-amber-500/35"
                  >
                    <FileText className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">
                      {contratosCount} contrato{contratosCount !== 1 ? 's' : ''}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>Abra o card para ver os contratos</p>
                </TooltipContent>
              </Tooltip>
            )}
            {orcamentosCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 max-w-full truncate bg-orange-500/15 text-orange-200 border-orange-500/35"
                  >
                    <Presentation className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">
                      {orcamentosCount} orçamento{orcamentosCount !== 1 ? 's' : ''}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>Abra o card para ver os orçamentos</p>
                </TooltipContent>
              </Tooltip>
            )}
            {lembretesCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-amber-500/20 text-amber-100 border-amber-500/40"
                title={`${lembretesCount} lembrete(s) em aberto`}
              >
                <Bell className="h-2.5 w-2.5 shrink-0" />
                <span>{lembretesCount}</span>
              </Badge>
            )}
          </div>

          <div
            className="flex shrink-0 flex-col items-end gap-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Switch
                    checked={lead.needsAttention || false}
                    onCheckedChange={(checked) =>
                      handleAttentionToggle(checked, { stopPropagation: () => {} } as React.MouseEvent)
                    }
                    className="h-4 w-7 data-[state=checked]:bg-destructive"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                <p>Dar atenção</p>
              </TooltipContent>
            </Tooltip>

            <div className="flex flex-wrap items-center justify-end gap-1 max-w-[88px]">
              {unreadCount && unreadCount > 0 && lastMessageData?.isFromLead && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-green-500 text-white animate-pulse shrink-0">
                      <MessageCircle className="h-2.5 w-2.5" />
                      <span>{unreadCount}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    <p>
                      {unreadCount} mensagem{unreadCount > 1 ? 'ns' : ''} não lida
                      {unreadCount > 1 ? 's' : ''}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
              {configs && configs.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground shrink-0">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      <span className="whitespace-nowrap">{timeDisplay}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    <p className="text-muted-foreground">Última interação</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <h4 className="font-semibold text-foreground text-xs leading-snug truncate inline-flex max-w-full items-center gap-1">
            {pontuaGarboBadge && (
              <Star className="h-3 w-3 shrink-0 fill-gold text-gold drop-shadow-[0_0_5px_rgba(242,216,146,0.7)]" aria-hidden />
            )}
            <span className="truncate">
              {hasPermission('lead_name', 'view') ? lead.name : '•••••'}
            </span>
          </h4>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatYMDToBR(lead.dateArrived)}</span>
          </div>
          {lastMessageData?.lastMessage && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span
                className={cn(
                  'truncate min-w-0 flex-1',
                  lastMessageData.isFromLead && 'font-medium text-foreground/80',
                )}
              >
                {lastMessageData.isFromLead ? '' : '↩ '}
                {lastMessageData.lastMessage}
              </span>
            </div>
          )}
        </div>

        {pontuaGarboBadge && (
          <div className="w-full min-w-0 max-w-full overflow-hidden">
            <LeadPontuaGarboPartnerBadge badge={pontuaGarboBadge} variant="card" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 min-w-0">
          <Badge
            className={cn(
              'text-[10px] max-w-full truncate shrink',
              originColors[lead.origin] || originColors['Outros'],
            )}
          >
            <span className="truncate">
              {hasPermission('lead_origin', 'view') ? lead.origin : '•••'}
            </span>
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0 h-5 max-w-full bg-amber-50 text-amber-700 border-amber-200 font-medium inline-flex items-center gap-0.5 cursor-pointer hover:bg-amber-100 transition-colors min-w-0"
              >
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[72px]">{currentRegiao || 'Sem região'}</span>
                <ChevronDown className="h-2.5 w-2.5 shrink-0" />
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
              {regioesDisponiveis.map((regiao) => (
                <DropdownMenuItem
                  key={regiao}
                  onClick={(e) => handleRegiaoChange(regiao, e)}
                  className={cn('cursor-pointer', currentRegiao === regiao && 'bg-accent')}
                >
                  <MapPin className="h-3 w-3 mr-2" />
                  {regiao}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(markupResumo || (podeAbrirMarkup && onOpenMarkup)) && (
          <div className="relative z-10 min-w-0">
            {markupResumo && markupResumo.preco_final > 0 ? (
              <MarkupCardPreview
                resumo={markupResumo}
                compact
                readOnly={!podeAbrirMarkup}
                onClick={
                  podeAbrirMarkup
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenMarkup?.(lead.id, markupResumo.orcamento_id);
                      }
                    : undefined
                }
              />
            ) : podeAbrirMarkup && onOpenMarkup ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px] border-emerald-500/30 text-emerald-200"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenMarkup(lead.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Calculator className="h-3 w-3 mr-1" />
                Markup
              </Button>
            ) : null}
          </div>
        )}

        {/* Ações: lembrete + botões empilhados na largura da coluna */}
        <div
          className="flex items-center gap-1.5 pt-1.5 border-t border-border/50 min-w-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {bellButton}
          <LeadProjetoCardActions leadId={lead.id} leadNome={lead.name}>
            <LeadSinalizarButton
              leadId={lead.id}
              leadNome={lead.name}
              leadStatus={lead.status}
              className="w-full h-7 text-[10px] px-2 justify-center min-w-0 max-w-full"
            />
            {canMarkAsSale && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[10px] px-2 justify-center min-w-0 max-w-full"
                onClick={handleMarkSale}
              >
                <DollarSign className="h-3 w-3 mr-1 shrink-0" />
                <span className="truncate">Marcar Venda</span>
              </Button>
            )}
          </LeadProjetoCardActions>
        </div>
      </CardContent>
      </Card>

    </div>
  );
}

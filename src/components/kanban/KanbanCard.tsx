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
import { isPortalVendaPerdida } from '@/lib/crm-portal';
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
import { kanbanStageSkin, kanbanStageTintHex } from '@/lib/kanban-stage-skin';
import { KanbanLeadCardFoil } from '@/components/kanban/KanbanLeadCardFoil';

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
  /** Token de cor da coluna (primary, success...). */
  colorToken?: string | null;
  /** Índice da coluna no quadro. */
  columnIndex?: number;
  /** Título da coluna atual — pinta o card da mesma família da coluna. */
  stageTitle?: string;
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
  colorToken,
  columnIndex = 0,
  stageTitle,
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
  const [foilActive, setFoilActive] = useState(false);
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
  const skin = kanbanStageSkin(stageTitle ?? lead.status, colorToken, columnIndex);
  const stageTintHex = kanbanStageTintHex(skin.key);
  const showFoil = foilActive || isDragging;

  const nameInitials = useMemo(() => {
    const parts = lead.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  }, [lead.name]);

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
    !isPortalVendaPerdida(lead.status) &&
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
          'kanban-lead-card group/lead relative w-full min-w-0 overflow-hidden cursor-pointer',
          skin.card,
          !isDragging && 'animate-in fade-in slide-in-from-top-2 duration-300 fill-mode-backwards',
          isDragging && 'z-50 scale-[1.03] rotate-1 opacity-95 ring-2 ring-gold/40',
          justDropped && !isDragging && 'animate-in zoom-in-95 duration-300 ring-2 ring-gold/50',
          kanbanCardProjetoRingClass(projetoTone),
        )}
        onClick={onClick}
        onMouseEnter={() => setFoilActive(true)}
        onMouseLeave={() => setFoilActive(false)}
        onFocusCapture={() => setFoilActive(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFoilActive(false);
          }
        }}
      >
        {/* Trilho da coluna — identifica o estágio sem ler o título */}
        <span
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 z-[2] w-[3px]',
            skin.rail,
          )}
          aria-hidden
        />

        <KanbanLeadCardFoil active={showFoil} tintHex={stageTintHex} />

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
            'relative z-[2] space-y-2.5 overflow-x-hidden pl-4 pr-3 py-3 sm:pr-3.5 sm:py-3.5',
            !isDragging && 'animate-in fade-in duration-300 fill-mode-backwards',
          )}
          style={{ animationDelay: `${appearDelayMs}ms` }}
        >
          {/* Linha 1: arrastar + avatar + nome + controles */}
          <div className="flex items-start gap-2 min-w-0">
            <button
              type="button"
              className="mt-1.5 shrink-0 rounded p-0.5 text-cream/35 hover:text-cream/70 hover:bg-white/5 cursor-grab active:cursor-grabbing touch-none transition-colors"
              aria-label="Arrastar card"
              onClick={(e) => e.stopPropagation()}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>

            <div
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                'bg-gradient-to-br from-white/12 to-black/25',
                'border border-white/10 text-[11px] font-semibold tracking-wide text-cream/95',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
              )}
              aria-hidden
            >
              {hasPermission('lead_name', 'view') ? nameInitials : '··'}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="kanban-lead-name inline-flex max-w-full items-start gap-1 text-[15px] font-bold leading-snug tracking-tight">
                  {pontuaGarboBadge && (
                    <Star
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-gold text-gold drop-shadow-[0_0_5px_rgba(242,216,146,0.7)]"
                      aria-hidden
                    />
                  )}
                  <span className="line-clamp-2 break-words">
                    {hasPermission('lead_name', 'view') ? lead.name : '•••••'}
                  </span>
                </h4>

                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {bellButton}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <Switch
                          checked={lead.needsAttention || false}
                          onCheckedChange={(checked) =>
                            handleAttentionToggle(checked, {
                              stopPropagation: () => {},
                            } as React.MouseEvent)
                          }
                          className="h-4 w-7 data-[state=checked]:bg-destructive"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      <p>Dar atenção</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0 opacity-70" />
                  {formatYMDToBR(lead.dateArrived)}
                </span>
                {configs && configs.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-black/25 text-cream/80"
                        style={
                          timeColor?.cor
                            ? { backgroundColor: timeColor.cor, color: '#1a120e' }
                            : undefined
                        }
                      >
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        {timeDisplay}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>Última interação</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {unreadCount && unreadCount > 0 && lastMessageData?.isFromLead && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white animate-pulse">
                        <MessageCircle className="h-2.5 w-2.5" />
                        {unreadCount}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>
                        {unreadCount} mensagem{unreadCount > 1 ? 'ns' : ''} não lida
                        {unreadCount > 1 ? 's' : ''}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* Sinais / badges */}
          <div className="flex flex-wrap items-center gap-1 min-w-0 pl-0.5">
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

          {lastMessageData?.lastMessage && (
            <div className="flex items-center gap-1.5 rounded-md bg-black/20 px-2 py-1.5 text-[10px] text-muted-foreground min-w-0 border border-white/5">
              <MessageSquare className="h-3 w-3 shrink-0 opacity-70" />
              <span
                className={cn(
                  'truncate min-w-0 flex-1',
                  lastMessageData.isFromLead && 'font-medium text-cream/90',
                )}
              >
                {lastMessageData.isFromLead ? '' : '↩ '}
                {lastMessageData.lastMessage}
              </span>
            </div>
          )}

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
                  className="text-[9px] px-1.5 py-0 h-5 max-w-full bg-amber-50/95 text-amber-800 border-amber-200/80 font-medium inline-flex items-center gap-0.5 cursor-pointer hover:bg-amber-100 transition-colors min-w-0"
                >
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate max-w-[120px]">{currentRegiao || 'Sem região'}</span>
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

          <div
            className="flex min-w-0 flex-col gap-1.5 border-t border-gold/15 pt-2"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <LeadProjetoCardActions leadId={lead.id} leadNome={lead.name}>
              <div className="flex flex-wrap gap-1.5">
                <LeadSinalizarButton
                  leadId={lead.id}
                  leadNome={lead.name}
                  leadStatus={lead.status}
                  className="h-8 min-w-[46%] flex-1 justify-center px-2.5 text-[11px]"
                />
                {canMarkAsSale && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 min-w-[46%] flex-1 justify-center px-2.5 text-[11px]"
                    onClick={handleMarkSale}
                  >
                    <DollarSign className="mr-1 h-3.5 w-3.5 shrink-0" />
                    <span>Marcar Venda</span>
                  </Button>
                )}
              </div>
            </LeadProjetoCardActions>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

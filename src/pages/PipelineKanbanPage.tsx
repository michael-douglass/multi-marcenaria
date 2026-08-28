import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Search, Target, MapPin, Plus, X, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useLeads } from '@/hooks/useLeads';
import { useLeadsForKanbanPage, type KanbanMonthPeriodFilter } from '@/hooks/useLeadsForKanbanPage';
import { useLeadOrigins } from '@/hooks/useLeadOrigins';
import { useRegioes } from '@/hooks/useRegioes';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { KanbanCard } from '@/components/kanban/KanbanCard';
import { FloatingHorizontalScrollbar } from '@/components/kanban/FloatingHorizontalScrollbar';
import { KanbanPageZoomShell } from '@/components/kanban/KanbanPageZoomShell';
import { KanbanPageZoomControls } from '@/components/kanban/KanbanPageZoomControls';
import { LeadModal } from '@/components/leads/LeadModal';
import { useLeadProjetos } from '@/hooks/useLeadProjetos';
import { adaptLeadFromDatabase } from '@/lib/adapters';
import { leadMatchesSearchQuery } from '@/lib/lead-search';
import { resolveKanbanColumns } from '@/lib/kanban-resolver';
import {
  buildKanbanPageStatusOptions,
  getTargetStatusForKanbanColumn,
} from '@/lib/kanban-status-options';
import { buildAllLeadModalStatusOptions } from '@/lib/pipeline-status-options';
import { usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import { useUnreadMessages, useMarkMessagesAsRead } from '@/hooks/useUnreadMessages';
import { useLeadLastMessages } from '@/hooks/useLeadLastMessages';
import { useLeadLembretesCountMap } from '@/hooks/useLeadLembretes';
import { useLeadsMeetingsMap } from '@/hooks/useLeadMeetings';
import { useContratosLeadIdsMap } from '@/hooks/useContratosLead';
import { useOrcamentosLeadMap } from '@/hooks/useOrcamentoSlides';
import { useLeadMarkupResumoMap } from '@/hooks/useMarkupOrcamentos';
import { MarkupCalculatorSheet } from '@/components/markup/MarkupCalculatorSheet';
import { toast } from 'sonner';
import { cn, toSaoPauloTime } from '@/lib/utils';

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

function initialMonthPeriod(): KanbanMonthPeriodFilter {
  return { type: 'all' };
}

export default function PipelineKanbanPage() {
  const { kanbanSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { updateLead } = useLeads({ fetchLeads: false });
  const { origins } = useLeadOrigins();
  const { regioesDisponiveis } = useRegioes();
  const { pages, isLoading: isLoadingKanban } = useKanbanConfig();
  const { activeStages: pipelineStages } = usePipelineCustomStages();
  useLeadProjetos({ realtime: true });
  const [periodFilter, setPeriodFilter] = useState<KanbanMonthPeriodFilter>(initialMonthPeriod);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedRegioes, setSelectedRegioes] = useState<string[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [droppedLeadId, setDroppedLeadId] = useState<number | null>(null);

  const syncLeadIdInUrl = useCallback((leadId: number | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (leadId != null) {
        next.set('id', String(leadId));
      } else {
        next.delete('id');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const openLeadModal = useCallback(
    (leadId: number | null) => {
      setSelectedLeadId(leadId);
      setIsModalOpen(true);
      syncLeadIdInUrl(leadId);
    },
    [syncLeadIdInUrl],
  );

  const closeLeadModal = useCallback(() => {
    // Limpa ?id= antes de marcar fechado: evita o efeito da URL reabrir o card.
    syncLeadIdInUrl(null);
    setIsModalOpen(false);
    setSelectedLeadId(null);
  }, [syncLeadIdInUrl]);

  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [kanbanScrollEdges, setKanbanScrollEdges] = useState({ canLeft: false, canRight: false });

  const updateKanbanScrollEdges = useCallback(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const epsilon = 6;
    setKanbanScrollEdges({
      canLeft: scrollLeft > epsilon,
      canRight: maxScroll > epsilon && scrollLeft < maxScroll - epsilon,
    });
  }, []);

  const scrollKanbanHorizontal = useCallback((direction: 'prev' | 'next') => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const step = Math.min(400, Math.max(240, el.clientWidth * 0.85));
    el.scrollBy({ left: direction === 'next' ? step : -step, behavior: 'smooth' });
  }, []);

  const page = useMemo(
    () => pages.find((entry) => entry.slug === kanbanSlug && entry.ativo),
    [pages, kanbanSlug],
  );

  // Reabre o card só quando a URL muda (ex.: F5 / atualização do sistema com ?id=).
  // Não depende de isModalOpen — senão, ao fechar, o ?id= antigo ainda na URL reabria o card.
  useEffect(() => {
    const leadIdFromUrl = searchParams.get('id');
    if (!leadIdFromUrl) return;
    const leadId = parseInt(leadIdFromUrl, 10);
    if (Number.isNaN(leadId)) return;
    setSelectedLeadId(leadId);
    setIsModalOpen(true);
  }, [searchParams]);

  const isGlobalSearchActive = searchQuery.trim().length > 0;

  /** Com busca ativa, ignora o filtro de mês para achar cards de qualquer período (como no Pipeline). */
  const effectivePeriodFilter: KanbanMonthPeriodFilter = isGlobalSearchActive
    ? { type: 'all' }
    : periodFilter;

  const { data: leadsData, isLoading: isLoadingLeads } = useLeadsForKanbanPage(
    page ?? null,
    effectivePeriodFilter,
  );
  const leads = leadsData ?? [];
  const isInitialKanbanLoad =
    (isLoadingKanban && pages.length === 0) || (isLoadingLeads && !leadsData);

  const periodSelectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Todos os leads' }];
    const now = toSaoPauloTime(new Date());
    const yNow = now.getFullYear();
    for (let y = yNow; y >= yNow - 1; y--) {
      for (let m = 0; m < 12; m++) {
        opts.push({ value: `${y}-${m}`, label: `${MESES_PT[m]} ${y}` });
      }
    }
    return opts;
  }, []);

  const periodSelectValue =
    periodFilter.type === 'all' ? 'all' : `${periodFilter.year}-${periodFilter.month}`;

  const adaptedLeads = useMemo(() => leads.map(adaptLeadFromDatabase), [leads]);

  const filteredLeads = useMemo(() => {
    let result = adaptedLeads;
    if (selectedOrigins.length) {
      result = result.filter((lead) => selectedOrigins.includes(lead.origin));
    }
    if (selectedRegioes.length) {
      result = result.filter((lead) => lead.regiao && selectedRegioes.includes(lead.regiao));
    }
    if (isGlobalSearchActive) {
      result = result.filter((lead) => leadMatchesSearchQuery(lead, searchQuery));
    }
    return result;
  }, [adaptedLeads, isGlobalSearchActive, searchQuery, selectedOrigins, selectedRegioes]);

  const columns = useMemo(() => {
    if (!page) return [];
    return resolveKanbanColumns({ page, leads: filteredLeads });
  }, [page, filteredLeads]);

  useEffect(() => {
    updateKanbanScrollEdges();
    const el = kanbanScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateKanbanScrollEdges());
    ro.observe(el);
    return () => ro.disconnect();
  }, [columns.length, filteredLeads.length, page?.id, updateKanbanScrollEdges]);

  const leadsForUnread = useMemo(() => filteredLeads.map((lead) => ({ id: lead.id, telefone: lead.phone })), [filteredLeads]);
  const kanbanLeadIds = useMemo(() => filteredLeads.map((lead) => lead.id), [filteredLeads]);
  const { data: unreadCountMap = {} } = useUnreadMessages(leadsForUnread);
  const { data: lastMessagesMap = {} } = useLeadLastMessages(leadsForUnread);
  const lembretesCountMap = useLeadLembretesCountMap();
  const markMessagesAsRead = useMarkMessagesAsRead();
  const { data: meetingsMap } = useLeadsMeetingsMap(kanbanLeadIds);
  const { data: contratosLeadMap } = useContratosLeadIdsMap();
  const { data: orcamentosLeadMap } = useOrcamentosLeadMap();
  const markupResumoMap = useLeadMarkupResumoMap();
  const [markupSheet, setMarkupSheet] = useState<{
    leadId: number;
    leadNome: string;
    orcamentoId?: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const getTargetStatusForColumn = (columnId: string): string | null => {
    const targetColumn = page?.columns.find((column) => column.id === columnId);
    if (!targetColumn) return null;
    return getTargetStatusForKanbanColumn(targetColumn);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const resolveDropColumnId = useCallback(
    (overId: string | number): string | null => {
      if (!page) return null;
      if (typeof overId === 'string' && page.columns.some((col) => col.id === overId)) {
        return overId;
      }
      if (typeof overId === 'number') {
        const targetColumn = columns.find((col) => col.items.some((item) => item.id === overId));
        return targetColumn?.id ?? null;
      }
      return null;
    },
    [page, columns],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const leadId = event.active.id as number;
    const overId = event.over?.id;
    setActiveId(null);
    if (overId === undefined || overId === null) return;

    const columnId = resolveDropColumnId(overId);
    if (!columnId) return;
    const targetStatus = getTargetStatusForColumn(columnId);
    if (!targetStatus) return;

    updateLead.mutate(
      { id: leadId, updates: { status: targetStatus } },
      {
        onSuccess: () => {
          setDroppedLeadId(leadId);
          window.setTimeout(() => setDroppedLeadId(null), 450);
          toast.success('Lead movido com sucesso');
        },
        onError: () => {
          toast.error('Não foi possível mover o lead');
        },
      },
    );
  };

  const activeCard = activeId ? filteredLeads.find((lead) => lead.id === activeId) : null;

  const selectedLead = useMemo(
    () => (selectedLeadId ? filteredLeads.find((lead) => lead.id === selectedLeadId) : null),
    [filteredLeads, selectedLeadId],
  );

  const leadModalStatusOptions = useMemo(
    () => buildAllLeadModalStatusOptions(pipelineStages, pages, selectedLead?.status),
    [pipelineStages, pages, selectedLead?.status],
  );

  const newLeadDefaultStatus = useMemo(
    () => buildKanbanPageStatusOptions(page)[0]?.value,
    [page],
  );

  if (!isInitialKanbanLoad && !page) {
    return <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">Kanban não encontrado.</div>;
  }

  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden px-2 pb-2 md:px-3 md:pb-3 md:space-y-3 space-y-2">
      {isInitialKanbanLoad || !page ? (
        <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">Carregando Kanban...</div>
      ) : (
      <>
      <div>
        <h1 className="text-xl md:text-2xl font-bold">{page.nome}</h1>
        <p className="text-sm text-muted-foreground">Kanban configurável por regras de origem e ajustes manuais</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 sm:flex-wrap">
        <Select
          value={periodSelectValue}
          onValueChange={(v) => {
            if (v === 'all') {
              setPeriodFilter({ type: 'all' });
              return;
            }
            const dash = v.lastIndexOf('-');
            const ys = v.slice(0, dash);
            const ms = v.slice(dash + 1);
            setPeriodFilter({
              type: 'month',
              year: parseInt(ys, 10),
              month: parseInt(ms, 10),
            });
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px] justify-start">
            <CalendarRange className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent className="max-h-[min(70vh,320px)]">
            {periodSelectOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10 pr-10 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-48 justify-start">
              <Target className="h-4 w-4 mr-2" />
              {selectedOrigins.length === 0 ? 'Todas origens' : `${selectedOrigins.length} origem(ns)`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              <Button variant="ghost" size="sm" className="w-full justify-start font-normal" onClick={() => setSelectedOrigins([])}>
                Todas as origens
              </Button>
              {origins.map((origin) => (
                <div key={origin.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm">
                  <Checkbox
                    id={`kanban-origin-${origin.id}`}
                    checked={selectedOrigins.includes(origin.nome)}
                    onCheckedChange={(checked) => {
                      setSelectedOrigins((prev) =>
                        checked ? [...prev, origin.nome] : prev.filter((item) => item !== origin.nome),
                      );
                    }}
                  />
                  <label htmlFor={`kanban-origin-${origin.id}`} className="text-sm cursor-pointer flex-1">
                    {origin.nome}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-48 justify-start">
              <MapPin className="h-4 w-4 mr-2" />
              {selectedRegioes.length === 0 ? 'Todas regiões' : `${selectedRegioes.length} região(ões)`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              <Button variant="ghost" size="sm" className="w-full justify-start font-normal" onClick={() => setSelectedRegioes([])}>
                Todas as regiões
              </Button>
              {regioesDisponiveis.map((regiao) => (
                <div key={regiao} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm">
                  <Checkbox
                    id={`kanban-regiao-${regiao}`}
                    checked={selectedRegioes.includes(regiao)}
                    onCheckedChange={(checked) => {
                      setSelectedRegioes((prev) => (checked ? [...prev, regiao] : prev.filter((item) => item !== regiao)));
                    }}
                  />
                  <label htmlFor={`kanban-regiao-${regiao}`} className="text-sm cursor-pointer flex-1">
                    {regiao}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <KanbanPageZoomControls variant="inline" />

        <Button
          onClick={() => {
            openLeadModal(null);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      <div className="text-xs md:text-sm text-muted-foreground px-1 space-y-0.5">
        <p>
          {filteredLeads.length} {filteredLeads.length === 1 ? 'lead encontrado' : 'leads encontrados'}
          {(selectedOrigins.length || selectedRegioes.length || isGlobalSearchActive || periodFilter.type === 'all') &&
            ' (com filtros)'}
          {isGlobalSearchActive && ' — busca em todos os períodos'}
        </p>
        <p className="text-[11px] text-muted-foreground/90">
          {isGlobalSearchActive
            ? 'Busca ativa: mostrando leads de qualquer mês que correspondam ao termo.'
            : periodFilter.type === 'all'
              ? 'Período: todas as datas de chegada.'
              : `Período: ${MESES_PT[periodFilter.month]} de ${periodFilter.year} (data de chegada).`}
        </p>
      </div>

      <KanbanPageZoomControls variant="fixed" transparent={!!markupSheet} />
      <KanbanPageZoomShell
        onZoomApplied={updateKanbanScrollEdges}
        className="overflow-x-hidden overflow-y-hidden"
      >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={pointerWithin}
      >
        <div className="relative flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden pb-4">
          <div
            ref={kanbanScrollRef}
            onScroll={updateKanbanScrollEdges}
            className="scrollbar-always-visible flex min-h-0 min-w-0 max-w-full flex-1 gap-2.5 overflow-x-scroll overflow-y-hidden overscroll-x-contain px-10 md:gap-3 md:px-12"
          >
            {columns.map((column) => (
              <div key={column.id} className="flex h-full min-h-0 shrink-0">
                <KanbanColumn
                  title={column.title}
                  count={column.items.length}
                  status={column.title}
                  droppableId={column.id}
                  items={column.items.map((lead) => lead.id)}
                >
                  {column.items.map((lead, cardIndex) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      appearIndex={cardIndex}
                      justDropped={droppedLeadId === lead.id}
                      unreadCount={unreadCountMap[lead.id]}
                      hasMeeting={!!meetingsMap?.has(lead.id)}
                      contratosCount={contratosLeadMap?.get(lead.id) ?? 0}
                      orcamentosCount={orcamentosLeadMap?.get(lead.id) ?? 0}
                      markupResumo={markupResumoMap.get(lead.id) ?? null}
                      lembretesCount={lembretesCountMap.get(lead.id) || 0}
                      lastMessage={lastMessagesMap[lead.id] ?? null}
                      onOpenMarkup={(leadId, orcamentoId) =>
                        setMarkupSheet({
                          leadId,
                          leadNome: lead.name,
                          orcamentoId,
                        })
                      }
                      onClick={() => {
                        openLeadModal(lead.id);
                        if (lead.phone && unreadCountMap[lead.id] > 0) {
                          markMessagesAsRead.mutate(lead.phone);
                        }
                      }}
                    />
                  ))}
                </KanbanColumn>
              </div>
            ))}
          </div>
          {/* Setas no meio da altura (sem faixa full-height — evita vazamento visual na sidebar) */}
          <div className="pointer-events-none absolute left-2 top-1/2 z-30 -translate-y-1/2 md:left-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Rolar colunas para a esquerda"
              aria-disabled={!kanbanScrollEdges.canLeft}
              onClick={() => {
                if (kanbanScrollEdges.canLeft) scrollKanbanHorizontal('prev');
              }}
              className={cn(
                'pointer-events-auto h-11 w-11 shrink-0 rounded-full border-2 border-border bg-background shadow-md hover:bg-accent',
                !kanbanScrollEdges.canLeft && 'cursor-default opacity-40',
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
          <div className="pointer-events-none absolute right-2 top-1/2 z-30 -translate-y-1/2 md:right-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Rolar colunas para a direita"
              aria-disabled={!kanbanScrollEdges.canRight}
              onClick={() => {
                if (kanbanScrollEdges.canRight) scrollKanbanHorizontal('next');
              }}
              className={cn(
                'pointer-events-auto h-11 w-11 shrink-0 rounded-full border-2 border-border bg-background shadow-md hover:bg-accent',
                !kanbanScrollEdges.canRight && 'cursor-default opacity-40',
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <DragOverlay>{activeCard ? <KanbanCard lead={activeCard} /> : null}</DragOverlay>
      </DndContext>

      <FloatingHorizontalScrollbar
        targetRef={kanbanScrollRef}
        deps={[columns.length, filteredLeads.length, page?.id]}
      />
      </KanbanPageZoomShell>

      </>
      )}

      <LeadModal
        isOpen={isModalOpen}
        onClose={closeLeadModal}
        leadId={selectedLeadId}
        isEditMode
        statusOptions={leadModalStatusOptions}
        newLeadDefaultStatus={newLeadDefaultStatus}
        onLeadDuplicated={(newLeadId) => openLeadModal(newLeadId)}
        onLeadCreated={(newLeadId) => openLeadModal(newLeadId)}
      />

      {markupSheet ? (
        <MarkupCalculatorSheet
          key={`${markupSheet.leadId}-${markupSheet.orcamentoId ?? 'novo'}`}
          open
          onOpenChange={(open) => {
            if (!open) setMarkupSheet(null);
          }}
          leadId={markupSheet.leadId}
          leadNome={markupSheet.leadNome}
          orcamentoId={markupSheet.orcamentoId}
        />
      ) : null}
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutGrid, List, Calendar, Filter, ArrowUpDown, MapPin, Target, Check, FileText, CalendarRange, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { useLeadRealtime } from '@/hooks/useLeadRealtime';
import { useLastInteractions } from '@/hooks/useLastInteractions';
import { useUnreadMessages, useMarkMessagesAsRead } from '@/hooks/useUnreadMessages';
import { useLeadLastMessages } from '@/hooks/useLeadLastMessages';
import { useLeadLembretesCountMap } from '@/hooks/useLeadLembretes';
import { useLeadsMeetingsMap } from '@/hooks/useLeadMeetings';
import { useContratosLeadIdsMap } from '@/hooks/useContratosLead';
import { useOrcamentosLeadMap } from '@/hooks/useOrcamentoSlides';
import { useLeadMarkupResumoMap } from '@/hooks/useMarkupOrcamentos';
import { MarkupCalculatorSheet } from '@/components/markup/MarkupCalculatorSheet';
import { useLeadOrigins } from '@/hooks/useLeadOrigins';
import { usePipelineTimeConfig } from '@/hooks/usePipelineTimeConfig';
import { REGIOES_DISPONIVEIS } from '@/hooks/useWebhooks';
import { Lead, LeadStatus, LeadSortBy } from '@/types/selletos';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, toSaoPauloTime } from '@/lib/utils';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { FloatingHorizontalScrollbar } from '@/components/kanban/FloatingHorizontalScrollbar';
import { KanbanPageZoomShell } from '@/components/kanban/KanbanPageZoomShell';
import { KanbanPageZoomControls } from '@/components/kanban/KanbanPageZoomControls';
import { KanbanCard } from '@/components/kanban/KanbanCard';
import { LeadModal } from '@/components/leads/LeadModal';
import { SaleValueDialog } from '@/components/leads/SaleValueDialog';
import { useLeadPontuaGarboSaleInfo } from '@/hooks/useLeadPontuaGarboSaleInfo';
import { LeadsListView } from '@/components/leads/LeadsListView';
import { PipelineMetrics } from '@/components/pipeline/PipelineMetrics';

import { ExportReportDialog } from '@/components/pipeline/ExportReportDialog';
import { PipelineStagesConfigDialog } from '@/components/pipeline/PipelineStagesConfigDialog';
import { usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { adaptLeadFromDatabase, adaptUserForAvatar, adaptUserFromDatabase } from '@/lib/adapters';
import { shouldIgnoreRealtimeLeadUpdate } from '@/lib/lead-update-guard';
import { sortLeadsWithAttentionPriority } from '@/lib/lead-sort';
import {
  leadBelongsInPipelineStage,
  leadMatchesAnyPipelineStage,
  buildAllLeadModalStatusOptions,
  getPipelineInboxStageName,
} from '@/lib/pipeline-status-options';
import { leadMatchesSearchQuery } from '@/lib/lead-search';
import { PipelineLeadSearch } from '@/components/pipeline/PipelineLeadSearch';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { buildMarkAsWonUpdates } from '@/lib/vendas-ganhos';
import { useSyncPontuaGarboLiberacaoAposVenda } from '@/hooks/usePontuaGarboComissaoLiberacao';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { useLeadProjetos } from '@/hooks/useLeadProjetos';

const DEFAULT_KANBAN_STAGES: string[] = [
  'Novo Lead',
  'Aula Experimental Marcada',
  'Não Entraram para Aula Experimental',
  'Aula Realizada',
  'Venda Realizada (Matriculado)',
  'Clientes Já Cadastrados',
];

export default function Pipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { leads, updateLead, isLoading } = useLeads();
  const { users } = useUsers();
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions();
  const { origins } = useLeadOrigins();
  const { configs: timeConfigs } = usePipelineTimeConfig();
  const { activeStages: customStages } = usePipelineCustomStages();
  const { config: vendasGanhosConfig, isLoading: isLoadingVendasGanhosConfig } = useVendasGanhosConfig();
  useLeadProjetos({ realtime: true });
  const liberacaoAposVenda = useSyncPontuaGarboLiberacaoAposVenda();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<LeadStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'current_month' | 'custom' | 'date_range' | 'all'>('all');
  const [customDateFilter, setCustomDateFilter] = useState<Date | undefined>(undefined);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>(undefined);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [droppedLeadId, setDroppedLeadId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadModalInitialTab, setLeadModalInitialTab] = useState<'detalhes' | 'analise-ia'>('detalhes');
  const [leadModalIaSubtab, setLeadModalIaSubtab] = useState<'visual' | 'render'>('visual');
  const [isEditMode, setIsEditMode] = useState(true);

  /** Mantém ?id= enquanto o card está aberto — sobrevive a remount/atualização. */
  const syncLeadIdInUrl = useCallback((leadId: number | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (leadId != null) {
        next.set('id', String(leadId));
      } else {
        next.delete('id');
        next.delete('tab');
        next.delete('iaSubtab');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const openLeadModal = useCallback(
    (leadId: number | null, editMode = true) => {
      setSelectedLeadId(leadId);
      setIsEditMode(editMode);
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
    setIsEditMode(true);
    setLeadModalInitialTab('detalhes');
    setLeadModalIaSubtab('visual');
  }, [syncLeadIdInUrl]);
  const [showSaleValueDialog, setShowSaleValueDialog] = useState(false);
  const [pendingSaleLeadId, setPendingSaleLeadId] = useState<number | null>(null);
  const { data: pontuaGarboSale } = useLeadPontuaGarboSaleInfo(pendingSaleLeadId);
  const [sortBy, setSortBy] = useState<LeadSortBy>('ultima_interacao');
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedRegioes, setSelectedRegioes] = useState<string[]>([]);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>(null);
  const [realtimeInteractionMap, setRealtimeInteractionMap] = useState<Record<number, number>>({});
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showStagesConfigDialog, setShowStagesConfigDialog] = useState(false);
  const [manualOrder, setManualOrder] = useState<Record<string, number[]>>({});
  const messagesRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lista de etapas vem da tabela (defaults + customizadas) ordenadas por `ordem`.
  // Fallback para os defaults caso a tabela ainda não tenha sido carregada.
  const KANBAN_STAGES = useMemo<string[]>(
    () =>
      customStages.length > 0
        ? customStages.map((s) => s.nome)
        : DEFAULT_KANBAN_STAGES,
    [customStages],
  );
  const customStageColorMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    customStages.forEach((s) => {
      map[s.nome] = s.cor;
    });
    return map;
  }, [customStages]);

  const { pages: kanbanPages } = useKanbanConfig();

  const leadModalStatusOptions = useMemo(
    () => buildAllLeadModalStatusOptions(customStages, kanbanPages),
    [customStages, kanbanPages],
  );

  const leadModalAllStatusValues = useMemo(
    () => leadModalStatusOptions.map((opt) => opt.value),
    [leadModalStatusOptions],
  );

  const newLeadDefaultStatus = useMemo(
    () => getPipelineInboxStageName(KANBAN_STAGES),
    [KANBAN_STAGES],
  );

  const pipelineKanbanScrollRef = useRef<HTMLDivElement>(null);
  const [pipelineKanbanScrollEdges, setPipelineKanbanScrollEdges] = useState({ canLeft: false, canRight: false });

  const updatePipelineKanbanScrollEdges = useCallback(() => {
    const el = pipelineKanbanScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const epsilon = 6;
    setPipelineKanbanScrollEdges({
      canLeft: scrollLeft > epsilon,
      canRight: maxScroll > epsilon && scrollLeft < maxScroll - epsilon,
    });
  }, []);

  const scrollPipelineKanbanHorizontal = useCallback((direction: 'prev' | 'next') => {
    const el = pipelineKanbanScrollRef.current;
    if (!el) return;
    const step = Math.min(400, Math.max(240, el.clientWidth * 0.85));
    el.scrollBy({ left: direction === 'next' ? step : -step, behavior: 'smooth' });
  }, []);

  // Reabre o card só quando o ?id= da URL muda (F5 / botão Atualizar).
  // Não escuta a lista de leads — senão um recarregamento reabria o card depois do clique fora.
  const selectedLeadIdRef = useRef(selectedLeadId);
  selectedLeadIdRef.current = selectedLeadId;
  const leadIdFromUrl = searchParams.get('id');
  const tabFromUrl = searchParams.get('tab');
  const iaSubtabFromUrl = searchParams.get('iaSubtab');
  const searchFromUrl = searchParams.get('search');

  useEffect(() => {
    if (!leadIdFromUrl) return;
    const leadId = parseInt(leadIdFromUrl, 10);
    if (Number.isNaN(leadId)) return;
    // Lead novo via URL → mostra todos os períodos para o card aparecer no funil.
    if (selectedLeadIdRef.current !== leadId) {
      setDateFilter('all');
    }
    setSelectedLeadId(leadId);
    setIsEditMode(true);
    setIsModalOpen(true);

    if (tabFromUrl === 'analise-ia' || tabFromUrl === 'detalhes') {
      setLeadModalInitialTab(tabFromUrl);
    }
    if (iaSubtabFromUrl === 'render' || iaSubtabFromUrl === 'visual') {
      setLeadModalIaSubtab(iaSubtabFromUrl);
    }
  }, [leadIdFromUrl, tabFromUrl, iaSubtabFromUrl]);

  useEffect(() => {
    if (!searchFromUrl || (isLoading && !leads)) return;
    setSearchQuery(searchFromUrl);
    setDateFilter('all');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      return next;
    }, { replace: true });
  }, [searchFromUrl, isLoading, leads, setSearchParams]);

  // Buscar últimas interações de mensagens para cada lead
  const leadIds = useMemo(() => leads?.map(l => l.id) || [], [leads]);
  const { data: dbInteractionMap = {} } = useLastInteractions(leadIds, leads || []);

  // Buscar contagem de mensagens não lidas por lead
  const leadsForUnread = useMemo(() => 
    leads?.map(l => ({ id: l.id, telefone: l.telefone })) || [], 
    [leads]
  );
  const { data: unreadCountMap = {} } = useUnreadMessages(leadsForUnread);
  const { data: lastMessagesMap = {} } = useLeadLastMessages(leadsForUnread);
  const lembretesCountMap = useLeadLembretesCountMap();
  const markMessagesAsRead = useMarkMessagesAsRead();

  // Buscar reuniões agendadas dos leads (para badge "Reunião Marcada")
  const { data: leadsMeetingsMap } = useLeadsMeetingsMap(leadIds);
  const { data: contratosLeadMap } = useContratosLeadIdsMap();
  const { data: orcamentosLeadMap } = useOrcamentosLeadMap();
  const markupResumoMap = useLeadMarkupResumoMap();
  const [markupSheet, setMarkupSheet] = useState<{
    leadId: number;
    leadNome: string;
    orcamentoId?: string;
  } | null>(null);

  // Combinar interações do banco com atualizações em tempo real (tempo real tem prioridade)
  const lastInteractionMap = useMemo(() => {
    return { ...dbInteractionMap, ...realtimeInteractionMap };
  }, [dbInteractionMap, realtimeInteractionMap]);

  // Configurar sensores para melhor detecção de drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Inicializar ordem manual quando leads mudarem
  useEffect(() => {
    if (!leads || sortBy !== 'manual') return;
    
    setManualOrder(prev => {
      const updated: Record<string, number[]> = { ...prev };
      
      // Para cada coluna, adicionar novos leads que ainda não estão na ordem
      KANBAN_STAGES.forEach(stage => {
        if (!updated[stage]) updated[stage] = [];
        const leadsInStage = leads
          .map(adaptLeadFromDatabase)
          .filter((l) => leadBelongsInPipelineStage(l.status, stage, KANBAN_STAGES))
          // Ordenar por ordem_manual do banco primeiro
          .sort((a, b) => {
            const orderA = a.manualOrder ?? 999999;
            const orderB = b.manualOrder ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(b.dateArrived).getTime() - new Date(a.dateArrived).getTime();
          });
        
        const existingIds = new Set(updated[stage]);
        
        leadsInStage.forEach(lead => {
          if (!existingIds.has(lead.id)) {
            // Novos leads vão pro topo
            updated[stage] = [lead.id, ...updated[stage]];
          }
        });
        
        // Remover IDs de leads que não existem mais
        updated[stage] = updated[stage].filter(id => 
          leadsInStage.some(l => l.id === id)
        );
      });
      
      return updated;
    });
  }, [leads, sortBy, KANBAN_STAGES]);

  const currentUserData = useMemo(() => {
    if (!users || !user?.email) return null;
    return users.map(adaptUserFromDatabase).find(u => u.email === user.email);
  }, [users, user?.email]);

  const currentUserRole = currentUserData?.role || 'NENHUM';
  const canMarkSale = currentUserRole === 'ADMIN' || currentUserRole === 'VENDEDOR';

  // Todos os leads adaptados (sem filtro de data) - para métricas como "Leads Hoje"
  const allAdaptedLeads = useMemo(() => {
    if (!leads) return [];
    return leads.map(adaptLeadFromDatabase);
  }, [leads]);

  // Data base para filtros de DATA (Hoje/Semana/Mês/Mês atual):
  // - Sempre usar a data de chegada do lead (data_chegada / dateArrived)
  //   para manter consistência com "Data específica" e com o card "Leads Hoje".
  // - lastInteractionMap continua sendo usado APENAS para ordenação e para o filtro de tempo de interação.
  const getLeadFilterDate = useCallback((lead: ReturnType<typeof adaptLeadFromDatabase>) => {
    // dateArrived é YYYY-MM-DD; usar meio-dia para evitar problemas de timezone
    return toSaoPauloTime(new Date(`${lead.dateArrived}T12:00:00`));
  }, []);

  /** Comparador dentro da coluna (sem prioridade de "Dar atenção" — aplicada em sortLeadsWithAttentionPriority). */
  const compareLeadsInColumn = useCallback(
    (a: Lead, b: Lead) => {
      if (sortBy === 'manual') {
        const localIndexA = manualOrder[a.status as LeadStatus]?.indexOf(a.id);
        const localIndexB = manualOrder[b.status as LeadStatus]?.indexOf(b.id);

        if (
          localIndexA !== undefined &&
          localIndexB !== undefined &&
          localIndexA !== -1 &&
          localIndexB !== -1
        ) {
          return localIndexA - localIndexB;
        }

        const dbOrderA = a.manualOrder ?? 999999;
        const dbOrderB = b.manualOrder ?? 999999;
        if (dbOrderA !== dbOrderB) return dbOrderA - dbOrderB;

        return new Date(b.dateArrived).getTime() - new Date(a.dateArrived).getTime();
      }

      if (sortBy === 'ultima_interacao') {
        const timeA = lastInteractionMap[a.id] || new Date(a.dateArrived).getTime();
        const timeB = lastInteractionMap[b.id] || new Date(b.dateArrived).getTime();
        return timeB - timeA;
      }

      return new Date(b.dateArrived).getTime() - new Date(a.dateArrived).getTime();
    },
    [sortBy, manualOrder, lastInteractionMap],
  );

  const sortLeadsForColumn = useCallback(
    (columnLeads: Lead[]) => sortLeadsWithAttentionPriority(columnLeads, compareLeadsInColumn),
    [compareLeadsInColumn],
  );

  const isGlobalSearchActive = searchQuery.trim().length > 0;

  const filteredLeads = useMemo(() => {
    if (!leads) return [];

    if (isGlobalSearchActive) {
      const matched = allAdaptedLeads.filter((lead) =>
        leadMatchesSearchQuery(lead, searchQuery),
      );
      return sortLeadsWithAttentionPriority(matched, compareLeadsInColumn);
    }

    let filtered = allAdaptedLeads;

    // Filtro 1: Vendedor
    if (selectedVendor === 'unassigned') {
      filtered = filtered.filter(lead =>
        !leads.find(l => l.id === lead.id)?.vendedor_responsavel_id
      );
    } else if (selectedVendor !== 'all') {
      filtered = filtered.filter(lead => {
        const dbLead = leads.find(l => l.id === lead.id);
        return dbLead?.vendedor?.id === selectedVendor;
      });
    }

    // Filtro 2: Etapa/Status
    if (selectedStage !== 'all') {
      filtered = filtered.filter((lead) =>
        leadBelongsInPipelineStage(lead.status, selectedStage, KANBAN_STAGES),
      );
    }

    // Filtro 3: Data (usando timezone de São Paulo)
    // Regras:
    // - custom/date_range: filtra por data de chegada (dateArrived)
    // - today/week/month/current_month: também filtra por data de chegada (via getLeadFilterDate)
    if (dateFilter === 'date_range' && dateRangeFilter?.from) {
      const fromStr = format(dateRangeFilter.from, 'yyyy-MM-dd');
      const toStr = dateRangeFilter.to ? format(dateRangeFilter.to, 'yyyy-MM-dd') : fromStr;
      filtered = filtered.filter(lead => {
        return lead.dateArrived >= fromStr && lead.dateArrived <= toStr;
      });
    } else if (dateFilter === 'custom' && customDateFilter) {
      const customDateStr = format(customDateFilter, 'yyyy-MM-dd');
      filtered = filtered.filter(lead => lead.dateArrived === customDateStr);
    } else if (dateFilter !== 'all') {
      const todaySP = toSaoPauloTime(new Date());
      const todayStr = format(todaySP, 'yyyy-MM-dd');

      filtered = filtered.filter(lead => {
        const leadDateSP = getLeadFilterDate(lead);
        const leadDateStr = format(leadDateSP, 'yyyy-MM-dd');

        switch (dateFilter) {
          case 'today':
            return leadDateStr === todayStr;
          case 'week': {
            const last7Days = new Set(
              Array.from({ length: 7 }, (_, i) =>
                format(subDays(todaySP, i), 'yyyy-MM-dd')
              )
            );
            return last7Days.has(leadDateStr);
          }
          case 'month': {
            const last30Days = new Set(
              Array.from({ length: 30 }, (_, i) =>
                format(subDays(todaySP, i), 'yyyy-MM-dd')
              )
            );
            return last30Days.has(leadDateStr);
          }
          case 'current_month': {
            // Evitar comparação de Date (sensível a timezone/local/UTC).
            // Comparar por strings yyyy-MM-dd (no mesmo padrão usado em 'today/week/month').
            const firstDayOfMonthStr = format(
              new Date(todaySP.getFullYear(), todaySP.getMonth(), 1),
              'yyyy-MM-dd'
            );
            return leadDateStr >= firstDayOfMonthStr && leadDateStr <= todayStr;
          }
          default:
            return true;
        }
      });
    }

    // Filtro 4: Origem (multi-seleção)
    if (selectedOrigins.length > 0) {
      filtered = filtered.filter(lead => selectedOrigins.includes(lead.origin));
    }

    // Filtro 5: Região/Fonte de Tráfego (multi-seleção)
    if (selectedRegioes.length > 0) {
      filtered = filtered.filter(lead => lead.regiao && selectedRegioes.includes(lead.regiao));
    }

    // Filtro 6: Tempo de interação (baseado na legenda de cores)
    if (selectedTimeFilter && timeConfigs) {
      const selectedConfig = timeConfigs.find(c => c.id === selectedTimeFilter);
      if (selectedConfig) {
        const now = Date.now();
        const sortedConfigs = [...timeConfigs].sort((a, b) => a.tempoMinutos - b.tempoMinutos);
        const configIndex = sortedConfigs.findIndex(c => c.id === selectedTimeFilter);
        const isLastConfig = configIndex === sortedConfigs.length - 1;
        
        // Definir limites de tempo: desde o limite anterior até o limite do filtro selecionado
        // Para o último filtro, incluir todos os leads que excedem o limite anterior (sem limite máximo)
        const minMinutes = configIndex > 0 ? sortedConfigs[configIndex - 1].tempoMinutos : 0;
        const maxMinutes = selectedConfig.tempoMinutos;
        
        filtered = filtered.filter(lead => {
          const lastTs = lastInteractionMap[lead.id] || new Date(lead.dateArrived).getTime();
          const elapsedMinutes = (now - lastTs) / (1000 * 60);
          
          // Se for o último filtro, incluir todos os leads com tempo > minMinutes
          if (isLastConfig) {
            return elapsedMinutes > minMinutes;
          }
          return elapsedMinutes > minMinutes && elapsedMinutes <= maxMinutes;
        });
      }
    }

    // Ordenação global (lista); no Kanban cada coluna reordena de novo com sortLeadsForColumn.
    filtered = sortLeadsWithAttentionPriority(filtered, compareLeadsInColumn);

    return filtered;
  }, [
    leads,
    allAdaptedLeads,
    KANBAN_STAGES,
    selectedVendor,
    selectedStage,
    dateFilter,
    customDateFilter,
    dateRangeFilter,
    isGlobalSearchActive,
    searchQuery,
    sortBy,
    lastInteractionMap,
    selectedOrigins,
    selectedRegioes,
    manualOrder,
    getLeadFilterDate,
    selectedTimeFilter,
    timeConfigs,
    compareLeadsInColumn,
  ]);

  /** No Kanban, só leads com status de coluna cadastrada no Pipeline (demais ficam nas páginas Kanban). */
  const pipelineKanbanLeads = useMemo(() => {
    if (isGlobalSearchActive) return filteredLeads;
    return filteredLeads.filter((lead) =>
      leadMatchesAnyPipelineStage(lead.status, KANBAN_STAGES),
    );
  }, [filteredLeads, KANBAN_STAGES, isGlobalSearchActive]);

  useEffect(() => {
    if (viewMode !== 'kanban') return;
    updatePipelineKanbanScrollEdges();
    const el = pipelineKanbanScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updatePipelineKanbanScrollEdges());
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, pipelineKanbanLeads.length, updatePipelineKanbanScrollEdges]);

  const vendors = useMemo(() => {
    if (!users) return [];
    return users.filter(u => u.role === 'vendedor' || u.role === 'admin');
  }, [users]);

  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  // Callback para atualizar timestamp de última interação
  const handleLeadUpdate = useCallback((leadId: number) => {
    if (shouldIgnoreRealtimeLeadUpdate(leadId)) return;
    setRealtimeInteractionMap(prev => ({
      ...prev,
      [leadId]: Date.now()
    }));
    // A lista de leads é atualizada por useKanbanRealtimeSync (patch no cache),
    // sem recarregar o quadro inteiro a cada autosave.
  }, []);

  // Callback para atualizar quando há nova mensagem no WhatsApp
  const handleNewWhatsAppMessage = useCallback((telefone: string) => {
    const incomingPhone = telefone.replace(/\D/g, '');
    const lead = leadsRef.current?.find(l => {
      const leadPhone = l.telefone?.replace(/\D/g, '');
      return leadPhone === incomingPhone;
    });
    
    if (lead) {
      setRealtimeInteractionMap(prev => ({
        ...prev,
        [lead.id]: Date.now()
      }));
    }
    
    if (messagesRefreshTimerRef.current) clearTimeout(messagesRefreshTimerRef.current);
    messagesRefreshTimerRef.current = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['unread-messages'] });
      void queryClient.invalidateQueries({ queryKey: ['lead-last-messages'] });
    }, 500);
  }, [queryClient]);

  // Ativar monitoramento em tempo real
  useLeadRealtime({
    onLeadUpdate: handleLeadUpdate,
    onNewMessage: handleNewWhatsAppMessage,
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const leadId = active.id as number;
    
    // Verificar permissão para editar status
    if (!hasPermission('lead_status', 'edit')) {
      toast.error('Você não tem permissão para mover leads');
      setActiveId(null);
      return;
    }

    const currentLead = filteredLeads.find(l => l.id === leadId);
    if (!currentLead) {
      setActiveId(null);
      return;
    }

    // Buscar lead original do banco para acessar vendedor_responsavel_id
    const dbLead = leads?.find(l => l.id === leadId);

    // Determinar status de destino: over pode ser um card (id numérico) ou a coluna (id = status)
    const overLead = typeof over.id === 'number' ? filteredLeads.find(l => l.id === over.id) : null;
    const targetStatus: string | null = overLead
      ? overLead.status
      : typeof over.id === 'string' && KANBAN_STAGES.includes(over.id)
        ? over.id
        : null;
    
    // CASO 1: Reordenação dentro da mesma coluna (modo manual)
    if (sortBy === 'manual' && targetStatus === currentLead.status) {
      const columnItems = manualOrder[currentLead.status] ?? [];
      const oldIndex = columnItems.indexOf(leadId);
      const newIndex = columnItems.indexOf(over.id as number);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(columnItems, oldIndex, newIndex);
        
        // Atualizar state local imediatamente (UI responsiva)
        setManualOrder(prev => ({
          ...prev,
          [currentLead.status]: newOrder
        }));
        
        // Persistir nova ordem no banco de dados
        console.log('🔄 Salvando nova ordem no banco...');
        
        // Atualizar apenas os leads afetados (entre oldIndex e newIndex)
        const start = Math.min(oldIndex, newIndex);
        const end = Math.max(oldIndex, newIndex);
        const leadsToUpdate = newOrder.slice(start, end + 1);
        
        // Batch update para performance
        Promise.all(
          leadsToUpdate.map((id, idx) => 
            updateLead.mutateAsync({
              id,
              updates: { ordem_manual: start + idx }
            })
          )
        ).then(() => {
          console.log('✅ Ordem salva com sucesso');
        }).catch(error => {
          console.error('❌ Erro ao salvar ordem:', error);
          toast.error('Erro ao salvar ordem dos leads');
          
          // Reverter mudança em caso de erro
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        });
      }
      
      setActiveId(null);
      return;
    }

    // CASO 2: Mudança de coluna
    if (!targetStatus || currentLead.status === targetStatus) {
      setActiveId(null);
      return;
    }
    const newStatus = targetStatus;
    
    updateLead.mutate(
      { 
        id: leadId, 
        updates: { 
          status: newStatus,
          vendedor_responsavel_id: user?.id || dbLead?.vendedor_responsavel_id || null
        } 
      },
      {
        onSuccess: () => {
          // Atualizar timestamp
          setRealtimeInteractionMap(prev => ({
            ...prev,
            [leadId]: Date.now()
          }));

          // Se modo manual, calcular posição exata baseado no over
          if (sortBy === 'manual') {
            setManualOrder(prev => {
              const updated = { ...prev };
              
              // Remover da coluna antiga
              Object.keys(updated).forEach(status => {
                updated[status as LeadStatus] = updated[status as LeadStatus].filter(id => id !== leadId);
              });
              
              // Se over é um lead (inserir logo após ele)
              if (typeof over.id === 'number') {
                const overIndex = updated[newStatus].indexOf(over.id as number);
                if (overIndex !== -1) {
                  updated[newStatus].splice(overIndex + 1, 0, leadId);
                } else {
                  updated[newStatus] = [leadId, ...updated[newStatus]];
                }
              } else {
                // Se over é a coluna (adicionar no topo)
                updated[newStatus] = [leadId, ...updated[newStatus]];
              }
              
              return updated;
            });
          }
          
          setDroppedLeadId(leadId);
          window.setTimeout(() => setDroppedLeadId(null), 450);

          toast.success('Lead movido com sucesso', {
            description: `Status atualizado para: ${newStatus}`,
          });
        },
      }
    );

    setActiveId(null);
  };

  const handleMarkAsSale = (leadId: number) => {
    setPendingSaleLeadId(leadId);
    setShowSaleValueDialog(true);
  };

  const handleConfirmSale = async (value: number) => {
    if (!pendingSaleLeadId) return;

    const statusDestino = vendasGanhosConfig.statusDestinoAoGanhar?.trim();
    if (isLoadingVendasGanhosConfig) {
      toast.error('Aguarde: carregando configuração de Negócios Ganhos…');
      return;
    }
    if (!statusDestino) {
      toast.error('Configure a coluna destino em Negócios Ganhos antes de registrar a venda.');
      return;
    }

    try {
      await updateLead.mutateAsync({
        id: pendingSaleLeadId,
        updates: buildMarkAsWonUpdates(value, statusDestino, user?.id!),
      });
      await liberacaoAposVenda.mutateAsync(pendingSaleLeadId);
      void queryClient.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
      void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] });
      void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-comissao-liberacao'] });
      toast.success('Venda registrada com sucesso!', {
        description: `Valor: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      });
      setShowSaleValueDialog(false);
      setPendingSaleLeadId(null);
    } catch {
      toast.error('Erro ao registrar a venda');
    }
  };

  const activeCard = activeId && leads ? adaptLeadFromDatabase(leads.find(l => l.id === activeId)!) : null;

  // Verificar permissão para acessar a página
  if (isPermissionsLoading) {
    return <GarboBrandLoader variant="inline" size="md" message="Carregando…" />;
  }

  if (!hasPermission('pipeline', 'view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold text-foreground">Acesso Negado</h2>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para visualizar o pipeline.
            Entre em contato com o administrador para solicitar acesso.
          </p>
        </div>
      </div>
    );
  }

  const isInitialLeadsLoad = isLoading && !leads;

  return (
    <div
      className={cn(
        'flex min-w-0 max-w-full flex-col overflow-x-hidden px-2 pb-2 md:px-3 md:pb-3',
        viewMode === 'kanban'
          ? 'h-auto flex-none gap-2 overflow-visible'
          : 'min-h-0 flex-1 space-y-2 overflow-y-auto md:space-y-3',
      )}
    >
      {isInitialLeadsLoad ? (
        <GarboBrandLoader variant="inline" size="md" message="Carregando leads…" />
      ) : (
      <>
      <div className="flex shrink-0 items-center justify-between">
        {/* Botão Exportar Relatório - não exibido para vendedores */}
        {currentUserRole !== 'VENDEDOR' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Relatório</span>
          </Button>
        )}

        <div className="flex items-center gap-2">
          {viewMode === 'kanban' && <KanbanPageZoomControls variant="inline" />}
          {/* Toggle Kanban/Lista */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kanban' | 'list')}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1 md:gap-2 text-xs md:text-sm">
                <LayoutGrid className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1 md:gap-2 text-xs md:text-sm">
                <List className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Lista</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Painel de Métricas — recolhido por padrão para o quadro ter mais altura */}
      <div className="shrink-0">
        <PipelineMetrics 
          leads={filteredLeads}
          allLeads={allAdaptedLeads}
          isLoading={isLoading}
          userRole={currentUserRole}
          dateFilter={dateFilter}
          customDateFilter={customDateFilter}
          selectedOrigins={selectedOrigins}
          selectedRegioes={selectedRegioes}
          onLeadClick={(leadId) => openLeadModal(leadId, true)}
        />
      </div>

      <div className="flex shrink-0 flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:flex-wrap">
          <PipelineLeadSearch
            leads={allAdaptedLeads}
            value={searchQuery}
            onChange={setSearchQuery}
            disabled={isLoading}
            onSelectLead={(leadId) => {
              openLeadModal(leadId, true);
            }}
          />

          {/* Filtro de Ordenação */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as LeadSortBy)}>
            <SelectTrigger className="w-full sm:w-56">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ultima_interacao">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">Última Interação</span>
                  <span className="text-xs text-muted-foreground">
                    Mais recente primeiro
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="data_cadastro">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">Data de Cadastro</span>
                  <span className="text-xs text-muted-foreground">
                    Ordem cronológica
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="manual">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">Manual</span>
                  <span className="text-xs text-muted-foreground">
                    Você controla a posição
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Data */}
          <Select 
            value={dateFilter} 
            onValueChange={(v) => {
              setDateFilter(v as typeof dateFilter);
              if (v !== 'custom') setCustomDateFilter(undefined);
              if (v !== 'date_range') setDateRangeFilter(undefined);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as datas</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="current_month">Mês atual</SelectItem>
              <SelectItem value="week">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="date_range">Período...</SelectItem>
              <SelectItem value="custom">Data específica...</SelectItem>
            </SelectContent>
          </Select>

          {/* DatePicker para intervalo de datas (date_range) */}
          {dateFilter === 'date_range' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-64 justify-start">
                  <CalendarRange className="h-4 w-4 mr-2" />
                  {dateRangeFilter?.from ? (
                    dateRangeFilter.to ? (
                      `${format(dateRangeFilter.from, 'dd/MM', { locale: ptBR })} - ${format(dateRangeFilter.to, 'dd/MM/yyyy', { locale: ptBR })}`
                    ) : (
                      format(dateRangeFilter.from, 'dd/MM/yyyy', { locale: ptBR })
                    )
                  ) : (
                    'Selecione o período'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={dateRangeFilter}
                  onSelect={setDateRangeFilter}
                  numberOfMonths={1}
                  locale={ptBR}
                  className="pointer-events-auto"
                  disabled={(date) => date > toSaoPauloTime(new Date())}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* DatePicker para data customizada */}
          {dateFilter === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-56 justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  {customDateFilter ? format(customDateFilter, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customDateFilter}
                  onSelect={setCustomDateFilter}
                  initialFocus
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Filtro de Vendedor */}
          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filtrar por vendedor">
                {selectedVendor === 'unassigned' ? (
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">?</div>
                    <span>Leads Não Atribuídos</span>
                  </div>
                ) : selectedVendor !== 'all' && (() => {
                  const vendor = vendors.find(u => u.id === selectedVendor);
                  return vendor ? (
                    <div className="flex items-center gap-2">
                      <UserAvatar user={adaptUserForAvatar(vendor)} size="sm" />
                      <span>{vendor.nome}</span>
                    </div>
                  ) : 'Selecione...';
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              <SelectItem value="unassigned">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">?</div>
                  <span>Leads Não Atribuídos</span>
                </div>
              </SelectItem>
              {vendors.map(vendor => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={adaptUserForAvatar(vendor)} size="sm" />
                    <span>{vendor.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Origem (multi-seleção) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-48 justify-start">
                <Target className="h-4 w-4 mr-2" />
                {selectedOrigins.length === 0 
                  ? 'Todas origens' 
                  : `${selectedOrigins.length} origem${selectedOrigins.length > 1 ? 'ns' : ''}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Selecione as origens</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start font-normal"
                  onClick={() => setSelectedOrigins([])}
                >
                  <Check className={`h-4 w-4 mr-2 ${selectedOrigins.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                  Todas as origens
                </Button>
                {origins.map(origin => (
                  <div key={origin.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm">
                    <Checkbox
                      id={`origin-${origin.id}`}
                      checked={selectedOrigins.includes(origin.nome)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedOrigins(prev => [...prev, origin.nome]);
                        } else {
                          setSelectedOrigins(prev => prev.filter(o => o !== origin.nome));
                        }
                      }}
                    />
                    <label 
                      htmlFor={`origin-${origin.id}`} 
                      className="text-sm cursor-pointer flex-1"
                    >
                      {origin.nome}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtro de Região/Fonte de Tráfego (multi-seleção) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-48 justify-start">
                <MapPin className="h-4 w-4 mr-2" />
                {selectedRegioes.length === 0 
                  ? 'Todas regiões' 
                  : `${selectedRegioes.length} região${selectedRegioes.length > 1 ? 'ões' : ''}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Selecione as regiões</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start font-normal"
                  onClick={() => setSelectedRegioes([])}
                >
                  <Check className={`h-4 w-4 mr-2 ${selectedRegioes.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                  Todas as regiões
                </Button>
                {REGIOES_DISPONIVEIS.map(regiao => (
                  <div key={regiao} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm">
                    <Checkbox
                      id={`regiao-${regiao}`}
                      checked={selectedRegioes.includes(regiao)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRegioes(prev => [...prev, regiao]);
                        } else {
                          setSelectedRegioes(prev => prev.filter(r => r !== regiao));
                        }
                      }}
                    />
                    <label 
                      htmlFor={`regiao-${regiao}`} 
                      className="text-sm cursor-pointer flex-1"
                    >
                      {regiao}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtro de Etapa (só visível no modo lista) */}
          {viewMode === 'list' && (
            <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as LeadStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-56">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etapas</SelectItem>
                {KANBAN_STAGES.map(stage => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={() => {
              openLeadModal(null, true);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Novo Lead</span>
            <span className="sm:hidden">Novo</span>
          </Button>

          {currentUserRole === 'ADMIN' && (
            <Button
              variant="outline"
              onClick={() => setShowStagesConfigDialog(true)}
              className="w-full sm:w-auto"
              title="Configurar colunas do Pipeline"
            >
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Configurar colunas</span>
              <span className="sm:hidden">Colunas</span>
            </Button>
          )}
      </div>

      {/* Contador de resultados e Legenda de Cores */}
      <div className="flex shrink-0 flex-col sm:flex-row sm:items-center gap-2 px-1">
        <div className="text-xs md:text-sm text-muted-foreground shrink-0">
          {(viewMode === 'kanban' ? pipelineKanbanLeads : filteredLeads).length}{' '}
          {(viewMode === 'kanban' ? pipelineKanbanLeads : filteredLeads).length === 1
            ? 'lead encontrado'
            : 'leads encontrados'}
          {customDateFilter && dateFilter === 'custom' && ` - ${format(customDateFilter, 'dd/MM/yyyy', { locale: ptBR })}`}
          {isGlobalSearchActive && ' (busca em todos os leads)'}
          {!isGlobalSearchActive &&
            (dateFilter !== 'all' ||
              selectedVendor !== 'all' ||
              selectedStage !== 'all' ||
              selectedOrigins.length > 0 ||
              selectedRegioes.length > 0 ||
              selectedTimeFilter) &&
            ' (com filtros)'}
        </div>
        
      </div>

      {/* Visualização Kanban */}
      {viewMode === 'kanban' && (
        <>
        <KanbanPageZoomControls variant="fixed" transparent={!!markupSheet} />
        <KanbanPageZoomShell
          onZoomApplied={updatePipelineKanbanScrollEdges}
          className="min-h-[min(72vh,calc(100svh-11rem))] overflow-visible"
        >
        <DndContext 
          sensors={sensors} 
          onDragStart={handleDragStart} 
          onDragEnd={handleDragEnd}
          collisionDetection={pointerWithin}
        >
          <div className="relative flex h-auto w-full min-w-0 max-w-full flex-col overflow-visible pb-8">
            <div className="pointer-events-none sticky top-[42vh] z-30 h-0 w-full">
              <div className="pointer-events-none absolute left-2 -translate-y-1/2 md:left-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Rolar colunas para a esquerda"
                  aria-disabled={!pipelineKanbanScrollEdges.canLeft}
                  onClick={() => {
                    if (pipelineKanbanScrollEdges.canLeft) scrollPipelineKanbanHorizontal('prev');
                  }}
                  className={cn(
                    'pointer-events-auto h-11 w-11 shrink-0 rounded-full border-2 border-border bg-background shadow-md hover:bg-accent',
                    !pipelineKanbanScrollEdges.canLeft && 'cursor-default opacity-40',
                  )}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </div>
              <div className="pointer-events-none absolute right-2 -translate-y-1/2 md:right-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Rolar colunas para a direita"
                  aria-disabled={!pipelineKanbanScrollEdges.canRight}
                  onClick={() => {
                    if (pipelineKanbanScrollEdges.canRight) scrollPipelineKanbanHorizontal('next');
                  }}
                  className={cn(
                    'pointer-events-auto h-11 w-11 shrink-0 rounded-full border-2 border-border bg-background shadow-md hover:bg-accent',
                    !pipelineKanbanScrollEdges.canRight && 'cursor-default opacity-40',
                  )}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div
              ref={pipelineKanbanScrollRef}
              onScroll={updatePipelineKanbanScrollEdges}
              className="relative z-[1] flex h-auto min-h-[min(72vh,calc(100svh-11rem))] min-w-0 max-w-full items-stretch gap-3 overflow-x-auto overscroll-x-contain px-10 pb-6 md:gap-3.5 md:px-12 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            >
            {KANBAN_STAGES.map((stage, columnIndex) => {
              const stageLeads = sortLeadsForColumn(
                pipelineKanbanLeads.filter((lead) =>
                  leadBelongsInPipelineStage(lead.status, stage, KANBAN_STAGES),
                ),
              );
              return (
                <div key={stage} className="flex h-auto min-h-[min(72vh,calc(100svh-11rem))] shrink-0 self-stretch">
                <KanbanColumn 
                  title={stage} 
                  count={stageLeads.length} 
                  status={stage}
                  items={stageLeads.map(l => l.id)}
                  colorToken={customStageColorMap[stage] ?? null}
                  columnIndex={columnIndex}
                >
                      {stageLeads.map((lead, cardIndex) => (
                        <KanbanCard
                          key={lead.id}
                          lead={lead}
                          appearIndex={cardIndex}
                          justDropped={droppedLeadId === lead.id}
                          lastInteractionTime={lastInteractionMap[lead.id]}
                          unreadCount={unreadCountMap[lead.id]}
                          hasMeeting={!!leadsMeetingsMap?.has(lead.id)}
                          contratosCount={contratosLeadMap?.get(lead.id) ?? 0}
                          orcamentosCount={orcamentosLeadMap?.get(lead.id) ?? 0}
                          markupResumo={markupResumoMap.get(lead.id) ?? null}
                          lembretesCount={lembretesCountMap.get(lead.id) || 0}
                          lastMessage={lastMessagesMap[lead.id] ?? null}
                          colorToken={customStageColorMap[stage] ?? null}
                          columnIndex={columnIndex}
                          stageTitle={stage}
                          onOpenMarkup={(leadId, orcamentoId) =>
                            setMarkupSheet({
                              leadId,
                              leadNome: lead.name,
                              orcamentoId,
                            })
                          }
                          onClick={() => {
                            openLeadModal(lead.id, true);
                            // Marcar mensagens como lidas ao abrir o card
                            if (lead.phone && unreadCountMap[lead.id] > 0) {
                              markMessagesAsRead.mutate(lead.phone);
                            }
                          }}
                          onMarkAsSale={canMarkSale ? handleMarkAsSale : undefined}
                        />
                      ))}
                </KanbanColumn>
                </div>
              );
            })}
            </div>
          </div>
          <DragOverlay>
            {activeCard && (
              <KanbanCard
                lead={activeCard}
                stageTitle={activeCard.status}
                colorToken={customStageColorMap[activeCard.status] ?? null}
                columnIndex={Math.max(0, KANBAN_STAGES.indexOf(activeCard.status))}
              />
            )}
          </DragOverlay>
        </DndContext>
        <FloatingHorizontalScrollbar
          targetRef={pipelineKanbanScrollRef}
          deps={[pipelineKanbanLeads.length, viewMode]}
        />
        </KanbanPageZoomShell>
        </>
      )}

      {/* Visualização Lista */}
      {viewMode === 'list' && (
        <LeadsListView 
          leads={filteredLeads}
          onLeadClick={(leadId) => {
            openLeadModal(leadId, true);
          }}
        />
      )}

      </>
      )}

      <LeadModal
        isOpen={isModalOpen}
        onClose={closeLeadModal}
        leadId={selectedLeadId}
        isEditMode={isEditMode}
        statusOptions={leadModalStatusOptions}
        allStatusValues={leadModalAllStatusValues}
        newLeadDefaultStatus={newLeadDefaultStatus}
        initialTab={leadModalInitialTab}
        initialIaSubtab={leadModalIaSubtab}
        onLeadDuplicated={(newLeadId) => openLeadModal(newLeadId, true)}
        onLeadCreated={(newLeadId) => openLeadModal(newLeadId, true)}
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

      <SaleValueDialog
        isOpen={showSaleValueDialog}
        onClose={() => {
          setShowSaleValueDialog(false);
          setPendingSaleLeadId(null);
        }}
        onConfirm={handleConfirmSale}
        leadName={
          pendingSaleLeadId
            ? filteredLeads.find((l) => l.id === pendingSaleLeadId)?.name || ''
            : ''
        }
        budgetValue={
          pendingSaleLeadId
            ? filteredLeads.find((l) => l.id === pendingSaleLeadId)?.budgetValue ?? 0
            : 0
        }
        pontuaGarbo={pontuaGarboSale ?? null}
      />

      {/* Modal de Exportar Relatório - só renderiza quando aberto para evitar queries desnecessárias */}
      {showExportDialog && (
        <ExportReportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          leads={filteredLeads}
          allLeads={allAdaptedLeads}
          lastInteractionMap={lastInteractionMap}
        />
      )}
      {showStagesConfigDialog && (
        <PipelineStagesConfigDialog
          open={showStagesConfigDialog}
          onOpenChange={setShowStagesConfigDialog}
        />
      )}
    </div>
  );
}

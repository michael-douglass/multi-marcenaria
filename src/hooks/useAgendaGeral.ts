import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format,
  parseISO,
  addHours,
  startOfDay,
  isSameDay,
  addDays,
  subDays,
  differenceInMinutes,
} from 'date-fns';
import { useAgenda, type AgendaReuniao } from '@/hooks/useAgenda';
import { useLeadLembretes, type LeadLembrete } from '@/hooks/useLeadLembretes';
import { useAgendaPessoal, type TarefaPessoal } from '@/hooks/useAgendaPessoal';
import { useMarketingTasks, type MarketingTask } from '@/hooks/useMarketingTasks';
import { useMarketingContentCards } from '@/hooks/useMarketingConteudo';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAllTitularRecords } from '@/lib/titular-access';
import { supabase } from '@/integrations/supabase/client';
import { matchesAgendaGeralSearch } from '@/lib/agenda-geral-search';
import { userIsTitularDaReuniao } from '@/lib/agenda-reuniao-titulares';
import { toast } from 'sonner';
import { getOcorrenciasNoIntervalo } from '@/lib/agenda-pessoal-recorrencia';
import {
  planBulkRescheduleEvent,
  type BulkRescheduleTimeMode,
} from '@/lib/agenda-postpone';
import type { PessoalAgendaEventData } from '@/components/agenda/TarefaPessoalOcorrenciaDialog';

export type BulkRescheduleOptions =
  | { keepTime: true }
  | { keepTime: false; time: string };

export interface BulkRescheduleResult {
  moved: number;
  skipped: number;
  failed: number;
}

export interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  status: 'pendente' | 'concluido' | 'cancelado' | 'confirmado' | 'em_andamento';
  type: 'tarefa' | 'lembrete' | 'pessoal' | 'conteudo';
  /** Cor hex (#rrggbb) escolhida no item; null/undefined = cor padrão do tipo. */
  color?: string | null;
  /**
   * Sem horário marcado → faixa “Sem horário” no topo.
   * false = aparece na grade mesmo às 00:00.
   */
  untimed?: boolean;
  originalData: unknown;
}

export type AgendaGeralAdminTitularFilterMode = 'all' | 'self' | 'provider';

export interface AgendaGeralAdminTitularFilter {
  filter_mode: AgendaGeralAdminTitularFilterMode;
  filter_titular_id: string | null;
}

const PENDING_STATUSES = new Set<AgendaEvent['status']>(['pendente', 'confirmado', 'em_andamento']);

interface AgendaGeralSources {
  reunioes: AgendaReuniao[];
  lembretes: LeadLembrete[];
  tarefas: TarefaPessoal[];
  tasks: MarketingTask[];
}

export function buildAgendaGeralEvents({
  reunioes,
  lembretes,
  tarefas,
  tasks,
}: AgendaGeralSources): AgendaEvent[] {
  const events: AgendaEvent[] = [];

  reunioes.forEach((r) => {
    events.push({
      id: r.id,
      title: r.titulo || 'Sem título',
      description: r.descricao || r.observacoes,
      start: new Date(r.data_hora_inicio),
      end: new Date(r.data_hora_fim),
      status: r.status,
      type: 'tarefa',
      color: r.cor ?? null,
      untimed: false,
      originalData: r,
    });
  });

  lembretes.forEach((l) => {
    const start = new Date(l.data_hora);
    events.push({
      id: l.id,
      title: `[Lead: ${l.lead?.nome || '?'}] ${l.titulo}`,
      description: l.descricao,
      start,
      end: addHours(start, 1),
      status: l.status,
      type: 'lembrete',
      color: l.cor ?? null,
      untimed: false,
      originalData: l,
    });
  });

  const intervalStart = subDays(new Date(), 60);
  const intervalEnd = addDays(new Date(), 60);

  tarefas.forEach((t) => {
    const ocorrencias = getOcorrenciasNoIntervalo(t, intervalStart, intervalEnd);
    ocorrencias.forEach((o, index) => {
      let start = o.dataOcorrencia;
      const hasHora = Boolean(t.hora);
      if (hasHora) {
        const [h, m] = t.hora!.split(':').map(Number);
        start = new Date(start);
        start.setHours(h, m, 0, 0);
      } else {
        start = startOfDay(start);
      }

      events.push({
        id: `${t.id}-${index}`,
        title: t.evento_id ? `[Evento] ${t.titulo}` : `[Pessoal] ${t.titulo}`,
        description: t.descricao,
        start,
        end: addHours(start, 1),
        status: o.concluida ? 'concluido' : 'pendente',
        type: 'pessoal',
        color: t.cor ?? null,
        untimed: !hasHora,
        originalData: { ...t, dataOcorrencia: o.dataOcorrencia },
      });
    });
  });

  tasks.forEach((t) => {
    const hasHora = Boolean(t.hora_agendada);
    const start = hasHora
      ? parseISO(`${t.data_agendada}T${t.hora_agendada}`)
      : startOfDay(parseISO(t.data_agendada));
    events.push({
      id: t.id,
      title: `[Marketing: ${t.tipo}] ${t.titulo}`,
      description: t.descricao,
      start,
      end: addHours(start, 1),
      status: t.status,
      type: 'conteudo',
      color: null,
      untimed: !hasHora,
      originalData: t,
    });
  });

  return events;
}

export function countPendingEventsToday(events: AgendaEvent[]): number {
  const hoje = new Date();
  return events.filter(
    (e) => isSameDay(e.start, hoje) && PENDING_STATUSES.has(e.status),
  ).length;
}

/** Extrai o user_id responsável/titular de eventos com um único titular. */
function getEventUserId(event: AgendaEvent): string | null {
  switch (event.type) {
    case 'lembrete':
      return (event.originalData as LeadLembrete).titular_id;
    case 'pessoal':
      return (event.originalData as TarefaPessoal).titular_id;
    case 'conteudo':
      return (event.originalData as MarketingTask).criado_por;
    default:
      return null;
  }
}

/**
 * Agenda de tarefas e lembretes de lead usam `titular_ids`.
 * Demais tipos usam um único titular/responsável.
 */
function eventMatchesTitularUser(event: AgendaEvent, userId: string | null | undefined): boolean {
  if (!userId) return false;
  if (event.type === 'tarefa') {
    return userIsTitularDaReuniao(
      (event.originalData as AgendaReuniao).titular_ids,
      userId,
    );
  }
  if (event.type === 'lembrete') {
    const l = event.originalData as LeadLembrete;
    if (l.titular_ids?.length) return l.titular_ids.includes(userId);
    return l.titular_id === userId;
  }
  return getEventUserId(event) === userId;
}

export interface UseAgendaGeralOptions {
  /**
   * Quando true (painel flutuante), ignora a preferência do admin e mostra
   * apenas eventos da própria titularidade. Em agenda-comercial o admin
   * continua podendo escolher ver outros via filtro na tela.
   */
  forceOwnTitular?: boolean;
}

export function useAgendaGeral(options?: UseAgendaGeralOptions) {
  const forceOwnTitular = options?.forceOwnTitular === true;
  const { user, userRole, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = canViewAllTitularRecords(userRole, isSuperAdmin);

  const { reunioes, config, updateReuniao, deleteReuniao, loading: loadingAgenda } = useAgenda();
  const {
    lembretes,
    updateLembrete,
    completeLembrete,
    deleteLembrete,
    isLoading: loadingLembretes,
  } = useLeadLembretes();
  const {
    tarefas,
    updateTarefa,
    deleteTarefa,
    concluirOcorrencia,
    excluirOcorrencia,
    loading: loadingPessoal,
  } = useAgendaPessoal({ forceOwnTitular });
  const {
    tasks,
    updateTask,
    createTask,
    deleteTask,
    completeTask,
    isLoading: loadingMarketing,
  } = useMarketingTasks();
  const { cards } = useMarketingContentCards();
  const { users } = useUsers();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | null>(null);

  const [editingReuniao, setEditingReuniao] = useState<AgendaReuniao | null>(null);
  const [editingLembrete, setEditingLembrete] = useState<LeadLembrete | null>(null);
  const [editingMarketingTask, setEditingMarketingTask] = useState<MarketingTask | null>(null);
  const [editingPessoal, setEditingPessoal] = useState<PessoalAgendaEventData | null>(null);

  // ── Filtro de titularidade (apenas admins) ──────────────────────────────────

  const {
    data: adminGeralPref,
    isFetched: adminGeralPrefFetched,
    isLoading: isLoadingAdminGeralPref,
  } = useQuery({
    queryKey: ['agenda-geral-admin-titular-filter', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('crm_multiempresas_agenda_geral_admin_titular_filter')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Erro ao buscar filtro de titularidade (agenda geral):', error);
        throw error;
      }
      return data as {
        user_id: string;
        filter_mode: AgendaGeralAdminTitularFilterMode;
        filter_titular_id: string | null;
        updated_at: string;
      } | null;
    },
    enabled: !!user?.id && isAdmin,
  });

  const saveAdminGeralTitularFilter = useMutation({
    mutationFn: async (next: AgendaGeralAdminTitularFilter) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (!isAdmin) throw new Error('Apenas administradores podem salvar este filtro');

      const filter_titular_id = next.filter_mode === 'provider' ? next.filter_titular_id : null;
      if (next.filter_mode === 'provider' && !filter_titular_id) {
        throw new Error('Selecione o usuário titular');
      }

      const { error } = await supabase
        .from('crm_multiempresas_agenda_geral_admin_titular_filter')
        .upsert(
          {
            user_id: user.id,
            filter_mode: next.filter_mode,
            filter_titular_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-geral-admin-titular-filter', user?.id] });
    },
    onError: (error) => {
      console.error('Erro ao salvar filtro de titularidade (agenda geral):', error);
      toast.error('Erro ao salvar preferência do filtro');
    },
  });

  const adminGeralTitularFilter = useMemo((): AgendaGeralAdminTitularFilter | null => {
    if (!isAdmin || !adminGeralPrefFetched) return null;
    // Padrão nativo: cada titular vê só os próprios (não “todos”).
    if (!adminGeralPref) return { filter_mode: 'self', filter_titular_id: null };
    return {
      filter_mode: adminGeralPref.filter_mode,
      filter_titular_id: adminGeralPref.filter_titular_id,
    };
  }, [isAdmin, adminGeralPrefFetched, adminGeralPref]);

  // ── Eventos ─────────────────────────────────────────────────────────────────

  const allEvents = useMemo(
    () => buildAgendaGeralEvents({ reunioes, lembretes, tarefas, tasks }),
    [reunioes, lembretes, tarefas, tasks],
  );

  /** Eventos após aplicar o filtro de titularidade do admin (ou forçar só os meus). */
  const titularFilteredEvents = useMemo(() => {
    if (forceOwnTitular) {
      return allEvents.filter((e) => eventMatchesTitularUser(e, user?.id));
    }
    if (!isAdmin) return allEvents;
    // Enquanto a preferência não carrega: só os meus (evita flash com tarefas de outros).
    if (!adminGeralPrefFetched || !adminGeralTitularFilter) {
      return allEvents.filter((e) => eventMatchesTitularUser(e, user?.id));
    }
    const { filter_mode, filter_titular_id } = adminGeralTitularFilter;
    if (filter_mode === 'all') return allEvents;
    if (filter_mode === 'self') {
      return allEvents.filter((e) => eventMatchesTitularUser(e, user?.id));
    }
    if (filter_mode === 'provider' && filter_titular_id) {
      return allEvents.filter((e) => eventMatchesTitularUser(e, filter_titular_id));
    }
    return allEvents.filter((e) => eventMatchesTitularUser(e, user?.id));
  }, [
    allEvents,
    forceOwnTitular,
    isAdmin,
    adminGeralPrefFetched,
    adminGeralTitularFilter,
    user?.id,
  ]);

  const filteredEvents = useMemo(
    () => titularFilteredEvents.filter((event) => matchesAgendaGeralSearch(event, searchTerm)),
    [titularFilteredEvents, searchTerm],
  );

  /** Eventos ativos no calendário (concluídas saem da grade e vão para o histórico). */
  const calendarEvents = useMemo(
    () => titularFilteredEvents.filter((event) => event.status !== 'concluido'),
    [titularFilteredEvents],
  );

  /** Histórico do dia selecionado: concluídas só daquele dia (busca continua com todos os dias). */
  const completedEvents = useMemo(
    () =>
      titularFilteredEvents
        .filter((event) => event.status === 'concluido' && isSameDay(event.start, selectedDate))
        .sort((a, b) => b.start.getTime() - a.start.getTime()),
    [titularFilteredEvents, selectedDate],
  );

  const pendingTodayCount = useMemo(
    () => countPendingEventsToday(titularFilteredEvents),
    [titularFilteredEvents],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  /** Grava a nova data/hora de um evento (sem toast). */
  const persistEventReschedule = async (
    event: AgendaEvent,
    newStart: Date,
    newEnd: Date,
  ) => {
    if (event.type === 'tarefa') {
      const reuniao = event.originalData as AgendaReuniao;
      const duracao = Math.max(1, differenceInMinutes(newEnd, newStart));
      await updateReuniao.mutateAsync({
        id: reuniao.id,
        data_hora_inicio: newStart.toISOString(),
        data_hora_fim: newEnd.toISOString(),
        duracao_minutos: duracao,
      });
      return;
    }

    if (event.type === 'lembrete') {
      const lembrete = event.originalData as LeadLembrete;
      await updateLembrete.mutateAsync({
        id: lembrete.id,
        updates: { data_hora: newStart.toISOString() },
      });
      return;
    }

    if (event.type === 'conteudo') {
      const task = event.originalData as MarketingTask;
      await updateTask({
        id: task.id,
        data_agendada: format(newStart, 'yyyy-MM-dd'),
        hora_agendada: format(newStart, 'HH:mm'),
      });
      return;
    }

    if (event.type === 'pessoal') {
      const pessoal = event.originalData as PessoalAgendaEventData;
      if (
        pessoal.tipo_agendamento === 'recorrente' &&
        !isSameDay(newStart, pessoal.dataOcorrencia)
      ) {
        const err = new Error('RECURRENT_DAY_CHANGE');
        err.name = 'RECURRENT_DAY_CHANGE';
        throw err;
      }
      const updates: Parameters<typeof updateTarefa.mutateAsync>[0] = {
        id: pessoal.id,
        hora: format(newStart, 'HH:mm'),
      };
      if (pessoal.tipo_agendamento === 'unica') {
        updates.data = format(newStart, 'yyyy-MM-dd');
      }
      await updateTarefa.mutateAsync(updates);
    }
  };

  const handleEventDrop = async (event: AgendaEvent, newStart: Date, newEnd: Date) => {
    setIsRescheduling(true);
    try {
      await persistEventReschedule(event, newStart, newEnd);
      // A página permanece no dia visível: o card muda de data, o calendário não acompanha.
      if (isSameDay(event.start, newStart)) {
        toast.success(`Horário atualizado para ${format(newStart, 'HH:mm')}`);
      } else {
        toast.success(`Tarefa adiada para ${format(newStart, 'dd/MM')} às ${format(newStart, 'HH:mm')}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'RECURRENT_DAY_CHANGE') {
        toast.error(
          'Tarefas recorrentes só podem ter o horário alterado no mesmo dia. Edite a tarefa para mudar a data.',
        );
        return;
      }
      toast.error('Não foi possível atualizar o horário');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleBulkReschedule = async (
    events: AgendaEvent[],
    targetDate: Date,
    options: BulkRescheduleOptions,
  ): Promise<BulkRescheduleResult> => {
    const timeMode: BulkRescheduleTimeMode = options.keepTime
      ? { mode: 'keep-time' }
      : { mode: 'set-time', time: options.time };

    setIsRescheduling(true);
    let moved = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (const event of events) {
        const plan = planBulkRescheduleEvent(event, targetDate, timeMode);
        if (plan.skipped) {
          skipped += 1;
          continue;
        }
        try {
          await persistEventReschedule(event, plan.start, plan.end);
          moved += 1;
        } catch {
          failed += 1;
        }
      }

      const parts: string[] = [];
      if (moved > 0) {
        parts.push(
          `${moved} ${moved === 1 ? 'tarefa movida' : 'tarefas movidas'} para ${format(targetDate, 'dd/MM')}`,
        );
      }
      if (skipped > 0) {
        parts.push(
          `${skipped} ${skipped === 1 ? 'ignorada' : 'ignoradas'} (recorrente ou inválida)`,
        );
      }
      if (failed > 0) {
        parts.push(`${failed} ${failed === 1 ? 'falhou' : 'falharam'}`);
      }

      if (moved > 0 && failed === 0) {
        toast.success(parts.join(' · '));
      } else if (moved > 0) {
        toast.warning(parts.join(' · '));
      } else if (skipped > 0 && failed === 0) {
        toast.warning(parts.join(' · ') || 'Nenhuma tarefa foi movida');
      } else {
        toast.error(parts.join(' · ') || 'Não foi possível mover as tarefas');
      }
    } finally {
      setIsRescheduling(false);
    }

    return { moved, skipped, failed };
  };

  const handleEditEvent = (event: AgendaEvent) => {
    if (event.type === 'tarefa') {
      setEditingReuniao(event.originalData as AgendaReuniao);
    } else if (event.type === 'lembrete') {
      setEditingLembrete(event.originalData as LeadLembrete);
    } else if (event.type === 'conteudo') {
      setEditingMarketingTask(event.originalData as MarketingTask);
    } else if (event.type === 'pessoal') {
      setEditingPessoal(event.originalData as PessoalAgendaEventData);
    }
  };

  /** Conclui o item no banco (sem toast). */
  const persistEventComplete = async (event: AgendaEvent) => {
    if (event.status === 'concluido') return;

    if (event.type === 'tarefa') {
      const reuniao = event.originalData as AgendaReuniao;
      await updateReuniao.mutateAsync({ id: reuniao.id, status: 'concluido' });
      return;
    }

    if (event.type === 'lembrete') {
      const lembrete = event.originalData as LeadLembrete;
      await completeLembrete.mutateAsync(lembrete.id);
      return;
    }

    if (event.type === 'conteudo') {
      const task = event.originalData as MarketingTask;
      await completeTask(task.id);
      return;
    }

    if (event.type === 'pessoal') {
      const pessoal = event.originalData as PessoalAgendaEventData;
      await concluirOcorrencia.mutateAsync({
        tarefa: pessoal,
        dataOcorrencia: format(pessoal.dataOcorrencia, 'yyyy-MM-dd'),
        concluida: true,
      });
    }
  };

  /** Conclui o item direto da prévia em hover (sem abrir o modal). */
  const handleCompleteEvent = async (event: AgendaEvent) => {
    if (event.status === 'concluido') return;
    try {
      await persistEventComplete(event);
      if (event.type === 'pessoal') {
        toast.success('Tarefa concluída!');
      }
    } catch {
      toast.error('Não foi possível concluir a tarefa');
    }
  };

  const handleBulkComplete = async (
    events: AgendaEvent[],
  ): Promise<{ completed: number; skipped: number; failed: number }> => {
    setIsRescheduling(true);
    let completed = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (const event of events) {
        if (event.status === 'concluido') {
          skipped += 1;
          continue;
        }
        try {
          await persistEventComplete(event);
          completed += 1;
        } catch {
          failed += 1;
        }
      }

      const parts: string[] = [];
      if (completed > 0) {
        parts.push(
          `${completed} ${completed === 1 ? 'tarefa concluída' : 'tarefas concluídas'}`,
        );
      }
      if (skipped > 0) {
        parts.push(`${skipped} já estavam concluídas`);
      }
      if (failed > 0) {
        parts.push(`${failed} ${failed === 1 ? 'falhou' : 'falharam'}`);
      }

      if (completed > 0 && failed === 0) {
        toast.success(parts.join(' · '));
      } else if (completed > 0) {
        toast.warning(parts.join(' · '));
      } else if (failed > 0) {
        toast.error(parts.join(' · ') || 'Não foi possível concluir as tarefas');
      } else {
        toast.message(parts.join(' · ') || 'Nenhuma tarefa para concluir');
      }
    } finally {
      setIsRescheduling(false);
    }

    return { completed, skipped, failed };
  };

  /** Exclui o item direto da prévia em hover (sem abrir o modal). */
  const handleDeleteEvent = async (event: AgendaEvent) => {
    try {
      if (event.type === 'tarefa') {
        const reuniao = event.originalData as AgendaReuniao;
        await deleteReuniao.mutateAsync(reuniao.id);
      } else if (event.type === 'lembrete') {
        const lembrete = event.originalData as LeadLembrete;
        await deleteLembrete.mutateAsync(lembrete.id);
      } else if (event.type === 'conteudo') {
        const task = event.originalData as MarketingTask;
        await deleteTask(task.id);
      } else if (event.type === 'pessoal') {
        const pessoal = event.originalData as PessoalAgendaEventData;
        if (pessoal.tipo_agendamento === 'unica') {
          await deleteTarefa.mutateAsync(pessoal.id);
        } else {
          await excluirOcorrencia.mutateAsync({
            tarefa: pessoal,
            dataOcorrencia: format(pessoal.dataOcorrencia, 'yyyy-MM-dd'),
          });
        }
      }
    } catch {
      toast.error('Não foi possível excluir a tarefa');
    }
  };

  const handleSearchResultSelect = (event: AgendaEvent) => {
    setSelectedDate(event.start);
    setCalendarFocusDate(event.start);
    handleEditEvent(event);
  };

  const handleSaveReuniao = async (id: string, updates: Partial<AgendaReuniao>) => {
    await updateReuniao.mutateAsync({ id, ...updates });
    setEditingReuniao(null);
  };

  const handleSaveMarketingTask = async (taskData: Parameters<typeof createTask>[0]) => {
    if (editingMarketingTask) {
      await updateTask({ id: editingMarketingTask.id, ...taskData });
    }
    setEditingMarketingTask(null);
  };

  const isLoading =
    loadingAgenda ||
    loadingLembretes ||
    loadingPessoal ||
    loadingMarketing ||
    (isAdmin && (!adminGeralPrefFetched || isLoadingAdminGeralPref));

  return {
    allEvents: titularFilteredEvents,
    calendarEvents,
    completedEvents,
    filteredEvents,
    pendingTodayCount,
    selectedDate,
    setSelectedDate,
    searchTerm,
    setSearchTerm,
    isRescheduling,
    calendarFocusDate,
    setCalendarFocusDate,
    editingReuniao,
    setEditingReuniao,
    editingLembrete,
    setEditingLembrete,
    editingMarketingTask,
    setEditingMarketingTask,
    editingPessoal,
    setEditingPessoal,
    reunioes,
    config,
    cards,
    users,
    updateReuniao,
    handleEventDrop,
    handleBulkReschedule,
    handleBulkComplete,
    handleEditEvent,
    handleCompleteEvent,
    handleDeleteEvent,
    handleSearchResultSelect,
    handleSaveReuniao,
    handleSaveMarketingTask,
    isLoading,
    // Titularidade (admin only)
    isAdminAgendaGeral: isAdmin,
    adminGeralTitularFilter,
    saveAdminGeralTitularFilter,
  };
}

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import type { KanbanPageComplete } from '@/types/kanban-config';
import { computeKanbanLeadFetchScope, getKanbanLeadsScopeCacheKey } from '@/lib/kanban-leads-scope';
import {
  enrichLeadsWithChatData,
  fetchLeadsRawForKanbanScope,
  getDataChegadaRangeForCalendarMonth,
} from '@/lib/leads-fetch-helpers';
import type { LeadWithVendor } from '@/hooks/useLeads';

/** `all` = sem filtro de data; `month` = data_chegada dentro do mês/ano (inclusive). */
export type KanbanMonthPeriodFilter =
  | { type: 'all' }
  | { type: 'month'; year: number; month: number };

/**
 * Carrega apenas leads que podem aparecer no Kanban da página (status das fontes + overrides).
 * Opcionalmente restringe por mês de **data_chegada** para carregar menos dados.
 *
 * - `placeholderData: keepPreviousData`: mantém os cards anteriores em tela enquanto refaz a query
 *   (evita flash de "Carregando..." ao trocar de página/Kanban e ao revalidar via Realtime).
 * - Cache persistido em localStorage (PersistQueryClientProvider em App.tsx) — abre instantâneo
 *   na próxima visita usando os dados da última sessão.
 */
export function useLeadsForKanbanPage(
  page: KanbanPageComplete | null,
  periodFilter: KanbanMonthPeriodFilter,
) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();

  const periodKey =
    periodFilter.type === 'all' ? 'all' : `${periodFilter.year}-${periodFilter.month}`;

  return useQuery({
    queryKey: [
      'leads',
      'kanban-page',
      user?.id,
      schemaEmpresa ?? 'master',
      page?.id,
      page ? getKanbanLeadsScopeCacheKey(page) : '',
      periodKey,
    ],
    queryFn: async (): Promise<LeadWithVendor[]> => {
      if (!page) return [];

      const scope = computeKanbanLeadFetchScope(page);
      if (scope.statuses.length === 0 && scope.leadIds.length === 0) {
        return [];
      }

      const dataChegadaRange =
        periodFilter.type === 'month'
          ? getDataChegadaRangeForCalendarMonth(periodFilter.year, periodFilter.month)
          : null;

      const raw = await fetchLeadsRawForKanbanScope(scope, dataChegadaRange, schemaEmpresa);
      return enrichLeadsWithChatData(raw, schemaEmpresa);
    },
    enabled: !!user?.id && queriesReady && !!page,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });
}

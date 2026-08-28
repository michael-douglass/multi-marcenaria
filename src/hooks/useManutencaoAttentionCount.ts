import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import {
  findManutencaoKanbanPage,
  getManutencaoAttentionOverrides,
  getManutencaoAttentionStatuses,
} from '@/lib/manutencao-attention';

const MASTER_LEADS = 'CRM-multi-empresas>leads<';

/**
 * Conta cards nas colunas "Manutenção solicitada" + "Manutenção agendada"
 * para exibir no menu lateral (quantos ainda precisam de atenção).
 */
export function useManutencaoAttentionCount() {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { pages, isLoading: isLoadingPages } = useKanbanConfig();

  const page = useMemo(() => findManutencaoKanbanPage(pages), [pages]);
  const statuses = useMemo(
    () => (page ? getManutencaoAttentionStatuses(page) : []),
    [page],
  );
  const overrides = useMemo(
    () => (page ? getManutencaoAttentionOverrides(page) : { includeIds: [], excludeIds: [] }),
    [page],
  );

  const query = useQuery({
    queryKey: [
      'leads',
      'manutencao-attention-count',
      schemaEmpresa ?? 'master',
      page?.id ?? null,
      statuses.slice().sort().join('\u001f'),
      overrides.includeIds.slice().sort((a, b) => a - b).join(','),
      overrides.excludeIds.slice().sort((a, b) => a - b).join(','),
    ],
    enabled: queriesReady && !!page && statuses.length > 0,
    staleTime: 1000 * 20,
    queryFn: async (): Promise<number> => {
      const leadsTable = table('leads', MASTER_LEADS);
      const matchedIds = new Set<number>();

      const { data: byStatus, error: statusError } = await db
        .from(leadsTable)
        .select('id')
        .in('status', statuses);

      if (statusError) throw statusError;
      for (const row of byStatus ?? []) {
        const id = Number((row as { id: number }).id);
        if (Number.isFinite(id)) matchedIds.add(id);
      }

      for (const id of overrides.excludeIds) {
        matchedIds.delete(id);
      }

      if (overrides.includeIds.length > 0) {
        const missingIncludes = overrides.includeIds.filter((id) => !matchedIds.has(id));
        if (missingIncludes.length > 0) {
          const { data: includedRows, error: includeError } = await db
            .from(leadsTable)
            .select('id')
            .in('id', missingIncludes);

          if (includeError) throw includeError;
          for (const row of includedRows ?? []) {
            const id = Number((row as { id: number }).id);
            if (Number.isFinite(id)) matchedIds.add(id);
          }
        }
      }

      return matchedIds.size;
    },
  });

  return {
    count: query.data ?? 0,
    isLoading: isLoadingPages || query.isLoading,
    page,
  };
}

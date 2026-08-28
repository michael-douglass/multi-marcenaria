import { useMemo } from 'react';
import { useKanbanConfig } from '@/hooks/useKanbanConfig';
import { usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import {
  buildAllLeadStatusFilterOptions,
  pipelineStatusFilterValues,
  type PipelineStatusFilterOption,
} from '@/lib/pipeline-status-options';

/**
 * Lista completa de status/colunas para selects (Pipeline + páginas Kanban + extras).
 * Mesma fonte usada nos filtros da página Leads.
 */
export function usePipelineStatusSelectOptions(extraStatuses: string[] = []) {
  const { stages } = usePipelineCustomStages();
  const { pages: kanbanPages } = useKanbanConfig();

  const extraKey = extraStatuses
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\u0001');

  return useMemo(
    () =>
      pipelineStatusFilterValues(
        buildAllLeadStatusFilterOptions(stages, kanbanPages, extraKey ? extraKey.split('\u0001') : []),
      ),
    [stages, kanbanPages, extraKey],
  );
}

/** Opções com rótulo (coluna Kanban) e valor gravado em leads.status — para selects de configuração. */
export function usePipelineStatusFilterOptions(extraStatuses: string[] = []) {
  const { stages } = usePipelineCustomStages();
  const { pages: kanbanPages } = useKanbanConfig();

  const extraKey = extraStatuses
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\u0001');

  return useMemo(() => {
    const options = buildAllLeadStatusFilterOptions(
      stages,
      kanbanPages,
      extraKey ? extraKey.split('\u0001') : [],
    );
    return options.filter((o): o is PipelineStatusFilterOption => o.value !== 'all');
  }, [stages, kanbanPages, extraKey]);
}

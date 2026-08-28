import type { KanbanPageComplete } from '@/types/kanban-config';
import { getTargetStatusForKanbanColumn } from '@/lib/kanban-status-options';

export interface KanbanLeadFetchScope {
  statuses: string[];
  leadIds: number[];
}

/**
 * Define o subconjunto mínimo de leads a buscar para um Kanban configurável:
 * - status alvo de cada coluna (fonte ativa ou nome da coluna)
 * - nome da coluna (leads salvos com status = nome ao arrastar)
 * - todos os valor_fonte das fontes ativas (legado / múltiplas fontes)
 * - IDs citados em overrides (incluir/excluir), para não perder cartões só manuais
 *
 * Filtros finos de origem/região continuam no resolver no cliente (sobre esse subconjunto).
 */
export function computeKanbanLeadFetchScope(page: KanbanPageComplete): KanbanLeadFetchScope {
  const statuses = new Set<string>();
  const leadIds = new Set<number>();

  for (const column of page.columns) {
    if (!column.ativo) continue;

    for (const override of column.overrides) {
      if (override.ativo) {
        leadIds.add(override.leadId);
      }
    }

    const targetStatus = getTargetStatusForKanbanColumn(column);
    if (targetStatus) statuses.add(targetStatus);

    const nomeColuna = column.nome.trim();
    if (nomeColuna) statuses.add(nomeColuna);

    for (const source of column.sources) {
      if (!source.ativo) continue;
      const v = source.valorFonte?.trim();
      if (v) statuses.add(v);
    }
  }

  return {
    statuses: [...statuses],
    leadIds: [...leadIds],
  };
}

export function getKanbanLeadsScopeCacheKey(page: KanbanPageComplete): string {
  const { statuses, leadIds } = computeKanbanLeadFetchScope(page);
  return `${[...statuses].sort().join('\u001f')}|\u001f|${[...leadIds].sort((a, b) => a - b).join(',')}`;
}

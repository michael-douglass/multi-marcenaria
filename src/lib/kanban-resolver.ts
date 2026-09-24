import type { Lead } from '@/types/selletos';
import type { KanbanCardOverride, KanbanColumnSource, KanbanPageComplete } from '@/types/kanban-config';
import { decodeKanbanFiltroLista } from '@/lib/kanban-filter-encoding';
import { sortLeadsWithAttentionPriority } from '@/lib/lead-sort';

interface ResolveArgs {
  page: KanbanPageComplete;
  leads: Lead[];
  /** Leads com projeto feito pulsando — sobem ao topo da coluna. */
  elevateLeadIds?: ReadonlySet<number>;
}

const matchesSource = (lead: Lead, source: KanbanColumnSource): boolean => {
  if (!source.ativo) return false;

  if (lead.status !== source.valorFonte) return false;

  const filtroOrigens = decodeKanbanFiltroLista(source.filtroOrigem);
  if (filtroOrigens !== null && !filtroOrigens.includes(lead.origin ?? '')) return false;

  const filtroRegioes = decodeKanbanFiltroLista(source.filtroRegiao);
  if (filtroRegioes !== null && !filtroRegioes.includes(lead.regiao ?? '')) return false;
  if (source.filtroDataDe && lead.dateArrived < source.filtroDataDe) return false;
  if (source.filtroDataAte && lead.dateArrived > source.filtroDataAte) return false;

  return true;
};

const applyOverrides = (baseLeadIds: Set<number>, overrides: KanbanCardOverride[]): Set<number> => {
  const result = new Set(baseLeadIds);
  overrides
    .filter((override) => override.ativo)
    .forEach((override) => {
      if (override.acao === 'exclude') {
        result.delete(override.leadId);
        return;
      }
      result.add(override.leadId);
    });
  return result;
};

export function resolveKanbanColumns({ page, leads, elevateLeadIds }: ResolveArgs) {
  return page.columns
    .filter((column) => column.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((column) => {
      const leadIds = new Set<number>();

      const activeSources = column.sources.filter((source) => source.ativo);

      leads.forEach((lead) => {
        const matched =
          activeSources.length > 0
            ? activeSources.some((source) => matchesSource(lead, source))
            : lead.status === column.nome;
        if (matched) {
          leadIds.add(lead.id);
        }
      });

      const finalLeadIds = applyOverrides(leadIds, column.overrides);
      const items = sortLeadsWithAttentionPriority(
        leads.filter((lead) => finalLeadIds.has(lead.id)),
        (a, b) =>
          new Date(b.dateArrived).getTime() - new Date(a.dateArrived).getTime(),
        elevateLeadIds,
      );

      return {
        id: column.id,
        title: column.nome,
        items,
      };
    });
}

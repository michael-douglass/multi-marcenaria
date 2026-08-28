import type { Lead } from '@/types/selletos';
import type { KanbanPageComplete } from '@/types/kanban-config';
import { resolveKanbanColumns } from '@/lib/kanban-resolver';
import {
  buildKanbanSomaVariableKey,
  type KanbanSomaCampo,
  parseKanbanSomaVariable,
} from '@/lib/orcamento-formula';

/** Soma valores dos leads que estão em uma coluna de página Kanban personalizada. */
export function computeKanbanColumnSums(
  pages: KanbanPageComplete[],
  leads: Lead[],
): Record<string, number> {
  const sums: Record<string, number> = {};

  for (const page of pages) {
    if (!page.ativo) continue;
    const columns = resolveKanbanColumns({ page, leads });
    for (const column of columns) {
      const campo: KanbanSomaCampo = 'orcamento';
      let total = 0;
      for (const lead of column.items) {
        total += leadValueForCampo(lead, campo);
      }
      sums[buildKanbanSomaVariableKey(column.id, campo)] = total;

      const negocioKey = buildKanbanSomaVariableKey(column.id, 'negocio');
      sums[negocioKey] = column.items.reduce((s, l) => s + leadValueForCampo(l, 'negocio'), 0);

      const qtdKey = buildKanbanSomaVariableKey(column.id, 'quantidade');
      sums[qtdKey] = column.items.length;
    }
  }

  return sums;
}

function leadValueForCampo(lead: Lead, campo: KanbanSomaCampo): number {
  switch (campo) {
    case 'negocio':
      return lead.dealValue || 0;
    case 'quantidade':
      return 1;
    case 'orcamento':
    default:
      return lead.budgetValue || 0;
  }
}

/** Extrai IDs de colunas Kanban referenciados em fórmulas. */
export function extractKanbanColumnIdsFromFormulas(formulas: string[]): string[] {
  const ids = new Set<string>();
  for (const formula of formulas) {
    const matches = formula.match(/\[([^\]]+)\]/g);
    if (!matches) continue;
    for (const match of matches) {
      const parsed = parseKanbanSomaVariable(match.slice(1, -1).trim());
      if (parsed) ids.add(parsed.columnId);
    }
  }
  return [...ids];
}

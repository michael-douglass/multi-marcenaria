import type { KanbanColumnWithRules, KanbanPageComplete } from '@/types/kanban-config';

export interface KanbanStatusOption {
  /** Nome da coluna exibido no select (ex.: "Orçamentos a fazer") */
  label: string;
  /** Valor salvo em leads.status (ex.: "Enviou orçamento") */
  value: string;
}

/** Mesma regra usada ao soltar o card em uma coluna do Kanban configurável. */
export function getTargetStatusForKanbanColumn(column: KanbanColumnWithRules): string {
  const sourceStatus = column.sources.find((source) => source.ativo && source.tipoFonte === 'status');
  if (sourceStatus?.valorFonte?.trim()) {
    return sourceStatus.valorFonte.trim();
  }
  return column.nome.trim();
}

/** Opções de status alinhadas às colunas ativas da página Kanban (ordem das colunas). */
export function buildKanbanPageStatusOptions(
  page: KanbanPageComplete | null | undefined,
  currentStatus?: string | null,
): KanbanStatusOption[] {
  if (!page) return [];

  const byValue = new Map<string, string>();

  for (const column of page.columns.filter((c) => c.ativo).sort((a, b) => a.ordem - b.ordem)) {
    const value = getTargetStatusForKanbanColumn(column);
    if (!value) continue;
    if (!byValue.has(value)) {
      byValue.set(value, column.nome);
    }
  }

  const options: KanbanStatusOption[] = [...byValue.entries()].map(([value, label]) => ({
    label,
    value,
  }));

  const current = currentStatus?.trim();
  if (current && !byValue.has(current)) {
    options.push({ label: current, value: current });
  }

  return options;
}

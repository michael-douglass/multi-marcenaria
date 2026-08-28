import type { KanbanPageComplete } from '@/types/kanban-config';

/** Colunas da página Manutenção que exigem atenção no dia a dia. */
export const MANUTENCAO_ATTENTION_COLUMN_NAMES = [
  'Manutenção solicitada',
  'Manutenção agendada',
] as const;

const ATTENTION_NAMES = new Set(
  MANUTENCAO_ATTENTION_COLUMN_NAMES.map((name) => normalizeKanbanLabel(name)),
);

export function normalizeKanbanLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export function isManutencaoKanbanPage(page: Pick<KanbanPageComplete, 'nome' | 'slug'>): boolean {
  return (
    normalizeKanbanLabel(page.slug) === 'manutencao' ||
    normalizeKanbanLabel(page.nome) === 'manutencao'
  );
}

export function isManutencaoAttentionColumn(columnName: string): boolean {
  return ATTENTION_NAMES.has(normalizeKanbanLabel(columnName));
}

export function findManutencaoKanbanPage(
  pages: KanbanPageComplete[],
): KanbanPageComplete | undefined {
  return pages.find((page) => page.ativo && isManutencaoKanbanPage(page));
}

/**
 * Statuses que alimentam as colunas de atenção (fontes ativas ou nome da coluna).
 */
export function getManutencaoAttentionStatuses(page: KanbanPageComplete): string[] {
  const statuses = new Set<string>();

  for (const column of page.columns) {
    if (!column.ativo || !isManutencaoAttentionColumn(column.nome)) continue;

    const activeSources = column.sources.filter((source) => source.ativo);
    if (activeSources.length > 0) {
      for (const source of activeSources) {
        const value = source.valorFonte?.trim();
        if (value) statuses.add(value);
      }
      continue;
    }

    const nome = column.nome.trim();
    if (nome) statuses.add(nome);
  }

  return [...statuses];
}

export function getManutencaoAttentionOverrides(page: KanbanPageComplete): {
  includeIds: number[];
  excludeIds: number[];
} {
  const includeIds = new Set<number>();
  const excludeIds = new Set<number>();

  for (const column of page.columns) {
    if (!column.ativo || !isManutencaoAttentionColumn(column.nome)) continue;

    for (const override of column.overrides) {
      if (!override.ativo) continue;
      if (override.acao === 'include') includeIds.add(override.leadId);
      if (override.acao === 'exclude') excludeIds.add(override.leadId);
    }
  }

  return {
    includeIds: [...includeIds],
    excludeIds: [...excludeIds],
  };
}

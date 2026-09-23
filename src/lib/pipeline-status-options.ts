import {
  DEFAULT_PIPELINE_STAGES,
  type PipelineCustomStage,
} from '@/hooks/usePipelineCustomStages';
import type { KanbanPageComplete } from '@/types/kanban-config';
import { getTargetStatusForKanbanColumn } from '@/lib/kanban-status-options';
import {
  LEGACY_VENDA_PERDIDA_NAO_MATRICULADO,
  ORCAMENTOS_PERDIDOS_STATUS,
} from '@/lib/crm-portal';

export interface PipelineStatusFilterOption {
  value: string;
  label: string;
}

export interface LeadModalStatusOption {
  value: string;
  label: string;
  /** Funil ou página de origem da coluna (ex.: Pipeline principal, Orçamentos) */
  group?: string;
  /** Ordem da coluna no sistema (pipeline.ordem / kanban_columns.ordem). */
  ordem?: number;
  /** Ordem da página/grupo no sistema (0 = pipeline, depois kanban_pages.ordem). */
  groupOrdem?: number;
}

export interface LeadStatusDisplayInfo {
  value: string;
  columnLabel: string;
  /** Nome da página/funil (ex.: Pipeline principal, Orçamentos internos). */
  pageLabel: string | null;
}

export const PIPELINE_GROUP_LABEL = 'Pipeline principal';

/** Localiza a opção do status atual (coluna + página). */
export function resolveLeadStatusDisplay(
  status: string | null | undefined,
  options: LeadModalStatusOption[] | null | undefined,
): LeadStatusDisplayInfo {
  const value = status?.trim() || '';
  if (!value) {
    return { value: '', columnLabel: 'Sem coluna', pageLabel: null };
  }
  const match = options?.find((opt) => opt.value === value);
  if (match) {
    return {
      value,
      columnLabel: match.label.trim() || value,
      pageLabel: match.group?.trim() || null,
    };
  }
  return { value, columnLabel: value, pageLabel: null };
}

/** Agrupa opções na ordem do sistema (já ordenadas em buildAllLeadModalStatusOptions). */
export function groupLeadModalStatusOptions(
  options: LeadModalStatusOption[],
): Map<string, LeadModalStatusOption[]> {
  const groups = new Map<string, LeadModalStatusOption[]>();
  for (const opt of options) {
    const group = opt.group?.trim() || 'Outros';
    const list = groups.get(group) ?? [];
    list.push(opt);
    groups.set(group, list);
  }
  return groups;
}

/**
 * Opções de status das páginas Kanban: rótulo = nome da coluna, valor = status gravado no lead.
 * Evita salvar o nome da coluna quando a fonte ativa usa outro valor em leads.status.
 */
export function collectKanbanPageStatusFilterOptions(
  pages: KanbanPageComplete[],
): PipelineStatusFilterOption[] {
  const byValue = new Map<string, string>();

  for (const page of pages.filter((p) => p.ativo)) {
    for (const column of page.columns.filter((c) => c.ativo).sort((a, b) => a.ordem - b.ordem)) {
      const value = getTargetStatusForKanbanColumn(column);
      if (!value || byValue.has(value)) continue;
      byValue.set(value, column.nome.trim() || value);
    }
  }

  return [...byValue.entries()].map(([value, label]) => ({ value, label }));
}

/** Status usados em páginas Kanban configuráveis (valor salvo em leads.status). */
export function collectKanbanPageStatusValues(pages: KanbanPageComplete[]): string[] {
  return collectKanbanPageStatusFilterOptions(pages).map((o) => o.value);
}

/**
 * Opções de status para a página Leads: pipeline + todas as páginas Kanban + valores já usados nos leads.
 */
export function buildAllLeadStatusFilterOptions(
  activeStages: PipelineCustomStage[],
  kanbanPages: KanbanPageComplete[],
  extraStatuses: string[] = [],
): PipelineStatusFilterOption[] {
  const kanbanOptions = collectKanbanPageStatusFilterOptions(kanbanPages);
  const extraOptions: PipelineStatusFilterOption[] = extraStatuses
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .map((value) => ({ value, label: value }));

  const seen = new Set<string>();
  const mergedExtras: PipelineStatusFilterOption[] = [];
  for (const opt of [...kanbanOptions, ...extraOptions]) {
    if (seen.has(opt.value)) continue;
    seen.add(opt.value);
    mergedExtras.push(opt);
  }

  return buildPipelineStatusFilterOptions(activeStages, mergedExtras);
}

/** Opções do filtro de status — mesma fonte do Pipeline e do modal de lead. */
export function buildPipelineStatusFilterOptions(
  activeStages: PipelineCustomStage[],
  extraOptions: PipelineStatusFilterOption[] = [],
): PipelineStatusFilterOption[] {
  const stageNames =
    activeStages.length > 0
      ? activeStages.map((s) => s.nome)
      : DEFAULT_PIPELINE_STAGES.map((s) => s.nome);

  const seen = new Set<string>();
  const options: PipelineStatusFilterOption[] = [];

  for (const nome of stageNames) {
    if (!nome.trim() || seen.has(nome)) continue;
    if (nome.trim() === LEGACY_VENDA_PERDIDA_NAO_MATRICULADO) continue;
    seen.add(nome);
    options.push({ value: nome, label: nome });
  }

  for (const opt of extraOptions) {
    const value = opt.value?.trim();
    if (!value || seen.has(value)) continue;
    if (value === LEGACY_VENDA_PERDIDA_NAO_MATRICULADO) continue;
    seen.add(value);
    const label = opt.label?.trim() || value;
    options.push({ value, label });
  }

  return [{ value: 'all', label: 'Todos os Status' }, ...options];
}

/**
 * Opções do select de status no modal do lead: colunas do pipeline + todas as páginas Kanban ativas.
 * A ordem segue exatamente o sistema (pipeline.ordem e kanban_columns.ordem), nunca alfabética.
 */
export function buildAllLeadModalStatusOptions(
  activeStages: PipelineCustomStage[],
  kanbanPages: KanbanPageComplete[],
  currentStatus?: string | null,
): LeadModalStatusOption[] {
  const byValue = new Map<string, LeadModalStatusOption>();
  const ordered: LeadModalStatusOption[] = [];

  const pushUnique = (opt: LeadModalStatusOption) => {
    if (!opt.value || byValue.has(opt.value)) return;
    // Status legado: não oferece mais "Não Matriculado" no select.
    if (opt.value === LEGACY_VENDA_PERDIDA_NAO_MATRICULADO) return;
    byValue.set(opt.value, opt);
    ordered.push(opt);
  };

  const stages =
    activeStages.length > 0
      ? [...activeStages].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
      : DEFAULT_PIPELINE_STAGES.map((s, index) => ({
          nome: s.nome,
          ordem: index,
        }));

  stages.forEach((stage, index) => {
    const value = stage.nome.trim();
    if (!value) return;
    pushUnique({
      value,
      label: value,
      group: PIPELINE_GROUP_LABEL,
      ordem: 'ordem' in stage ? stage.ordem : index,
      groupOrdem: 0,
    });
  });

  const activePages = [...kanbanPages.filter((p) => p.ativo)].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  activePages.forEach((page, pageIndex) => {
    const groupName = page.nome.trim() || 'Kanban';
    const groupOrdem = page.ordem ?? pageIndex + 1;
    const columns = [...page.columns.filter((c) => c.ativo)].sort(
      (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
    );

    for (const column of columns) {
      const value = getTargetStatusForKanbanColumn(column);
      if (!value) continue;
      const columnLabel = column.nome.trim() || value;
      const existing = byValue.get(value);
      if (existing) {
        // Mesmo status em outra página: mantém a 1ª ocorrência (ordem do sistema),
        // mas anota o nome da coluna desta página quando diferente.
        if (existing.group !== groupName && existing.label !== columnLabel) {
          existing.label = `${existing.label} · ${columnLabel}`;
        }
        continue;
      }
      pushUnique({
        value,
        label: columnLabel,
        group: groupName,
        ordem: column.ordem,
        groupOrdem,
      });
    }
  });

  const current = currentStatus?.trim();
  if (current && current !== LEGACY_VENDA_PERDIDA_NAO_MATRICULADO && !byValue.has(current)) {
    ordered.push({
      value: current,
      label: current,
      group: 'Status atual',
      ordem: Number.MAX_SAFE_INTEGER,
      groupOrdem: Number.MAX_SAFE_INTEGER,
    });
  }

  return ordered;
}

/** Valores de status (sem "all") para selects que precisam listar pipeline + Kanbans. */
export function pipelineStatusFilterValues(
  options: PipelineStatusFilterOption[],
): string[] {
  return options.filter((o) => o.value !== 'all').map((o) => o.value);
}

/** Primeira coluna do pipeline (caixa de novos leads). */
export function getPipelineInboxStageName(pipelineStages: string[]): string {
  return pipelineStages[0]?.trim() || DEFAULT_PIPELINE_STAGES[0].nome;
}

/**
 * Corrige variações de texto (Kanban antigo, digitação, maiúsculas) para o nome da coluna do Pipeline.
 */
const PIPELINE_STATUS_ALIASES: Record<string, string> = {
  'orçamentos ja enviados': 'Enviou orçamento',
  'orcamentos ja enviados': 'Enviou orçamento',
  'orçamento ja enviado': 'Enviou orçamento',
  'reunião marcada': 'Reunião marcada',
  'reuniao marcada': 'Reunião marcada',
  'reunião feita': 'Reunião feita',
  'reuniao feita': 'Reunião feita',
  [LEGACY_VENDA_PERDIDA_NAO_MATRICULADO.toLowerCase()]: ORCAMENTOS_PERDIDOS_STATUS,
  'venda perdida (nao matriculado)': ORCAMENTOS_PERDIDOS_STATUS,
};

export function normalizeLeadStatusForPipeline(
  leadStatus: string | undefined | null,
  pipelineStages: string[],
): string {
  const trimmed = (leadStatus || '').trim();
  if (!trimmed) return '';

  const alias = PIPELINE_STATUS_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  const caseMatch = pipelineStages.find(
    (stage) => stage.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (caseMatch) return caseMatch;

  return trimmed;
}

/**
 * Define em qual coluna do Pipeline principal o lead aparece.
 * A coluna de novos leads aceita apenas status vazio ou igual ao nome dessa coluna (ex.: "Novo Lead").
 */
export function leadBelongsInPipelineStage(
  leadStatus: string | undefined | null,
  stage: string,
  pipelineStages: string[],
): boolean {
  const raw = (leadStatus || '').trim();
  const normalized = normalizeLeadStatusForPipeline(leadStatus, pipelineStages);
  const inboxStage = getPipelineInboxStageName(pipelineStages);
  const stageKey = stage.trim().toLowerCase();

  if (stage === inboxStage) {
    return !normalized || normalized === inboxStage;
  }

  if (normalized === stage) return true;
  if (raw && raw.toLowerCase() === stageKey) return true;
  if (normalized && normalized.toLowerCase() === stageKey) return true;

  return false;
}

/** Verifica se o lead cabe em alguma coluna fixa configurada no Pipeline. */
export function leadMatchesAnyPipelineStage(
  leadStatus: string | undefined | null,
  pipelineStages: string[],
): boolean {
  return pipelineStages.some((stage) =>
    leadBelongsInPipelineStage(leadStatus, stage, pipelineStages),
  );
}

/**
 * Colunas exibidas no Pipeline principal: somente etapas cadastradas em pipeline_custom_stages.
 * Status de outras páginas Kanban (ex.: "Enviou orçamento") não geram colunas extras aqui.
 */
export function buildPipelineDisplayStages(pipelineStages: string[]): string[] {
  return [...pipelineStages];
}

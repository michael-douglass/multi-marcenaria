import { PIPELINE_ETAPAS_PADRAO } from '@/lib/kanbans-padrao';

export type KanbanSourceType = 'status' | 'column';
export type KanbanOverrideAction = 'include' | 'exclude';

export interface KanbanPage {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface KanbanColumn {
  id: string;
  paginaId: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface KanbanColumnSource {
  id: string;
  colunaId: string;
  tipoFonte: KanbanSourceType;
  valorFonte: string;
  filtroOrigem: string | null;
  filtroRegiao: string | null;
  filtroVendedorId: string | null;
  filtroDataDe: string | null;
  filtroDataAte: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface KanbanCardOverride {
  id: string;
  colunaId: string;
  leadId: number;
  acao: KanbanOverrideAction;
  ativo: boolean;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface KanbanColumnWithRules extends KanbanColumn {
  sources: KanbanColumnSource[];
  overrides: KanbanCardOverride[];
}

export interface KanbanPageComplete extends KanbanPage {
  columns: KanbanColumnWithRules[];
}

/** Etapas padrão do Pipeline (mesma lista de `src/lib/kanbans-padrao.ts`). */
export const DEFAULT_PIPELINE_STAGES = PIPELINE_ETAPAS_PADRAO;

export const KANBAN_FILTERABLE_STAGE_OPTIONS: string[] = [...DEFAULT_PIPELINE_STAGES];

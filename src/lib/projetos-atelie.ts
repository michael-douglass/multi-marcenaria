import type { AppUserRole } from '@/lib/app-roles';

export type ProjetoStageKind = 'waiting' | 'visita' | 'feito' | 'other';

export type ProjetoSignalTone = 'waiting' | 'active' | 'done';

export const MIN_CARACTERES_BUSCA_PROJETOS = 2;
export const MIN_CARACTERES_ENVIO_SETOR = 8;
export const MAX_IMAGENS_ENVIO_SETOR = 8;
export const MAX_IMAGEM_ENVIO_BYTES = 20 * 1024 * 1024;
export const MAX_CHAT_MENSAGEM = 2000;
export const LEAD_CHAT_FOLDER_NAME = 'chat';

export interface ProjetoStageLike {
  id: string;
  nome: string;
  ordem?: number;
}

export function normalizeProjetoStageName(nome: string | null | undefined): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Inclui o typo histórico “aguadando” para a fila não sumir. */
export function stageNameLooksWaiting(nome: string | null | undefined): boolean {
  const n = normalizeProjetoStageName(nome);
  return n.includes('aguardando') || n.includes('aguadando') || n.includes('fila');
}

export function stageNameLooksVisita(nome: string | null | undefined): boolean {
  return normalizeProjetoStageName(nome).includes('visita');
}

/**
 * Colunas do ateliê que, ao receber o projeto, promovem o lead no Kanban
 * para “Visita em obra Feita” (espelha a regra SQL da migration 203).
 */
export function stageNameTriggersVisitaObraFeita(nome: string | null | undefined): boolean {
  const n = normalizeProjetoStageName(nome);
  return n.includes('a serem feitos') || (n.includes('em andamento') && n.includes('projeto'));
}

/** Nome comercial típico; use resolveVisitaEmObraFeitaStatus para o valor exato do banco. */
export const VISITA_EM_OBRA_FEITA_STATUS_FALLBACK = 'Visita em obra Feita';

export interface PipelineStageNomeLike {
  nome: string;
  ativo?: boolean | null;
  ordem?: number | null;
}

/** Resolve o status exato cadastrado no funil (visita + obra + feita). */
export function resolveVisitaEmObraFeitaStatus(
  stages: readonly PipelineStageNomeLike[] | null | undefined,
): string {
  const match = (stages ?? [])
    .filter((s) => s.ativo !== false)
    .map((s) => ({ ...s, norm: normalizeProjetoStageName(s.nome) }))
    .filter((s) => s.norm.includes('visita') && s.norm.includes('obra') && s.norm.includes('feita'))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))[0];
  return match?.nome?.trim() || VISITA_EM_OBRA_FEITA_STATUS_FALLBACK;
}

/**
 * Só avança no funil: status vazio ou etapa com ordem menor que a visita feita.
 * Status fora do funil (ex.: Orçamentos ganhos) → não promove.
 */
export function shouldPromoteLeadToVisitaObraFeita(
  currentStatus: string | null | undefined,
  stages: readonly PipelineStageNomeLike[] | null | undefined,
): boolean {
  const target = resolveVisitaEmObraFeitaStatus(stages);
  const current = (currentStatus ?? '').trim();
  if (!current) return true;
  if (current === target) return false;

  const active = (stages ?? []).filter((s) => s.ativo !== false);
  const targetOrdem = active.find((s) => s.nome === target)?.ordem;
  const currentOrdem = active.find((s) => s.nome === current)?.ordem;
  if (targetOrdem == null || currentOrdem == null) return false;
  return currentOrdem < targetOrdem;
}

/** Coluna que recebe todo projeto marcado como concluído (“Precificações concluídas”). */
export const PRECIFICACOES_CONCLUIDAS_NOME = 'Precificações concluídas';

export function stageNameIsPrecificacoesConcluidas(nome: string | null | undefined): boolean {
  const n = normalizeProjetoStageName(nome);
  return n.includes('precificac') && n.includes('concluid');
}

/** Coluna fixa do fim do fluxo: “Orçamento ( Ja enviados )” — o nome não pode ser alterado. */
export function stageNameIsOrcamentosJaEnviados(nome: string | null | undefined): boolean {
  const n = normalizeProjetoStageName(nome);
  return n.includes('orcamento') && n.includes('enviado');
}

/** Colunas com nome travado (sem renomear nem excluir). */
export function isProjetoStageNomeFixo(nome: string | null | undefined): boolean {
  return stageNameIsOrcamentosJaEnviados(nome) || stageNameIsPrecificacoesConcluidas(nome);
}

export function classifyProjetoStage(
  stage: ProjetoStageLike,
  stages: readonly ProjetoStageLike[],
): ProjetoStageKind {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const last = ordered.length >= 2 ? ordered[ordered.length - 1] : null;
  if (last && stage.id === last.id) return 'feito';
  if (stageNameIsPrecificacoesConcluidas(stage.nome)) return 'feito';
  if (stageNameLooksVisita(stage.nome)) return 'visita';
  if (stageNameLooksWaiting(stage.nome)) return 'waiting';
  return 'other';
}

export function getWaitingProjetoStageId(stages: readonly ProjetoStageLike[]): string | null {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const waiting = ordered.find((stage) => stageNameLooksWaiting(stage.nome));
  if (waiting) return waiting.id;
  const lastId = ordered.length >= 2 ? ordered[ordered.length - 1]?.id : null;
  const fallback = ordered.find((stage) => {
    if (lastId && stage.id === lastId) return false;
    if (stageNameLooksVisita(stage.nome)) return false;
    return true;
  });
  return fallback?.id ?? ordered[0]?.id ?? null;
}

export function getFeitoProjetoStageId(stages: readonly ProjetoStageLike[]): string | null {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const precificadas = ordered.find((stage) => stageNameIsPrecificacoesConcluidas(stage.nome));
  if (precificadas) return precificadas.id;
  if (ordered.length < 2) return null;
  return ordered[ordered.length - 1]?.id ?? null;
}

export function isProjetoEmDesenho(projeto: {
  arquiteto_id?: string | null;
  aguardando_resposta?: boolean | null;
} | null | undefined): boolean {
  if (!projeto) return false;
  return Boolean(projeto.arquiteto_id) && projeto.aguardando_resposta !== true;
}

export function projetoSignalTone(
  projeto: {
    stage_id: string;
    arquiteto_id?: string | null;
    aguardando_resposta?: boolean | null;
  } | null | undefined,
  stages: readonly ProjetoStageLike[],
): ProjetoSignalTone | null {
  if (!projeto) return null;
  const stage = stages.find((item) => item.id === projeto.stage_id);
  if (stage && classifyProjetoStage(stage, stages) === 'feito') return 'done';
  if (projeto.aguardando_resposta) return 'waiting';
  if (isProjetoEmDesenho(projeto)) return 'active';
  return 'waiting';
}

export function kanbanCardProjetoRingClass(tone: ProjetoSignalTone | null | undefined): string {
  if (tone === 'waiting') return 'ring-2 ring-amber-400/45';
  if (tone === 'active') return 'ring-2 ring-sky-400/50';
  if (tone === 'done') return 'ring-2 ring-gold/40';
  return '';
}

/** Anel mais vivo no Pipeline quando o projeto feito ainda aguarda envio do orçamento. */
export function kanbanCardProjetoFeitoPulseRingClass(pulse: boolean): string {
  if (!pulse) return '';
  return 'ring-2 ring-emerald-400/70';
}

export function emptyStateForKind(kind: ProjetoStageKind): string {
  if (kind === 'waiting') return 'Nenhum na fila. Puxe um lead ou espere o vendedor enviar.';
  if (kind === 'visita') return 'Arraste para visita quando for medir na obra.';
  if (kind === 'feito') return 'Ainda não há projeto concluído nesta prancheta.';
  return 'Nenhum card neste andamento.';
}

export function columnKindLabel(kind: ProjetoStageKind): string {
  if (kind === 'waiting') return 'Fila';
  if (kind === 'visita') return 'Visita';
  if (kind === 'feito') return 'Feitos';
  return 'Em andamento';
}

/** Etapas do funil em que um card em Feitos ainda “cobra” envio do orçamento. */
const FEITO_PULSE_FUNNEL_KEYS = new Set([
  '', // status vazio = Novo Lead
  'novo lead',
  'visita em obra agendada',
  'visita em obra feita',
  'orcamentos feitos',
  'precificacao feita',
]);

/**
 * Card na coluna Feitos / Pipeline deve pulsar enquanto o lead ainda não chegou em “Enviou orçamento”.
 * Lista explícita (não depende da ordem das colunas do Pipeline).
 */
export function shouldPulseFeitoAwaitingOrcamento(
  leadStatus: string | null | undefined,
): boolean {
  const key = normalizeProjetoStageName(leadStatus);
  if (
    key === 'enviou orcamento' ||
    key === 'orcamentos ja enviados' ||
    key === 'orcamento ja enviado'
  ) {
    return false;
  }
  return FEITO_PULSE_FUNNEL_KEYS.has(key);
}

/** Projeto concluído no ateliê + funil ainda antes de “Enviou orçamento”. */
export function shouldPulseProjetoFeitoOnPipeline(
  projeto: {
    stage_id: string;
    arquiteto_id?: string | null;
    aguardando_resposta?: boolean | null;
  } | null | undefined,
  stages: readonly ProjetoStageLike[],
  leadStatus: string | null | undefined,
): boolean {
  return (
    projetoSignalTone(projeto, stages) === 'done' &&
    shouldPulseFeitoAwaitingOrcamento(leadStatus)
  );
}

/** IDs de leads que devem subir ao topo da coluna (depois de “Dar atenção”). */
export function collectFeitoPulseLeadIds(
  projetos: readonly {
    lead_id: number;
    stage_id: string;
    arquiteto_id?: string | null;
    aguardando_resposta?: boolean | null;
  }[],
  stages: readonly ProjetoStageLike[],
  leadStatusById: ReadonlyMap<number, string | null | undefined>,
): Set<number> {
  const ids = new Set<number>();
  for (const projeto of projetos) {
    const status = leadStatusById.get(projeto.lead_id);
    if (shouldPulseProjetoFeitoOnPipeline(projeto, stages, status)) {
      ids.add(projeto.lead_id);
    }
  }
  return ids;
}

export function canPegarProjeto(roles: readonly AppUserRole[] | null | undefined, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  const list = roles ?? [];
  return list.includes('admin') || list.includes('projetista') || list.includes('projetista_admin');
}

export function canSoltarOuReabrir(roles: readonly AppUserRole[] | null | undefined, isSuperAdmin = false): boolean {
  return canPegarProjeto(roles, isSuperAdmin);
}

export function canSolicitarNovamente(roles: readonly AppUserRole[] | null | undefined, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  const list = roles ?? [];
  return list.includes('admin') || list.includes('vendedor');
}

export function canEnviarDaPipeline(roles: readonly AppUserRole[] | null | undefined, isSuperAdmin = false): boolean {
  return canSolicitarNovamente(roles, isSuperAdmin);
}

export function projetistaPuxaJaEmDesenho(
  roles: readonly AppUserRole[] | null | undefined,
): boolean {
  const list = roles ?? [];
  const projetista = list.includes('projetista') || list.includes('projetista_admin');
  return projetista && !list.includes('vendedor') && !list.includes('admin');
}

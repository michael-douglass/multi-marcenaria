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

export function classifyProjetoStage(
  stage: ProjetoStageLike,
  stages: readonly ProjetoStageLike[],
): ProjetoStageKind {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const last = ordered.length >= 2 ? ordered[ordered.length - 1] : null;
  if (last && stage.id === last.id) return 'feito';
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

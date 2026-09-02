import type { AppUserRole } from '@/lib/app-roles'
import {
  isProjetistaAdminRole,
  isProjetistaRole,
} from '@/lib/app-roles'
import type { CrmProfile } from '@/lib/crm-identity'
import { colaboradorCrmRoles } from '@/lib/crm-identity'
import type { UserRole } from '@/types'

export type ProducaoStageKind = 'pendente' | 'iniciado' | 'feito' | 'other'

export type ProducaoChatCanal = 'vendas' | 'obras'

export const MIN_CARACTERES_BUSCA_PRODUCAO = 2
export const MAX_CHAT_MENSAGEM_PRODUCAO = 2000

export interface ProducaoStageLike {
  id: string
  nome: string
  ordem?: number
}

export function normalizeProducaoStageName(nome: string | null | undefined): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function stageNameLooksPendente(nome: string | null | undefined): boolean {
  const n = normalizeProducaoStageName(nome)
  return n.includes('pendente') || n.includes('fila') || n.includes('aguardando')
}

export function stageNameLooksIniciado(nome: string | null | undefined): boolean {
  const n = normalizeProducaoStageName(nome)
  return n.includes('iniciado') || n.includes('andamento')
}

export function classifyProducaoStage(
  stage: ProducaoStageLike,
  stages: readonly ProducaoStageLike[],
): ProducaoStageKind {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const last = ordered.length >= 2 ? ordered[ordered.length - 1] : null
  if (last && stage.id === last.id) return 'feito'
  if (stageNameLooksPendente(stage.nome)) return 'pendente'
  if (stageNameLooksIniciado(stage.nome)) return 'iniciado'
  return 'other'
}

export function getPendenteProducaoStageId(stages: readonly ProducaoStageLike[]): string | null {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const pendente = ordered.find((stage) => stageNameLooksPendente(stage.nome))
  if (pendente) return pendente.id
  return ordered[0]?.id ?? null
}

export function getIniciadoProducaoStageId(stages: readonly ProducaoStageLike[]): string | null {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const iniciado = ordered.find((stage) => stageNameLooksIniciado(stage.nome))
  if (iniciado) return iniciado.id
  if (ordered.length >= 2) return ordered[1]?.id ?? null
  return null
}

export function getFeitoProducaoStageId(stages: readonly ProducaoStageLike[]): string | null {
  const ordered = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  if (ordered.length < 2) return null
  return ordered[ordered.length - 1]?.id ?? null
}

export function columnKindLabelProducao(kind: ProducaoStageKind): string {
  if (kind === 'pendente') return 'FILA'
  if (kind === 'iniciado') return 'OFICINA'
  if (kind === 'feito') return 'PRONTO'
  return 'ETAPA'
}

export function emptyStateForProducaoKind(kind: ProducaoStageKind): string {
  if (kind === 'pendente') return 'Nenhum projeto aguardando produção.'
  if (kind === 'iniciado') return 'Nada em produção no momento.'
  if (kind === 'feito') return 'Ainda sem projetos concluídos.'
  return 'Coluna vazia.'
}

/** CRM (admin/vendedor/projetista) OU Montador Admin da casa. Montador comum: não. */
export function canAccessProjetosProducao(
  crm: CrmProfile | null | undefined,
  casaRoles: UserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true
  if ((casaRoles ?? []).includes('MontadorAdmin')) return true
  const roles = colaboradorCrmRoles(crm) as AppUserRole[]
  if (roles.includes('admin')) return true
  if (roles.includes('vendedor')) return true
  if (isProjetistaRole(roles)) return true
  return false
}

export function canConfigurarProducaoColunas(
  crmRoles: AppUserRole[] | null | undefined,
  casaRoles: UserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true
  if ((casaRoles ?? []).includes('MontadorAdmin')) return true
  return isProjetistaAdminRole(crmRoles, isSuperAdmin)
}

export function canMoverProducaoCard(
  crm: CrmProfile | null | undefined,
  casaRoles: UserRole[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  return canAccessProjetosProducao(crm, casaRoles, isSuperAdmin)
}

export function producaoCanalLabel(canal: ProducaoChatCanal): string {
  return canal === 'vendas' ? 'Projetista de vendas' : 'Projetista de obras'
}

export function producaoCanalHint(canal: ProducaoChatCanal): string {
  if (canal === 'vendas') {
    return 'Você está no canal: Projetista de vendas (mesmo fio do ateliê).'
  }
  return 'Você está no canal: Projetista de obras (produção / oficina).'
}

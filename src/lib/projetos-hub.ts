/**
 * Hub /projetos: alterna entre o quadro do ateliê (Projetos) e o da oficina (Produção).
 * A aba ativa vive na URL (`?aba=producao`) para links e o botão "voltar" funcionarem.
 */

export type ProjetosAba = 'atelie' | 'producao'

export const PROJETOS_ABA_PARAM = 'aba'

export const PROJETOS_PRODUCAO_URL = `/projetos?${PROJETOS_ABA_PARAM}=producao`

export interface ProjetosAbasAcesso {
  canAtelie: boolean
  canProducao: boolean
}

export function isProjetosAba(value: string | null | undefined): value is ProjetosAba {
  return value === 'atelie' || value === 'producao'
}

/** Abas que o usuário enxerga, na ordem da régua. */
export function visibleProjetosAbas(acesso: ProjetosAbasAcesso): ProjetosAba[] {
  const abas: ProjetosAba[] = []
  if (acesso.canAtelie) abas.push('atelie')
  if (acesso.canProducao) abas.push('producao')
  return abas
}

/**
 * Resolve a aba a exibir: respeita a URL se o usuário puder vê-la;
 * senão cai na primeira aba permitida (Montador Admin sem CRM → só Produção).
 */
export function resolveProjetosAba(
  param: string | null | undefined,
  acesso: ProjetosAbasAcesso,
): ProjetosAba | null {
  const abas = visibleProjetosAbas(acesso)
  if (isProjetosAba(param) && abas.includes(param)) return param
  return abas[0] ?? null
}

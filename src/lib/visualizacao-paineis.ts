import type { UserRole } from '@/types'

/** Registro de painéis da página Visualização — novos cards entram aqui. */
export const VISUALIZACAO_PAINEIS = [
  {
    id: 'chegada_materiais',
    label: 'Chegada de Materiais',
    description: 'Entregas de material previstas na semana.',
    exibicao: 'grid',
  },
  {
    id: 'calendario_obras',
    label: 'Calendário de Obras',
    description: 'Obras agendadas por dia na semana.',
    exibicao: 'grid',
  },
  {
    id: 'acompanhamento_obras',
    label: 'Acompanhamento de Obras',
    description: 'Fotos e evolução das obras de hoje.',
    exibicao: 'grid',
  },
  {
    id: 'obras_do_dia',
    label: 'Obras do Dia',
    description: 'Hoje e amanhã com montadores — só em tela cheia.',
    exibicao: 'fullscreen',
  },
  {
    id: 'obras_atrasadas',
    label: 'Obras Atrasadas',
    description: 'Obras com prazo de entrega vencido.',
    exibicao: 'grid',
  },
  {
    id: 'cobrancas_atrasadas',
    label: 'Cobranças Atrasadas',
    description: 'Clientes com parcelas vencidas.',
    exibicao: 'grid',
  },
] as const

export type VisualizacaoPainelId = (typeof VISUALIZACAO_PAINEIS)[number]['id']

export const VISUALIZACAO_PAINEL_IDS: VisualizacaoPainelId[] = VISUALIZACAO_PAINEIS.map(p => p.id)

/** Painéis fixos no grid da página (não inclui os só de tela cheia). */
export const VISUALIZACAO_PAINEL_GRID_IDS: VisualizacaoPainelId[] = VISUALIZACAO_PAINEIS
  .filter(p => p.exibicao === 'grid')
  .map(p => p.id)

export const DEFAULT_VISUALIZACAO_PAINEL_IDS: VisualizacaoPainelId[] = [...VISUALIZACAO_PAINEL_IDS]

export function painelApareceNoGrid(id: VisualizacaoPainelId): boolean {
  return VISUALIZACAO_PAINEIS.find(p => p.id === id)?.exibicao === 'grid'
}

export function isVisualizacaoPainelId(value: string): value is VisualizacaoPainelId {
  return VISUALIZACAO_PAINEL_IDS.includes(value as VisualizacaoPainelId)
}

/** Lista salva no banco, ignorando ids desconhecidos. */
export function normalizeVisualizacaoPaineisSalvos(raw: unknown): VisualizacaoPainelId[] | null {
  if (!Array.isArray(raw)) return null
  return raw.filter((id): id is VisualizacaoPainelId => typeof id === 'string' && isVisualizacaoPainelId(id))
}

/** Painéis visíveis para usuários Visualizador. */
export function getVisualizacaoPaineisVisiveis(
  salvos: VisualizacaoPainelId[] | null,
): Set<VisualizacaoPainelId> {
  const lista = salvos ?? DEFAULT_VISUALIZACAO_PAINEL_IDS
  return new Set(lista)
}

/** Estado inicial dos checkboxes no seletor do administrador. */
export function getVisualizacaoPaineisCheckboxState(
  salvos: VisualizacaoPainelId[] | null,
): Record<VisualizacaoPainelId, boolean> {
  return Object.fromEntries(
    VISUALIZACAO_PAINEL_IDS.map(id => [
      id,
      salvos ? salvos.includes(id) : true,
    ]),
  ) as Record<VisualizacaoPainelId, boolean>
}

export function checkboxStateToPaineisVisiveis(
  state: Record<VisualizacaoPainelId, boolean>,
): VisualizacaoPainelId[] {
  return VISUALIZACAO_PAINEL_IDS.filter(id => state[id])
}

/** Administrador define o que o Visualizador enxerga. */
export function canConfigurarVisualizacaoPaineis(roles: UserRole[]): boolean {
  return roles.includes('Administrador') || roles.includes('AdministradorObras')
}

/** Aplica filtro de painéis apenas para perfil Visualizador (sem perfil de gestão). */
export function shouldFiltrarPaineisVisualizacao(roles: UserRole[]): boolean {
  if (canConfigurarVisualizacaoPaineis(roles)) return false
  return roles.includes('Visualizador')
}

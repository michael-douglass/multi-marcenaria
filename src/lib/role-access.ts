import type { ActiveSection, UserRole } from '@/types'

const OBRAS_SECTIONS: ActiveSection[] = [
  'agendaObras',
  'acompanhamentoObras',
  'calendarioObras',
  'calendarioChegadaMateriais',
  'metricasObras',
]

export const ROLE_SECTIONS: Record<UserRole, ActiveSection[]> = {
  Administrador: ['dashboard', 'clientes', 'cobranças', 'fornecedores', 'funcionarios', 'contasPagar', 'caixaFornecedor', 'biblioteca', 'caixa', ...OBRAS_SECTIONS, 'visualizacao', 'configuracoes', 'baterPonto', 'resumoPonto'],
  Financeiro: ['dashboard', 'clientes', 'cobranças', 'fornecedores', 'funcionarios', 'biblioteca', 'visualizacao', 'meuPerfil', 'baterPonto', 'resumoPonto', 'agendaObras', 'pedidosObras'],
  Marceneiro: ['dashboard'],
  MontadorAdmin: ['projetosProducao', ...OBRAS_SECTIONS, 'visualizacao', 'meuFinanceiro', 'meuPerfil', 'baterPonto', 'historicoPonto', 'resumoPonto', 'funcionarios'],
  AdministradorObras: [...OBRAS_SECTIONS, 'pedidosObras', 'visualizacao', 'meuPerfil', 'baterPonto', 'historicoPonto'],
  Montador: ['agendaObras', 'calendarioObras', 'visualizacao', 'meuFinanceiro', 'meuPerfil', 'baterPonto', 'historicoPonto'],
  Visualizador: ['visualizacao'],
}

export function getAllowedSections(roles: UserRole[]): ActiveSection[] {
  const sections = new Set<ActiveSection>()
  for (const r of roles) {
    for (const s of ROLE_SECTIONS[r] ?? []) sections.add(s)
  }
  return [...sections]
}

export function isVisualizadorOnly(roles: UserRole[]): boolean {
  return roles.length > 0 && roles.every(r => r === 'Visualizador')
}

export function canAccessSection(roles: UserRole[], section: ActiveSection): boolean {
  return getAllowedSections(roles).includes(section)
}

export function isAdministrador(roles: UserRole[]): boolean {
  return roles.includes('Administrador')
}

/**
 * Lista e pasta do funcionário: RH vê tudo;
 * Montador Admin entra em /funcionarios e em /funcionarios/:id.
 */
export function canAccessFuncionarioPasta(roles: UserRole[], pathname: string): boolean {
  if (canAccessSection(roles, 'funcionarios')) return true
  if (!roles.includes('MontadorAdmin')) return false
  const path = pathname.split('?')[0] ?? pathname
  return path === '/funcionarios' || /^\/funcionarios\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)
}

/**
 * Pasta só com Ponto → Registros (sem cadastro, documentos e recibos).
 * Independente da listagem de pastas: Montador Admin vê as pastas, mas não o RH.
 */
export function isPastaPontoRegistrosRestrita(roles: UserRole[]): boolean {
  return roles.includes('MontadorAdmin') && !roles.includes('Administrador') && !roles.includes('Financeiro')
}

/**
 * RH edita qualquer ponto. Montador Admin lança/ajusta o de outras pessoas,
 * mas o ponto da própria titularidade fica bloqueado.
 */
export function podeEditarPontoRegistrosTerceiro(
  roles: UserRole[],
  funcionarioUsuarioId: string | null | undefined,
  currentUserId: string | undefined,
): boolean {
  if (roles.includes('Administrador') || roles.includes('Financeiro')) return true
  if (!isPastaPontoRegistrosRestrita(roles)) return true
  if (!currentUserId) return false
  return funcionarioUsuarioId !== currentUserId
}

/** Custos do markup na Agenda (Pedido a fazer + bloco nos cards). */
export function canViewMarkupCustos(roles: UserRole[]): boolean {
  return isAdministrador(roles) || roles.includes('Financeiro')
}

/** Cadastrar produtos e alterar itens do markup na página Pedidos. */
export function canEditMarkupItens(roles: UserRole[]): boolean {
  return canViewMarkupCustos(roles)
}

const CAMPO_ROLES: UserRole[] = ['Montador', 'MontadorAdmin', 'AdministradorObras']

/** Perfis de funcionário que batem ponto no campo. */
export function isFuncionarioCampo(roles: UserRole[]): boolean {
  return roles.some(r => CAMPO_ROLES.includes(r))
}

export function defaultPathForRoles(roles: UserRole[]): string {
  if (isVisualizadorOnly(roles)) return '/visualizacao'
  if (roles.includes('Montador') && roles.length === 1) return '/agenda-obras?view=calendario'
  if (
    (roles.includes('MontadorAdmin') || roles.includes('AdministradorObras'))
    && !roles.includes('Administrador')
    && !roles.includes('Financeiro')
  ) {
    return '/agenda-obras'
  }
  return '/dashboard'
}

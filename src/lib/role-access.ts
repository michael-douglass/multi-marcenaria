import type { ActiveSection, UserRole } from '@/types'

const OBRAS_SECTIONS: ActiveSection[] = [
  'agendaObras',
  'acompanhamentoObras',
  'calendarioObras',
  'calendarioChegadaMateriais',
  'metricasObras',
]

export const ROLE_SECTIONS: Record<UserRole, ActiveSection[]> = {
  Administrador: ['dashboard', 'clientes', 'cobranças', 'contratos', 'fornecedores', 'produtos', 'pedidos', 'aprovacao', 'contasPagar', 'caixaFornecedor', 'biblioteca', 'caixa', ...OBRAS_SECTIONS, 'visualizacao', 'configuracoes'],
  Financeiro: ['dashboard', 'clientes', 'cobranças', 'contratos', 'fornecedores', 'produtos', 'pedidos', 'biblioteca', 'visualizacao'],
  Marceneiro: ['dashboard'],
  MontadorAdmin: [...OBRAS_SECTIONS, 'meuFinanceiro', 'visualizacao'],
  AdministradorObras: [...OBRAS_SECTIONS, 'visualizacao'],
  Montador: ['agendaObras', 'calendarioObras', 'meuFinanceiro'],
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

export function defaultPathForRoles(roles: UserRole[]): string {
  if (isVisualizadorOnly(roles)) return '/visualizacao'
  if (roles.includes('Montador') && roles.length === 1) return '/calendario-obras'
  if (
    (roles.includes('MontadorAdmin') || roles.includes('AdministradorObras'))
    && !roles.includes('Administrador')
    && !roles.includes('Financeiro')
  ) {
    return '/agenda-obras'
  }
  return '/dashboard'
}

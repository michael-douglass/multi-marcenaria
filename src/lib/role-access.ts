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
  Financeiro: ['dashboard', 'clientes', 'cobranças', 'fornecedores', 'funcionarios', 'biblioteca', 'visualizacao', 'meuPerfil', 'baterPonto', 'resumoPonto', 'agendaObras'],
  Marceneiro: ['dashboard'],
  MontadorAdmin: [...OBRAS_SECTIONS, 'meuFinanceiro', 'meuPerfil', 'baterPonto'],
  AdministradorObras: [...OBRAS_SECTIONS, 'visualizacao', 'meuPerfil', 'baterPonto'],
  Montador: ['agendaObras', 'calendarioObras', 'meuFinanceiro', 'meuPerfil', 'baterPonto'],
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

/** Custos do markup na Agenda (Pedido a fazer + bloco nos cards). */
export function canViewMarkupCustos(roles: UserRole[]): boolean {
  return isAdministrador(roles) || roles.includes('Financeiro')
}

const CAMPO_ROLES: UserRole[] = ['Montador', 'MontadorAdmin', 'AdministradorObras']

/** Perfis de funcionário que batem ponto no campo. */
export function isFuncionarioCampo(roles: UserRole[]): boolean {
  return roles.some(r => CAMPO_ROLES.includes(r))
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

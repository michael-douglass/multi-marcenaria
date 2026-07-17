import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Truck,
  Receipt,
  Images,
  Landmark,
  Wallet,
  Banknote,
  HardHat,
  UserCog,
  CalendarDays,
  BarChart3,
  Camera,
  PackageCheck,
  Settings,
  Monitor,
  UserCircle,
  Clock,
  ClipboardList,
  History,
} from 'lucide-react'
import type { ActiveSection, UserRole } from '@/types'

/** IDs de itens de menu (rotas ou agrupadores) */
export type NavItemId =
  | ActiveSection
  | 'financeiro'
  | 'funcionariosGrupo'
  | 'obras'
  | 'configuracoes'
  | 'pontoGrupo'

export interface NavChildItem {
  id: string
  title: string
  url?: string
  icon: LucideIcon
  radialColor: string
  /** Se omitido, herda visibilidade do menu pai */
  roles?: UserRole[]
  children?: NavChildItem[]
}

function filterNavChildren(items: NavChildItem[], roles: UserRole[]): NavChildItem[] {
  return items
    .filter(c => !c.roles || c.roles.some(r => roles.includes(r)))
    .map(c => {
      if (!c.children?.length) return c
      const children = filterNavChildren(c.children, roles)
      if (children.length === 0) return null
      return { ...c, children }
    })
    .filter((c): c is NavChildItem => c != null)
}

function walkNavChildren(items: NavChildItem[], visit: (item: NavChildItem) => void) {
  for (const item of items) {
    visit(item)
    if (item.children?.length) walkNavChildren(item.children, visit)
  }
}

function findNavChildUrl(items: NavChildItem[], section: ActiveSection): string | null {
  let found: string | null = null
  walkNavChildren(items, item => {
    if (!item.children?.length && item.id === section && item.url) {
      found = item.url
    }
  })
  return found
}

export interface NavMainItem {
  id: NavItemId
  title: string
  url: string
  icon: LucideIcon
  radialColor: string
  roles: UserRole[]
  children?: NavChildItem[]
}

const FINANCEIRO_CHILDREN: NavChildItem[] = [
  {
    id: 'clientes',
    title: 'Clientes',
    url: '/clientes',
    icon: Users,
    radialColor: 'rgba(130,210,255,0.92)',
  },
  {
    id: 'cobranças',
    title: 'Cobranças',
    url: '/cobrancas',
    icon: TrendingUp,
    radialColor: 'rgba(196,181,253,0.92)',
  },
  {
    id: 'fornecedores',
    title: 'Fornecedores',
    url: '/fornecedores',
    icon: Truck,
    radialColor: 'rgba(251,191,36,0.92)',
  },
  {
    id: 'contasPagar',
    title: 'Contas a Pagar',
    url: '/contas-pagar',
    icon: Receipt,
    radialColor: 'rgba(74,222,128,0.92)',
    roles: ['Administrador'],
  },
  {
    id: 'caixaFornecedor',
    title: 'Caixa Fornecedor',
    url: '/caixa-fornecedor',
    icon: Wallet,
    radialColor: 'rgba(52,211,153,0.92)',
    roles: ['Administrador'],
  },
  {
    id: 'caixa',
    title: 'Caixa',
    url: '/caixa',
    icon: Banknote,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['Administrador'],
  },
]

const PONTO_CHILDREN: NavChildItem[] = [
  {
    id: 'baterPonto',
    title: 'Bater Ponto',
    url: '/bater-ponto',
    icon: Clock,
    radialColor: 'rgba(74,222,128,0.92)',
  },
  {
    id: 'historicoPonto',
    title: 'Histórico de ponto',
    url: '/historico-ponto',
    icon: History,
    radialColor: 'rgba(167,139,250,0.92)',
  },
]

const FUNCIONARIOS_CHILDREN: NavChildItem[] = [
  {
    id: 'funcionarios',
    title: 'Pastas',
    url: '/funcionarios',
    icon: UserCog,
    radialColor: 'rgba(240,210,140,0.92)',
  },
  {
    id: 'ponto',
    title: 'Ponto',
    icon: Clock,
    radialColor: 'rgba(74,222,128,0.92)',
    roles: ['Administrador', 'Financeiro', 'Montador', 'MontadorAdmin', 'AdministradorObras'],
    children: PONTO_CHILDREN,
  },
  {
    id: 'resumoPonto',
    title: 'Resumo de ponto',
    url: '/resumo-ponto',
    icon: ClipboardList,
    radialColor: 'rgba(96,165,250,0.92)',
  },
]

const OBRAS_CHILDREN: NavChildItem[] = [
  {
    id: 'agendaObras',
    title: 'Agenda de Obras',
    url: '/agenda-obras',
    icon: HardHat,
    radialColor: 'rgba(251,146,60,0.92)',
    roles: ['Administrador', 'AdministradorObras', 'Montador', 'MontadorAdmin', 'Financeiro'],
  },
  {
    id: 'acompanhamentoObras',
    title: 'Acompanhamento',
    url: '/acompanhamento-obras',
    icon: Camera,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['Administrador', 'AdministradorObras', 'MontadorAdmin'],
  },
  {
    id: 'calendarioObras',
    title: 'Calendário de Obras',
    url: '/calendario-obras',
    icon: CalendarDays,
    radialColor: 'rgba(96,165,250,0.92)',
    roles: ['Administrador', 'AdministradorObras', 'Montador', 'MontadorAdmin'],
  },
  {
    id: 'calendarioChegadaMateriais',
    title: 'Chegada de Materiais',
    url: '/chegada-materiais',
    icon: PackageCheck,
    radialColor: 'rgba(52,211,153,0.92)',
    roles: ['Administrador', 'AdministradorObras', 'MontadorAdmin'],
  },
  {
    id: 'metricasObras',
    title: 'Métricas de Obras',
    url: '/metricas-obras',
    icon: BarChart3,
    radialColor: 'rgba(74,222,128,0.92)',
    roles: ['Administrador', 'AdministradorObras', 'MontadorAdmin'],
  },
]

export const NAV_MAIN_ITEMS: NavMainItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['Administrador', 'Financeiro', 'Marceneiro'],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    url: '/clientes',
    icon: Landmark,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['Administrador', 'Financeiro'],
    children: FINANCEIRO_CHILDREN,
  },
  {
    id: 'funcionariosGrupo',
    title: 'Funcionários',
    url: '/funcionarios',
    icon: UserCog,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['Administrador', 'Financeiro'],
    children: FUNCIONARIOS_CHILDREN,
  },
  {
    id: 'obras',
    title: 'Obras',
    url: '/agenda-obras',
    icon: HardHat,
    radialColor: 'rgba(251,146,60,0.92)',
    roles: ['Administrador', 'AdministradorObras', 'Montador', 'MontadorAdmin', 'Financeiro'],
    children: OBRAS_CHILDREN,
  },
  {
    id: 'pontoGrupo',
    title: 'Bater Ponto',
    url: '/bater-ponto',
    icon: Clock,
    radialColor: 'rgba(74,222,128,0.92)',
    roles: ['Montador', 'MontadorAdmin', 'AdministradorObras'],
    children: PONTO_CHILDREN,
  },
  {
    id: 'meuFinanceiro',
    title: 'Meu Financeiro',
    url: '/meu-financeiro',
    icon: Wallet,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['Montador', 'MontadorAdmin'],
  },
  {
    id: 'meuPerfil',
    title: 'Meu Perfil',
    url: '/meu-perfil',
    icon: UserCircle,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['Montador', 'MontadorAdmin', 'AdministradorObras', 'Financeiro'],
  },
  {
    id: 'biblioteca',
    title: 'Biblioteca',
    url: '/biblioteca',
    icon: Images,
    radialColor: 'rgba(244,114,182,0.92)',
    roles: ['Administrador', 'Financeiro'],
  },
  {
    id: 'visualizacao',
    title: 'Visualização',
    url: '/visualizacao',
    icon: Monitor,
    radialColor: 'rgba(167,139,250,0.92)',
    roles: ['Administrador', 'Financeiro', 'AdministradorObras', 'Visualizador'],
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    url: '/configuracoes',
    icon: Settings,
    radialColor: 'rgba(156,163,175,0.92)',
    roles: ['Administrador'],
  },
]

export interface NavVisibilityContext {
  roles: UserRole[]
}

export function getVisibleNavMainItems(ctx: NavVisibilityContext): NavMainItem[] {
  if (!ctx.roles.length) return []
  return NAV_MAIN_ITEMS
    .filter(item => item.roles.some(r => ctx.roles.includes(r)))
    .map(item => {
      if (!item.children) return item
      return {
        ...item,
        children: filterNavChildren(item.children, ctx.roles),
      }
    })
    .filter(item => !item.children || item.children.length > 0)
}

export function getNavBadge(_item: NavMainItem, _ctx: NavVisibilityContext): number | undefined {
  return undefined
}

export function isFinanceiroSection(section: ActiveSection): boolean {
  let found = false
  walkNavChildren(FINANCEIRO_CHILDREN, item => {
    if (!item.children?.length && item.id === section) found = true
  })
  return found
}

export function isFuncionariosSection(section: ActiveSection): boolean {
  let found = false
  walkNavChildren(FUNCIONARIOS_CHILDREN, item => {
    if (!item.children?.length && item.id === section) found = true
  })
  return found
}

export function isObrasSection(section: ActiveSection): boolean {
  let found = false
  walkNavChildren(OBRAS_CHILDREN, item => {
    if (!item.children?.length && item.id === section) found = true
  })
  return found
}

export function isChegadaMateriaisSection(section: ActiveSection): boolean {
  return section === 'calendarioChegadaMateriais'
}

export function sectionFromPath(pathname: string): ActiveSection {
  if (pathname.startsWith('/funcionarios')) return 'funcionarios'

  const map: Record<string, ActiveSection> = {
    '/': 'dashboard',
    '/dashboard': 'dashboard',
    '/clientes': 'clientes',
    '/cobrancas': 'cobranças',
    '/fornecedores': 'fornecedores',
    '/funcionarios': 'funcionarios',
    '/contas-pagar': 'contasPagar',
    '/caixa-fornecedor': 'caixaFornecedor',
    '/biblioteca': 'biblioteca',
    '/caixa': 'caixa',
    '/agenda-obras': 'agendaObras',
    '/acompanhamento-obras': 'acompanhamentoObras',
    '/calendario-obras': 'calendarioObras',
    '/chegada-materiais': 'calendarioChegadaMateriais',
    '/chegada-materiais/calendario': 'calendarioChegadaMateriais',
    '/calendario-chegada-materiais': 'calendarioChegadaMateriais',
    '/metricas-obras': 'metricasObras',
    '/meu-financeiro': 'meuFinanceiro',
    '/meu-perfil': 'meuPerfil',
    '/bater-ponto': 'baterPonto',
    '/historico-ponto': 'historicoPonto',
    '/resumo-ponto': 'resumoPonto',
    '/visualizacao': 'visualizacao',
    '/configuracoes': 'configuracoes',
  }
  return map[pathname] ?? 'dashboard'
}

/** Rota inicial após login conforme o perfil do usuário. */
export function defaultPathForRole(role: UserRole | null): string {
  if (role === 'Visualizador') return '/visualizacao'
  if (role === 'Montador') return '/calendario-obras'
  if (role === 'MontadorAdmin' || role === 'AdministradorObras') return '/agenda-obras'
  return '/dashboard'
}

export { defaultPathForRoles, isVisualizadorOnly, canAccessSection, getAllowedSections } from './role-access'

export function pathFromSection(section: ActiveSection): string {
  for (const item of NAV_MAIN_ITEMS) {
    if (item.id === section) return item.url
    if (item.children) {
      const nested = findNavChildUrl(item.children, section)
      if (nested) return nested
    }
  }
  return '/dashboard'
}

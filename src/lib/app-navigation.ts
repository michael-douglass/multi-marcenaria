import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Truck,
  Package,
  ClipboardList,
  CheckCircle,
  Receipt,
  Images,
  Landmark,
  Wallet,
  Banknote,
  HardHat,
  FileSignature,
  CalendarDays,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { ActiveSection, UserRole } from '@/types'

/** IDs de itens de menu (rotas ou agrupadores) */
export type NavItemId = ActiveSection | 'financeiro' | 'obras' | 'configuracoes'

export interface NavChildItem {
  id: ActiveSection
  title: string
  url: string
  icon: LucideIcon
  radialColor: string
  /** Se omitido, herda visibilidade do menu pai */
  roles?: UserRole[]
  badgeKey?: 'pendingOrders'
}

export interface NavMainItem {
  id: NavItemId
  title: string
  url: string
  icon: LucideIcon
  radialColor: string
  roles: UserRole[]
  children?: NavChildItem[]
  badgeKey?: 'pendingOrders'
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
    id: 'contratos',
    title: 'Contratos',
    url: '/contratos',
    icon: FileSignature,
    radialColor: 'rgba(212,168,83,0.92)',
  },
  {
    id: 'fornecedores',
    title: 'Fornecedores',
    url: '/fornecedores',
    icon: Truck,
    radialColor: 'rgba(251,191,36,0.92)',
  },
  {
    id: 'produtos',
    title: 'Produtos',
    url: '/produtos',
    icon: Package,
    radialColor: 'rgba(167,139,250,0.92)',
  },
  {
    id: 'pedidos',
    title: 'Pedidos',
    url: '/pedidos',
    icon: ClipboardList,
    radialColor: 'rgba(96,165,250,0.92)',
  },
  {
    id: 'aprovacao',
    title: 'Aprovação',
    url: '/aprovacao',
    icon: CheckCircle,
    radialColor: 'rgba(251,146,60,0.92)',
    roles: ['Administrador'],
    badgeKey: 'pendingOrders',
  },
  {
    id: 'contasPagar',
    title: 'Contas a Pagar',
    url: '/contas-pagar',
    icon: Receipt,
    radialColor: 'rgba(74,222,128,0.92)',
  },
  {
    id: 'caixaFornecedor',
    title: 'Caixa Fornecedor',
    url: '/caixa-fornecedor',
    icon: Wallet,
    radialColor: 'rgba(52,211,153,0.92)',
  },
  {
    id: 'caixa',
    title: 'Caixa',
    url: '/caixa',
    icon: Banknote,
    radialColor: 'rgba(212,168,83,0.92)',
  },
]

const OBRAS_CHILDREN: NavChildItem[] = [
  {
    id: 'agendaObras',
    title: 'Agenda de Obras',
    url: '/agenda-obras',
    icon: HardHat,
    radialColor: 'rgba(251,146,60,0.92)',
  },
  {
    id: 'calendarioObras',
    title: 'Calendário de Obras',
    url: '/calendario-obras',
    icon: CalendarDays,
    radialColor: 'rgba(96,165,250,0.92)',
  },
  {
    id: 'metricasObras',
    title: 'Métricas de Obras',
    url: '/metricas-obras',
    icon: BarChart3,
    radialColor: 'rgba(74,222,128,0.92)',
    roles: ['Administrador', 'MontadorAdmin'],
  },
]

export const NAV_MAIN_ITEMS: NavMainItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    radialColor: 'rgba(212,168,83,0.92)',
    roles: ['Administrador', 'Financeiro', 'Marceneiro'],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    url: '/clientes',
    icon: Landmark,
    radialColor: 'rgba(212,168,83,0.92)',
    roles: ['Administrador', 'Financeiro'],
    children: FINANCEIRO_CHILDREN,
  },
  {
    id: 'obras',
    title: 'Obras',
    url: '/agenda-obras',
    icon: HardHat,
    radialColor: 'rgba(251,146,60,0.92)',
    roles: ['Administrador', 'Montador', 'MontadorAdmin'],
    children: OBRAS_CHILDREN,
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
    id: 'configuracoes',
    title: 'Configurações',
    url: '/configuracoes',
    icon: Settings,
    radialColor: 'rgba(156,163,175,0.92)',
    roles: ['Administrador'],
  },
]

export interface NavVisibilityContext {
  role: UserRole | null
  pendingOrders?: number
}

function filterChildren(item: NavMainItem, role: UserRole): NavChildItem[] {
  if (!item.children) return []
  return item.children.filter(c => !c.roles || c.roles.includes(role))
}

export function getVisibleNavMainItems(ctx: NavVisibilityContext): NavMainItem[] {
  if (!ctx.role) return []
  return NAV_MAIN_ITEMS.filter(item => item.roles.includes(ctx.role))
    .map(item => {
      if (!item.children) return item
      return { ...item, children: filterChildren(item, ctx.role!) }
    })
    .filter(item => !item.children || item.children.length > 0)
}

export function getNavBadge(
  item: NavMainItem,
  ctx: NavVisibilityContext,
): number | undefined {
  if (item.badgeKey === 'pendingOrders' && ctx.pendingOrders && ctx.pendingOrders > 0) {
    return ctx.pendingOrders
  }
  if (item.children && ctx.role) {
    const childComBadge = item.children.find(
      c =>
        c.badgeKey === 'pendingOrders' &&
        (!c.roles || c.roles.includes(ctx.role!)),
    )
    if (childComBadge && ctx.pendingOrders && ctx.pendingOrders > 0) {
      return ctx.pendingOrders
    }
  }
  return undefined
}

export function isFinanceiroSection(section: ActiveSection): boolean {
  return FINANCEIRO_CHILDREN.some(c => c.id === section)
}

export function isObrasSection(section: ActiveSection): boolean {
  return OBRAS_CHILDREN.some(c => c.id === section)
}

export function sectionFromPath(pathname: string): ActiveSection {
  const map: Record<string, ActiveSection> = {
    '/': 'dashboard',
    '/dashboard': 'dashboard',
    '/clientes': 'clientes',
    '/cobrancas': 'cobranças',
    '/contratos': 'contratos',
    '/fornecedores': 'fornecedores',
    '/produtos': 'produtos',
    '/pedidos': 'pedidos',
    '/aprovacao': 'aprovacao',
    '/contas-pagar': 'contasPagar',
    '/caixa-fornecedor': 'caixaFornecedor',
    '/biblioteca': 'biblioteca',
    '/caixa': 'caixa',
    '/agenda-obras': 'agendaObras',
    '/calendario-obras': 'calendarioObras',
    '/metricas-obras': 'metricasObras',
    '/configuracoes': 'configuracoes',
  }
  return map[pathname] ?? 'dashboard'
}

export function pathFromSection(section: ActiveSection): string {
  for (const item of NAV_MAIN_ITEMS) {
    if (item.id === section) return item.url
    const child = item.children?.find(c => c.id === section)
    if (child) return child.url
  }
  return '/dashboard'
}

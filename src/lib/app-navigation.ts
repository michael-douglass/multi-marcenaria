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
  ShoppingCart,
  Kanban,
  FileText,
  Calculator,
  Presentation,
  Megaphone,
  Trophy,
  Handshake,
  Ban,
  Zap,
  Palette,
  Briefcase,
  Shield,
  Webhook,
  LayoutGrid,
  Settings2,
  Ruler,
  FolderOpen,
  BrainCircuit,
} from 'lucide-react'
import type { CrmProfile, CrmRole } from '@/lib/crm-identity'
import {
  colaboradorCrmRoles,
  isCrmAdmin,
  isMarketingOnlyCrm,
  isPrestadorServico,
  isProjetistaOnlyCrm,
  isVendedorRestrictedCrm,
} from '@/lib/crm-identity'
import { isManutencaoKanbanPage } from '@/lib/manutencao-attention'
import { PROJETOS_ABA_PARAM, PROJETOS_PRODUCAO_URL } from '@/lib/projetos-hub'
import type { ActiveSection, UserProfile, UserRole } from '@/types'

export type NavSector = 'comercial' | 'casa'

/** IDs de itens de menu (rotas ou agrupadores) */
export type NavItemId =
  | ActiveSection
  | 'financeiro'
  | 'funcionariosGrupo'
  | 'obras'
  | 'configuracoes'
  | 'pontoGrupo'
  | 'comercial'
  | 'marketingCrm'
  | 'parceiros'
  | 'pipelineGrupo'
  | 'orcamentosGrupo'
  | 'automacoesGrupo'
  | 'adminCrmGrupo'
  | 'projetos'

export interface NavChildItem {
  id: string
  title: string
  url?: string
  icon: LucideIcon
  radialColor: string
  /** Termos extras para a busca da sidebar (ex.: "ia", "planilha"). */
  searchAliases?: string[]
  /** Se omitido, herda visibilidade do menu pai */
  roles?: UserRole[]
  crmRoles?: CrmRole[]
  crmAdminOnly?: boolean
  hideIfMarketingOnly?: boolean
  hideIfProjetistaOnly?: boolean
  hideIfVendedorRestricted?: boolean
  /** Esconde quem já tem papel comercial no CRM (atalho redundante com o menu Comercial). */
  hideIfCrmComercial?: boolean
  children?: NavChildItem[]
  badge?: number
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
  sector: NavSector
  roles: UserRole[]
  crmRoles?: CrmRole[]
  crmAdminOnly?: boolean
  hideIfMarketingOnly?: boolean
  hideIfProjetistaOnly?: boolean
  hideIfVendedorRestricted?: boolean
  parceiroOnly?: boolean
  children?: NavChildItem[]
}

export interface NavVisibilityContext {
  roles: UserRole[]
  crmRoles?: CrmRole[]
  marketingOnly?: boolean
  projetistaOnly?: boolean
  vendedorRestricted?: boolean
  crmAdmin?: boolean
  showParceiros?: boolean
}

function isNavEntryVisible(
  entry: {
    roles?: UserRole[]
    crmRoles?: CrmRole[]
    crmAdminOnly?: boolean
    hideIfMarketingOnly?: boolean
    hideIfProjetistaOnly?: boolean
    hideIfVendedorRestricted?: boolean
    hideIfCrmComercial?: boolean
    parceiroOnly?: boolean
  },
  ctx: NavVisibilityContext,
): boolean {
  if (entry.parceiroOnly) return Boolean(ctx.showParceiros)
  if (entry.hideIfCrmComercial && CRM_COMERCIAL_ROLES.some(r => (ctx.crmRoles ?? []).includes(r))) {
    return false
  }
  if (entry.hideIfMarketingOnly && ctx.marketingOnly) return false
  if (entry.hideIfProjetistaOnly && ctx.projetistaOnly) return false
  if (entry.hideIfVendedorRestricted && ctx.vendedorRestricted) return false
  if (entry.crmAdminOnly) return Boolean(ctx.crmAdmin)
  const factoryOk = Boolean(entry.roles?.some(r => ctx.roles.includes(r)))
  const crmOk = Boolean(entry.crmRoles?.some(r => (ctx.crmRoles ?? []).includes(r)))
  if (entry.roles?.length && entry.crmRoles?.length) return factoryOk || crmOk
  if (entry.crmRoles?.length && !entry.roles?.length) return crmOk
  if (entry.roles?.length) return factoryOk
  return factoryOk || crmOk
}

export function navVisibilityFromProfiles(
  roles: UserRole[],
  crm: CrmProfile | null | undefined,
  movelaria: UserProfile | null | undefined,
): NavVisibilityContext {
  return {
    roles,
    crmRoles: colaboradorCrmRoles(crm),
    marketingOnly: isMarketingOnlyCrm(crm),
    projetistaOnly: isProjetistaOnlyCrm(crm),
    vendedorRestricted: isVendedorRestrictedCrm(crm),
    crmAdmin: isCrmAdmin(crm),
    showParceiros: isPrestadorServico(crm) && movelaria?.ativo === true,
  }
}

function filterNavChildren(items: NavChildItem[], ctx: NavVisibilityContext): NavChildItem[] {
  return items
    .filter(c => {
      if (!c.roles && !c.crmRoles && !c.crmAdminOnly && !c.hideIfMarketingOnly && !c.hideIfProjetistaOnly && !c.hideIfVendedorRestricted) return true
      return isNavEntryVisible({
        roles: c.roles,
        crmRoles: c.crmRoles,
        crmAdminOnly: c.crmAdminOnly,
        hideIfMarketingOnly: c.hideIfMarketingOnly,
        hideIfProjetistaOnly: c.hideIfProjetistaOnly,
        hideIfVendedorRestricted: c.hideIfVendedorRestricted,
      }, ctx)
    })
    .map(c => {
      if (!c.children?.length) return c
      const children = filterNavChildren(c.children, ctx)
      if (children.length === 0) return null
      return { ...c, children }
    })
    .filter((c): c is NavChildItem => c != null)
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
    roles: ['Montador', 'MontadorAdmin', 'AdministradorObras'],
  },
  {
    id: 'resumoPonto',
    title: 'Resumo de ponto',
    url: '/resumo-ponto',
    icon: ClipboardList,
    radialColor: 'rgba(96,165,250,0.92)',
    roles: ['MontadorAdmin'],
  },
  {
    id: 'funcionarios',
    title: 'Pastas da equipe',
    url: '/funcionarios',
    icon: UserCog,
    radialColor: 'rgba(240,210,140,0.92)',
    roles: ['MontadorAdmin'],
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
    roles: ['Administrador', 'Financeiro'],
    children: PONTO_CHILDREN,
  },
  {
    id: 'resumoPonto',
    title: 'Resumo de ponto',
    url: '/resumo-ponto',
    icon: ClipboardList,
    radialColor: 'rgba(96,165,250,0.92)',
    roles: ['Administrador', 'Financeiro'],
  },
]

const CRM_COMERCIAL_ROLES: CrmRole[] = ['admin', 'vendedor', 'projetista', 'projetista_admin']
const CRM_VENDA_ROLES: CrmRole[] = ['admin', 'vendedor']
const CRM_MARKETING_ROLES: CrmRole[] = ['admin', 'marketing']
const CRM_MKT_VISIVEL_ROLES: CrmRole[] = ['admin', 'vendedor', 'marketing']

const OBRAS_CHILDREN: NavChildItem[] = [
  {
    // Produção mora na aba "Produção" de /projetos; este atalho fica só para o Montador Admin sem CRM.
    id: 'projetosProducao',
    title: 'Projetos de produção',
    url: PROJETOS_PRODUCAO_URL,
    icon: Ruler,
    radialColor: 'rgba(94,234,212,0.92)',
    roles: ['MontadorAdmin'],
    hideIfCrmComercial: true,
  },
  {
    id: 'agendaObras',
    title: 'Agenda de Obras',
    url: '/agenda-obras',
    icon: HardHat,
    radialColor: 'rgba(251,146,60,0.92)',
    roles: ['Administrador', 'AdministradorObras', 'Montador', 'MontadorAdmin', 'Financeiro'],
  },
  {
    id: 'pedidosObras',
    title: 'Pedidos',
    url: '/pedidos-obras',
    icon: ShoppingCart,
    radialColor: 'rgba(74,222,128,0.92)',
    roles: ['AdministradorObras', 'Financeiro'],
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
    url: '/agenda-obras?view=calendario',
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

const COMERCIAL_CHILDREN: NavChildItem[] = [
  {
    id: 'pipelineGrupo',
    title: 'Pipeline',
    icon: Kanban,
    radialColor: 'rgba(96,240,160,0.92)',
    crmRoles: CRM_COMERCIAL_ROLES,
    hideIfMarketingOnly: true,
    hideIfProjetistaOnly: true,
    children: [
      {
        id: 'pipeline',
        title: 'Kanban',
        url: '/pipeline',
        icon: LayoutGrid,
        radialColor: 'rgba(96,240,160,0.92)',
        crmRoles: CRM_COMERCIAL_ROLES,
        hideIfMarketingOnly: true,
        hideIfProjetistaOnly: true,
      },
      {
        id: 'pipelineConfig',
        title: 'Configurações',
        url: '/pipeline/configuracoes',
        icon: Settings2,
        radialColor: 'rgba(212,184,150,0.92)',
        crmAdminOnly: true,
      },
    ],
  },
  {
    id: 'leads',
    title: 'Leads',
    url: '/leads',
    icon: Users,
    radialColor: 'rgba(130,210,255,0.92)',
    crmRoles: CRM_COMERCIAL_ROLES,
    hideIfMarketingOnly: true,
  },
  {
    id: 'projetos',
    title: 'Projetos',
    url: '/projetos',
    icon: Ruler,
    radialColor: 'rgba(196,181,253,0.92)',
    crmRoles: CRM_COMERCIAL_ROLES,
    hideIfMarketingOnly: true,
  },
  {
    id: 'agendaComercial',
    title: 'Agenda comercial',
    url: '/agenda-comercial',
    icon: CalendarDays,
    radialColor: 'rgba(196,181,253,0.92)',
    crmRoles: CRM_VENDA_ROLES,
    hideIfMarketingOnly: true,
  },
  {
    id: 'contratosCrm',
    title: 'Contratos',
    url: '/contratos',
    icon: FileText,
    radialColor: 'rgba(214,180,140,0.92)',
    crmRoles: CRM_VENDA_ROLES,
    hideIfMarketingOnly: true,
  },
  {
    id: 'orcamentosIa',
    title: 'Orçamentos IA',
    url: '/orcamentos-ia',
    icon: BrainCircuit,
    radialColor: 'rgba(0,102,255,0.88)',
    roles: ['Administrador'],
    crmRoles: ['admin', 'vendedor', 'projetista', 'projetista_admin'],
    hideIfMarketingOnly: true,
    searchAliases: [
      'ia',
      'orcamentosia',
      'orcamento ia',
      'planilha',
      'planilha 4.0',
      'corte claude',
      'corteclaude',
      'bom fabril',
      'hellomob',
      'gpt',
      'inteligencia artificial',
      'levantamento',
    ],
  },
  {
    id: 'orcamentosGrupo',
    title: 'Orçamentos',
    icon: Presentation,
    radialColor: 'rgba(212,184,150,0.92)',
    roles: ['Administrador'],
    crmRoles: ['admin', 'vendedor', 'projetista', 'projetista_admin'],
    hideIfMarketingOnly: true,
    children: [
      {
        id: 'orcamentoSlides',
        title: 'Slides de orçamento',
        url: '/orcamento-slides',
        icon: Presentation,
        radialColor: 'rgba(212,184,150,0.92)',
        crmRoles: CRM_VENDA_ROLES,
        hideIfMarketingOnly: true,
      },
      {
        id: 'markupCrm',
        title: 'Markup (custo)',
        url: '/markup',
        icon: Calculator,
        radialColor: 'rgba(240,210,140,0.92)',
        roles: ['Administrador'],
        crmRoles: ['admin', 'projetista', 'projetista_admin'],
        hideIfMarketingOnly: true,
      },
    ],
  },
  {
    id: 'automacoesGrupo',
    title: 'Automações',
    icon: Zap,
    radialColor: 'rgba(252,196,90,0.92)',
    crmRoles: ['admin', 'vendedor', 'marketing'],
    children: [
      {
        id: 'automacoes',
        title: 'Negativação',
        url: '/automacoes',
        icon: Ban,
        radialColor: 'rgba(252,196,90,0.92)',
        crmRoles: CRM_VENDA_ROLES,
        hideIfMarketingOnly: true,
      },
      {
        id: 'automacoesMarketing',
        title: 'Marketing',
        url: '/automacoes/marketing',
        icon: Megaphone,
        radialColor: 'rgba(252,165,165,0.92)',
        crmRoles: CRM_MKT_VISIVEL_ROLES,
      },
    ],
  },
]

const MARKETING_CRM_CHILDREN: NavChildItem[] = [
  {
    id: 'marketingConteudo',
    title: 'Marketing de conteúdo',
    url: '/marketing-conteudo',
    icon: Megaphone,
    radialColor: 'rgba(252,165,165,0.92)',
    crmRoles: CRM_MARKETING_ROLES,
  },
  {
    id: 'bibliotecaCrm',
    title: 'Biblioteca CRM',
    url: '/biblioteca-crm',
    icon: Images,
    radialColor: 'rgba(244,114,182,0.92)',
    crmRoles: CRM_MARKETING_ROLES,
  },
  {
    id: 'controleEventos',
    title: 'Controle de Eventos',
    url: '/controle-eventos',
    icon: FolderOpen,
    radialColor: 'rgba(240,210,140,0.92)',
    crmRoles: CRM_MARKETING_ROLES,
    hideIfVendedorRestricted: true,
  },
  {
    id: 'marketingApresentacao',
    title: 'Apresentação para arquitetos',
    url: '/marketing/apresentacao-interna',
    icon: Presentation,
    radialColor: 'rgba(196,181,253,0.92)',
    crmRoles: CRM_MKT_VISIVEL_ROLES,
  },
  {
    id: 'pontuaGarbo',
    title: 'Pontua Garbo',
    url: '/marketing/pontua-garbo',
    icon: Trophy,
    radialColor: 'rgba(251,191,36,0.92)',
    crmRoles: CRM_MKT_VISIVEL_ROLES,
  },
  {
    id: 'financeiroPontua',
    title: 'Financeiro Pontua',
    url: '/financeiro-pontua',
    icon: Trophy,
    radialColor: 'rgba(240,210,140,0.92)',
    crmRoles: CRM_VENDA_ROLES,
    hideIfMarketingOnly: true,
  },
  {
    id: 'controleGastos',
    title: 'Controle de gastos',
    url: '/controle-gastos',
    icon: Wallet,
    radialColor: 'rgba(74,222,128,0.92)',
    crmAdminOnly: true,
  },
  {
    id: 'adminCrmGrupo',
    title: 'Administração CRM',
    icon: Shield,
    radialColor: 'rgba(212,184,150,0.92)',
    crmAdminOnly: true,
    children: [
      {
        id: 'marcaCrm',
        title: 'Marca',
        url: '/admin/marca',
        icon: Palette,
        radialColor: 'rgba(212,184,150,0.92)',
        crmAdminOnly: true,
      },
      {
        id: 'adminUsuarios',
        title: 'Usuários CRM',
        url: '/admin',
        icon: Shield,
        radialColor: 'rgba(240,210,140,0.92)',
        crmAdminOnly: true,
      },
      {
        id: 'adminWebhooks',
        title: 'Webhooks',
        url: '/admin/webhooks',
        icon: Webhook,
        radialColor: 'rgba(125,211,252,0.92)',
        crmAdminOnly: true,
      },
    ],
  },
]

export const NAV_MAIN_ITEMS: NavMainItem[] = [
  {
    id: 'comercial',
    title: 'CRM',
    url: '/pipeline',
    icon: Briefcase,
    radialColor: 'rgba(96,240,160,0.92)',
    sector: 'comercial',
    roles: ['Administrador'],
    crmRoles: CRM_COMERCIAL_ROLES,
    hideIfMarketingOnly: true,
    children: COMERCIAL_CHILDREN,
  },
  {
    id: 'marketingCrm',
    title: 'Marketing',
    url: '/marketing-conteudo',
    icon: Megaphone,
    radialColor: 'rgba(252,165,165,0.92)',
    sector: 'comercial',
    roles: [],
    crmRoles: CRM_MKT_VISIVEL_ROLES,
    children: MARKETING_CRM_CHILDREN,
  },
  {
    id: 'parceiros',
    title: 'Parceiros',
    url: '/portal-parceiro',
    icon: Handshake,
    radialColor: 'rgba(214,180,140,0.92)',
    sector: 'comercial',
    roles: [],
    parceiroOnly: true,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    radialColor: 'rgba(240,210,140,0.92)',
    sector: 'casa',
    roles: ['Administrador', 'Financeiro'],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    url: '/clientes',
    icon: Landmark,
    radialColor: 'rgba(240,210,140,0.92)',
    sector: 'casa',
    roles: ['Administrador', 'Financeiro'],
    children: FINANCEIRO_CHILDREN,
  },
  {
    id: 'funcionariosGrupo',
    title: 'Funcionários',
    url: '/funcionarios',
    icon: UserCog,
    radialColor: 'rgba(240,210,140,0.92)',
    sector: 'casa',
    roles: ['Administrador', 'Financeiro', 'MontadorAdmin'],
    children: FUNCIONARIOS_CHILDREN,
  },
  {
    id: 'obras',
    title: 'Obras',
    url: '/agenda-obras',
    icon: HardHat,
    radialColor: 'rgba(251,146,60,0.92)',
    sector: 'casa',
    roles: ['Administrador', 'AdministradorObras', 'Montador', 'MontadorAdmin', 'Financeiro'],
    crmRoles: CRM_COMERCIAL_ROLES,
    children: OBRAS_CHILDREN,
  },
  {
    id: 'pontoGrupo',
    title: 'Bater Ponto',
    url: '/bater-ponto',
    icon: Clock,
    radialColor: 'rgba(74,222,128,0.92)',
    sector: 'casa',
    roles: ['Montador', 'MontadorAdmin', 'AdministradorObras'],
    children: PONTO_CHILDREN,
  },
  {
    id: 'meuFinanceiro',
    title: 'Meu Financeiro',
    url: '/meu-financeiro',
    icon: Wallet,
    radialColor: 'rgba(240,210,140,0.92)',
    sector: 'casa',
    roles: ['Montador', 'MontadorAdmin'],
  },
  {
    id: 'meuPerfil',
    title: 'Meu Perfil',
    url: '/meu-perfil',
    icon: UserCircle,
    radialColor: 'rgba(240,210,140,0.92)',
    sector: 'casa',
    roles: ['Montador', 'MontadorAdmin', 'AdministradorObras', 'Financeiro'],
  },
  {
    id: 'biblioteca',
    title: 'Biblioteca',
    url: '/biblioteca',
    icon: Images,
    radialColor: 'rgba(244,114,182,0.92)',
    sector: 'casa',
    roles: ['Administrador', 'Financeiro'],
  },
  {
    id: 'visualizacao',
    title: 'Visualização',
    url: '/visualizacao',
    icon: Monitor,
    radialColor: 'rgba(167,139,250,0.92)',
    sector: 'casa',
    roles: ['Administrador', 'Financeiro', 'AdministradorObras', 'MontadorAdmin', 'Montador', 'Visualizador'],
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    url: '/configuracoes',
    icon: Settings,
    radialColor: 'rgba(156,163,175,0.92)',
    sector: 'casa',
    roles: ['Administrador'],
  },
]

export function getVisibleNavMainItems(ctx: NavVisibilityContext): NavMainItem[] {
  if (!ctx.roles.length && !(ctx.crmRoles?.length) && !ctx.showParceiros) return []
  return NAV_MAIN_ITEMS
    .filter(item => isNavEntryVisible(item, ctx))
    .map(item => {
      if (!item.children) return item
      const children = filterNavChildren(item.children, ctx)
      if (item.id === 'comercial' && ctx.projetistaOnly) {
        return { ...item, url: '/projetos', children }
      }
      if (item.id === 'obras' && children.length > 0) {
        return { ...item, url: children[0]?.url ?? item.url, children }
      }
      return { ...item, children }
    })
    .filter(item => !item.children || item.children.length > 0)
}

export function attachPipelineKanbanPages(
  items: NavMainItem[],
  pages: Array<{ slug: string; nome: string; ativo: boolean; ordem: number }>,
  manutencaoCount = 0,
): NavMainItem[] {
  const extras: NavChildItem[] = pages
    .filter(page => page.ativo && page.slug && page.slug !== 'pipeline')
    .sort((a, b) => a.ordem - b.ordem)
    .map(page => ({
      id: `pipelineKanban:${page.slug}`,
      title: page.nome,
      url: `/pipeline/${page.slug}`,
      icon: Kanban,
      radialColor: 'rgba(96,240,160,0.92)',
      crmRoles: CRM_COMERCIAL_ROLES,
      hideIfMarketingOnly: true,
      hideIfProjetistaOnly: true,
      badge: isManutencaoKanbanPage(page) && manutencaoCount > 0 ? manutencaoCount : undefined,
    }))

  if (extras.length === 0) return items

  const inject = (children: NavChildItem[]): NavChildItem[] =>
    children.map(child => {
      if (child.id === 'pipelineGrupo' && child.children?.length) {
        const config = child.children.filter(entry => entry.id === 'pipelineConfig')
        const rest = child.children.filter(entry => entry.id !== 'pipelineConfig')
        return { ...child, children: [...rest, ...extras, ...config] }
      }
      if (child.children?.length) return { ...child, children: inject(child.children) }
      return child
    })

  return items.map(item => (item.children ? { ...item, children: inject(item.children) } : item))
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

export function isComercialSection(section: ActiveSection): boolean {
  let found = false
  walkNavChildren(COMERCIAL_CHILDREN, item => {
    if (!item.children?.length && item.id === section) found = true
  })
  return found
}

export function isMarketingCrmSection(section: ActiveSection): boolean {
  let found = false
  walkNavChildren(MARKETING_CRM_CHILDREN, item => {
    if (!item.children?.length && item.id === section) found = true
  })
  return found
}

export function isCrmSection(section: ActiveSection): boolean {
  return isComercialSection(section) || isMarketingCrmSection(section)
}

export function isCasaSection(section: ActiveSection): boolean {
  return !isCrmSection(section) && section !== 'portalParceiro'
}

export function isChegadaMateriaisSection(section: ActiveSection): boolean {
  return section === 'calendarioChegadaMateriais'
}

export function isLeafPathActive(pathname: string, url: string | undefined): boolean {
  if (!url) return false
  const pathOnly = url.split('?')[0]
  if (pathOnly === '/pipeline') return pathname === '/pipeline'
  if (pathOnly === '/admin') return pathname === '/admin'
  if (pathname === pathOnly) return true
  if (pathOnly !== '/' && pathname.startsWith(`${pathOnly}/`)) return true
  return false
}

/** Destaca item do menu de obras conforme `?view=` (Filas/Kanban vs Calendário). */
export function isObrasNavItemActive(
  pathname: string,
  search: string,
  itemId: string,
  itemUrl: string | undefined,
): boolean {
  if (pathname !== '/agenda-obras' && pathname !== '/calendario-obras') {
    return isLeafPathActive(pathname, itemUrl)
  }
  const view = new URLSearchParams(search).get('view')
  const onCalendario =
    pathname === '/calendario-obras' || view === 'calendario'
  if (itemId === 'calendarioObras') return onCalendario
  if (itemId === 'agendaObras') return !onCalendario
  return isLeafPathActive(pathname, itemUrl)
}

export function sectionFromPath(pathname: string, search = ''): ActiveSection {
  if (pathname.startsWith('/funcionarios')) return 'funcionarios'
  if (pathname.startsWith('/pipeline/configuracoes')) return 'pipelineConfig'
  if (pathname.startsWith('/pipeline')) return 'pipeline'
  if (pathname.startsWith('/automacoes/marketing')) return 'automacoesMarketing'
  if (pathname.startsWith('/automacoes')) return 'automacoes'
  if (pathname.startsWith('/marketing/apresentacao-interna')) return 'marketingApresentacao'
  if (pathname.startsWith('/marketing/pontua-garbo')) return 'pontuaGarbo'
  if (pathname.startsWith('/biblioteca-crm')) return 'bibliotecaCrm'
  if (pathname.startsWith('/admin/webhooks')) return 'adminWebhooks'
  if (pathname.startsWith('/admin/marca')) return 'marcaCrm'
  if (pathname === '/admin' || pathname.startsWith('/admin')) return 'adminUsuarios'
  if (pathname.startsWith('/projetos-producao')) return 'projetosProducao'
  if (pathname === '/projetos' && new URLSearchParams(search).get(PROJETOS_ABA_PARAM) === 'producao') {
    return 'projetosProducao'
  }
  if (pathname.startsWith('/projetos')) return 'projetos'
  if (pathname.startsWith('/contratos')) return 'contratosCrm'
  if (pathname.startsWith('/orcamento-slides')) return 'orcamentoSlides'
  if (pathname.startsWith('/orcamentos-ia')) return 'orcamentosIa'
  if (pathname.startsWith('/markup')) return 'markupCrm'
  if (pathname.startsWith('/marketing-conteudo')) return 'marketingConteudo'
  if (pathname.startsWith('/controle-eventos') || pathname.startsWith('/eventos-crm')) return 'controleEventos'
  if (pathname.startsWith('/portal-parceiro')) return 'portalParceiro'

  if (pathname === '/agenda-obras' || pathname === '/calendario-obras') {
    const raw = search.startsWith('?') ? search.slice(1) : search
    const view = new URLSearchParams(raw).get('view')
    if (pathname === '/calendario-obras' || view === 'calendario') return 'calendarioObras'
    return 'agendaObras'
  }

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
    '/projetos-producao': 'projetosProducao',
    '/pedidos-obras': 'pedidosObras',
    '/acompanhamento-obras': 'acompanhamentoObras',
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
    '/leads': 'leads',
    '/projetos': 'projetos',
    '/agenda-comercial': 'agendaComercial',
    '/contratos': 'contratosCrm',
    '/markup': 'markupCrm',
    '/orcamento-slides': 'orcamentoSlides',
    '/orcamentos-ia': 'orcamentosIa',
    '/marketing-conteudo': 'marketingConteudo',
    '/biblioteca-crm': 'bibliotecaCrm',
    '/admin/marca': 'marcaCrm',
    '/admin': 'adminUsuarios',
    '/admin/webhooks': 'adminWebhooks',
    '/controle-gastos': 'controleGastos',
    '/controle-eventos': 'controleEventos',
    '/financeiro-pontua': 'financeiroPontua',
    '/portal-parceiro': 'portalParceiro',
    '/eventos-crm': 'controleEventos',
    '/pipeline/configuracoes': 'pipelineConfig',
  }
  return map[pathname] ?? 'dashboard'
}

/** Rota inicial após login conforme o perfil do usuário. */
export function defaultPathForRole(role: UserRole | null): string {
  if (role === 'Visualizador') return '/visualizacao'
  if (role === 'Montador') return '/agenda-obras?view=calendario'
  if (role === 'Marceneiro') return '/meu-perfil'
  if (role === 'MontadorAdmin' || role === 'AdministradorObras') return '/agenda-obras'
  if (role === 'Financeiro' || role === 'Administrador') return '/dashboard'
  return '/meu-perfil'
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

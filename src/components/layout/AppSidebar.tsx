import { Fragment, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Briefcase, ChevronRight, Landmark, User } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { SidebarAmberRibbon } from '@/components/layout/SidebarAmberRibbon'
import { SidebarSearchEmpty, SidebarSearchField } from '@/components/layout/SidebarSearchField'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApp } from '@/context/AppContext'
import { useKanbanConfig } from '@/hooks/useKanbanConfig'
import { useManutencaoAttentionCount } from '@/hooks/useManutencaoAttentionCount'
import {
  attachPipelineKanbanPages,
  getVisibleNavMainItems,
  isComercialSection,
  isFinanceiroSection,
  isFuncionariosSection,
  isLeafPathActive,
  isMarketingCrmSection,
  isObrasNavItemActive,
  isObrasSection,
  navVisibilityFromProfiles,
  sectionFromPath,
  type NavChildItem,
  type NavItemId,
  type NavMainItem,
} from '@/lib/app-navigation'
import { colaboradorCrmRoles, canAccessCrmPath } from '@/lib/crm-identity'
import { canAccessSection } from '@/lib/role-access'
import { flattenSidebarPages, matchSidebarClientes, matchSidebarCobrancas, matchSidebarLeads, matchSidebarObras, matchSidebarPages } from '@/lib/sidebar-search'
import { useSidebarLeadsIndex } from '@/hooks/useSidebarLeadsIndex'
import { useSidebarCobrancasIndex } from '@/hooks/useSidebarCobrancasIndex'
import { useObras } from '@/hooks/useObras'
import { useFinanceDataOptional } from '@/context/FinanceDataContext'
import { isPontoLightPath } from '@/lib/webgl-support'
import { cn } from '@/lib/utils'
import type { ActiveSection } from '@/types'

interface NavChildTreeProps {
  child: NavChildItem
  activeSection: ActiveSection
  pathname: string
  search: string
  depth: number
  sidebarOpen: boolean
  renderLeaf: (
    url: string,
    title: string,
    Icon: NavMainItem['icon'],
    isActive: boolean,
    nested?: boolean,
    depth?: number,
    badge?: number,
  ) => React.ReactNode
}

function isNavChildActive(
  item: NavChildItem,
  pathname: string,
  search: string,
  section: ActiveSection,
): boolean {
  if (item.children?.length) {
    return item.children.some(child => isNavChildActive(child, pathname, search, section))
  }
  if (item.id === 'agendaObras' || item.id === 'calendarioObras') {
    return isObrasNavItemActive(pathname, search, item.id, item.url)
  }
  if (item.url && isLeafPathActive(pathname, item.url)) return true
  return item.id === section
}

function NavChildTree({
  child,
  activeSection,
  pathname,
  search,
  depth,
  sidebarOpen,
  renderLeaf,
}: NavChildTreeProps) {
  const ChildIcon = child.icon
  const hasNested = Boolean(child.children?.length)
  const isActive = hasNested
    ? child.children!.some(c => isNavChildActive(c, pathname, search, activeSection))
    : isNavChildActive(child, pathname, search, activeSection)
  const [open, setOpen] = useState(isActive)

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  if (!hasNested) {
    return (
      <li>
        {renderLeaf(
          child.url!,
          child.title,
          ChildIcon,
          isActive,
          true,
          depth,
          child.badge,
        )}
      </li>
    )
  }

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen} className="group/nested">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            onClick={e => {
              e.stopPropagation()
              if (!sidebarOpen) setOpen(true)
            }}
            className={cn(!isActive && 'text-[#d4bc9f]', 'cursor-pointer w-full', depth > 0 && 'pl-6')}
          >
            <ChildIcon className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">{child.title}</span>
            <ChevronRight
              className={cn(
                'ml-auto h-4 w-4 shrink-0 text-[#edd9c4] transition-transform group-data-[collapsible=icon]:hidden',
                open && 'rotate-90',
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
          <ul
            className={cn(
              'mt-0.5 flex flex-col gap-0.5 border-l pl-2',
              depth === 0 ? 'ml-2' : 'ml-3',
              'border-[rgba(240,210,140,0.18)]',
            )}
          >
            {child.children!.map(sub => (
              <NavChildTree
                key={sub.id}
                child={sub}
                activeSection={activeSection}
                pathname={pathname}
                search={search}
                depth={depth + 1}
                sidebarOpen={sidebarOpen}
                renderLeaf={renderLeaf}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

function SectorPlaque({
  tone,
  title,
  subtitle,
  icon: Icon,
  open,
}: {
  tone: 'comercial' | 'casa'
  title: string
  subtitle: string
  icon: NavMainItem['icon']
  open?: boolean
}) {
  return (
    <div
      data-open={open ? 'true' : 'false'}
      className={cn(
        'sidebar-sector-head group-data-[collapsible=icon]:hidden',
        tone === 'comercial' ? 'sidebar-sector-head--comercial' : 'sidebar-sector-head--casa',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="sidebar-sector-kicker">{title}</span>
        <ChevronRight
          className={cn(
            'ml-auto h-3.5 w-3.5 shrink-0 opacity-80 transition-transform',
            open && 'rotate-90',
          )}
        />
      </div>
      <p className={cn('sidebar-sector-sub', !open && 'sr-only')}>{subtitle}</p>
    </div>
  )
}

export function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { roles, userProfile, crmProfile } = useApp()
  const { open, setOpen, isMobile, setOpenMobile } = useSidebar()
  const activeSection = sectionFromPath(location.pathname, location.search)
  const skipWebGL = isPontoLightPath(location.pathname)
  const { pages } = useKanbanConfig()
  const { count: manutencaoCount } = useManutencaoAttentionCount()
  const canSearchLeads = canAccessCrmPath('/leads', crmProfile, userProfile)
  const canSearchObras = canAccessSection(roles, 'agendaObras')
  const canSearchCobrancas = canAccessSection(roles, 'cobranças')
  const canSearchClientes = canAccessSection(roles, 'clientes')

  const items = attachPipelineKanbanPages(
    getVisibleNavMainItems(navVisibilityFromProfiles(roles, crmProfile, userProfile)),
    pages,
    manutencaoCount,
  )
  const comercialItems = items.filter(item => item.sector === 'comercial')
  const casaItems = items.filter(item => item.sector === 'casa')
  const [searchQuery, setSearchQuery] = useState('')
  const allPages = useMemo(() => flattenSidebarPages(items), [items])
  const searchHits = useMemo(() => matchSidebarPages(allPages, searchQuery), [allPages, searchQuery])
  const { data: leadIndex = [], isFetching: leadsFetching } = useSidebarLeadsIndex(canSearchLeads)
  const obrasStore = useObras()
  const finance = useFinanceDataOptional()
  const { data: cobrancaIndex = [], isFetching: cobrancasFetching } = useSidebarCobrancasIndex(canSearchCobrancas)
  const leadHits = useMemo(
    () => (canSearchLeads ? matchSidebarLeads(leadIndex, searchQuery) : []),
    [canSearchLeads, leadIndex, searchQuery],
  )
  const obraHits = useMemo(
    () => (canSearchObras ? matchSidebarObras(obrasStore.data, searchQuery, leadIndex) : []),
    [canSearchObras, obrasStore.data, searchQuery, leadIndex],
  )
  const cobrancaHits = useMemo(
    () => (canSearchCobrancas ? matchSidebarCobrancas(cobrancaIndex, searchQuery, leadIndex) : []),
    [canSearchCobrancas, cobrancaIndex, searchQuery, leadIndex],
  )
  const clienteHits = useMemo(() => {
    if (!canSearchClientes) return []
    const clientes = finance?.clientes.data ?? []
    const cobrancaNomes = new Set(cobrancaHits.map(hit => hit.title))
    return matchSidebarClientes(clientes, searchQuery).filter(hit => !cobrancaNomes.has(hit.title))
  }, [canSearchClientes, finance?.clientes.data, searchQuery, cobrancaHits])
  const financeiroHits = useMemo(
    () => [...cobrancaHits, ...clienteHits],
    [cobrancaHits, clienteHits],
  )
  const isSearching = searchQuery.trim().length > 0
  const crmHits = searchHits.filter(hit => hit.sector === 'comercial')
  const casaHits = searchHits.filter(hit => hit.sector === 'casa')
  const searchEmpty =
    isSearching &&
    searchHits.length === 0 &&
    leadHits.length === 0 &&
    obraHits.length === 0 &&
    financeiroHits.length === 0 &&
    !leadsFetching &&
    !cobrancasFetching

  const financeiroAbertoPorRota = isFinanceiroSection(activeSection)
  const funcionariosAbertoPorRota = isFuncionariosSection(activeSection)
  const obrasAbertoPorRota = isObrasSection(activeSection)
  const comercialAbertoPorRota = isComercialSection(activeSection)
  const marketingAbertoPorRota = isMarketingCrmSection(activeSection)
  const pontoAbertoPorRota =
    activeSection === 'baterPonto'
    || activeSection === 'historicoPonto'
    || activeSection === 'resumoPonto'

  const [financeiroOpen, setFinanceiroOpen] = useState(financeiroAbertoPorRota)
  const [funcionariosOpen, setFuncionariosOpen] = useState(funcionariosAbertoPorRota)
  const [obrasOpen, setObrasOpen] = useState(obrasAbertoPorRota)
  const [pontoOpen, setPontoOpen] = useState(pontoAbertoPorRota)
  const [comercialOpen, setComercialOpen] = useState(comercialAbertoPorRota)
  const [marketingOpen, setMarketingOpen] = useState(marketingAbertoPorRota)
  const routeSector: 'crm' | 'movelaria' =
    comercialAbertoPorRota || marketingAbertoPorRota || activeSection === 'portalParceiro'
      ? 'crm'
      : 'movelaria'
  const [sectorOverride, setSectorOverride] = useState<'crm' | 'movelaria' | 'none' | null>(null)
  const openSector = sectorOverride ?? routeSector
  const comercialSectorOpen = openSector === 'crm'
  const casaSectorOpen = openSector === 'movelaria'

  const handleSectorOpenChange = (sector: 'crm' | 'movelaria', nextOpen: boolean) => {
    if (!open) {
      setOpen(true)
      setSectorOverride(sector)
      return
    }
    setSectorOverride(nextOpen ? sector : 'none')
  }

  useEffect(() => {
    setSectorOverride(null)
  }, [location.pathname])

  useEffect(() => {
    if (comercialAbertoPorRota) {
      setComercialOpen(true)
      setFinanceiroOpen(false)
    }
  }, [comercialAbertoPorRota])

  useEffect(() => {
    if (marketingAbertoPorRota) {
      setMarketingOpen(true)
      setFinanceiroOpen(false)
    }
  }, [marketingAbertoPorRota])

  useEffect(() => {
    if (financeiroAbertoPorRota) {
      setFinanceiroOpen(true)
      setComercialOpen(false)
      setMarketingOpen(false)
    }
  }, [financeiroAbertoPorRota])

  useEffect(() => {
    if (funcionariosAbertoPorRota) setFuncionariosOpen(true)
  }, [funcionariosAbertoPorRota])

  useEffect(() => {
    if (obrasAbertoPorRota) setObrasOpen(true)
  }, [obrasAbertoPorRota])

  useEffect(() => {
    if (pontoAbertoPorRota) setPontoOpen(true)
  }, [pontoAbertoPorRota])

  const grupoOpenState: Partial<Record<NavItemId, boolean>> = {
    financeiro: financeiroOpen,
    funcionariosGrupo: funcionariosOpen,
    obras: obrasOpen,
    pontoGrupo: pontoOpen,
    comercial: comercialOpen,
    marketingCrm: marketingOpen,
  }

  const setGrupoOpenById = (id: NavItemId, next: boolean) => {
    if (id === 'financeiro') setFinanceiroOpen(next)
    else if (id === 'funcionariosGrupo') setFuncionariosOpen(next)
    else if (id === 'obras') setObrasOpen(next)
    else if (id === 'pontoGrupo') setPontoOpen(next)
    else if (id === 'comercial') setComercialOpen(next)
    else if (id === 'marketingCrm') setMarketingOpen(next)
  }

  const handleNavClick = (url: string) => {
    setSearchQuery('')
    if (!open) {
      setOpen(true)
      navigate(url)
      return
    }
    navigate(url)
    if (isMobile) setOpenMobile(false)
  }

  const profileHref = colaboradorCrmRoles(crmProfile).length > 0
    ? '/profile'
    : canAccessSection(roles, 'meuPerfil')
      ? '/meu-perfil'
      : null

  const renderLeaf = (
    url: string,
    title: string,
    Icon: NavMainItem['icon'],
    isActive: boolean,
    nested = false,
    depth = 0,
    badge?: number,
    trail?: string,
  ) => (
    <SidebarMenuButton
      isActive={isActive}
      onClick={e => {
        e.stopPropagation()
        handleNavClick(url)
      }}
      className={cn(
        !isActive && 'text-[#d4bc9f]',
        'cursor-pointer',
        nested && (depth === 0 ? 'pl-6' : 'pl-8'),
        nested && 'group-data-[collapsible=icon]:!pl-2',
        trail && 'h-auto min-h-8 items-start py-1.5',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <span className="block truncate">{title}</span>
        {trail ? <span className="sidebar-search-trail">{trail}</span> : null}
      </span>
      {typeof badge === 'number' && badge > 0 ? (
        <span className="sidebar-nav-badge group-data-[collapsible=icon]:hidden">{badge}</span>
      ) : null}
    </SidebarMenuButton>
  )

  const renderNavItems = (list: NavMainItem[], tone: 'comercial' | 'casa') =>
    list.map(item => {
      const Icon = item.icon

      if (item.id === 'comercial' && item.children?.length) {
        return (
          <Fragment key={item.id}>
            {item.children.map(child => (
              <NavChildTree
                key={child.id}
                child={child}
                activeSection={activeSection}
                pathname={location.pathname}
                depth={0}
                sidebarOpen={open}
                renderLeaf={renderLeaf}
              />
            ))}
          </Fragment>
        )
      }

      if (item.children?.length) {
        const childActive = item.children.some(c =>
          isNavChildActive(c, location.pathname, location.search, activeSection),
        )
        const grupoAtivo = childActive || Boolean(grupoOpenState[item.id])
        const setGrupoOpen = (next: boolean) => setGrupoOpenById(item.id, next)

        return (
          <Collapsible
            key={item.id}
            open={grupoAtivo}
            onOpenChange={setGrupoOpen}
            className={cn(
              'group/collapsible sidebar-folder',
              tone === 'comercial' ? 'sidebar-folder--comercial' : 'sidebar-folder--casa',
              item.id === 'financeiro' && 'sidebar-folder--financeiro',
            )}
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={childActive}
                  onClick={e => {
                    e.stopPropagation()
                    if (!open) {
                      setOpen(true)
                      setGrupoOpen(true)
                    }
                  }}
                  className={cn(
                    !childActive && 'text-[#d4bc9f]',
                    'cursor-pointer w-full',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.title}
                  </span>
                  <ChevronRight
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0 text-[#edd9c4] transition-transform group-data-[collapsible=icon]:hidden',
                      grupoAtivo && 'rotate-90',
                    )}
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                <ul className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-[rgba(240,210,140,0.18)] pl-2">
                  {item.children.map(child => (
                    <NavChildTree
                      key={child.id}
                      child={child}
                      activeSection={activeSection}
                      pathname={location.pathname}
                      search={location.search}
                      depth={0}
                      sidebarOpen={open}
                      renderLeaf={renderLeaf}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )
      }

      const isActive = isLeafPathActive(location.pathname, item.url) || activeSection === item.id
      return (
        <SidebarMenuItem key={item.id}>
          {renderLeaf(item.url, item.title, Icon, isActive)}
        </SidebarMenuItem>
      )
    })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative overflow-hidden border-b border-[rgba(240,210,140,0.12)] pb-3">
        {skipWebGL ? null : <SidebarAmberRibbon active={open && !isMobile} />}
        <div className="relative z-[2] isolate flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center">
          <div className="hidden shrink-0 group-data-[collapsible=icon]:block">
            <Logo full={false} halo={false} />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <Logo full halo={false} height={72} />
          </div>
        </div>
        <div className="relative z-[2]">
          <SidebarSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            collapsed={!open && !isMobile}
            onExpand={() => {
              if (isMobile) setOpenMobile(true)
              else setOpen(true)
            }}
            disableAura={skipWebGL}
            mobileSheet={isMobile}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden group-data-[collapsible=icon]:overflow-x-visible">
        <ScrollArea className={cn('h-full sidebar-scroll', !open && !isMobile && 'sidebar-scroll--icon')}>
          {isSearching ? (
            <div className="px-1 pb-3">
              {searchEmpty ? <SidebarSearchEmpty query={searchQuery} /> : null}
              {leadHits.length > 0 ? (
                <>
                  <p className="sidebar-search-kicker sidebar-search-kicker--crm">Leads</p>
                  <SidebarMenu>
                    {leadHits.map(hit => {
                      const Icon = hit.icon
                      const leadId = hit.id.replace(/^lead-/, '')
                      const isActive =
                        location.pathname === '/pipeline' &&
                        new URLSearchParams(location.search).get('id') === leadId
                      return (
                        <SidebarMenuItem key={hit.id}>
                          {renderLeaf(hit.url, hit.title, Icon, isActive, false, 0, undefined, hit.trail)}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </>
              ) : null}
              {obraHits.length > 0 ? (
                <>
                  <p className="sidebar-search-kicker sidebar-search-kicker--casa">Agenda de Obras</p>
                  <SidebarMenu>
                    {obraHits.map(hit => {
                      const Icon = hit.icon
                      const obraId = hit.id.replace(/^obra-/, '')
                      const isActive =
                        location.pathname === '/agenda-obras' &&
                        new URLSearchParams(location.search).get('obra') === obraId
                      return (
                        <SidebarMenuItem key={hit.id}>
                          {renderLeaf(hit.url, hit.title, Icon, isActive, false, 0, undefined, hit.trail)}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </>
              ) : null}
              {financeiroHits.length > 0 ? (
                <>
                  <p className="sidebar-search-kicker sidebar-search-kicker--casa">Financeiro</p>
                  <SidebarMenu>
                    {financeiroHits.map(hit => {
                      const Icon = hit.icon
                      const isActive = isLeafPathActive(location.pathname, hit.url.split('?')[0])
                      return (
                        <SidebarMenuItem key={hit.id}>
                          {renderLeaf(hit.url, hit.title, Icon, isActive, false, 0, undefined, hit.trail)}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </>
              ) : null}
              {crmHits.length > 0 ? (
                <>
                  <p className="sidebar-search-kicker sidebar-search-kicker--crm">CRM</p>
                  <SidebarMenu>
                    {crmHits.map(hit => {
                      const Icon = hit.icon
                      const isActive = isLeafPathActive(location.pathname, hit.url)
                      return (
                        <SidebarMenuItem key={hit.id}>
                          {renderLeaf(hit.url, hit.title, Icon, isActive, false, 0, undefined, hit.trail)}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </>
              ) : null}
              {casaHits.length > 0 ? (
                <>
                  <p className="sidebar-search-kicker sidebar-search-kicker--casa">Movelaria</p>
                  <SidebarMenu>
                    {casaHits.map(hit => {
                      const Icon = hit.icon
                      const isActive = isLeafPathActive(location.pathname, hit.url)
                      return (
                        <SidebarMenuItem key={hit.id}>
                          {renderLeaf(hit.url, hit.title, Icon, isActive, false, 0, undefined, hit.trail)}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </>
              ) : null}
            </div>
          ) : (
            <>
          {comercialItems.length > 0 ? (
            <Collapsible
              open={comercialSectorOpen}
              onOpenChange={next => handleSectorOpenChange('crm', next)}
            >
              <SidebarGroup
                className="sidebar-sector sidebar-sector--comercial pt-1"
                data-open={comercialSectorOpen ? 'true' : 'false'}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full text-left"
                    aria-controls="sidebar-setor-crm"
                    onClick={e => {
                      e.stopPropagation()
                    }}
                  >
                    <SectorPlaque
                      tone="comercial"
                      title="CRM"
                      subtitle="Vendas, leads e pipeline"
                      icon={Briefcase}
                      open={comercialSectorOpen}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenu id="sidebar-setor-crm">{renderNavItems(comercialItems, 'comercial')}</SidebarMenu>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ) : null}

          {casaItems.length > 0 ? (
            <Collapsible
              open={casaSectorOpen}
              onOpenChange={next => handleSectorOpenChange('movelaria', next)}
            >
              <SidebarGroup
                className="sidebar-sector sidebar-sector--casa"
                data-open={casaSectorOpen ? 'true' : 'false'}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full text-left"
                    aria-controls="sidebar-setor-movelaria"
                    onClick={e => {
                      e.stopPropagation()
                    }}
                  >
                    <SectorPlaque
                      tone="casa"
                      title="Movelaria"
                      subtitle="Caixa, obras e equipe"
                      icon={Landmark}
                      open={casaSectorOpen}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenu id="sidebar-setor-movelaria">{renderNavItems(casaItems, 'casa')}</SidebarMenu>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ) : null}
            </>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-[rgba(240,210,140,0.12)]">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            if (profileHref) handleNavClick(profileHref)
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[rgba(240,210,140,0.08)] group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(240,210,140,0.35)] bg-[rgba(240,210,140,0.12)]">
            <User className="h-4 w-4 text-[#f2d892]" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-semibold text-cream">
              {userProfile?.nome || crmProfile?.nome || userProfile?.email || crmProfile?.email || 'Perfil'}
            </p>
            <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
              Abrir perfil · GARBO
            </p>
          </div>
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}

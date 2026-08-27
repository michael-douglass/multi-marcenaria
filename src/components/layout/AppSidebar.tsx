import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, User } from 'lucide-react'
import { Logo } from '@/components/Logo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApp } from '@/context/AppContext'
import {
  getVisibleNavMainItems,
  isFinanceiroSection,
  isFuncionariosSection,
  isObrasSection,
  sectionFromPath,
  type NavChildItem,
  type NavItemId,
  type NavMainItem,
} from '@/lib/app-navigation'
import { cn } from '@/lib/utils'
import type { ActiveSection } from '@/types'

interface NavChildTreeProps {
  child: NavChildItem
  activeSection: ActiveSection
  depth: number
  sidebarOpen: boolean
  renderLeaf: (
    url: string,
    title: string,
    Icon: NavMainItem['icon'],
    isActive: boolean,
    nested?: boolean,
    depth?: number,
  ) => React.ReactNode
}

function NavChildTree({
  child,
  activeSection,
  depth,
  sidebarOpen,
  renderLeaf,
}: NavChildTreeProps) {
  const ChildIcon = child.icon
  const hasNested = Boolean(child.children?.length)
  const isActive = hasNested
    ? child.children!.some(c => isNavChildActive(c, activeSection))
    : activeSection === child.id
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
          activeSection === child.id,
          true,
          depth,
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
            className={cn(!isActive && 'text-[#d4bc9f]', 'cursor-pointer w-full', depth > 0 && 'pl-7')}
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
              'mt-0.5 flex flex-col gap-0.5 border-l border-[rgba(240,210,140,0.15)]',
              depth === 0 ? 'ml-2 pl-2' : 'ml-4 pl-2',
            )}
          >
            {child.children!.map(sub => (
              <NavChildTree
                key={sub.id}
                child={sub}
                activeSection={activeSection}
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

function isNavChildActive(item: NavChildItem, section: ActiveSection): boolean {
  if (item.children?.length) {
    return item.children.some(child => isNavChildActive(child, section))
  }
  return item.id === section
}

export function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { roles, userProfile } = useApp()
  const { open, setOpen, isMobile, setOpenMobile } = useSidebar()
  const activeSection = sectionFromPath(location.pathname)

  const items = getVisibleNavMainItems({ roles })
  const financeiroAbertoPorRota = isFinanceiroSection(activeSection)
  const funcionariosAbertoPorRota = isFuncionariosSection(activeSection)
  const obrasAbertoPorRota = isObrasSection(activeSection)
  const pontoAbertoPorRota =
    activeSection === 'baterPonto'
    || activeSection === 'historicoPonto'
    || activeSection === 'resumoPonto'

  const [financeiroOpen, setFinanceiroOpen] = useState(financeiroAbertoPorRota)
  const [funcionariosOpen, setFuncionariosOpen] = useState(funcionariosAbertoPorRota)
  const [obrasOpen, setObrasOpen] = useState(obrasAbertoPorRota)
  const [pontoOpen, setPontoOpen] = useState(pontoAbertoPorRota)

  useEffect(() => {
    if (financeiroAbertoPorRota) setFinanceiroOpen(true)
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
  }

  const setGrupoOpenById = (id: NavItemId, open: boolean) => {
    if (id === 'financeiro') setFinanceiroOpen(open)
    else if (id === 'funcionariosGrupo') setFuncionariosOpen(open)
    else if (id === 'obras') setObrasOpen(open)
    else if (id === 'pontoGrupo') setPontoOpen(open)
  }

  const handleNavClick = (url: string) => {
    if (!open) {
      setOpen(true)
      navigate(url)
      return
    }
    navigate(url)
    if (isMobile) setOpenMobile(false)
  }

  const renderLeaf = (
    url: string,
    title: string,
    Icon: NavMainItem['icon'],
    isActive: boolean,
    nested = false,
    depth = 0,
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
        nested && (depth === 0 ? 'pl-7' : depth === 1 ? 'pl-10' : 'pl-12'),
        nested && 'group-data-[collapsible=icon]:!pl-2',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="group-data-[collapsible=icon]:hidden">{title}</span>
    </SidebarMenuButton>
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-[rgba(240,210,140,0.12)] pb-3">
        <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center">
          <div className="hidden shrink-0 group-data-[collapsible=icon]:block">
            <Logo full={false} />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <Logo full />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarGroup>
            <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
            <SidebarMenu>
              {items.map(item => {
                const Icon = item.icon

                if (item.children?.length) {
                  const childActive = item.children.some(c => isNavChildActive(c, activeSection))
                  const grupoAtivo = childActive || Boolean(grupoOpenState[item.id])
                  const setGrupoOpen = (next: boolean) => setGrupoOpenById(item.id, next)

                  return (
                    <Collapsible
                      key={item.id}
                      open={grupoAtivo}
                      onOpenChange={setGrupoOpen}
                      className="group/collapsible"
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
                                return
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
                          <ul className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-[rgba(240,210,140,0.15)] pl-2">
                            {item.children.map(child => (
                              <NavChildTree
                                key={child.id}
                                child={child}
                                activeSection={activeSection}
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

                const isActive = activeSection === item.id
                return (
                  <SidebarMenuItem key={item.id}>
                    {renderLeaf(item.url, item.title, Icon, isActive)}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-[rgba(240,210,140,0.12)]">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(240,210,140,0.35)] bg-[rgba(240,210,140,0.12)]">
            <User className="h-4 w-4 text-[#f2d892]" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-semibold text-cream">
              {userProfile?.email ?? 'Usuário'}
            </p>
            <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
              GARBO · v1.0
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

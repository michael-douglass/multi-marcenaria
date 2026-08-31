import { useEffect, useState } from 'react'
import { BarChart3, CalendarDays } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { NavigationHeader } from '@/components/layout/NavigationHeader'
import { AgendaPopup } from '@/components/layout/AgendaPopup'
import { MetricasObrasPopup } from '@/components/layout/MetricasObrasPopup'
import { FloatingAgendaGeralShell } from '@/components/layout/FloatingAgendaGeralShell'
import { ContasPagarNotifProvider } from '@/components/layout/ContasPagarNotifications'
import { useApp } from '@/context/AppContext'
import { isVisualizadorOnly } from '@/lib/role-access'
import { hasObrasAdminSectionsAccess } from '@/lib/obra-permissions'
import { cn } from '@/lib/utils'
import { canUseAgendaGeral, isCrmAppPath } from '@/lib/crm-identity'
import { isPontoLightPath } from '@/lib/webgl-support'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { AppPaperAura } from '@/components/layout/AppPaperAura'
import { CrmSelletosDock } from '@/components/crm/CrmSelletosDock'
import { useKanbanRealtimeSync } from '@/hooks/useKanbanRealtimeSync'
import { useUiPreferences } from '@/hooks/useUiPreferences'

function FloatingNavButton({
  label,
  ariaLabel,
  open,
  onClick,
  icon: Icon,
  accent,
}: {
  label: string
  ariaLabel: string
  open: boolean
  onClick: () => void
  icon: typeof CalendarDays
  accent?: 'gold' | 'emerald'
}) {
  const isEmerald = accent === 'emerald'
  const idleBorder = isEmerald ? 'rgba(74,222,128,0.45)' : 'rgba(240,210,140,0.55)'
  const activeBorder = isEmerald ? '#86efac' : '#f5e0a8'
  const idleIcon = isEmerald ? 'rgba(134,239,172,0.9)' : 'rgba(240,210,140,0.85)'
  const activeIcon = isEmerald ? '#86efac' : '#f5e0a8'
  const labelColor = isEmerald ? 'rgba(134,239,172,0.7)' : 'rgba(240,210,140,0.65)'
  const glow = isEmerald ? '0 0 28px rgba(74,222,128,0.3)' : '0 0 28px rgba(240,210,140,0.35)'

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-[8px] font-semibold uppercase tracking-[0.22em] transition-colors duration-300"
        style={{ color: open ? activeIcon : labelColor }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group relative flex h-14 w-14 items-center justify-center rounded-full border-2',
          'bg-gradient-to-br from-[rgba(20,8,4,0.98)] to-[rgba(8,3,1,0.98)]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300',
          'hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(8,3,1,0.9)]',
          isEmerald
            ? 'focus-visible:ring-[rgba(74,222,128,0.55)]'
            : 'focus-visible:ring-[rgba(240,210,140,0.55)]',
        )}
        style={{
          borderColor: open ? activeBorder : idleBorder,
          boxShadow: open ? glow : undefined,
        }}
        aria-label={ariaLabel}
        aria-pressed={open}
      >
        <span
          className={cn(
            'pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300',
            'group-hover:opacity-100',
            isEmerald
              ? 'bg-[radial-gradient(circle_at_30%_25%,rgba(74,222,128,0.18),transparent_65%)]'
              : 'bg-[radial-gradient(circle_at_30%_25%,rgba(240,210,140,0.16),transparent_65%)]',
          )}
          aria-hidden
        />
        <Icon
          className="relative h-6 w-6 transition-colors duration-300"
          style={{ color: open ? activeIcon : idleIcon }}
        />
      </button>
    </div>
  )
}

export function MainLayout() {
  useKanbanRealtimeSync()
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)
  const [isMetricasOpen, setIsMetricasOpen] = useState(false)
  const [isAgendaGeralOpen, setIsAgendaGeralOpen] = useState(false)
  const { roles, userProfile, crmProfile } = useApp()
  const { preferences, updatePreferences } = useUiPreferences()
  const location = useLocation()
  const navigate = useNavigate()
  const showAgendaGeral = canUseAgendaGeral(userProfile, crmProfile, location.pathname)

  useEffect(() => {
    if (preferences.hideFloatingPopups) setIsAgendaGeralOpen(false)
  }, [preferences.hideFloatingPopups])

  const openAgendaSafely = () => {
    // No iPhone, abrir o popup em cima da própria Agenda duplica Kanban + fotos e derruba o Safari.
    if (window.matchMedia('(max-width: 768px)').matches) {
      const onObrasPage = location.pathname === '/agenda-obras'
        || location.pathname === '/calendario-obras'
      if (!onObrasPage) navigate('/agenda-obras')
      return
    }
    setIsAgendaOpen(p => !p)
  }
  const hideAgenda = isVisualizadorOnly(roles)
  const showMetricasFab = hasObrasAdminSectionsAccess(roles)
  // No fluxo de ponto o botão flutuante cobre “Tirar selfie / Salvar” no celular.
  const hideFabsOnPonto = isPontoLightPath(location.pathname)
  const isCrmArea = isCrmAppPath(location.pathname)
  const hideFactoryFabs = hideFabsOnPonto || isCrmArea
  const isProjetosAtelie = location.pathname.startsWith('/projetos')
  const isPipelineBoard =
    location.pathname === '/pipeline' ||
    (location.pathname.startsWith('/pipeline/') &&
      !location.pathname.startsWith('/pipeline/configuracoes'))
  const fillViewportBoard = isProjetosAtelie
  const pipelinePageScroll = isPipelineBoard

  return (
    <ContasPagarNotifProvider>
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="relative h-svh max-h-svh min-h-0 overflow-hidden bg-transparent">
        {!hideFabsOnPonto ? <AppPaperAura /> : null}
        <NavigationHeader onOpenAgenda={openAgendaSafely} />
        <div className={cn(
          'paper-workspace relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overscroll-y-contain',
          fillViewportBoard
            ? 'overflow-hidden px-0 py-0 pb-16 sm:pb-16'
            : pipelinePageScroll
              ? 'overflow-x-hidden overflow-y-auto touch-pan-y px-2 py-2 pb-10 sm:px-3 sm:py-3 sm:pb-10'
            : 'overflow-x-hidden overflow-y-auto touch-pan-y',
          !fillViewportBoard && !pipelinePageScroll && isCrmArea
            ? 'px-2 py-2 pb-24 sm:px-3 sm:py-3 sm:pb-24'
            : !fillViewportBoard && !pipelinePageScroll && hideFabsOnPonto
              ? 'obra-layout-scroll px-4 py-4 pb-8 sm:px-6 sm:py-7 sm:pb-7 md:px-8'
              : !fillViewportBoard && !pipelinePageScroll
                ? 'obra-layout-scroll px-4 py-4 pb-24 sm:px-6 sm:py-7 md:px-8'
                : null,
        )}>
          <div className={cn(
            'flex min-w-0 flex-col',
            fillViewportBoard
              ? 'min-h-0 flex-1 overflow-hidden'
              : pipelinePageScroll
                ? 'h-auto min-h-0 flex-none overflow-visible'
                : 'min-h-0 flex-none md:flex-1',
            !isCrmArea && 'obra-layout-outlet',
          )}>
            <AppErrorBoundary>
              <Outlet />
            </AppErrorBoundary>
          </div>
        </div>
      </SidebarInset>

      {showAgendaGeral && !hideFabsOnPonto ? (
        <FloatingAgendaGeralShell
          isOpen={isAgendaGeralOpen}
          onToggle={() => setIsAgendaGeralOpen(open => !open)}
          onClose={() => setIsAgendaGeralOpen(false)}
          side={preferences.floatingAgendaSide}
          onSideChange={side => {
            void updatePreferences({ floatingAgendaSide: side })
          }}
        />
      ) : null}

      {isCrmArea && (
        <AppErrorBoundary>
          <CrmSelletosDock />
        </AppErrorBoundary>
      )}

      {!hideFactoryFabs && (!hideAgenda || showMetricasFab) && (
        <>
          <div className="fixed bottom-6 right-6 z-[201] flex flex-row-reverse items-end gap-3">
            {!hideAgenda && (
              <FloatingNavButton
                label="Agenda"
                ariaLabel="Abrir agenda"
                open={isAgendaOpen}
                onClick={openAgendaSafely}
                icon={CalendarDays}
                accent="gold"
              />
            )}
            {showMetricasFab && (
              <FloatingNavButton
                label="Métricas"
                ariaLabel="Abrir métricas de obras"
                open={isMetricasOpen}
                onClick={() => setIsMetricasOpen(p => !p)}
                icon={BarChart3}
                accent="emerald"
              />
            )}
          </div>
          {!hideAgenda && (
            <AgendaPopup open={isAgendaOpen} onClose={() => setIsAgendaOpen(false)} />
          )}
          {showMetricasFab && (
            <MetricasObrasPopup open={isMetricasOpen} onClose={() => setIsMetricasOpen(false)} />
          )}
        </>
      )}
    </SidebarProvider>
    </ContasPagarNotifProvider>
  )
}

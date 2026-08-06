import { useState } from 'react'
import { BarChart3, CalendarDays } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { NavigationHeader } from '@/components/layout/NavigationHeader'
import { AgendaPopup } from '@/components/layout/AgendaPopup'
import { MetricasObrasPopup } from '@/components/layout/MetricasObrasPopup'
import { useApp } from '@/context/AppContext'
import { isVisualizadorOnly } from '@/lib/role-access'
import { hasObrasAdminSectionsAccess } from '@/lib/obra-permissions'
import { cn } from '@/lib/utils'

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
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)
  const [isMetricasOpen, setIsMetricasOpen] = useState(false)
  const { roles } = useApp()
  const hideAgenda = isVisualizadorOnly(roles)
  const showMetricasFab = hasObrasAdminSectionsAccess(roles)

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-svh max-h-svh min-h-0 overflow-hidden">
        <NavigationHeader onOpenAgenda={() => setIsAgendaOpen(true)} />
        <div className="obra-layout-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 pb-24 sm:px-6 sm:py-7 sm:pb-7 md:px-8 touch-pan-y">
          <div className="obra-layout-outlet flex min-h-0 min-w-0 flex-none flex-col md:flex-1">
            <Outlet />
          </div>
        </div>
      </SidebarInset>

      {(!hideAgenda || showMetricasFab) && (
        <>
          <div className="fixed bottom-6 right-6 z-[201] flex flex-row-reverse items-end gap-3">
            {!hideAgenda && (
              <FloatingNavButton
                label="Agenda"
                ariaLabel="Abrir agenda"
                open={isAgendaOpen}
                onClick={() => setIsAgendaOpen(p => !p)}
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
  )
}

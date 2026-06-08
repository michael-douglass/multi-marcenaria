import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppNavRadialMenu } from '@/components/layout/AppNavRadialMenu'
import { NavigationHeader } from '@/components/layout/NavigationHeader'
import { AgendaPopup } from '@/components/layout/AgendaPopup'

interface MainLayoutProps {
  pendingOrders: number
}

export function MainLayout({ pendingOrders }: MainLayoutProps) {
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar pendingOrders={pendingOrders} />
      <SidebarInset className="h-svh max-h-svh min-h-0 overflow-hidden">
        <NavigationHeader
          pendingOrders={pendingOrders}
          onOpenAgenda={() => setIsAgendaOpen(true)}
        />
        <div className="obra-layout-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 pb-24 sm:px-6 sm:py-7 sm:pb-7 md:px-8 touch-pan-y">
          <div className="obra-layout-outlet flex min-h-0 min-w-0 flex-none flex-col md:flex-1">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <AppNavRadialMenu pendingOrders={pendingOrders} />

      {/* Botão flutuante de Agenda — visível em todas as páginas */}
      <div className="fixed bottom-6 z-[201] flex flex-col items-center gap-1" style={{ right: '6rem' }}>
        <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[rgba(212,168,83,0.65)]">
          Agenda
        </span>
        <button
          type="button"
          onClick={() => setIsAgendaOpen(p => !p)}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 bg-gradient-to-br from-[rgba(20,8,4,0.98)] to-[rgba(8,3,1,0.98)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all hover:scale-105"
          style={{
            borderColor: isAgendaOpen ? '#dbb25a' : 'rgba(212,168,83,0.55)',
            boxShadow: isAgendaOpen ? '0 0 28px rgba(212,168,83,0.35)' : undefined,
          }}
          aria-label="Abrir agenda"
        >
          <CalendarDays
            className="h-6 w-6"
            style={{ color: isAgendaOpen ? '#dbb25a' : 'rgba(212,168,83,0.85)' }}
          />
        </button>
      </div>

      <AgendaPopup open={isAgendaOpen} onClose={() => setIsAgendaOpen(false)} />
    </SidebarProvider>
  )
}

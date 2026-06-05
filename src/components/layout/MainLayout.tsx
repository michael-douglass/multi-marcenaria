import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppNavRadialMenu } from '@/components/layout/AppNavRadialMenu'
import { NavigationHeader } from '@/components/layout/NavigationHeader'

interface MainLayoutProps {
  pendingOrders: number
}

export function MainLayout({ pendingOrders }: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar pendingOrders={pendingOrders} />
      <SidebarInset className="h-svh max-h-svh min-h-0 overflow-hidden">
        <NavigationHeader pendingOrders={pendingOrders} />
        <div className="obra-layout-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 pb-24 sm:px-6 sm:py-7 sm:pb-7 md:px-8 touch-pan-y">
          <div className="obra-layout-outlet flex min-h-0 min-w-0 flex-none flex-col md:flex-1">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <AppNavRadialMenu pendingOrders={pendingOrders} />
    </SidebarProvider>
  )
}

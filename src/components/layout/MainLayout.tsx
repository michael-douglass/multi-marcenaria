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
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-5 sm:px-6 sm:py-7 md:px-8 touch-pan-y">
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <AppNavRadialMenu pendingOrders={pendingOrders} />
    </SidebarProvider>
  )
}

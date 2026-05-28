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
      <SidebarInset>
        <NavigationHeader pendingOrders={pendingOrders} />
        <div className="flex-1 overflow-y-auto px-6 py-7 md:px-8">
          <Outlet />
        </div>
      </SidebarInset>
      <AppNavRadialMenu pendingOrders={pendingOrders} />
    </SidebarProvider>
  )
}

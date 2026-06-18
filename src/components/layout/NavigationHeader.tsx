import { Clock, Home, LogOut, User, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { defaultPathForRoles, pathFromSection } from '@/lib/app-navigation'
import { isVisualizadorOnly } from '@/lib/role-access'

const PERFIL_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  marceneiro: 'Marceneiro',
  montador: 'Montador',
  montador_admin: 'Montador Admin',
  administrador_obras: 'Administrador de Obras',
  visualizador: 'Visualizador',
}

interface NavigationHeaderProps {
  pendingOrders: number
  onOpenAgenda?: () => void
}

export function NavigationHeader({ pendingOrders, onOpenAgenda }: NavigationHeaderProps) {
  const navigate = useNavigate()
  const { roles, userProfile, signOut } = useApp()
  const perfilLabel = userProfile ? (PERFIL_LABEL[userProfile.perfil] ?? userProfile.perfil) : ''

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[rgba(240,210,140,0.28)] bg-[rgba(52,34,26,0.94)] px-4 backdrop-blur-md safe-area-top-offset">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
        >
          <span className="text-xs font-bold">←</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
          onClick={() => navigate(defaultPathForRoles(roles))}
          aria-label="Início"
        >
          <Home className="h-4 w-4" />
        </Button>

        {!isVisualizadorOnly(roles) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#f2d892] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
          onClick={onOpenAgenda}
          title="Agenda e Calendário"
          aria-label="Agenda e Calendário"
        >
          <CalendarDays className="h-4 w-4" />
        </Button>
        )}

        <Logo full={false} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {roles.includes('Administrador') && pendingOrders > 0 && (
          <button
            type="button"
            onClick={() => navigate(pathFromSection('aprovacao'))}
            className="flex items-center gap-1.5 rounded-full border border-[rgba(240,210,140,0.38)] bg-[rgba(240,210,140,0.12)] px-3 py-1 text-[0.72rem] font-semibold text-[#f2d892] transition-colors hover:bg-[rgba(240,210,140,0.2)]"
          >
            <Clock className="h-3 w-3" />
            {pendingOrders} pendente{pendingOrders > 1 ? 's' : ''}
          </button>
        )}

        <div className="hidden h-4 w-px bg-[rgba(240,210,140,0.18)] sm:block" />

        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 shrink-0 text-[#edd9c4]" />
          <div className="hidden flex-col items-end sm:flex">
            <span className="max-w-[180px] truncate text-[0.72rem] font-semibold text-cream">
              {userProfile?.email ?? ''}
            </span>
            {perfilLabel && (
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[#f2d892]">
                {perfilLabel}
              </span>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#edd9c4] hover:text-[#f5e0a8]"
          onClick={() => signOut()}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

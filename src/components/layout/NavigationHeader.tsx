import { Clock, Home, LogOut, User, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'
import { ContasPagarNotifBell } from '@/components/layout/ContasPagarNotifications'
import { useApp } from '@/context/AppContext'
import { defaultPathForRoles } from '@/lib/app-navigation'
import { isFuncionarioCampo, isVisualizadorOnly } from '@/lib/role-access'

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
  onOpenAgenda?: () => void
}

export function NavigationHeader({ onOpenAgenda }: NavigationHeaderProps) {
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

        {isFuncionarioCampo(roles) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#4ade80] hover:bg-[rgba(74,222,128,0.12)] hover:text-[#86efac]"
            onClick={() => navigate('/bater-ponto')}
            title="Bater Ponto"
            aria-label="Bater Ponto"
          >
            <Clock className="h-4 w-4" />
          </Button>
        )}

        <Logo full={false} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {roles.includes('Administrador') && <ContasPagarNotifBell />}

        <div className="hidden h-4 w-px bg-[rgba(240,210,140,0.18)] sm:block" />

        <AppRefreshButton showLabel />

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

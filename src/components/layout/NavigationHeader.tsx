import { Clock, Home, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { pathFromSection } from '@/lib/app-navigation'

const PERFIL_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  marceneiro: 'Marceneiro',
  montador: 'Montador',
  montador_admin: 'Montador Admin',
  administrador_obras: 'Administrador de Obras',
}

interface NavigationHeaderProps {
  pendingOrders: number
}

export function NavigationHeader({ pendingOrders }: NavigationHeaderProps) {
  const navigate = useNavigate()
  const { role, userProfile, signOut } = useApp()
  const perfilLabel = userProfile ? (PERFIL_LABEL[userProfile.perfil] ?? userProfile.perfil) : ''

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[rgba(212,168,83,0.09)] bg-[rgba(5,2,1,0.65)] px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#8a6a55] hover:bg-[rgba(212,168,83,0.1)] hover:text-[#dbb25a]"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
        >
          <span className="text-xs font-bold">←</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#8a6a55] hover:bg-[rgba(212,168,83,0.1)] hover:text-[#dbb25a]"
          onClick={() => navigate(pathFromSection('dashboard'))}
          aria-label="Início"
        >
          <Home className="h-4 w-4" />
        </Button>
        <Logo full={false} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {role === 'Administrador' && pendingOrders > 0 && (
          <button
            type="button"
            onClick={() => navigate(pathFromSection('aprovacao'))}
            className="flex items-center gap-1.5 rounded-full border border-[rgba(212,168,83,0.38)] bg-[rgba(212,168,83,0.12)] px-3 py-1 text-[0.72rem] font-semibold text-[#d4a853] transition-colors hover:bg-[rgba(212,168,83,0.2)]"
          >
            <Clock className="h-3 w-3" />
            {pendingOrders} pendente{pendingOrders > 1 ? 's' : ''}
          </button>
        )}

        <div className="hidden h-4 w-px bg-[rgba(212,168,83,0.18)] sm:block" />

        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 shrink-0 text-[#8a6a55]" />
          <div className="hidden flex-col items-end sm:flex">
            <span className="max-w-[180px] truncate text-[0.72rem] font-semibold text-cream">
              {userProfile?.email ?? ''}
            </span>
            {perfilLabel && (
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[#d4a853]">
                {perfilLabel}
              </span>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#8a6a55] hover:text-[#dbb25a]"
          onClick={() => signOut()}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

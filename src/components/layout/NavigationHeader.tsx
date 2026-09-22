import { Clock, Home, LogOut, User, CalendarDays } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'
import { ContasPagarNotifBell } from '@/components/layout/ContasPagarNotifications'
import { SaldoMesInsightHeaderDock } from '@/components/dashboard/SaldoMesInsightHeaderDock'
import { AgendaDisponibilidadeHeaderDock } from '@/components/obras/AgendaDisponibilidadeHeaderDock'
import { useApp } from '@/context/AppContext'
import { useSaldoMesInsightOptional } from '@/context/SaldoMesInsightContext'
import { defaultPathForRoles } from '@/lib/app-navigation'
import { canAccessCrmPath, canUseAgendaGeral, isCrmAppPath } from '@/lib/crm-identity'
import { podeBaterPontoPorTipo } from '@/lib/funcionario-constants'
import { useMeuFuncionario } from '@/hooks/useMeuFuncionario'
import { cn } from '@/lib/utils'

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
  const location = useLocation()
  const { roles, userProfile, crmProfile, signOut } = useApp()
  const { data: meuFuncionario } = useMeuFuncionario()
  const saldoCtx = useSaldoMesInsightOptional()
  const perfilLabel = userProfile ? (PERFIL_LABEL[userProfile.perfil] ?? userProfile.perfil) : ''
  const isCrmArea = isCrmAppPath(location.pathname)
  const canCrmAgenda = canAccessCrmPath('/agenda-comercial', crmProfile, userProfile)
  const showAgendaBtn = canUseAgendaGeral(userProfile, crmProfile, location.pathname)
  const showPontoBtn = podeBaterPontoPorTipo(meuFuncionario?.tipo)
  /** Chip travado no cabeçalho — precisa de espaço próprio no celular. */
  const saldoDockVisible = Boolean(saldoCtx?.enabled && saldoCtx.locked && saldoCtx.message)

  const navIconClass =
    'h-8 w-8 shrink-0 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]'

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex min-h-14 shrink-0 flex-wrap items-center border-b border-[rgba(240,210,140,0.28)]',
        'bg-[rgba(52,34,26,0.94)] backdrop-blur-md safe-area-top-offset',
        saldoDockVisible ? 'gap-x-1.5 gap-y-0 px-2 sm:gap-x-3 sm:px-4' : 'gap-x-2 gap-y-0 px-3 sm:gap-x-3 sm:px-4',
      )}
    >
      {/* Linha 1 (esq.): menu, voltar, início… */}
      <div className="order-1 flex h-14 shrink-0 items-center gap-0.5 sm:gap-2">
        <SidebarTrigger />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={navIconClass}
          onClick={() => navigate(-1)}
          aria-label="Voltar"
        >
          <span className="text-xs font-bold">←</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={navIconClass}
          onClick={() => navigate(defaultPathForRoles(roles))}
          aria-label="Início"
        >
          <Home className="h-4 w-4" />
        </Button>

        {showAgendaBtn && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[#f2d892] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
            onClick={() => {
              if (isCrmArea && canCrmAgenda) navigate('/agenda-comercial')
              else onOpenAgenda?.()
            }}
            title="Agenda"
            aria-label="Agenda"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        )}

        {showPontoBtn && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[#4ade80] hover:bg-[rgba(74,222,128,0.12)] hover:text-[#86efac]"
            onClick={() => navigate('/bater-ponto')}
            title="Bater Ponto"
            aria-label="Bater Ponto"
          >
            <Clock className="h-4 w-4" />
          </Button>
        )}

        {/* Com o saldo travado, a logo cede espaço no celular/tablet. */}
        <div className={cn(saldoDockVisible ? 'hidden lg:block' : 'block')}>
          <Logo full={false} />
        </div>
      </div>

      {/*
        Cards (saldo + agenda):
        - Com saldo travado no celular: segunda linha, os dois lado a lado.
        - Sem saldo travado: agenda fica no meio da primeira linha.
        - Em telas md+: os dois (ou só a agenda) na faixa central.
      */}
      {saldoDockVisible ? (
        <div
          className={cn(
            'flex min-w-0 items-stretch gap-1.5',
            'order-3 w-full basis-full pb-2',
            'md:order-2 md:w-auto md:flex-1 md:basis-auto md:justify-start md:px-1 md:pb-0',
          )}
        >
          <div className="min-w-0 flex-1 md:max-w-[18rem]">
            <SaldoMesInsightHeaderDock />
          </div>
          <div className="min-w-0 flex-1 empty:hidden md:max-w-[22rem]">
            <AgendaDisponibilidadeHeaderDock />
          </div>
        </div>
      ) : (
        <div className="order-2 flex min-w-0 flex-1 items-center px-0.5 md:px-1">
          <div className="min-w-0 w-full max-w-[22rem]">
            <AgendaDisponibilidadeHeaderDock />
          </div>
        </div>
      )}

      {/* Linha 1 (dir.): notificações, atualizar, usuário, sair */}
      <div
        className={cn(
          'ml-auto flex h-14 shrink-0 items-center gap-1 sm:gap-3',
          saldoDockVisible ? 'order-2 md:order-3' : 'order-3',
        )}
      >
        <ContasPagarNotifBell />
        <AppRefreshButton showLabel />

        <div className="hidden h-4 w-px bg-[rgba(240,210,140,0.18)] sm:block" />

        <div
          className={cn(
            'items-center gap-2',
            saldoDockVisible ? 'hidden sm:flex' : 'flex',
          )}
        >
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
          className={navIconClass}
          onClick={() => signOut()}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

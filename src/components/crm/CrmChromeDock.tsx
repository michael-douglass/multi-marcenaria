import { useMemo, useState } from 'react'
import { Banknote, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { useCrmAgenda } from '@/hooks/useCrmAgenda'
import { useCrmPontuaAdmin } from '@/hooks/useCrmMarketing'
import { canAccessCrmPath, isCrmAdmin } from '@/lib/crm-identity'
import { AGENDA_STATUS_LABEL, reunioesHoje } from '@/lib/crm-agenda'
import { cn, fmtCur, fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'

function ChromeFab({
  label,
  ariaLabel,
  count,
  open,
  onClick,
  icon: Icon,
  accent,
}: {
  label: string
  ariaLabel: string
  count: number
  open: boolean
  onClick: () => void
  icon: typeof CalendarDays
  accent: 'gold' | 'emerald'
}) {
  const isEmerald = accent === 'emerald'
  const idleBorder = isEmerald ? 'rgba(74,222,128,0.45)' : 'rgba(240,210,140,0.55)'
  const activeBorder = isEmerald ? '#86efac' : '#f5e0a8'
  const idleIcon = isEmerald ? 'rgba(134,239,172,0.9)' : 'rgba(240,210,140,0.85)'
  const activeIcon = isEmerald ? '#86efac' : '#f5e0a8'
  const labelColor = isEmerald ? 'rgba(134,239,172,0.7)' : 'rgba(240,210,140,0.65)'

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-[8px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: open ? activeIcon : labelColor }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'relative flex h-14 w-14 items-center justify-center rounded-full border-2',
          'bg-gradient-to-br from-[rgba(20,8,4,0.98)] to-[rgba(8,3,1,0.98)]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300',
          'hover:scale-105 active:scale-95',
        )}
        style={{ borderColor: open ? activeBorder : idleBorder }}
        aria-label={ariaLabel}
        aria-pressed={open}
      >
        <Icon className="h-6 w-6" style={{ color: open ? activeIcon : idleIcon }} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-amber-950">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </div>
  )
}

export function CrmChromeDock() {
  const navigate = useNavigate()
  const { crmProfile, userProfile } = useApp()
  const canAgenda = canAccessCrmPath('/agenda-comercial', crmProfile, userProfile)
  const canPontua = isCrmAdmin(crmProfile)
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [saqueOpen, setSaqueOpen] = useState(false)
  const [pontuaDockArmed, setPontuaDockArmed] = useState(false)
  const agendaApi = useCrmAgenda(canAgenda)
  const pontuaApi = useCrmPontuaAdmin(canPontua && pontuaDockArmed)

  const hoje = useMemo(() => reunioesHoje(agendaApi.data.reunioes), [agendaApi.data.reunioes])
  const pendentes = useMemo(
    () => pontuaApi.saques.filter(s => s.status === 'pendente'),
    [pontuaApi.saques],
  )
  const nomeDe = (id: string) => pontuaApi.prestadores.find(p => p.id === id)?.nome ?? 'Parceiro'

  if (!canAgenda && !canPontua) return null

  return (
    <>
      <div
        data-crm-chrome
        className="fixed bottom-6 right-6 z-[201] flex flex-row-reverse items-end gap-3"
      >
        {canAgenda && (
          <ChromeFab
            label="Agenda"
            ariaLabel="Abrir agenda comercial de hoje"
            count={hoje.length}
            open={agendaOpen}
            onClick={() => {
              setSaqueOpen(false)
              setAgendaOpen(v => !v)
            }}
            icon={CalendarDays}
            accent="gold"
          />
        )}
        {canPontua && (
          <ChromeFab
            label="Saque"
            ariaLabel="Saques Pontua pendentes"
            count={pendentes.length}
            open={saqueOpen}
            onClick={() => {
              setAgendaOpen(false)
              setPontuaDockArmed(true)
              setSaqueOpen(v => !v)
            }}
            icon={Banknote}
            accent="emerald"
          />
        )}
      </div>

      {agendaOpen && canAgenda && (
        <div
          className="fixed bottom-28 right-6 z-[202] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[rgba(240,210,140,0.28)] bg-[rgba(16,10,6,0.97)] shadow-2xl"
          role="dialog"
          aria-label="Reuniões de hoje"
        >
          <div className="border-b border-[rgba(240,210,140,0.18)] px-4 py-3">
            <p className="text-sm font-semibold text-[#f2d892]">Agenda comercial</p>
            <p className="text-[0.65rem] text-[#d4bc9f]">Reuniões de hoje — não é a agenda de obras.</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {hoje.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nada marcado para hoje.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {hoje.map(item => (
                  <li key={item.id} className="px-4 py-2 text-sm">
                    <p className="font-medium text-[#f2d892]">{item.titulo}</p>
                    <p className="text-xs text-[#d4bc9f]">
                      {new Date(item.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {AGENDA_STATUS_LABEL[item.status] ?? item.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-[rgba(240,210,140,0.18)] p-3">
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => {
                setAgendaOpen(false)
                navigate('/agenda-comercial')
              }}
            >
              Ver agenda
            </Button>
          </div>
        </div>
      )}

      {saqueOpen && canPontua && (
        <div
          className="fixed bottom-28 right-6 z-[202] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[rgba(74,222,128,0.28)] bg-[rgba(10,18,12,0.97)] shadow-2xl"
          role="dialog"
          aria-label="Saques Pontua pendentes"
        >
          <div className="border-b border-[rgba(74,222,128,0.18)] px-4 py-3">
            <p className="text-sm font-semibold text-[#bbf7d0]">Saques Pontua</p>
            <p className="text-[0.65rem] text-[#86efac]/70">Pedidos dos arquitetos. Não mistura com o Caixa.</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {pendentes.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum saque aguardando.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {pendentes.map(item => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                    <div>
                      <p className="text-[#bbf7d0]">{nomeDe(item.prestadorId)} · {fmtCur(item.valor)}</p>
                      <p className="text-xs text-[#86efac]/70">{fmtDate(item.criadoEm)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => void pontuaApi.aprovarSaque(item.id)
                          .then(() => showToast('Saque aprovado.'))
                          .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => void pontuaApi.rejeitarSaque(item.id)
                          .then(() => showToast('Pedido rejeitado.'))
                          .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-[rgba(74,222,128,0.18)] p-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                setSaqueOpen(false)
                navigate('/financeiro-pontua')
              }}
            >
              Abrir Pontua
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

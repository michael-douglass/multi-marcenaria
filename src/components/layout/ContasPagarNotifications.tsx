import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Bell, ChevronRight, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import {
  useContasPagarNotificacoes,
  type ContaPagarNotifTarefa,
} from '@/hooks/useContasPagarNotificacoes'
import { cn, fmtCur, fmtDate } from '@/lib/utils'

interface ContasPagarNotifCtx {
  tarefas: ContaPagarNotifTarefa[]
  count: number
  loading: boolean
  dismiss: (id: string) => Promise<void>
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  diaReferencia: string
}

const Ctx = createContext<ContasPagarNotifCtx | null>(null)

function useContasPagarNotif() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useContasPagarNotif fora do provider')
  return ctx
}

function TarefaRow({
  tarefa,
  index,
  onDismiss,
  dismissing,
}: {
  tarefa: ContaPagarNotifTarefa
  index: number
  onDismiss: (id: string) => void
  dismissing: string | null
}) {
  const fornecedor = tarefa.fornecedor_nome?.trim() || 'Sem fornecedor'
  const descricao = tarefa.descricao?.trim() || 'Sem descri\u00e7\u00e3o'

  return (
    <li
      className="contas-notif-row group relative flex items-start gap-3 border-b border-[rgba(240,210,140,0.1)] px-4 py-3 last:border-b-0"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_rgba(242,216,146,0.45)]',
          tarefa.statusUi === 'vencido'
            ? 'bg-[#f87171] shadow-[0_0_10px_rgba(248,113,113,0.55)]'
            : tarefa.statusUi === 'pago'
              ? 'bg-[#4ade80]'
              : 'bg-[#f2d892]',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-display truncate text-[1.05rem] tracking-[0.04em] text-[#f5e0a8]">
            {fornecedor}
          </p>
          <Badge status={tarefa.statusUi} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug text-[#edd9c4]/80">
          {descricao}
        </p>
        <p className="mt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[#f2d892]/65">
          Venc. {fmtDate(tarefa.data_vencimento)}
          <span className="mx-1.5 text-[#edd9c4]/35">|</span>
          <span className="text-[#f5e0a8]">{fmtCur(tarefa.valor_parcela)}</span>
        </p>
      </div>
      <button
        type="button"
        className={cn(
          'contas-notif-excluir mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5',
          'border border-[rgba(248,113,113,0.4)] bg-[rgba(220,38,38,0.1)]',
          'text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#fca5a5]',
          'transition-all duration-200 hover:border-[rgba(248,113,113,0.75)] hover:bg-[rgba(220,38,38,0.2)]',
          'hover:shadow-[0_0_18px_rgba(220,38,38,0.22)] active:scale-95',
          'disabled:opacity-50',
        )}
        disabled={dismissing === tarefa.id}
        onClick={() => onDismiss(tarefa.id)}
        title="Excluir notifica\u00e7\u00e3o neste dia (n\u00e3o altera o status da conta)"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir
      </button>
    </li>
  )
}

function ContasPagarNotifPanel() {
  const navigate = useNavigate()
  const { tarefas, count, loading, dismiss, panelOpen, setPanelOpen, diaReferencia } =
    useContasPagarNotif()
  const [dismissing, setDismissing] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!panelOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      const bell = document.getElementById('contas-pagar-notif-bell')
      if (bell?.contains(target)) return
      setPanelOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [panelOpen, setPanelOpen])

  const handleDismiss = async (id: string) => {
    setDismissing(id)
    try {
      await dismiss(id)
    } finally {
      setDismissing(null)
    }
  }

  if (!panelOpen) return null

  return createPortal(
    <div
      ref={panelRef}
      className="contas-notif-panel fixed right-3 top-[3.75rem] z-[220] flex max-h-[min(36rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl sm:right-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="contas-notif-panel-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex min-h-0 flex-1 flex-col border border-[rgba(240,210,140,0.32)] bg-[linear-gradient(165deg,rgba(42,26,18,0.98)_0%,rgba(18,10,6,0.98)_55%,rgba(10,5,2,0.99)_100%)] shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(240,210,140,0.12)] backdrop-blur-md">
        <header className="relative shrink-0 flex items-start justify-between gap-3 border-b border-[rgba(240,210,140,0.14)] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.28em] text-[#f2d892]/70">
              {'Notificações'}
            </p>
            <h2
              id={titleId}
              className="font-display mt-0.5 text-[1.55rem] leading-none tracking-[0.06em] text-[#f5e0a8]"
            >
              Contas a pagar
            </h2>
            <p className="mt-1 text-[0.68rem] text-[#edd9c4]/65">
              {'Hoje e vencidas do mês'}
              {count > 0 ? ` · ${count}` : ''}
              <span className="text-[#edd9c4]/40">{` · ${fmtDate(diaReferencia)}`}</span>
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
            onClick={() => setPanelOpen(false)}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="contas-notif-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {loading && tarefas.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-[#edd9c4]/70">
              {'Carregando notificações...'}
            </p>
          ) : tarefas.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-[#f2d892]/40" />
              <p className="mt-3 text-xs text-[#edd9c4]/75">
                {'Nenhuma notificação aberta.'}
              </p>
            </div>
          ) : (
            <ul>
              {tarefas.map((t, i) => (
                <TarefaRow
                  key={t.id}
                  tarefa={t}
                  index={i}
                  onDismiss={handleDismiss}
                  dismissing={dismissing}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="relative shrink-0 border-t border-[rgba(240,210,140,0.14)] px-3 py-2.5">
          <button
            type="button"
            className="group flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[rgba(240,210,140,0.1)] text-[0.72rem] font-semibold text-[#f2d892] transition-colors hover:bg-[rgba(240,210,140,0.18)] hover:text-[#f5e0a8]"
            onClick={() => {
              setPanelOpen(false)
              navigate('/contas-pagar')
            }}
          >
            Abrir Contas a Pagar
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="mt-1.5 text-center text-[0.58rem] text-[#edd9c4]/45">
            {'Excluir some só hoje — não altera o pagamento da conta'}
          </p>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

/** Sino no canto superior direito do header (todas as páginas Admin). */
export function ContasPagarNotifBell() {
  const { count, panelOpen, togglePanel } = useContasPagarNotif()
  const hasItems = count > 0

  return (
    <Button
      id="contas-pagar-notif-bell"
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'relative h-9 w-9 rounded-full border border-[rgba(240,210,140,0.28)]',
        'text-[#f2d892] hover:bg-[rgba(240,210,140,0.12)] hover:text-[#f5e0a8]',
        hasItems && !panelOpen && 'contas-notif-fab-pulse',
        panelOpen && 'border-[rgba(248,113,113,0.55)] bg-[rgba(220,38,38,0.12)] text-[#fca5a5]',
      )}
      onClick={togglePanel}
      title="Notifica\u00e7\u00f5es de contas a pagar"
      aria-label="Notifica\u00e7\u00f5es de contas a pagar"
      aria-expanded={panelOpen}
    >
      <Bell className="h-4 w-4" />
      {hasItems ? (
        <span className="absolute -right-1 -top-1 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[#dc2626] px-1 font-display text-[0.7rem] leading-none text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Button>
  )
}

export function ContasPagarNotifProvider({ children }: { children: ReactNode }) {
  const { roles } = useApp()
  const enabled = roles.includes('Administrador')
  const { tarefas, count, loading, dismiss, diaReferencia } = useContasPagarNotificacoes(enabled)
  const [panelOpen, setPanelOpen] = useState(false)

  const togglePanel = useCallback(() => {
    setPanelOpen(p => !p)
  }, [])

  const value = useMemo(
    () => ({
      tarefas,
      count,
      loading,
      dismiss,
      panelOpen,
      setPanelOpen,
      togglePanel,
      diaReferencia,
    }),
    [tarefas, count, loading, dismiss, panelOpen, togglePanel, diaReferencia],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {enabled ? <ContasPagarNotifPanel /> : null}
    </Ctx.Provider>
  )
}

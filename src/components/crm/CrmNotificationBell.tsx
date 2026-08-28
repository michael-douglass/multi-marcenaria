import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { hasCrmColaboradorAccess } from '@/lib/crm-identity'
import { NOTIF_TIPO_LABEL } from '@/lib/crm-comunicacao'
import { useCrmNotificacoes } from '@/hooks/useCrmComunicacao'
import { cn, fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'

export function CrmNotificationBell() {
  const { crmProfile } = useApp()
  const enabled = hasCrmColaboradorAccess(crmProfile)
  const { items, naoLidas, loading, marcarLida } = useCrmNotificacoes(enabled)
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDoc = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!enabled) return null

  return (
    <div ref={wrapRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'relative h-9 w-9 rounded-full border border-[rgba(74,222,128,0.35)]',
          'text-[#86efac] hover:bg-[rgba(74,222,128,0.12)] hover:text-[#bbf7d0]',
          open && 'border-[rgba(74,222,128,0.7)] bg-[rgba(22,101,52,0.25)]',
        )}
        onClick={() => setOpen(v => !v)}
        title="Avisos do CRM"
        aria-label="Avisos do CRM"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[#16a34a] px-1 font-display text-[0.7rem] leading-none text-white">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        ) : null}
      </Button>
      {open && createPortal(
        <div
          id={panelId}
          className="fixed right-4 top-16 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[rgba(74,222,128,0.28)] bg-[rgba(16,28,18,0.97)] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[rgba(74,222,128,0.18)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#bbf7d0]">Avisos do CRM</p>
              <p className="text-[0.65rem] text-[#86efac]/70">Não mistura com o sino de Contas a Pagar.</p>
            </div>
            {naoLidas > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[0.65rem] text-[#86efac] hover:text-white"
                onClick={() => {
                  void marcarLida(null, true)
                    .then(() => showToast('Avisos marcados como lidos.'))
                    .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Ler todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-6 text-center text-sm text-[#86efac]/70">Abrindo avisos...</p>}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-[#86efac]/70">Nenhum aviso.</p>
            )}
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'block w-full border-b border-[rgba(74,222,128,0.1)] px-4 py-3 text-left text-sm hover:bg-[rgba(74,222,128,0.08)]',
                  !item.read && 'bg-[rgba(22,101,52,0.22)]',
                )}
                onClick={() => {
                  if (!item.read) void marcarLida(item.id).catch(() => undefined)
                  if (item.leadId) {
                    setOpen(false)
                    navigate('/pipeline')
                  }
                }}
              >
                <p className={cn('text-[#e7ffe9]', !item.read && 'font-semibold')}>{item.message}</p>
                <p className="mt-1 text-[0.65rem] text-[#86efac]/65">
                  {NOTIF_TIPO_LABEL[item.tipo] ?? item.tipo}
                  {item.vendorName ? ` · ${item.vendorName}` : ''}
                  {item.createdAt ? ` · ${fmtDate(item.createdAt)}` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

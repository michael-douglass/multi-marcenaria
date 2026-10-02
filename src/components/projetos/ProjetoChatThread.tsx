import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MailOpen } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isBolhaDoAtelie, notaAindaNaoLida } from '@/lib/lead-projeto-chat'
import { isProjetistaRole, type AppUserRole } from '@/lib/app-roles'
import type { LeadProjetoNota } from '@/hooks/useLeadProjetos'

interface ProjetoChatThreadProps {
  notas: LeadProjetoNota[]
  currentUserId?: string | null
  currentUserRoles?: readonly AppUserRole[] | null
  lastReadAt?: string | null
  className?: string
  onMarkUnread?: (nota: LeadProjetoNota) => void
  markUnreadPending?: boolean
}

function tipoLabel(tipo: LeadProjetoNota['tipo']): string {
  if (tipo === 'envio') return 'Pedido de projeto'
  if (tipo === 'reenvio') return 'Novo pedido'
  return 'Conversa'
}

export function ProjetoChatThread({
  notas,
  currentUserId,
  currentUserRoles,
  lastReadAt,
  className,
  onMarkUnread,
  markUnreadPending,
}: ProjetoChatThreadProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const isProjetista = isProjetistaRole(currentUserRoles)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [notas.length, notas.at(-1)?.id])

  if (notas.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-[#8a7060]">
        Titular e projetista ainda não escreveram. Quando alguém mandar, o aviso acende no card.
      </p>
    )
  }

  return (
    <>
      <div ref={scrollerRef} className={cn('space-y-3 overflow-y-auto pr-1', className)}>
        {notas.map((nota) => {
          const mine = nota.autor_id === currentUserId
          const atelie = isBolhaDoAtelie(nota.autor_roles)
          const caption = nota.mensagem.trim() === '📷 Imagem' ? '' : nota.mensagem
          const pending = notaAindaNaoLida({
            autorId: nota.autor_id,
            destinatarioId: nota.destinatario_id,
            criadoEm: nota.criado_em,
            currentUserId,
            lastReadAt,
            isProjetista,
          })
          const forMe =
            nota.destinatario_id === currentUserId ||
            (!nota.destinatario_id && isProjetista && !mine)
          const showMarkUnread = Boolean(onMarkUnread) && forMe && !pending
          return (
            <article
              key={nota.id}
              className={cn(
                'lead-modal-bubble max-w-[min(100%,34rem)] rounded-2xl border px-3.5 py-2.5',
                mine ? 'ml-auto' : 'mr-auto',
                atelie && 'border-sky-400/40 bg-sky-50',
                pending && 'ring-1 ring-sky-400/50',
              )}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={cn('font-semibold', atelie ? 'text-sky-700' : 'text-[#8d5e22]')}>
                  {nota.autor_nome}
                </span>
                <span className="lead-modal-kicker shrink-0 tabular-nums">
                  {format(new Date(nota.criado_em), 'dd MMM HH:mm', { locale: ptBR })}
                </span>
              </div>
              <p className="lead-modal-kicker mt-0.5 text-[11px] uppercase tracking-wide">
                {tipoLabel(nota.tipo)}
                {nota.destinatario_nome && mine ? (
                  <span className="normal-case tracking-normal text-[#8a7060]">
                    {' '}
                    · para {nota.destinatario_nome}
                  </span>
                ) : null}
              </p>
              {nota.imagem_url ? (
                <button
                  type="button"
                  className="mt-2 block overflow-hidden rounded-md"
                  onClick={() => setLightbox(nota.imagem_url)}
                >
                  <img src={nota.imagem_url} alt={nota.file_name ?? ''} className="max-h-44 w-full object-cover" />
                </button>
              ) : null}
              {caption ? (
                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-6 text-[#2a1812] [overflow-wrap:anywhere]">
                  {caption}
                </p>
              ) : null}
              {showMarkUnread ? (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-[11px] text-[#8a7060] hover:text-[#8d5e22]"
                    disabled={markUnreadPending}
                    onClick={() => onMarkUnread?.(nota)}
                  >
                    <MailOpen className="h-3 w-3" />
                    Marcar não lida
                  </Button>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      <Dialog open={Boolean(lightbox)} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-3xl border-[#8d5e22]/20 bg-[#fffcf8] p-2">
          {lightbox ? <img src={lightbox} alt="" className="max-h-[80vh] w-full object-contain" /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

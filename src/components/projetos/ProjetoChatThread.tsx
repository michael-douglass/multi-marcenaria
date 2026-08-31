import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { isBolhaDoAtelie } from '@/lib/lead-projeto-chat'
import type { LeadProjetoNota } from '@/hooks/useLeadProjetos'

interface ProjetoChatThreadProps {
  notas: LeadProjetoNota[]
  currentUserId?: string | null
  className?: string
}

function tipoLabel(tipo: LeadProjetoNota['tipo']): string {
  if (tipo === 'envio') return 'Pedido de projeto'
  if (tipo === 'reenvio') return 'Novo pedido'
  return 'Conversa'
}

export function ProjetoChatThread({ notas, currentUserId, className }: ProjetoChatThreadProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [notas.length, notas.at(-1)?.id])

  if (notas.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-cream-muted">
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
          return (
            <article
              key={nota.id}
              className={cn(
                'lead-modal-bubble max-w-[min(100%,34rem)] rounded-2xl border px-3.5 py-2.5',
                mine ? 'ml-auto' : 'mr-auto',
                atelie && 'border-sky-400/30 bg-sky-950/40',
              )}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={cn('font-semibold', atelie ? 'text-sky-200' : 'text-gold')}>
                  {nota.autor_nome}
                </span>
                <span className="lead-modal-kicker shrink-0 tabular-nums">
                  {format(new Date(nota.criado_em), 'dd MMM HH:mm', { locale: ptBR })}
                </span>
              </div>
              <p className="lead-modal-kicker mt-0.5 text-[11px] uppercase tracking-wide">
                {tipoLabel(nota.tipo)}
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
                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-6 text-cream-secondary [overflow-wrap:anywhere]">
                  {caption}
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
      <Dialog open={Boolean(lightbox)} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-3xl border-gold/20 bg-[#120c09] p-2">
          {lightbox ? <img src={lightbox} alt="" className="max-h-[80vh] w-full object-contain" /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

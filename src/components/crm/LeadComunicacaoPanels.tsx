import { useState } from 'react'
import { MessageCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CrmLeadSection } from '@/components/crm/CrmLeadSection'
import { EmptyState, LoadingState } from '@/components/ui/EmptyState'
import { useCrmLeadIa, useCrmWhatsApp } from '@/hooks/useCrmComunicacao'
import { showToast } from '@/lib/toast'
import { fmtDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function LeadWhatsAppPanel({ telefone, leadNome }: { telefone: string; leadNome: string }) {
  const { messages, loading, aviso, enviar } = useCrmWhatsApp(telefone, Boolean(telefone))
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)

  return (
    <CrmLeadSection title="WhatsApp" icon={MessageCircle}>
      {aviso && <p className="mb-2 text-xs text-amber-300/80">{aviso}</p>}
      {loading && <LoadingState message="Abrindo o histórico..." />}
      {!loading && messages.length === 0 && (
        <EmptyState message={`Nenhuma conversa ainda com ${leadNome}.`} />
      )}
      {messages.length > 0 && (
        <div className="mb-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
          {messages.map(msg => {
            const fromLead = msg.remetente === 'lead' || msg.remetente === 'human'
            return (
              <div key={`${msg.origem}-${msg.id}`} className={cn('flex', fromLead ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-1.5 text-sm',
                  fromLead ? 'bg-muted text-foreground' : 'bg-emerald-700/70 text-white',
                )}>
                  {msg.conteudo || (msg.urlMidia ? `[${msg.tipoMensagem}]` : '')}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="glass-input flex-1"
          placeholder="Escrever mensagem"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        <Button
          size="sm"
          type="button"
          disabled={sending || !texto.trim()}
          onClick={() => {
            setSending(true)
            void enviar(texto.trim())
              .then(() => { setTexto(''); showToast('Mensagem enviada.') })
              .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
              .finally(() => setSending(false))
          }}
        >
          Enviar
        </Button>
      </div>
    </CrmLeadSection>
  )
}

export function LeadIaPanel({
  leadId,
  leadNome,
  leadOrigem,
}: {
  leadId: number
  leadNome: string
  leadOrigem: string
}) {
  const { analises, renders, chat, loading, pedirAnalise } = useCrmLeadIa(leadId)
  const [asking, setAsking] = useState(false)

  return (
    <CrmLeadSection title="IA de projeto" icon={Sparkles}>
      <p className="mb-2 text-xs text-muted-foreground">
        Análises, renders e o chat da Íris já gravados neste lead. Pedir uma nova análise usa as fotos da lousa.
      </p>
      <Button
        size="sm"
        type="button"
        variant="outline"
        disabled={asking}
        onClick={() => {
          setAsking(true)
          void pedirAnalise(leadNome, leadOrigem)
            .then(() => showToast('Análise pedida.'))
            .catch(err => showToast(err instanceof Error ? err.message : 'A IA não respondeu. Tente de novo ou use a lousa.', 'error'))
            .finally(() => setAsking(false))
        }}
      >
        <Sparkles className="h-4 w-4" /> Pedir análise
      </Button>
      {loading && <LoadingState message="Abrindo a IA do lead..." />}
      {!loading && analises.length === 0 && renders.length === 0 && chat.length === 0 && (
        <EmptyState message="Nenhuma análise ainda neste lead." />
      )}
      {analises[0] && (
        <article className="mt-3 rounded-xl border border-border/70 p-3">
          <p className="text-xs text-muted-foreground">{analises[0].modelo} · {fmtDate(analises[0].criadoEm)}</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">{analises[0].conteudo}</p>
        </article>
      )}
      {renders.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {renders.map(r => (
            <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-border/70">
              <img src={r.url} alt="Render da IA" className="h-24 w-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {chat.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{chat.length} recados no chat da Íris.</p>
      )}
    </CrmLeadSection>
  )
}

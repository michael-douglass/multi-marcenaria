import { MessageCircle } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { useCrmChatInterno } from '@/hooks/useCrmComunicacao'

export function ChatCrmPage() {
  const { contatos, loading, error } = useCrmChatInterno()

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Chat interno"
        subtitle="Conversas do CRM com o cliente. Hoje o histórico vivo fica no WhatsApp da ficha do lead."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/15">
            <MessageCircle className="h-4 w-4 text-emerald-300" />
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo o chat..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && contatos.length === 0 && (
        <EmptyState message="Nenhuma conversa neste caderno ainda. Abra um lead no Pipeline e use o WhatsApp da ficha." />
      )}
      {contatos.length > 0 && (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/80">
          {contatos.map(c => (
            <li key={c.id} className="px-3 py-2 text-sm">
              <p className="font-medium">{c.nome || c.telefone}</p>
              <p className="text-xs text-muted-foreground">{c.telefone}{c.naoLidas ? ` · ${c.naoLidas} não lidas` : ''}</p>
            </li>
          ))}
        </ul>
      )}
    </CrmPageFrame>
  )
}

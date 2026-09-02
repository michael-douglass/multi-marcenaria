import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import {
  useObraProducaoChatMutations,
  useObraProducaoNotas,
  useProducaoVendasNotas,
  type ObraProducao,
  type ObraProducaoNota,
} from '@/hooks/useObraProducao'
import {
  producaoCanalHint,
  producaoCanalLabel,
  type ProducaoChatCanal,
} from '@/lib/projetos-producao'
import type { LeadProjetoNota } from '@/hooks/useLeadProjetos'
import { useAuth } from '@/contexts/AuthContext'

interface ProducaoDualChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: ObraProducao | null
}

function toLeadNota(nota: ObraProducaoNota): LeadProjetoNota {
  return {
    id: nota.id,
    lead_id: nota.lead_id,
    autor_id: nota.autor_id,
    mensagem: nota.mensagem,
    tipo: nota.tipo,
    criado_em: nota.criado_em,
    imagem_url: nota.imagem_url,
    file_name: nota.file_name,
    mime_type: nota.mime_type,
    autor_nome: nota.autor_nome,
    autor_roles: nota.autor_roles,
  }
}

export function ProducaoDualChatPanel({ open, onOpenChange, card }: ProducaoDualChatPanelProps) {
  const { user } = useAuth()
  const [canal, setCanal] = useState<ProducaoChatCanal>('obras')
  const { data: notasObras = [], isLoading: loadingObras } = useObraProducaoNotas(
    open && card ? card.id : null,
  )
  const { data: notasVendas = [], isLoading: loadingVendas } = useProducaoVendasNotas(
    open && card ? card.lead_id : null,
  )
  const { enviarObras, enviarVendas } = useObraProducaoChatMutations()

  const notas = canal === 'obras' ? notasObras : notasVendas
  const loading = canal === 'obras' ? loadingObras : loadingVendas
  const sending = enviarObras.isPending || enviarVendas.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden border-[#2a3a36]/12 bg-[#fffcf7] p-0">
        <DialogHeader className="space-y-2 border-b border-[#2a3a36]/10 px-5 py-4 text-left">
          <DialogTitle className="font-display text-[#1c2824]">
            Conversas · {card?.lead_nome ?? 'Projeto'}
          </DialogTitle>
          <DialogDescription className="text-[#5a6b66]">
            Dois canais no mesmo card: vendas (ateliê) e obras (produção).
          </DialogDescription>
          <div className="flex gap-1 pt-1" role="tablist" aria-label="Canal do chat">
            {(['vendas', 'obras'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={canal === key}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  canal === key && key === 'vendas' && 'border-[#c9a35a]/50 bg-[#c9a35a]/15 text-[#7a5a1e]',
                  canal === key && key === 'obras' && 'border-[#2d8c78]/40 bg-[#e8f6f1] text-[#1f5f52]',
                  canal !== key && 'border-[#2a3a36]/12 text-[#6b7c76] hover:border-[#2a3a36]/25',
                )}
                onClick={() => setCanal(key)}
              >
                {producaoCanalLabel(key)}
                <span className="ml-1.5 tabular-nums opacity-70">
                  {key === 'vendas' ? notasVendas.length : notasObras.length}
                </span>
              </button>
            ))}
          </div>
          <p
            className={cn(
              'text-[11px]',
              canal === 'vendas' ? 'text-[#7a5a1e]' : 'text-[#1f5f52]',
            )}
          >
            {producaoCanalHint(canal)}
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden bg-[#f4f8f6]/60 px-4 py-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#6b7c76]">Abrindo o canal…</p>
          ) : (
            <ProjetoChatThread
              notas={notas.map(toLeadNota)}
              currentUserId={user?.id}
              className="max-h-[min(48vh,28rem)]"
            />
          )}
        </div>

        <div className="border-t border-[#2a3a36]/10 bg-white/80 px-4 py-3">
          <ProjetoChatComposer
            compact
            disabled={!card || sending}
            onSend={({ mensagem, file }) => {
              if (!card) return
              if (canal === 'obras') {
                enviarObras.mutate({
                  obraProducaoId: card.id,
                  leadId: card.lead_id,
                  mensagem,
                  file,
                })
              } else {
                enviarVendas.mutate({
                  leadId: card.lead_id,
                  mensagem,
                  file,
                })
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

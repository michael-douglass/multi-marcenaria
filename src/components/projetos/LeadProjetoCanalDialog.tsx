import { type SyntheticEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useLeadProjetoMutations, useLeadProjetoNotas } from '@/hooks/useLeadProjetos'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'

interface LeadProjetoCanalDialogProps {
  leadId: number
  leadNome?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadProjetoCanalDialog({
  leadId,
  leadNome,
  open,
  onOpenChange,
}: LeadProjetoCanalDialogProps) {
  const { user } = useAuth()
  const { data: notas = [] } = useLeadProjetoNotas(open ? leadId : null)
  const { adicionarNota } = useLeadProjetoMutations()

  const stopCardEvent = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-3 border-gold/20 bg-[#120c09] sm:max-w-lg"
        onClick={stopCardEvent}
        onPointerDown={stopCardEvent}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-gold">Canal do ateliê</DialogTitle>
          <DialogDescription>
            {leadNome
              ? `Titular e projetista no mesmo fio de ${leadNome}. Não é WhatsApp.`
              : 'Titular e projetista no mesmo fio. Não é WhatsApp.'}
          </DialogDescription>
        </DialogHeader>
        <ProjetoChatThread notas={notas} currentUserId={user?.id} className="min-h-0 flex-1 max-h-[46vh]" />
        <ProjetoChatComposer
          compact
          disabled={adicionarNota.isPending}
          onSend={({ mensagem, file }) => adicionarNota.mutate({ leadId, mensagem, file })}
        />
      </DialogContent>
    </Dialog>
  )
}
